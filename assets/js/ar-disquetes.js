// Archive · Disquetes — press a disk on the shelf: it travels to the
// drive and slides in through the slot, and the screen reads it. The cover of
// the disk inside sticks out of the slot. With no project inserted, the bio
// is the disk inside.
import { reduceMotion } from './ar-common.js';

const es = document.documentElement.lang === 'es';
const T = { reading: es ? 'Leyendo' : 'Reading' };

const drive = document.querySelector('.drive');
const well = document.querySelector('.now-well');
const now = document.querySelector('.now');
const screen = document.querySelector('.screen');
const state = screen.querySelector('.screen__state');
const out = screen.querySelector('.screen__out');
const ejectBtn = screen.querySelector('.screen__eject');
const cta = document.querySelector('.deck .cta');
// on two columns the disk's links (demo, code) sit under the drive, outside
// the screen; CSS shows either these or the ones inside the screen
const deckLinks = document.querySelector('.deck__links');
const setDeckLinks = (links) => deckLinks?.replaceChildren(...(links ? [links.cloneNode(true)] : []));
const bioEntry = document.querySelector('.entry--bio');
const entries = [...document.querySelectorAll('.entry:not(.entry--bio)')];

let loaded = null;
let busy = false;
// Lets page effects follow the drive (grid versions listen to these).
const announce = (type, entry) => document.dispatchEvent(new CustomEvent(type, {
  detail: { entry, color: getComputedStyle(entry.querySelector('.disk')).getPropertyValue('--plastic').trim() }
}));
const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion.matches ? 0 : ms));

/* ---------- the disk in flight ---------- */
// The ghost is a fixed copy of the disk (transform-origin 0 0). While it goes
// through the slot its outline is cut at the slot line, so the part that is
// already inside the drive disappears: `cut(b)` keeps the disk's clipped
// corner and shows it down to b% of its height.

const cut = (b) => `polygon(0 0, 93% 0, 100% 6.5%, 100% ${b}%, 0 ${b}%)`;

function ghostFrom(entry, rect) {
  const g = entry.querySelector('.entry__disk .disk').cloneNode(true);
  g.classList.add('disk-ghost');
  g.style.width = `${rect.width}px`;
  g.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
  document.body.append(g);
  return g;
}

// Where a disk sits right above the slot, just narrower than the slot.
// The disk goes in through the slot, as wide as it can, cut at the slot's
// top line as it slides in. (The cover stands behind the drive; the disk
// itself goes into the slot.) On the shelf it keeps its own size.
// `dy` is how far the page is about to scroll: the drive is measured where it
// will be when the flight lands, not where it is as it takes off. The deck is
// sticky on wide screens, so it does not move by dy: the page jumps to the
// end of the scroll, the slot is measured there, and the page jumps back, all
// before the next paint, so nothing is seen.
function dock(width, dy = 0) {
  const y0 = scrollY;
  if (dy) scrollTo({ top: y0 + dy, behavior: 'instant' });
  const slot = drive.querySelector('.drive__slot').getBoundingClientRect();
  if (dy) scrollTo({ top: y0, behavior: 'instant' });
  // a touch narrower than the slot, centred on it, so it fits through
  const w = slot.width * .96;
  return { k: w / width, x: slot.left + (slot.width - w) / 2, slot: slot.top + slot.height * .35 };
}

const swallow = (delay) => setTimeout(() => {
  drive.classList.add('is-swallowing');
  setTimeout(() => drive.classList.remove('is-swallowing'), 500);
}, delay);

