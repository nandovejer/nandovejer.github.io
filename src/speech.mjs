// The cassette's voice, made at build time.
//
// Every tape in the Cassette version is read aloud: a clip for its head (the
// title, its line, its quote) and one per track. Here the build works out what
// each clip says (the same text the liner prints, with a pronunciation table
// for words a Spanish or English reader would trip on) and names the clip by
// a hash of everything that shapes its sound: the words, the voice and its
// settings, the pauses. So a clip is made once; when a text changes, its name
// changes, the new one is made and the old one goes.
//
//   voice.clip(lang, parts) → the clip's URL (from a page in cassette/<lang>/)
//   voice.finish({ check, noAudio }) → makes the missing clips with Piper
//     (tools/voice.py), deletes the ones nothing uses; with `check`, only
//     reports both.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Bump to make every clip again (a change in voice.py the hash cannot see).
const VERSION = 1;

// The voices (Piper models in ~/.cache/tts, see tools/voice-setup.sh) and how
// they read: the model's own pace, a little more give in the length of each
// sound than its default so it doesn't tick along.
export const VOICES = {
  es: { model: 'es_ES-davefx-medium', length_scale: 1, noise_scale: 0.7, noise_w_scale: 0.95 },
  en: { model: 'en_US-joe-medium', length_scale: 1, noise_scale: 0.7, noise_w_scale: 0.95 }
};
// Seconds of silence: between sentences, between parts (title, paragraphs,
// facts), give or take `jitter`; before the first word and after the last.
const PAUSE = { sentence: 0.3, part: 0.65, jitter: 0.07, lead: 0.15, tail: 0.3 };

const DIR = 'assets/audio';

/* ---------- what a clip says ---------- */

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#x?[\da-f]+|\w+);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(parseInt(e.slice(1).replace(/^x/i, '0x'))) : entities[e] ?? m);
const text = (html) => decode(String(html).replace(/<[^>]+>/g, ' '));
const tidy = (s) => s.replace(/\s+/g, ' ').replace(/\s·\s/g, ', ').trim();
const stop = (s) => (/[.!?…:”"]$/.test(s) ? s : `${s}.`);
const say = (parts) => parts.map((p) => tidy(text(p))).filter(Boolean).map(stop);

// A track: its title, then each paragraph, fact ("label: value") and social
// profile, in order. The demo and code buttons say nothing worth hearing.
export function trackParts({ title, body }) {
  const html = String(body).replace(/<ul class="links">[\s\S]*?<\/ul>/g, '');
  const facts = [...html.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g)].map(([, k, v]) => `${tidy(text(k))}: ${tidy(text(v))}`);
  const rest = [...html.replace(/<dl[\s\S]*?<\/dl>/g, '').matchAll(/<(p|li)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(([, , x]) => x);
  return say([title ?? '', ...rest, ...facts]);
}

// The head: the title, its line, its quote.
export const headParts = ({ name, use, year, quote }) => say([name, `${use ?? ''}${year ? ` · ${year}` : ''}`, quote ?? '']);

/* ---------- how to say it ----------
   data/pronounce.json: per language, a word as written → as it should
   sound, spelled the way the voice reads its own language. Whole words only,
   case as written; longer entries first, so "Tech Lead" beats "Tech". */
const table = (root) => {
  const all = JSON.parse(readFileSync(join(root, 'data/pronounce.json'), 'utf8'));
  return Object.fromEntries(Object.entries(all).map(([lang, words]) => {
    const keys = Object.keys(words).filter((k) => !k.startsWith('//')).sort((a, b) => b.length - a.length);
    if (!keys.length) return [lang, (s) => s];
    const re = new RegExp(`(?<![\\p{L}\\p{N}])(${keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}])`, 'gu');
    return [lang, (s) => s.replace(re, (m) => words[m])];
  }));
};

/* ---------- the clips ---------- */

export function createVoice(root) {
  const speak = table(root);
  const clips = new Map(); // id → { lang, parts }

  function clip(lang, parts) {
    if (!parts.length) return null;
    const spoken = parts.map(speak[lang] ?? ((s) => s));
    const id = createHash('sha1')
      .update(JSON.stringify({ v: VERSION, voice: VOICES[lang], pause: PAUSE, lang, parts: spoken }))
      .digest('hex').slice(0, 16);
    clips.set(`${lang}/${id}`, { lang, parts: spoken });
    return `../../${DIR}/${lang}/${id}.opus`;
  }

  function finish({ check = false, noAudio = false, list = false } = {}) {
    const base = join(root, DIR);
    const have = new Set(existsSync(base) ? readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .flatMap((d) => readdirSync(join(base, d.name)).map((f) => `${d.name}/${f}`)) : []);
    const missing = [...clips.keys()].filter((k) => !have.has(`${k}.opus`));
    const orphans = [...have].filter((f) => !clips.has(f.replace(/\.opus$/, '')));
    if (list) for (const [k, c] of clips) console.log(`\n${k}\n  ${c.parts.join('\n  ')}`);
    if (check) return { missing, orphans };

    for (const f of orphans) { rmSync(join(base, f)); console.log('✗', `${DIR}/${f}`); }
    if (!missing.length) return { missing, orphans };
    if (noAudio) {
      console.warn(`! ${missing.length} clip(s) not made (--no-audio): the check will fail until they are`);
      return { missing, orphans };
    }

    const home = process.env.TTS_HOME ?? join(homedir(), '.cache/tts');
    const python = process.env.TTS_PYTHON ?? join(home, 'venv/bin/python');
    const voices = Object.fromEntries(Object.entries(VOICES).map(([lang, v]) => [lang, { ...v, model: join(home, `${v.model}.onnx`) }]));
    const lacking = [python, ...Object.values(voices).map((v) => v.model)].filter((f) => !existsSync(f));
    if (lacking.length) {
      throw new Error(`The voice is not set up (missing ${lacking.join(', ')}).\n  Run tools/voice-setup.sh, or build with --no-audio to skip the clips.`);
    }
    const jobs = missing.map((k) => {
      const { lang, parts } = clips.get(k);
      mkdirSync(join(base, lang), { recursive: true });
      return { lang, parts, out: join(base, `${k}.opus`) };
    });
    console.log(`♪ reading ${jobs.length} clip(s) aloud…`);
    const run = spawnSync(python, [join(root, 'tools/voice.py')], {
      input: JSON.stringify({ voices, pause: PAUSE, jobs }), stdio: ['pipe', 'inherit', 'inherit']
    });
    if (run.status !== 0) throw new Error(`tools/voice.py failed (exit ${run.status ?? run.signal})`);
    return { missing: [], orphans };
  }

  return { clip, finish };
}
