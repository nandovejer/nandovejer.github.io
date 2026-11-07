// Cassette version — press a case standing in the oak rack: it rises out of
// its slot, turns on its side and flies into the deck on the cabinet's
// aluminium plate; the door opens and the tape goes in; the reels turn, the
// trace on the little CRT moves and the liner notes beside it are that tape's: side A the
// text, a track per paragraph; side B the facts and links. ◀◀ / ▶▶ move
// between tracks, ■ stops, ⏏ sends the tape back to its slot. With no
// project in, the house tape (the bio) is in the deck.
import { reduceMotion, scrollAlong, glideTo } from './ar-common.js';

const bb = document.querySelector('.cabinet');
const panel = bb.querySelector('.panel');
const door = bb.querySelector('.tdeck__door');
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
}

function setTrack(i) {
  track = Math.max(0, Math.min(tracks.length - 1, i));
  tracks.forEach((t, k) => t.classList.toggle('is-current', k === track));
  osdNo.textContent = tracks[track]?.dataset.no ?? 'A1';
  bb.style.setProperty('--p', tracks.length > 1 ? track / (tracks.length - 1) : 0);
  keys.rew.setAttribute('aria-disabled', String(track === 0));
  keys.ff.setAttribute('aria-disabled', String(track === tracks.length - 1));
}

/* ---------- the trace in the dial ----------
   A blue oscilloscope line, as on the cabinet's little CRT: flat (a quiver)
   when stopped, a moving wave while it plays, fast while it winds. */
const wave = bb.querySelector('.crt__wave');
const wctx = wave.getContext('2d');
let wframe = 0;
function trace(now = 0) {
  const { width: w, height: h } = wave;
  const fast = bb.classList.contains('is-ff') || bb.classList.contains('is-rew');
  const amp = playing || fast ? h * .32 : h * .03;
  const speed = fast ? .02 : .004;
  wctx.clearRect(0, 0, w, h);
  wctx.beginPath();
  for (let x = 0; x <= w; x += 3) {
    const t = x / w * Math.PI * 2;
    const y = h / 2 + amp * (Math.sin(t * 3 + now * speed) * .6 + Math.sin(t * 7.3 - now * speed * 1.7) * .3 + Math.sin(t * 13 + now * speed * .6) * .1)
      + (playing ? 0 : (Math.random() - .5) * 1.2);
    x ? wctx.lineTo(x, y) : wctx.moveTo(x, y);
  }
  // the phosphor: a wide soft halo, then the bright core of the line
  wctx.lineJoin = 'round';
  wctx.shadowColor = 'rgb(70 160 255 / .9)';
  wctx.shadowBlur = 18;
  wctx.lineWidth = 7;
  wctx.strokeStyle = 'rgb(60 150 255 / .22)';
  wctx.stroke();
  wctx.shadowBlur = 6;
  wctx.lineWidth = 2;
  wctx.strokeStyle = '#bfe3ff';
  wctx.stroke();
  if ((playing || fast) && !reduceMotion.matches) wframe = requestAnimationFrame(trace);
}
const retrace = () => { cancelAnimationFrame(wframe); trace(performance.now()); };

const drums = [...bb.querySelectorAll('.counter__win b')];
const showCount = () => {
  const s = String(count).padStart(3, '0');
  osdCount.textContent = s;
  drums.forEach((d, i) => { d.textContent = s[i]; });
};
let paused = false;
function play(on) {
  playing = on;
  paused = false;
  bb.classList.toggle('is-playing', on);
  keys.play.setAttribute('aria-pressed', String(on));
  keys.pause.setAttribute('aria-pressed', 'false');
  osdMode.textContent = on ? '▶ PLAY' : '■ STOP';
  clearInterval(tick);
  if (on) tick = setInterval(() => { count = (count + 1) % 1000; showCount(); }, 1000);
  retrace();
}

// ◀◀ / ▶▶: the reels whirr, the counter runs, the next track lights up.
async function wind(dir) {
  const to = track + dir;
  if (busy || to < 0 || to >= tracks.length) return;
  bb.classList.add(dir > 0 ? 'is-ff' : 'is-rew');
  retrace();
  count = (count + dir * 37 + 1000) % 1000;
  showCount();
  await sleep(420);
  bb.classList.remove('is-ff', 'is-rew');
  retrace();
  setTrack(to);
  const r = tracks[track].getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) glideTo(tracks[track], 'nearest');
}

