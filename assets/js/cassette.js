// Cassette version — press a case standing in the oak rack: it fades out of
// its slot and its tape fades into the deck; the reels turn, the level
// meter under the speaker lights up and the liner notes beside it are that
// tape's: side A the text, a track per paragraph; side B the facts and links.
// ◀◀ / ▶▶ move between tracks, ■ stops, ⏏ sends the tape back to its slot.
// With no project in, the house tape (the bio, "Sobre mí") is in the deck; it
// stands first in the rack and its slot is empty while it plays. ⏏ takes the
// page down to the rack. While it
// plays, a voice reads the tape aloud (clips made at build time, see
// src/speech.mjs): the title and its line, then track after track; the VOZ
// key mutes it, 2× doubles its speed, SHUFFLE puts in a tape at random,
// SIDE flips to the other side, LINK copies the tape's address, and
// REPEAT starts the tape again when it ends.
import { reduceMotion, scrollAlong, glideTo } from './ar-common.js';

const bb = document.querySelector('.cabinet');
const panel = bb.querySelector('.panels');
const well = bb.querySelector('.tdeck__well');
const liner = document.querySelector('.liner');
const spineBox = document.querySelector('.studio__spine');
const oneColumn = matchMedia('(max-width: 47.99em)');
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
const tapes = items.filter((it) => it !== house);   // the projects
// down to the rack: the line asking to pick a tape whole just under the
// masthead (html's scroll-padding in chrome.css), the rack's heading under
// it; with a project in (the line hidden), the heading
const toRack = () => glideTo(cta.hidden ? document.querySelector('.rack') : cta, 'start');
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
  placeSpine();
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

// The case's spine: along the top of the liner notes in two columns; in one
// column it heads the page, above the deck (the notes go under the deck).
function placeSpine() {
  // the notes' own spine if they have one (a tape just loaded), else the one placed before
  const h = out.querySelector('.hspine') ?? spineBox.querySelector('.hspine');
  if (!h) return;
  if (oneColumn.matches) spineBox.replaceChildren(h);
  else { spineBox.replaceChildren(); out.querySelector('.jcard')?.prepend(h); }
}
oneColumn.addEventListener('change', placeSpine);

function setTrack(i) {
  track = Math.max(0, Math.min(tracks.length - 1, i));
  tracks.forEach((t, k) => t.classList.toggle('is-current', k === track));
  osdNo.textContent = tracks[track]?.dataset.no ?? 'A1';
  bb.style.setProperty('--p', tracks.length > 1 ? track / (tracks.length - 1) : 0);
  keys.rew.setAttribute('aria-disabled', String(track === 0));
  keys.ff.setAttribute('aria-disabled', String(track === tracks.length - 1));
}

/* ---------- the level meter under the speaker ----------
   Eight columns of LEDs: the left and right channels, the voice and the
   tape, then four frequency bands (the bass high and slow, the treble low
   and nervous). Dark when stopped; while it plays each jumps about its own level (the
   voice column lively, and dark while the voice is silent; the tape steady),
   the highest LED it reached held a moment before it falls; while it winds
   they race; when it stops they fall back to nothing. */
