// Cassette version — press a case standing in the oak rack: it rises out of
// its slot, turns on its side and flies into the deck on the cabinet's
// silver recorder; the tape slides into the open bay; the reels turn, the
// equaliser beside the speaker lights up and the liner notes beside it are that tape's: side A the
// text, a track per paragraph; side B the facts and links. ◀◀ / ▶▶ move
// between tracks, ■ stops, ⏏ sends the tape back to its slot. With no
// project in, the house tape (the bio) is in the deck. While it plays, a
// voice reads the tape aloud (clips made at build time, see src/speech.mjs):
// the title and its line, then track after track; the VOZ key mutes it.
import { reduceMotion, scrollAlong, glideTo } from './ar-common.js';

const bb = document.querySelector('.cabinet');
const panel = bb.querySelector('.panel');
const well = bb.querySelector('.tdeck__well');
const liner = document.querySelector('.liner');
const out = liner.querySelector('.liner__out');
const state = bb.querySelector('.bb__state');
const osdMode = bb.querySelector('.osd__mode');
const osdNo = bb.querySelector('.osd__no');
const osdCount = bb.querySelector('.osd__count');
const dialTitle = bb.querySelector('.osd__title');
const strip = bb.querySelector('.strip__text');
const cta = document.querySelector('.studio__cta');
const keys = Object.fromEntries([...bb.querySelectorAll('[data-key]')].map((b) => [b.dataset.key, b]));
const house = document.querySelector('.cas-bio');
const items = [...document.querySelectorAll('.cas-item')];
const L = bb.dataset;

let loaded = null;   // the project in the deck (null: the house tape)
let busy = false;
let playing = false;
let tracks = [];
let track = 0;
let count = 0;
let tick = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion.matches ? 0 : ms));
const press = (key) => {
  key.classList.add('is-pressed');
  setTimeout(() => key.classList.remove('is-pressed'), 160);
};

/* ---------- what is in the deck ---------- */

// The tape in the well and its liner notes, which take its J-card colour and
// lettering.
function load(src) {
  const tape = src.querySelector('.cas-item__tape .cassette').cloneNode(true);
  well.replaceChildren(tape);
  out.replaceChildren(...[...src.querySelector('.cas-item__notes').children].map((n) => n.cloneNode(true)));
  out.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  liner.className = ['liner', ...[...tape.classList].filter((c) => /^(jc|ty)--/.test(c))].join(' ');
  tracks = [...out.querySelectorAll('.track')];
  dialTitle.textContent = out.querySelector('.notes__title')?.textContent ?? '';
  strip.textContent = `${out.querySelector('.notes__code')?.textContent.split('·')[0].trim() ?? ''} · ${dialTitle.textContent}`;
  count = 0;
  showCount();
  setTrack(0);
  hush();
  fresh = true;
}

function setTrack(i) {
  track = Math.max(0, Math.min(tracks.length - 1, i));
  tracks.forEach((t, k) => t.classList.toggle('is-current', k === track));
  osdNo.textContent = tracks[track]?.dataset.no ?? 'A1';
  bb.style.setProperty('--p', tracks.length > 1 ? track / (tracks.length - 1) : 0);
  keys.rew.setAttribute('aria-disabled', String(track === 0));
  keys.ff.setAttribute('aria-disabled', String(track === tracks.length - 1));
}

/* ---------- the equaliser beside the speaker ----------
   A bar of fluorescent segments per band: dark when stopped; while it plays
   each band jumps about its own level (more in the bass), lit white-green
   with a blurred green afterglow above that is held a moment and then sinks;
   while it winds they all race; when it stops they fall back to nothing. */
const bands = [...bb.querySelectorAll('.eq__band')].map((b) => ({ leds: [...b.children], lvl: 0, peak: 0, hold: 0 }));
let wframe = 0;
let wlast = -1e9;
function trace(now = 0) {
  const fast = bb.classList.contains('is-ff') || bb.classList.contains('is-rew');
  const on = playing || fast;
  if (now - wlast >= 70) {
    wlast = now;
    bands.forEach((b, i) => {
      const n = b.leds.length;
      const base = fast ? .78 : .64 - i * .05;
      let to = 0;
      if (on) to = reduceMotion.matches ? base : base + (Math.random() - .5) * (fast ? .5 : .75) + Math.sin(now / 260 + i * 1.3) * .12;
      to = Math.round(n * Math.min(1, Math.max(0, to)));
      b.lvl = to >= b.lvl || reduceMotion.matches ? to : b.lvl - 1;
      // the afterglow: green over the level, three segments up while it
      // plays, held a moment at its height, then sinking a segment a frame
      const glow = on ? Math.min(n, b.lvl + 3) : b.lvl;
      if (glow >= b.peak) { b.peak = glow; b.hold = 6; } else if (b.hold > 0) b.hold--; else b.peak--;
      if (reduceMotion.matches) b.peak = glow;
      const solid = Math.max(0, b.lvl - 2);
      b.leds.forEach((l, k) => {
        const tr = k >= solid && k < b.peak;
        l.classList.toggle('on', k < solid);
        l.classList.toggle('tr', tr);
        if (tr) l.style.setProperty('--a', (1 - (k - solid) / Math.max(1, b.peak - solid) * .55).toFixed(2));
      });
    });
  }
  const moving = on || bands.some((b) => b.lvl || b.peak);
  if (moving && !reduceMotion.matches) wframe = requestAnimationFrame(trace);
}
const retrace = () => { cancelAnimationFrame(wframe); wlast = -1e9; trace(performance.now()); };