async function flyIn(ghost, rect, dy = 0) {
  if (reduceMotion.matches) { ghost.remove(); return; }
  const { k, x, slot } = dock(rect.width, dy);
  const H = rect.height * k;
  // lift off, arc over to the drive tilting, line up above the slot, slide in
  const top0 = slot - H;
  const mx = (rect.left + x) / 2;
  // the top of the arc stays on screen
  const my = Math.max(12, Math.min(rect.top, top0) - Math.min(160, innerHeight * .18));
  const frames = [
    { transform: `translate(${rect.left}px, ${rect.top}px) scale(1) rotate(0deg)`, clipPath: cut(100), offset: 0 },
    { transform: `translate(${rect.left}px, ${rect.top - 14}px) scale(1.04) rotate(2deg)`, clipPath: cut(100), offset: .08 },
    { transform: `translate(${mx}px, ${my}px) scale(${(1 + k) / 2}) rotate(-12deg)`, clipPath: cut(100), offset: .38 },
    { transform: `translate(${x}px, ${top0 - 10}px) scale(${k}) rotate(2deg)`, clipPath: cut(100), offset: .6 },
    { transform: `translate(${x}px, ${top0}px) scale(${k}) rotate(0deg)`, clipPath: cut(100), offset: .66 },
    { transform: `translate(${x}px, ${slot}px) scale(${k}) rotate(0deg)`, clipPath: cut(0), offset: 1 }
  ];
  const duration = 1500;
  swallow(duration * .66);
  const a = ghost.animate(frames, { duration, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' });
  await a.finished;
  ghost.remove();
}

async function flyOut(entry) {
  if (reduceMotion.matches) return;
  const btn = entry.querySelector('.entry__disk');
  const home = btn.getBoundingClientRect();
  const { k, x, slot } = dock(home.width);
  const H = home.height * k;
  const top0 = slot - H;
  const ghost = ghostFrom(entry, home);
  const visible = home.bottom > 0 && home.top < innerHeight;
  const rise = [
    { transform: `translate(${x}px, ${slot}px) scale(${k})`, clipPath: cut(0), opacity: 1, offset: 0 },
    { transform: `translate(${x}px, ${top0}px) scale(${k})`, clipPath: cut(100), opacity: 1, offset: .38 }
  ];
  const back = visible
    ? [
        { transform: `translate(${(home.left + x) / 2}px, ${Math.min(home.top, top0) - 120}px) scale(${(1 + k) / 2}) rotate(10deg)`, clipPath: cut(100), opacity: 1, offset: .7 },
        { transform: `translate(${home.left}px, ${home.top}px) scale(1) rotate(0deg)`, clipPath: cut(100), opacity: 1, offset: 1 }
      ]
    : [{ transform: `translate(${x}px, ${top0 - 140}px) scale(${k}) rotate(-6deg)`, clipPath: cut(100), opacity: 0, offset: 1 }];
  drive.classList.add('is-swallowing');
  setTimeout(() => drive.classList.remove('is-swallowing'), 450);
  const a = ghost.animate([...rise, ...back], { duration: 1200, easing: 'cubic-bezier(.45, 0, .25, 1)', fill: 'forwards' });
  await a.finished;
  ghost.remove();
}

/* ---------- reading ---------- */

function render(entry) {
  const content = entry.querySelector('.entry__content').cloneNode(true);
  content.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  out.replaceChildren(...content.children);
  setDeckLinks(out.querySelector('.links'));
  [...out.children].forEach((el, i) => el.style.setProperty('--k', i));
  const title = out.querySelector('.entry__title');
  title?.setAttribute('tabindex', '-1');
  return title;
}

/* ---------- the cover of the disk inside, sticking out of the slot ---------- */

const ease = 'cubic-bezier(.45, 0, .25, 1)';
// On one column (phone, tablet) there is no cover: the drive sits under the
// screen and the screen itself sinks into the slot and rises out of it. It is
// cut at its own bottom edge (the drive's top), so it never shows below it.
const oneCol = matchMedia('(max-width: 63.999em)');
const screenAt = (d) => ({ transform: `translateY(${d}px)`, clipPath: `inset(0 0 ${d}px 0)` });

function showCover(entry, { animate = true } = {}) {
  if (now) now.replaceChildren(entry.querySelector('.disk').cloneNode(true));
  const go = animate && !reduceMotion.matches;
  if (oneCol.matches) {
    screen.getAnimations().forEach((a) => a.cancel());
    if (go) screen.animate([screenAt(screen.offsetHeight), screenAt(0)], { duration: 650, easing: ease });
    return;
  }
  if (now && go) {
    now.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 650, easing: ease });
  }
}
async function sinkCover() {
  if (oneCol.matches) {
    if (!reduceMotion.matches && !screen.getAnimations().length) {
      await screen.animate([screenAt(0), screenAt(screen.offsetHeight)], { duration: 480, easing: ease, fill: 'forwards' }).finished;
    }
    if (now) now.replaceChildren();
    return;
  }
  if (!now?.firstChild) return;
  if (!reduceMotion.matches) {
    await now.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { duration: 420, easing: ease, fill: 'forwards' }).finished;
  }
  now.replaceChildren();
  now.getAnimations().forEach((a) => a.cancel());
}
// if the layout changes with the screen sunk, it comes back
oneCol.addEventListener('change', () => screen.getAnimations().forEach((a) => a.cancel()));