keys.play.addEventListener('click', () => { press(keys.play); if (!busy) play(true); });
keys.stop.addEventListener('click', () => { press(keys.stop); play(false); });
// ❚❚ holds the tape where it is; ❚❚ again (or ▶) goes on from there
keys.pause.addEventListener('click', () => {
  if (busy) return;
  if (playing) {
    play(false);
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
  // the house tape stays: the door only opens and closes
  door.classList.add('is-open');
  await sleep(380);
  door.classList.remove('is-open');
});

/* ---------- the case in flight ---------- */

// Transforms about the centre of the copy (w × h), placed with its centre at (cx, cy).
const at = (cx, cy, w, h, deg, k) => `translate(${cx - w / 2}px, ${cy - h / 2}px) rotate(${deg}deg) scale(${k})`;

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

// From the rack (r) into the door (t): up out of its slot, over in an arc,
// turning on its side, down into the door as long as the cassette is wide,
// and in.
function arc(r, t) {
  const w = r.width, h = r.height;
  const k = (t.width * 1.06) / h;             // 109 mm of case for 100 mm of tape
  const a = [r.left + w / 2, r.top + h / 2];
  const b = [t.left + t.width / 2, t.top + t.height / 2];
  const up = a[1] - h * .35;
  const top = Math.min(up, b[1]) - Math.min(120, innerHeight * .12);
  return [
    { transform: at(a[0], a[1], w, h, 0, 1), opacity: 1, offset: 0 },
    { transform: at(a[0], up, w, h, 0, 1), opacity: 1, offset: .16 },
    { transform: at((a[0] + b[0]) / 2, top, w, h, -50, (1 + k) / 2), opacity: 1, offset: .5 },
    { transform: at(b[0], b[1] - t.height * .5, w, h, -90, k), opacity: 1, offset: .78 },
    { transform: at(b[0], b[1], w, h, -90, k), opacity: 1, offset: .9 },
    { transform: at(b[0], b[1] + 4, w, h, -90, k * .96), opacity: 0, offset: 1 }
  ];
}

const lift = (el) => (reduceMotion.matches || !el ? Promise.resolve()
  : el.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-35%)', opacity: 0 }], { duration: 320, easing: 'ease-in', fill: 'forwards' }).finished);
const drop = (el) => (reduceMotion.matches || !el ? Promise.resolve()
  : el.animate([{ transform: 'translateY(-35%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2, .8, .2, 1)' }).finished);

// How far the page must scroll to show the whole radio-cassette (0 if it is).
function deckScroll() {
  const r = panel.getBoundingClientRect();
  if (r.top >= 0 && r.bottom <= innerHeight) return 0;
  const max = document.documentElement.scrollHeight - innerHeight;
  const to = Math.max(0, Math.min(max, scrollY + r.top - Math.max(16, (innerHeight - r.height) / 2)));
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
  const dy = deckScroll();
  scrollAlong(dy, 700);
  door.classList.add('is-open');
  const gone = lift(well.firstElementChild);
  if (!reduceMotion.matches) {
    await g.animate(arc(r, rectAt(well, dy)), { duration: 1300, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' }).finished;
  }
  await gone;
  g.remove();
  load(item);
  await drop(well.firstElementChild);
  door.classList.remove('is-open');
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
  door.classList.add('is-open');
  const w = well.getBoundingClientRect();
  await lift(well.firstElementChild);
  // the case goes back to its slot
  const spine = item.querySelector('.cspine');
  const r = spine.getBoundingClientRect();
  if (!reduceMotion.matches) {
    const g = ghostOf(spine, r);
    const frames = arc(r, w).reverse().map((f) => ({ ...f, offset: 1 - f.offset }));
    const visible = r.bottom > 0 && r.top < innerHeight;
    if (!visible) frames.splice(3, frames.length, { ...frames[2], opacity: 0, offset: 1 });
    await g.animate(frames, { duration: 1100, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' }).finished;
    g.remove();
  }
  item.classList.remove('is-out');
  if (quiet) return;
  load(house);
  await drop(well.firstElementChild);
  door.classList.remove('is-open');
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

/* ---------- the rack's empty slots ----------
   The rows run as wide as the page; the slots the tapes leave at the end of
   the last row are still slots (empty ones), as in a real cabinet. */
const slots = document.querySelector('.rack__slots');
function fillRack() {
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
fillRack();
new ResizeObserver(fillRack).observe(slots);

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