/* ---------- the voice ----------
   Every part of a card that is read aloud carries its clip in data-say (the
   card's head on .jcard, each track on its own). A new tape starts with its
   head (title, line, quote), then the lit track, and goes on to the next
   when one ends; after the last the tape stops. ❚❚ holds the voice mid-word
   and goes on from there; ■ goes back to the start of the track; ◀◀ / ▶▶ and
   ⏏ cut it short. The VOZ key mutes it (remembered in this browser). A clip
   that will not play leaves the tape playing on, silent. */
const muteKey = bb.querySelector('.mute');
const voice = new Audio();
voice.preload = 'none';
let muted = false;
try { muted = localStorage.getItem('cassette-muted') === '1'; } catch { /* storage off */ }
let fresh = true;     // the next reading starts with the card's head
let reading = null;   // what the voice is on: 'head', a track's index, or nothing

// Cut: the next reading starts the lit track from its beginning.
function hush() {
  reading = null;
  voice.pause();
}

function cue(what) {
  const src = what === 'head' ? out.querySelector('.jcard')?.dataset.say : tracks[what]?.dataset.say;
  if (what === 'head') fresh = false;
  if (!src) { reading = what; next(); return; }
  reading = what;
  voice.src = src;
  voice.play().catch(() => { /* not allowed or not there: silent */ });
}

// Read (or go on reading) what is lit, if the tape is playing and not muted.
function speak() {
  if (!playing || muted || !tracks.length) return;
  if (reading !== null) { voice.play().catch(() => {}); return; }
  cue(fresh && out.querySelector('.jcard')?.dataset.say ? 'head' : track);
}

// A clip is over: the head leads into the lit track, a track into the next.
function next() {
  if (reading === null || !playing) return;
  if (reading === 'head') { cue(track); return; }
  if (track < tracks.length - 1) {
    setTrack(track + 1);
    const r = tracks[track].getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) glideTo(tracks[track], 'nearest');
    cue(track);
  } else {
    play(false);
    setTrack(0);
    state.textContent = L.stopped;
  }
}
voice.addEventListener('ended', next);
voice.addEventListener('error', () => { reading = null; });

function setMuted(on) {
  muted = on;
  muteKey.setAttribute('aria-pressed', String(on));
  try { localStorage.setItem('cassette-muted', on ? '1' : '0'); } catch { /* storage off */ }
  if (on) voice.pause(); else speak();
}
muteKey.setAttribute('aria-pressed', String(muted));
muteKey.addEventListener('click', () => setMuted(!muted));
addEventListener('pagehide', hush);

const drums = [...bb.querySelectorAll('.counter__win b')];
const showCount = () => {
  const s = String(count).padStart(3, '0');
  osdCount.textContent = s;
  drums.forEach((d, i) => { d.textContent = s[i]; });
};
let paused = false;
// hold: stop the tape but keep the voice's place (❚❚)
function play(on, hold = false) {
  const was = playing;
  playing = on;
  paused = false;
  bb.classList.toggle('is-playing', on);
  keys.play.setAttribute('aria-pressed', String(on));
  keys.pause.setAttribute('aria-pressed', 'false');
  osdMode.textContent = on ? '▶ PLAY' : '■ STOP';
  clearInterval(tick);
  if (on) tick = setInterval(() => { count = (count + 1) % 1000; showCount(); }, 1000);
  retrace();
  if (on && !was) speak();
  if (!on) (hold ? voice.pause() : hush());
}

// ◀◀ / ▶▶: the reels whirr, the counter runs, the next track lights up.
async function wind(dir) {
  const to = track + dir;
  if (busy || to < 0 || to >= tracks.length) return;
  hush();
  bb.classList.add(dir > 0 ? 'is-ff' : 'is-rew');
  retrace();
  count = (count + dir * 37 + 1000) % 1000;
  showCount();
  await sleep(420);
  bb.classList.remove('is-ff', 'is-rew');
  retrace();
  setTrack(to);
  fresh = false;
  speak();
  const r = tracks[track].getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) glideTo(tracks[track], 'nearest');
}

