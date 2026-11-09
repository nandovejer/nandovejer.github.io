"""Reads the cassette's tracks aloud with Piper and saves them as Opus.

Called by build.mjs (never by hand): a JSON job list comes in on stdin,

  { "voices": { "es": { "model": ".../es_ES-davefx-medium.onnx", "length_scale": 1, ... } },
    "pause": { "sentence": .3, "part": .65, "jitter": .07, "lead": .15, "tail": .3 },
    "jobs": [ { "lang": "es", "out": "audio/es/<id>.opus", "parts": ["…", "…"] } ] }

and each job becomes one file: its parts (a title, a paragraph, a fact) read
in turn. Piper hands back one chunk per sentence; the pauses between them are
put in here, a little longer between parts than between sentences and never
quite the same twice, so the reading breathes instead of ticking. Then
ffmpeg evens out the loudness and writes Opus (mono, 32 kbps, 48 kHz).

Setup: tools/voice-setup.sh (a venv with piper-tts and the voices in
~/.cache/tts).
"""
import json
import os
import random
import subprocess
import sys

import numpy as np
from piper import PiperVoice, SynthesisConfig

spec = json.load(sys.stdin)
pause = spec["pause"]
voices = {}


def voice_for(lang):
    if lang not in voices:
        v = spec["voices"][lang]
        voice = PiperVoice.load(v["model"])
        cfg = SynthesisConfig(
            length_scale=v.get("length_scale"),
            noise_scale=v.get("noise_scale"),
            noise_w_scale=v.get("noise_w_scale"),
        )
        voices[lang] = (voice, cfg)
    return voices[lang]


def silence(seconds, rate):
    return np.zeros(int(max(0, seconds) * rate), dtype=np.int16)


def render(job):
    voice, cfg = voice_for(job["lang"])
    rate = voice.config.sample_rate
    rnd = random.Random(job["out"])  # the same file always breathes the same way
    gap = lambda s: silence(s + rnd.uniform(-pause["jitter"], pause["jitter"]), rate)
    pieces = [silence(pause["lead"], rate)]
    for i, part in enumerate(job["parts"]):
        if i:
            pieces.append(gap(pause["part"]))
        for k, chunk in enumerate(voice.synthesize(part, syn_config=cfg)):
            if k:
                pieces.append(gap(pause["sentence"]))
            pieces.append(chunk.audio_int16_array)
    pieces.append(silence(pause["tail"], rate))
    pcm = np.concatenate(pieces).astype("<i2").tobytes()
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y",
         "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", "pipe:0",
         "-af", "loudnorm=I=-18:TP=-1.5:LRA=11", "-ar", "48000",
         "-c:a", "libopus", "-b:a", "32k", "-application", "voip",
         "-map_metadata", "-1", "-fflags", "+bitexact", "-f", "ogg", job["out"] + ".part"],
        input=pcm, check=True)
    # only a whole file takes the name (a half-written one would pass for done)
    os.replace(job["out"] + ".part", job["out"])


jobs = spec["jobs"]
for n, job in enumerate(jobs, 1):
    render(job)
    print(f"♪ {n}/{len(jobs)} {job['out']}", flush=True)
