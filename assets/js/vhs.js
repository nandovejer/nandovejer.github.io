// VHS version — press a tape on the shelf: it slides out, turns and goes into
// the video recorder of the yellow TV. The screen fills with static and plays
// it: the sleeve and title, then the text, then the facts; REW and FF turn the
// pages, EJECT sends it back to the shelf. With no tape in, the TV is on
// channel 1, which shows the bio.
import { reduceMotion } from './ar-common.js';

const tv = document.querySelector('.tv');
const out = tv.querySelector('.tv__out');
const state = tv.querySelector('.tv__state');
const osdMode = tv.querySelector('.osd__mode');
const osdClock = tv.querySelector('.osd__clock');
const osdPage = tv.querySelector('.osd__page');
const vcr = tv.querySelector('.vcr');
const slot = tv.querySelector('.vcr__slot');
const keys = Object.fromEntries([...tv.querySelectorAll('[data-tv]')].map((b) => [b.dataset.tv, b]));
const cta = document.querySelector('.room__cta');
const bioPages = document.querySelector('.bio-pages');
const tapes = [...document.querySelectorAll('.tape--project')];
const L = tv.dataset;

let loaded = null;
let busy = false;
const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion.matches ? 0 : ms));

/* ---------- the screen ---------- */

// Blue static, like an untuned set: a small canvas drawn every frame, scaled up.
const canvas = tv.querySelector('.tv__noise');
const ctx = canvas.getContext('2d');
let noise = 0;
function drawNoise() {
  const img = ctx.createImageData(canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.random() * 255;
    d[i] = v * .55; d[i + 1] = v * .78; d[i + 2] = Math.min(255, v + 45); d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  noise = requestAnimationFrame(drawNoise);
}
async function staticFor(ms) {
  if (reduceMotion.matches) return;
  tv.classList.add('is-static');
  drawNoise();
  await sleep(ms);
  cancelAnimationFrame(noise);
  tv.classList.remove('is-static');
}

// The pages of whatever plays; REW and FF move between them.
let pages = [];
let page = 0;
function play(src) {
  out.replaceChildren(...[...src.children].map((n) => n.cloneNode(true)));
  out.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  pages = [...out.querySelectorAll('.tvp')];
  turn(0);
}
function turn(i) {
  page = Math.max(0, Math.min(pages.length - 1, i));
  pages.forEach((p, k) => { p.hidden = k !== page; });
  out.scrollTop = 0;
  osdPage.textContent = `${L.page} ${page + 1}/${pages.length}`;
  keys.rew.setAttribute('aria-disabled', String(page === 0));
  keys.ff.setAttribute('aria-disabled', String(page === pages.length - 1));
}
const press = (key) => {
  key.classList.add('is-pressed');
  setTimeout(() => key.classList.remove('is-pressed'), 160);
};
keys.rew.addEventListener('click', () => { if (page > 0) turn(page - 1); });
keys.ff.addEventListener('click', () => { if (page < pages.length - 1) turn(page + 1); });

// The tape counter of the video recorder, while a tape plays.
let tick = 0;
function counter(on) {
  clearInterval(tick);
  osdClock.textContent = '';
  if (!on) return;
  const t0 = Date.now();
  const show = () => {
    const s = Math.floor((Date.now() - t0) / 1000);
    osdClock.textContent = `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  show();
  tick = setInterval(show, 1000);
}

function channel() {
  play(bioPages);
  osdMode.textContent = L.channel;
  tv.classList.remove('is-playing');
  cta.hidden = false;
}

/* ---------- the tape in flight ---------- */
// A fixed copy of the spine flies from the shelf, turns on its side and lines
// up with the slot, then goes in (it shrinks and darkens as the flap opens).

const at = (cx, cy, w, h, deg, k) => `translate(${cx - w / 2}px, ${cy - h / 2}px) rotate(${deg}deg) scale(${k})`;

function ghostOf(tape) {
  const sp = tape.querySelector('.tape__spine .spine');
  const r = sp.getBoundingClientRect();
  const g = sp.cloneNode(true);
  g.classList.add('spine-ghost');
  Object.assign(g.style, { width: `${r.width}px`, height: `${r.height}px`, transform: at(r.left + r.width / 2, r.top + r.height / 2, r.width, r.height, 0, 1) });
  document.body.append(g);
  return { g, r };
}

// Where the slot will be once the page has scrolled by dy (measured there and
// back before the next paint, so nothing is seen).
function slotAt(dy = 0) {
  const y0 = scrollY;
  if (dy) scrollTo({ top: y0 + dy, behavior: 'instant' });
  const s = slot.getBoundingClientRect();
  if (dy) scrollTo({ top: y0, behavior: 'instant' });
  return s;
}

function path(r, s) {
  const k = (s.width * .94) / r.height;            // on its side, as wide as the slot
  const a = [r.left + r.width / 2, r.top + r.height / 2];
  const b = [s.left + s.width / 2, s.top + s.height / 2];
  const lift = Math.max(r.width * k, Math.min(a[1], b[1]) - Math.min(180, innerHeight * .2));
  return [
    { transform: at(a[0], a[1], r.width, r.height, 0, 1), opacity: 1, filter: 'brightness(1)', offset: 0 },
    { transform: at(a[0], a[1] - 26, r.width, r.height, -3, 1.04), opacity: 1, filter: 'brightness(1)', offset: .1 },
    { transform: at((a[0] + b[0]) / 2, lift, r.width, r.height, -55, (1 + k) / 2), opacity: 1, filter: 'brightness(1)', offset: .45 },
    { transform: at(b[0], b[1] - s.height * 1.6, r.width, r.height, -90, k), opacity: 1, filter: 'brightness(1)', offset: .7 },
    { transform: at(b[0], b[1], r.width, r.height, -90, k), opacity: 1, filter: 'brightness(1)', offset: .82 },
    { transform: at(b[0], b[1] + 2, r.width, r.height, -90, k * .86), opacity: 0, filter: 'brightness(.25)', offset: 1 }
  ];
}

async function flyIn(g, r, dy) {
  if (reduceMotion.matches) { g.remove(); return; }
  const duration = 1500;
  setTimeout(() => vcr.classList.add('is-open'), duration * .72);
  await g.animate(path(r, slotAt(dy)), { duration, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' }).finished;
  g.remove();
  vcr.classList.remove('is-open');
}

async function flyOut(tape) {
  if (reduceMotion.matches) return;
  const { g, r } = ghostOf(tape);
  const visible = r.bottom > 0 && r.top < innerHeight;
  const frames = path(r, slot.getBoundingClientRect()).reverse().map((f) => ({ ...f, offset: 1 - f.offset }));
  if (!visible) frames.splice(2, frames.length, { ...frames[2], opacity: 0, offset: 1 });
  vcr.classList.add('is-open');
  setTimeout(() => vcr.classList.remove('is-open'), 380);
  await g.animate(frames, { duration: 1200, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' }).finished;
  g.remove();
}

/* ---------- scrolling to the TV ---------- */

const fullyVisible = (el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; };
function tvScroll() {
  const screen = tv.querySelector('.tv__body');
  if (fullyVisible(screen)) return 0;
  const r = screen.getBoundingClientRect();
  const max = document.documentElement.scrollHeight - innerHeight;
  const to = Math.max(0, Math.min(max, scrollY + r.top + Math.min(0, (r.height - innerHeight) / 2) - Math.max(16, (innerHeight - r.height) / 2)));
  return Math.round(to - scrollY);
}
function scrollAlong(dy, ms) {
  if (!dy) return;
  if (reduceMotion.matches) { scrollBy({ top: dy, behavior: 'instant' }); return; }
  const y0 = scrollY, t0 = performance.now();
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const step = (now) => {
    const t = Math.min(1, (now - t0) / ms);
    scrollTo({ top: y0 + dy * ease(t), behavior: 'instant' });
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- insert and eject ---------- */

async function insert(tape) {
  if (busy || tape === loaded) return;
  busy = true;
  if (loaded) await eject({ quiet: true });
  cta.hidden = true;
  const { g, r } = ghostOf(tape);
  tape.classList.add('is-out');
  const dy = tvScroll();
  scrollAlong(dy, 800);
  await flyIn(g, r, dy);
  loaded = tape;
  osdMode.textContent = `▶ ${L.play}`;
  tv.classList.add('is-playing');
  await staticFor(650);
  play(tape.querySelector('.tape__content'));
  counter(true);
  const name = tape.querySelector('.tvp__title')?.textContent ?? '';
  state.textContent = `${L.playing}: ${name}`;
  busy = false;
}

async function eject({ quiet = false } = {}) {
  if (!loaded) return;
  const tape = loaded;
  loaded = null;
  press(keys.eject);
  counter(false);
  osdMode.textContent = `⏏ ${L.eject}`;
  tv.classList.add('is-ejecting');
  tv.classList.remove('is-playing');
  const noise = staticFor(quiet ? 400 : 700);
  await flyOut(tape);
  tape.classList.remove('is-out');
  await noise;
  tv.classList.remove('is-ejecting');
  if (!quiet) {
    channel();
    state.textContent = L.channel;
    tape.querySelector('.tape__spine').focus({ preventScroll: true });
  }
}

keys.eject.addEventListener('click', () => {
  if (loaded && !busy) eject();
  else press(keys.eject);
});
tapes.forEach((tape) => {
  tape.querySelector('.tape__spine').addEventListener('click', () => {
    if (tape === loaded) eject(); else insert(tape);
  });
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && loaded && !busy) eject();
});

/* ---------- header links ---------- */

function glideTo(el, block) {
  return new Promise((resolve) => {
    const done = () => { removeEventListener('scrollend', done); clearTimeout(t); resolve(); };
    const t = setTimeout(done, reduceMotion.matches ? 0 : 900);
    addEventListener('scrollend', done, { once: true });
    el.scrollIntoView({ block, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  });
}
document.querySelectorAll('.masthead__nav [data-go]').forEach((a) => {
  a.addEventListener('click', async (e) => {
    e.preventDefault();
    if (a.dataset.go === 'projects') { glideTo(document.querySelector('.shelf'), 'start'); return; }
    if (!fullyVisible(tv.querySelector('.tv__body'))) await glideTo(tv, 'center');
    if (loaded && !busy) await eject({ quiet: false });
  });
});

/* ---------- today, in Roman numerals ---------- */
const roman = (n) => [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  .reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
document.querySelectorAll('time.today').forEach((el) => {
  const d = new Date();
  el.textContent = `${roman(d.getDate())}·${roman(d.getMonth() + 1)}·${roman(d.getFullYear())}`;
  el.dateTime = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

/* ---------- switch on ---------- */
channel();
staticFor(500);