// No project inserted: the bio is the disk inside.
function showDefault({ animate = true } = {}) {
  const title = bioEntry ? render(bioEntry) : null;
  state.textContent = `${bioEntry?.dataset.code ?? ''} · ${title?.textContent ?? ''}`;
  document.body.classList.add('is-empty');
  screen.classList.add('is-default');
  ejectBtn.hidden = true;
  if (cta) cta.hidden = false;
  if (bioEntry) showCover(bioEntry, { animate });
}

async function insert(entry, { ghost, rect } = {}) {
  if (busy || entry === loaded) return;
  busy = true;
  if (loaded) await eject({ silent: true, quiet: true });
  const sinking = sinkCover();   // the bio's (or last) cover goes back in
  document.body.classList.remove('is-empty');
  if (cta) cta.hidden = true;

  // The disk is lifted where the reader sees it (it stays put on screen),
  // then the page glides up to the drive, and only then does it fly in, so
  // the whole trip is visible.
  const btn = entry.querySelector('.entry__disk');
  rect ??= btn.getBoundingClientRect();
  ghost ??= ghostFrom(entry, rect);
  entry.classList.add('is-out');
  // The page scrolls to the drive while the disk is in the air, so there is
  // no wait: both take SCROLL_MS and the disk is lined up over the slot when
  // the page stops.
  const dy = driveScroll();
  scrollAlong(dy, SCROLL_MS);

  await Promise.all([flyIn(ghost, rect, dy), sinking]);
  screen.classList.remove('is-default');
  drive.classList.add('is-loaded', 'is-reading');
  announce('disk:read', entry);
  state.textContent = `${T.reading} ${entry.dataset.code}…`;
  out.replaceChildren();
  setDeckLinks(null);
  await wait(900);
  drive.classList.remove('is-reading');
  const title = render(entry);
  state.textContent = `${entry.dataset.code} · ${title?.textContent ?? ''}`;
  showCover(entry);              // its cover rises out of the slot
  ejectBtn.hidden = false;
  loaded = entry;
  title?.focus({ preventScroll: true });
  // then take the reader to what was read (on small screens the screen is
  // below the drive; on wide ones it is beside it and already in view)
  // (on one column the screen is still rising out of the drive, so its box is
  // moved: the station, which does not move, is what the page glides to)
  if (oneCol.matches) glideTo(screen.closest('.station'), 'start');
  else if (!topVisible(screen)) glideTo(screen, 'start');
  busy = false;
}

/* ---------- scrolling to where things happen ---------- */

const fullyVisible = (el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; };
const topVisible = (el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.top <= innerHeight * .4; };
const SCROLL_MS = 800; // the flight is 1500 ms and lines up over the slot at ~990 ms

// How far the page must scroll to bring the drive a little below the middle of
// the screen, so the cover standing behind it shows too
// (0 when it is already fully in view), clamped to what the page can scroll.
function driveScroll() {
  const bezel = drive.querySelector('.drive__bezel');
  if (fullyVisible(bezel)) return 0;
  const r = drive.getBoundingClientRect();
  const max = document.documentElement.scrollHeight - innerHeight;
  const to = Math.max(0, Math.min(max, scrollY + r.top + r.height / 2 - innerHeight * .62));
  return Math.round(to - scrollY);
}

// Scrolls by dy over ms with its own easing, so the end time is known.
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