keys.play.addEventListener('click', () => { press(keys.play); if (!busy) play(true); });
keys.stop.addEventListener('click', () => { press(keys.stop); play(false); });
// ❚❚ holds the tape where it is; ❚❚ again (or ▶) goes on from there
keys.pause.addEventListener('click', () => {
  if (busy) return;
  if (playing) {
    play(false, true);
    paused = true;
    keys.pause.setAttribute('aria-pressed', 'true');
    osdMode.textContent = '❚❚ PAUSE';
  } else if (paused) play(true);
});
keys.ff.addEventListener('click', () => { press(keys.ff); wind(1); });
keys.rew.addEventListener('click', () => { press(keys.rew); wind(-1); });
keys.eject.addEventListener('click', async () => {
  press(keys.eject);
  if (busy) return;
  if (loaded) { eject(); return; }
  // the house tape stays: it only pops up a little and settles back
  const tape = well.firstElementChild;
  if (!tape || reduceMotion.matches) return;
  busy = true;
  await tape.animate([{ transform: 'none' }, { transform: 'translateY(-14%)', offset: .35 }, { transform: 'none' }], { duration: 520, easing: 'ease-out' }).finished;
  busy = false;
});

/* ---------- the case in flight ---------- */

// Transforms about the centre of the copy (w × h), placed with its centre at (cx, cy).
// k: one scale, or [across, along] the case (applied in its own frame, after the turn)
const at = (cx, cy, w, h, deg, k) => `translate(${cx - w / 2}px, ${cy - h / 2}px) rotate(${deg}deg) scale(${[].concat(k).join(', ')})`;

// A fixed copy of a case's spine, at its place in the rack.
function ghostOf(spine, r = spine.getBoundingClientRect()) {
  const g = spine.cloneNode(true);
  g.classList.add('ghost');
  Object.assign(g.style, { width: `${r.width}px`, height: `${r.height}px`, transform: at(r.left + r.width / 2, r.top + r.height / 2, r.width, r.height, 0, 1) });
  document.body.append(g);
  return g;
}

// Where an element will be once the page has scrolled by dy (measured there
// and back before the next paint, so nothing is seen).
function rectAt(el, dy = 0) {
  const y0 = scrollY;
  if (dy) scrollTo({ top: y0 + dy, behavior: 'instant' });
  const r = el.getBoundingClientRect();
  if (dy) scrollTo({ top: y0, behavior: 'instant' });
  return r;
}

// From the rack (r) onto the spine along the top of the liner notes (t): up
// out of its slot, over in an arc, turning on its side, and down onto the
// spine, stretched to its size (as long as the card is wide, as tall as the
// spine is).
function arc(r, t) {
  const w = r.width, h = r.height;
  const k = [t.height / w, t.width / h];
  const a = [r.left + w / 2, r.top + h / 2];
  const b = [t.left + t.width / 2, t.top + t.height / 2];
  const up = a[1] - h * .35;
  const top = Math.min(up, b[1]) - Math.min(120, innerHeight * .12);
  return [
    { transform: at(a[0], a[1], w, h, 0, 1), opacity: 1, offset: 0 },
    { transform: at(a[0], up, w, h, 0, 1), opacity: 1, offset: .16 },
    { transform: at((a[0] + b[0]) / 2, top, w, h, -50, [(1 + k[0]) / 2, (1 + k[1]) / 2]), opacity: 1, offset: .5 },
    { transform: at(b[0], b[1] - t.height * .6, w, h, -90, k), opacity: 1, offset: .8 },
    { transform: at(b[0], b[1], w, h, -90, k), opacity: 1, offset: 1 }
  ];
}
const fade = (el, out) => (reduceMotion.matches || !el ? Promise.resolve()
  : el.animate([{ opacity: out ? 1 : 0 }, { opacity: out ? 0 : 1 }], { duration: 160, easing: 'ease', fill: 'forwards' }).finished);

// No door: the tape slides up out of the bay's slot, and down into it.
const lift = (el) => (reduceMotion.matches || !el ? Promise.resolve()
  : el.animate([{ transform: 'none' }, { transform: 'translateY(-118%)' }], { duration: 360, easing: 'ease-in', fill: 'forwards' }).finished);
const drop = (el) => (reduceMotion.matches || !el ? Promise.resolve()
  : el.animate([{ transform: 'translateY(-118%)' }, { transform: 'none' }], { duration: 460, easing: 'cubic-bezier(.2, .8, .2, 1)' }).finished);

