// Archive · Disquetes — press or drag a disk from the shelf: it travels to the
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

// Where a disk sits right above the slot, at the width of the cover well.
// The disk goes in through the slot, as wide as the drive, cut at the slot's
// top line as it slides in. (The cover stands behind the drive; the disk
// itself goes into the slot.) On the shelf it keeps its own size.
function dock(width) {
  const face = drive.querySelector('.drive__bezel').getBoundingClientRect();
  const slot = drive.querySelector('.drive__slot').getBoundingClientRect();
  return { k: face.width / width, x: face.left, slot: slot.top + slot.height * .35 };
}

const swallow = (delay) => setTimeout(() => {
  drive.classList.add('is-swallowing');
  setTimeout(() => drive.classList.remove('is-swallowing'), 500);
}, delay);

async function flyIn(ghost, rect) {
  if (reduceMotion.matches) { ghost.remove(); return; }
  const { k, x, slot } = dock(rect.width);
  const H = rect.height * k;
  // lift off, arc over to the drive tilting, line up above the slot, slide in
  const top0 = slot - H;
  const mx = (rect.left + x) / 2;
  const my = Math.min(rect.top, top0) - Math.min(160, innerHeight * .18);
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
  [...out.children].forEach((el, i) => el.style.setProperty('--k', i));
  const title = out.querySelector('.entry__title');
  title?.setAttribute('tabindex', '-1');
  return title;
}

/* ---------- the cover of the disk inside, sticking out of the slot ---------- */

const ease = 'cubic-bezier(.45, 0, .25, 1)';
function showCover(entry, { animate = true } = {}) {
  if (!now) return;
  now.replaceChildren(entry.querySelector('.disk').cloneNode(true));
  if (animate && !reduceMotion.matches) {
    now.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 650, easing: ease });
  }
}
async function sinkCover() {
  if (!now?.firstChild) return;
  if (!reduceMotion.matches) {
    await now.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { duration: 420, easing: ease, fill: 'forwards' }).finished;
  }
  now.replaceChildren();
  now.getAnimations().forEach((a) => a.cancel());
}

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
  const bezel = drive.querySelector('.drive__bezel');
  if (!fullyVisible(bezel)) await glideTo(drive, 'center');

  await Promise.all([flyIn(ghost, rect), sinking]);
  screen.classList.remove('is-default');
  drive.classList.add('is-loaded', 'is-reading');
  announce('disk:read', entry);
  state.textContent = `${T.reading} ${entry.dataset.code}…`;
  out.replaceChildren();
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
  if (!topVisible(screen)) glideTo(screen, 'start');
  busy = false;
}

/* ---------- scrolling to where things happen ---------- */

const fullyVisible = (el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; };
const topVisible = (el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.top <= innerHeight * .4; };
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
  await sinkCover();             // its cover goes back in before it comes out
  entry.classList.remove('is-out');
  entry.querySelector('.entry__disk').style.visibility = 'hidden';
  await flyOut(entry);
  entry.querySelector('.entry__disk').style.visibility = '';
  if (!quiet) showDefault();
  if (!silent) entry.querySelector('.entry__disk').focus({ preventScroll: true });
}

ejectBtn.addEventListener('click', () => { if (!busy) eject(); });

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

/* ---------- press, or drag onto the drive ---------- */

const overDrive = (x, y) => [drive, screen].some((el) => {
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
});

entries.forEach((entry, i) => {
  const btn = entry.querySelector('.entry__disk');
  btn.hidden = false;
  btn.style.setProperty('--i', i);
  let drag = null;
  let suppressClick = false;

  btn.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    if (entry === loaded) eject(); else insert(entry);
  });

  btn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || busy || entry === loaded) return;
    const r = btn.getBoundingClientRect();
    drag = { x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, r, ghost: null };
    btn.setPointerCapture(e.pointerId);
  });

  btn.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.ghost && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) {
      drag.ghost = ghostFrom(entry, drag.r);
      entry.classList.add('is-out');
    }
    if (drag.ghost) {
      drag.ghost.style.transform = `translate(${e.clientX - drag.dx}px, ${e.clientY - drag.dy}px) rotate(-3deg)`;
      drive.classList.toggle('is-target', overDrive(e.clientX, e.clientY));
    }
  });

  const end = async (e) => {
    if (!drag) return;
    const { ghost } = drag;
    drag = null;
    drive.classList.remove('is-target');
    if (!ghost) return; // a plain press: the click handler takes it
    suppressClick = true;
    const r = ghost.getBoundingClientRect();
    if (overDrive(e.clientX, e.clientY)) {
      insert(entry, { ghost, rect: { left: r.left, top: r.top, width: r.width, height: r.height } });
    } else {
      const home = btn.getBoundingClientRect();
      if (!reduceMotion.matches) {
        await ghost.animate([{ transform: ghost.style.transform }, { transform: `translate(${home.left}px, ${home.top}px)` }],
          { duration: 400, easing: 'cubic-bezier(.3, .7, .2, 1)', fill: 'forwards' }).finished;
      }
      ghost.remove();
      entry.classList.remove('is-out');
    }
  };
  btn.addEventListener('pointerup', end);
  btn.addEventListener('pointercancel', end);
});

addEventListener('keydown', (e) => { if (e.key === 'Escape' && loaded && !busy) eject(); });

// The bio is the default reading, not a disk on the shelf.
if (bioEntry) bioEntry.hidden = true;
showDefault({ animate: false });