const PROFILE = [[.62, .5], [.62, .5], [.5, .8], [.56, .3], [.72, .3], [.6, .45], [.5, .6], [.4, .7]];   // [level, how much it jumps] per column
const bands = [...bb.querySelectorAll('.vu__col')].map((b) => ({ leds: [...b.children], lvl: 0, peak: 0, hold: 0 }));
let wframe = 0;
let wlast = -1e9;
function trace(now = 0) {
  const fast = bb.classList.contains('is-ff') || bb.classList.contains('is-rew');
  const on = playing || fast;
  if (now - wlast >= 70) {
    wlast = now;
    bands.forEach((b, i) => {
      const n = b.leds.length;
      const [lvl, jump] = PROFILE[i] ?? PROFILE[0];
      const base = fast ? .8 : lvl;
      let to = 0;
      if (on) to = reduceMotion.matches ? base : base + (Math.random() - .5) * (fast ? .3 : jump) + Math.sin(now / 240 + i * .9) * .1;
      if (i === 2 && !fast && (muted || voice.paused)) to = 0;
      to = Math.round(n * Math.min(1, Math.max(0, to)));
      b.lvl = to >= b.lvl || reduceMotion.matches ? to : b.lvl - 1;
      if (b.lvl >= b.peak) { b.peak = b.lvl; b.hold = 10; } else if (b.hold > 0) b.hold--; else b.peak--;
      if (reduceMotion.matches) b.peak = b.lvl;
      b.leds.forEach((l, k) => l.classList.toggle('on', k < b.lvl || (k === b.peak - 1 && b.peak > 0)));
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
  } else if (latched.repeat) {
    // REPEAT: back to the first track and on
    setTrack(0);
    const r = tracks[0].getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) glideTo(tracks[0], 'nearest');
    cue(0);
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

// 2× and REPEAT: keys that latch down (remembered in this browser too)
const latched = { double: false, repeat: false };
bb.querySelectorAll('[data-latch]').forEach((k) => {
  const name = k.dataset.latch;
  try { latched[name] = localStorage.getItem(`cassette-${name}`) === '1'; } catch { /* storage off */ }
  k.setAttribute('aria-pressed', String(latched[name]));
  k.addEventListener('click', () => {
    latched[name] = !latched[name];
    k.setAttribute('aria-pressed', String(latched[name]));
    try { localStorage.setItem(`cassette-${name}`, latched[name] ? '1' : '0'); } catch { /* storage off */ }
    tune();
  });
});
// 2×: the voice reads at double speed, the reels turning with it
function tune() {
  const rate = latched.double ? 2 : 1;
  voice.defaultPlaybackRate = rate;
  voice.playbackRate = rate;
  bb.style.setProperty('--rate', rate.toFixed(2));
}
tune();
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
  busy = true;
  if (loaded) await eject();
  else if (!reduceMotion.matches && well.firstElementChild) {
    // the house tape stays: it only pops up a little and settles back
    await well.firstElementChild.animate([{ transform: 'none' }, { transform: 'translateY(-14%)', offset: .35 }, { transform: 'none' }], { duration: 520, easing: 'ease-out' }).finished;
  }
  busy = false;
  // and the page goes down to the rack, to pick another
  toRack();
});

/* ---------- the change of tape ----------
   No flight: the case fades out of its slot in the rack (and back into it
   when it comes out), and the tape in the deck and the liner notes beside it
   fade out and in again as the tape changes. */

const fade = (el, out, ms = 260) => (reduceMotion.matches || !el ? Promise.resolve()
  : el.animate([{ opacity: out ? 1 : 0 }, { opacity: out ? 0 : 1 }], { duration: ms, easing: 'ease', fill: 'forwards' }).finished);

// The tape in the deck and the notes beside it: out, changed, in again.
async function swap(src) {
  await Promise.all([fade(well, true), fade(out, true), fade(spineBox, true)]);
  load(src);
  await Promise.all([fade(well, false, 340), fade(out, false, 340), fade(spineBox, false, 340)]);
}

// How far the page must scroll to show the top of the liner notes under the
// header (0 if the spine along its top is already in view).
// (in one column, the spine heading the page above the deck)
const spineOf = () => spineBox.querySelector('.hspine') ?? liner.querySelector('.hspine');
function linerScroll() {
  const r = spineOf().getBoundingClientRect();
  const head = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--head-h')) || 0;
  if (r.top >= head && r.bottom <= innerHeight) return 0;
  const max = document.documentElement.scrollHeight - innerHeight;
  const top = (oneColumn.matches ? spineBox : liner).getBoundingClientRect().top;
  const to = Math.max(0, Math.min(max, scrollY + top - head - 24));
  return Math.round(to - scrollY);
}

/* ---------- insert and eject ---------- */


// The address shows the tape in the deck (#id), so it can be shared or
// bookmarked; with the house tape in, no hash.
const mark = (item) => history.replaceState(null, '', `${location.pathname}${location.search}${item ? `#${item.id}` : ''}`);

async function insert(item) {
  if (busy || item === loaded || item === house) return;
  busy = true;
  mark(item);
  play(false);
  // the house tape leaves the deck: its case fades back into its slot
  if (!loaded) { house.classList.remove('is-out'); fade(house.querySelector('.cspine'), false); }
  if (loaded) await eject({ quiet: true });
  cta.hidden = true;
  // the case fades out of its slot; the page goes up to the deck
  await fade(item.querySelector('.cspine'), true);
  item.classList.add('is-out');
  // the page goes up to the spine: along the top of the notes beside the deck
  // in two columns, heading the deck in one; going up, the masthead comes back
  // as it does when the visitor scrolls up
  const dy = linerScroll();
  if (dy < 0) document.querySelector('.masthead')?.classList.remove('is-hidden');
  scrollAlong(dy, 600);
  await swap(item);
  loaded = item;
  await sleep(150);
  play(true);
  state.textContent = `${L.playing}: ${dialTitle.textContent}`;
  busy = false;
}

// The tape comes out of the deck: its case fades back into its slot in the
// rack and the house tape fades into the deck (unless another tape is going in).
async function eject({ quiet = false } = {}) {
  if (!loaded) return;
  const item = loaded;
  loaded = null;
  play(false);
  osdMode.textContent = '⏏ EJECT';
  const spine = item.querySelector('.cspine');
  item.classList.remove('is-out');
  if (!quiet) mark(null);
  const back = fade(spine, false);
  if (quiet) { await back; return; }
  // the house tape goes back in: its case fades out of its slot
  const home = fade(house.querySelector('.cspine'), true).then(() => house.classList.add('is-out'));
  await Promise.all([back, home, swap(house)]);
  cta.hidden = false;
  state.textContent = L.ejected;
  item.querySelector('.slot__case').focus({ preventScroll: true });
}

items.forEach((item) => {
  item.querySelector('.slot__case').addEventListener('click', async () => {
    if (busy) return;
    // the project in the deck, or the house tape while a project plays: out it comes
    if (item === loaded || (item === house && loaded)) { busy = true; await eject(); busy = false; } else insert(item);
  });
});

// The keys that spring back: a tape at random, the other side, the link.
const acts = Object.fromEntries([...bb.querySelectorAll('[data-act]')].map((k) => [k.dataset.act, k]));
acts.shuffle.addEventListener('click', () => {
  press(acts.shuffle);
  const pool = tapes.filter((it) => it !== loaded);
  if (pool.length && !busy) insert(pool[Math.floor(Math.random() * pool.length)]);
});
// SIDE: from side A to the first track of side B, and back to the start of A
acts.side.addEventListener('click', () => {
  press(acts.side);
  const b = tracks.findIndex((t) => t.dataset.no.startsWith('B'));
  if (b < 0) return;
  const to = track >= b ? 0 : b;
  if (to !== track) wind(to - track);
});
// LINK: the page's address with the tape's id, copied; the label says so a moment
acts.link.addEventListener('click', async () => {
  press(acts.link);
  const url = `${location.origin}${location.pathname}${loaded ? `#${loaded.id}` : ''}`;
  const label = acts.link.querySelector('small');
  try { await navigator.clipboard.writeText(url); } catch { /* the address bar already shows it */ }
  label.textContent = L.copied;
  clearTimeout(acts.link.timer);
  acts.link.timer = setTimeout(() => { label.textContent = label.dataset.label; }, 1600);
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
    if (a.dataset.go === 'projects') { toRack(); return; }
    await glideTo(oneColumn.matches ? panel : document.querySelector('.studio'), 'start');
    if (loaded && !busy) { busy = true; await eject(); busy = false; }
  });
});

/* ---------- switch on ---------- */
load(house);
house.classList.add('is-out');
retrace();
// a link to a tape (#id) puts it in
const asked = document.getElementById(decodeURIComponent(location.hash.slice(1)));
if (asked?.classList.contains('cas-item')) insert(asked);