// How far the page must scroll to show the top of the liner notes under the
// header (0 if the spine along its top is already in view).
const spineOf = () => liner.querySelector('.hspine');
function linerScroll() {
  const r = spineOf().getBoundingClientRect();
  const head = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head-h')) || 0;
  if (r.top >= head && r.bottom <= innerHeight) return 0;
  const max = document.documentElement.scrollHeight - innerHeight;
  const to = Math.max(0, Math.min(max, scrollY + liner.getBoundingClientRect().top - head - 24));
  return Math.round(to - scrollY);
}

/* ---------- insert and eject ---------- */

const oneColumn = matchMedia('(max-width: 63.99em)');

async function insert(item) {
  if (busy || item === loaded) return;
  busy = true;
  play(false);
  if (loaded) await eject({ quiet: true });
  cta.hidden = true;
  const spine = item.querySelector('.cspine');
  const r = spine.getBoundingClientRect();
  const g = ghostOf(spine, r);
  item.classList.add('is-out');
  const dy = linerScroll();
  scrollAlong(dy, 700);
  const gone = lift(well.firstElementChild);
  if (!reduceMotion.matches) {
    await g.animate(arc(r, rectAt(spineOf(), dy)), { duration: 1300, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' }).finished;
  }
  await gone;
  // the case lands on the card: its spine is now the card's
  load(item);
  await fade(g, true);
  g.remove();
  await drop(well.firstElementChild);
  loaded = item;
  await sleep(250);
  play(true);
  state.textContent = `${L.playing}: ${dialTitle.textContent}`;
  busy = false;
  // one column: the notes are under the deck, so the page goes to them
  if (oneColumn.matches) { await sleep(600); glideTo(liner, 'start'); }
}

async function eject({ quiet = false } = {}) {
  if (!loaded) return;
  const item = loaded;
  loaded = null;
  play(false);
  osdMode.textContent = '⏏ EJECT';
  const gone = lift(well.firstElementChild);
  // the case lifts off the card and goes back to its slot
  const spine = item.querySelector('.cspine');
  const r = spine.getBoundingClientRect();
  if (!reduceMotion.matches) {
    const t = spineOf().getBoundingClientRect();
    const g = ghostOf(spine, r);
    const frames = arc(r, t).reverse().map((f) => ({ ...f, offset: 1 - f.offset }));
    const visible = r.bottom > 0 && r.top < innerHeight;
    if (!visible) frames.splice(2, frames.length, { ...frames[1], opacity: 0, offset: 1 });
    const flight = g.animate(frames, { duration: 1100, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' }).finished;
    if (!quiet) load(house);
    await flight;
    g.remove();
  }
  await gone;
  item.classList.remove('is-out');
  if (quiet) return;
  if (reduceMotion.matches) load(house);
  await drop(well.firstElementChild);
  cta.hidden = false;
  state.textContent = L.ejected;
  item.querySelector('.slot__case').focus({ preventScroll: true });
}

items.forEach((item) => {
  item.querySelector('.slot__case').addEventListener('click', async () => {
    if (busy) return;
    if (item === loaded) { busy = true; await eject(); busy = false; } else insert(item);
  });
});

// Esc ejects the tape (unless it is closing the language list).
addEventListener('keydown', async (e) => {
  if (e.key !== 'Escape' || !loaded || busy) return;
  if (typeof liner.showPopover === 'function' && document.querySelector('.lang__menu:popover-open')) return;
  busy = true; await eject(); busy = false;
});

/* ---------- the racks' empty slots ----------
   Two racks, the projects and under them the links. The rows run as wide as
   the page; the slots the tapes leave at the end of the last row are still
   slots (empty ones), as in a real cabinet. */
function fillRack(slots) {
  slots.querySelectorAll('.slot--fill').forEach((s) => s.remove());
  const cols = getComputedStyle(slots).gridTemplateColumns.split(' ').length;
  const n = slots.children.length;
  const rest = (cols - (n % cols)) % cols;
  for (let i = 0; i < rest; i++) {
    const li = document.createElement('li');
    li.className = 'slot slot--empty slot--fill';
    li.setAttribute('aria-hidden', 'true');
    slots.append(li);
  }
}
document.querySelectorAll('.rack__slots').forEach((slots) => {
  fillRack(slots);
  new ResizeObserver(() => fillRack(slots)).observe(slots);
});

/* ---------- header links ---------- */
// Bio: the house tape (ejecting the project if one is in) and its notes.
// Projects: the rack.
document.querySelectorAll('.masthead__nav [data-go]').forEach((a) => {
  a.addEventListener('click', async (e) => {
    e.preventDefault();
    if (a.dataset.go === 'projects') { glideTo(document.querySelector('.rack'), 'center'); return; }
    await glideTo(oneColumn.matches ? panel : document.querySelector('.studio'), 'start');
    if (loaded && !busy) { busy = true; await eject(); busy = false; }
  });
});

/* ---------- switch on ---------- */
load(house);
retrace();
