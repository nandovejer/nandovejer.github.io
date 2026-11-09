#!/bin/sh
# Sets up the cassette's voice for the build, once per machine: a Python venv
# with Piper (piper-tts) and the two voices, in ~/.cache/tts (or $TTS_HOME).
# Needs python3 (with venv), curl and ffmpeg (with libopus).
#
#   es_ES-davefx-medium  CC0         https://huggingface.co/rhasspy/piper-voices/tree/main/es/es_ES/davefx/medium
#   en_US-joe-medium     CC0         https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US/joe/medium
set -eu
home="${TTS_HOME:-$HOME/.cache/tts}"
mkdir -p "$home"
command -v ffmpeg >/dev/null || { echo "ffmpeg is missing (apt install ffmpeg)"; exit 1; }
[ -x "$home/venv/bin/python" ] || python3 -m venv "$home/venv"
"$home/venv/bin/pip" install -q --upgrade piper-tts
base=https://huggingface.co/rhasspy/piper-voices/resolve/main
for v in es/es_ES/davefx/medium/es_ES-davefx-medium en/en_US/joe/medium/en_US-joe-medium; do
  name=$(basename "$v")
  for ext in onnx onnx.json; do
    [ -s "$home/$name.$ext" ] || curl -sSLf -o "$home/$name.$ext" "$base/$v.$ext"
  done
  echo "✓ $name"
done
echo "✓ voice ready in $home — node build.mjs will now read the tapes aloud"
