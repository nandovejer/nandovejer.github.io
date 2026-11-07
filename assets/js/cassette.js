// Cassette version — press a case on the stack: it slides out, flies to the
// radio-cassette, the door opens and the tape goes in; the reels turn, the
// speakers beat and the liner notes beside it are that tape's: side A the
// text, a track per paragraph; side B the facts and links. ◀◀ / ▶▶ move
// between tracks, ■ stops, ⏏ sends the tape back to the stack. With no
// project in, the house tape (the bio) is in the deck.
import { reduceMotion, scrollAlong, glideTo } from './ar-common.js';

const bb = document.querySelector('.boombox');
const door = bb.querySelector('.tdeck__door');
const well = bb.querySelector('.tdeck__well');
const liner = document.querySelector('.liner');
const out = liner.querySelector('.liner__out');
const state = bb.querySelector('.bb__state');
const osdMode = bb.querySelector('.osd__mode');
const osdNo = bb.querySelector('.osd__no');
const osdCount = bb.querySelector('.osd__count');
const dialTitle = bb.querySelector('.dial__title');
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

const showCount = () => { osdCount.textContent = String(count).padStart(3, '0'); };
function play(on) {
  playing = on;
  bb.classList.toggle('is-playing', on);
  keys.play.setAttribute('aria-pressed', String(on));
  osdMode.textContent = on ? '▶ PLAY' : '■ STOP';
  clearInterval(tick);
  if (on) tick = setInterval(() => { count = (count + 1) % 1000; showCount(); }, 1000);
}

// ◀◀ / ▶▶: the reels whirr, the counter runs, the next track lights up.
async function wind(dir) {
  const to = track + dir;
  if (busy || to < 0 || to >= tracks.length) return;
  bb.classList.add(dir > 0 ? 'is-ff' : 'is-rew');
  count = (count + dir * 37 + 1000) % 1000;
  showCount();
  await sleep(420);
  bb.classList.remove('is-ff', 'is-rew');
  setTrack(to);
  const r = tracks[track].getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) glideTo(tracks[track], 'nearest');
}

keys.play.addEventListener('click', () => { press(keys.play); if (!busy) play(true); });
keys.stop.addEventListener('click', () => { press(keys.stop); play(false); });
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

const at = (x, y, k, deg = 0) => `translate(${x}px, ${y}px) rotate(${deg}deg) scale(${k})`;

// A fixed copy of a case's spine, at its place on the stack.
function ghostOf(spine, r = spine.getBoundingClientRect()) {
  const g = spine.cloneNode(true);
  g.classList.add('ghost');
  Object.assign(g.style, { width: `${r.width}px`, height: `${r.height}px`, transform: at(r.left, r.top, 1) });
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

// From the stack (r) into the door (t): out of its slot, up in an arc, down
// into the door at its width, and in.
function arc(r, t) {
  const k = t.width / r.width;
  const ex = t.left, ey = t.top + (t.height - r.height * k) / 2;
  const mx = (r.left + ex) / 2, my = Math.min(r.top, ey) - Math.min(140, innerHeight * .15);
  return [
    { transform: at(r.left, r.top, 1), opacity: 1, offset: 0 },
    { transform: at(r.left + 14, r.top - 8, 1.02, -1), opacity: 1, offset: .12 },
    { transform: at(mx, my, (1 + k) / 2, -4), opacity: 1, offset: .55 },
    { transform: at(ex, ey, k), opacity: 1, offset: .88 },
    { transform: at(ex, ey + 8, k * .96), opacity: 0, offset: 1 }
  ];
}

const lift = (el) => (reduceMotion.matches || !el ? Promise.resolve()
  : el.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-35%)', opacity: 0 }], { duration: 320, easing: 'ease-in', fill: 'forwards' }).finished);
const drop = (el) => (reduceMotion.matches || !el ? Promise.resolve()
  : el.animate([{ transform: 'translateY(-35%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2, .8, .2, 1)' }).finished);

// How far the page must scroll to show the whole radio-cassette (0 if it is).
function deckScroll() {
  const r = bb.getBoundingClientRect();
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
  // the case goes back to its place on the stack
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

/* ---------- header links ---------- */
// Bio: the house tape (ejecting the project if one is in) and its notes.
// Projects: the stack.
document.querySelectorAll('.masthead__nav [data-go]').forEach((a) => {
  a.addEventListener('click', async (e) => {
    e.preventDefault();
    if (a.dataset.go === 'projects') { glideTo(document.querySelector('.stack'), 'start'); return; }
    await glideTo(oneColumn.matches ? bb : document.querySelector('.studio'), 'start');
    if (loaded && !busy) { busy = true; await eject(); busy = false; }
  });
});

/* ---------- switch on ---------- */
load(house);