// Smooth scroll, resolved when it ends (or soon after, as a fallback).
function glideTo(el, block) {
  return new Promise((resolve) => {
    const done = () => { removeEventListener('scrollend', done); clearTimeout(t); resolve(); };
    const t = setTimeout(done, reduceMotion.matches ? 0 : 900);
    addEventListener('scrollend', done, { once: true });
    el.scrollIntoView({ block, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  });
}

async function eject({ silent = false, quiet = false } = {}) {
  if (!loaded) return;
  const entry = loaded;
  loaded = null;
  pressKey(); // the eject key goes in and springs back out
  drive.classList.remove('is-loaded', 'is-reading');
  announce('disk:eject', entry);
  setDeckLinks(null);
  await sinkCover();             // its cover goes back in before it comes out
  entry.classList.remove('is-out');
  entry.querySelector('.entry__disk').style.visibility = 'hidden';
  await flyOut(entry);
  entry.querySelector('.entry__disk').style.visibility = '';
  if (!quiet) showDefault();
  if (!silent) entry.querySelector('.entry__disk').focus({ preventScroll: true });
}

ejectBtn.addEventListener('click', () => { if (!busy) eject(); });

/* ---------- header links ---------- */
// Bio: the page goes to the screen and, if a project is in, ejects it so the
// screen reads the bio. Projects: the page glides to the shelf.
// (Without JS they are plain anchors: the bio's text and the shelf.)
document.querySelectorAll('.masthead__nav [data-go]').forEach((a) => {
  a.addEventListener('click', async (e) => {
    e.preventDefault();
    if (a.dataset.go === 'projects') {
      glideTo(document.querySelector('.shelf'), 'start');
      return;
    }
    if (!topVisible(screen)) await glideTo(screen, 'start');
    if (loaded && !busy) await eject({ silent: true });
    out.querySelector('.entry__title')?.focus({ preventScroll: true });
  });
});

// The drive's own eject key: it always gives under the finger, and ejects
// the disk if a project is in (the bio stays: it is the default).
const driveKey = drive.querySelector('.drive__btn');
function pressKey() {
  drive.classList.remove('is-ejecting');
  void drive.offsetWidth; // restart the animation
  drive.classList.add('is-ejecting');
  setTimeout(() => drive.classList.remove('is-ejecting'), 340);
}
driveKey?.addEventListener('click', () => {
  if (loaded && !busy) eject({ silent: true });
  else pressKey();
});

/* ---------- press a disk: it goes straight to the drive ---------- */
// No dragging: the disk never follows the pointer, and the page keeps its
// scroll (a finger or wheel over a disk scrolls the page as anywhere else).

entries.forEach((entry, i) => {
  const btn = entry.querySelector('.entry__disk');
  btn.hidden = false;
  btn.style.setProperty('--i', i);
  btn.addEventListener('click', () => {
    if (entry === loaded) eject(); else insert(entry);
  });
});

addEventListener('keydown', (e) => { if (e.key === 'Escape' && loaded && !busy) eject(); });

// The bio is the default reading, not a disk on the shelf.
if (bioEntry) bioEntry.hidden = true;
showDefault({ animate: false });

/* ---------- on the grid: heights in whole cells (Asomado) ---------- */
// The screen and the drive deck are rounded up to a whole number of cells,
// so their bottom edges land on grid lines (widths are set in CSS).
const main = document.querySelector('main');
if (main) {
  const boxes = [screen, document.querySelector('.deck')].filter(Boolean);
  const snap = () => {
    const cols = parseFloat(getComputedStyle(main).getPropertyValue('--cols')) || 16;
    const c = main.clientWidth / cols;
    boxes.forEach((el) => {
      el.style.minHeight = '';
      const h = el.getBoundingClientRect().height;
      const target = `${Math.ceil(h / c - 0.01) * c}px`;
      if (el.style.minHeight !== target) el.style.minHeight = target;
    });
  };
  let queued = false;
  const ro = new ResizeObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; snap(); });
  });
  ro.observe(main);
  ro.observe(out);
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(snap);
  snap();
}

/* ---------- today, in Roman numerals ---------- */
// The footer shows the visitor's today as day·month·year (VI·XI·MMXXVI).
const roman = (n) => [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  .reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
document.querySelectorAll('time.today').forEach((el) => {
  const d = new Date();
  el.textContent = `${roman(d.getDate())}·${roman(d.getMonth() + 1)}·${roman(d.getFullYear())}`;
  el.dateTime = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
