// Archive · Disquetes — a disk sticks half out of the drive: push it in, or
// press / drag any disk from the shelf. It travels to the drive and slides in
// through the slot; the screen reads it. With no disk inserted the screen
// shows the bio.
import { reduceMotion } from './ar-common.js';

const es = document.documentElement.lang === 'es';
const T = { reading: es ? 'Leyendo' : 'Reading', push: es ? 'Empujar dentro' : 'Push in' };

const station = document.querySelector('.station');
const drive = document.querySelector('.drive');
const well = document.querySelector('.peek-well');
const screen = document.querySelector('.screen');
const state = screen.querySelector('.screen__state');
const out = screen.querySelector('.screen__out');
const ejectBtn = screen.querySelector('.screen__eject');
const cta = document.querySelector('.deck .cta');
const bioEntry = document.querySelector('.entry--bio');
const entries = [...document.querySelectorAll('.entry:not(.entry--bio)')];

let loaded = null;
let busy = false;
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

// Where a disk sits right above the slot, at the size of the peeking disk.
function dock(width) {
  const r = well.getBoundingClientRect();
  return { k: r.width / width, x: r.left, slot: r.bottom };
}

const swallow = (delay) => setTimeout(() => {
  drive.classList.add('is-swallowing');
  setTimeout(() => drive.classList.remove('is-swallowing'), 500);
}, delay);

async function flyIn(ghost, rect, { fromPeek = false } = {}) {
  if (reduceMotion.matches) { ghost.remove(); return; }
  const { k, x, slot } = dock(rect.width);
  const H = rect.height * k;
  let frames, duration;
  if (fromPeek) {
    // already above the slot and partly inside: push it the rest of the way
    const b0 = Math.min(100, Math.max(0, (slot - rect.top) / rect.height * 100));
    frames = [
      { transform: `translate(${x}px, ${rect.top}px)`, clipPath: cut(b0) },
      { transform: `translate(${x}px, ${slot}px)`, clipPath: cut(0) }
    ];
    duration = 650;
    swallow(80);
  } else {
    // lift off, arc over to the drive tilting, line up above the slot, slide in
    const top0 = slot - H;
    const mx = (rect.left + x) / 2;
    const my = Math.min(rect.top, top0) - Math.min(160, innerHeight * .18);
    frames = [
      { transform: `translate(${rect.left}px, ${rect.top}px) scale(1) rotate(0deg)`, clipPath: cut(100), offset: 0 },
      { transform: `translate(${rect.left}px, ${rect.top - 14}px) scale(1.04) rotate(2deg)`, clipPath: cut(100), offset: .08 },
      { transform: `translate(${mx}px, ${my}px) scale(${(1 + k) / 2}) rotate(-12deg)`, clipPath: cut(100), offset: .38 },
      { transform: `translate(${x}px, ${top0 - 10}px) scale(${k}) rotate(2deg)`, clipPath: cut(100), offset: .6 },
      { transform: `translate(${x}px, ${top0}px) scale(${k}) rotate(0deg)`, clipPath: cut(100), offset: .66 },
      { transform: `translate(${x}px, ${slot}px) scale(${k}) rotate(0deg)`, clipPath: cut(0), offset: 1 }
    ];
    duration = 1500;
    swallow(duration * .66);
  }
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

// Nothing inserted: the bio, and a disk sticking out asking to be pushed in.
function showDefault() {
  const title = bioEntry ? render(bioEntry) : null;
  state.textContent = `${bioEntry?.dataset.code ?? ''} · ${title?.textContent ?? ''}`;
  document.body.classList.add('is-empty');
  screen.classList.add('is-default');
  ejectBtn.hidden = true;
  if (cta) cta.hidden = false;
  showPeek();
}

async function insert(entry, { ghost, rect, fromPeek = false } = {}) {
  if (busy || entry === loaded) return;
  busy = true;
  if (loaded) await eject({ silent: true, quiet: true });
  hidePeek();
  document.body.classList.remove('is-empty');
  if (cta) cta.hidden = true;

  // bring the drive into view; the disk is lifted from where it was
  const btn = entry.querySelector('.entry__disk');
  rect ??= btn.getBoundingClientRect();
  const s = station.getBoundingClientRect();
  if (s.bottom < 80 || s.top > innerHeight * .5) station.scrollIntoView({ block: 'start' });
  ghost ??= ghostFrom(entry, rect);
  entry.classList.add('is-out');

  await flyIn(ghost, rect, { fromPeek });
  screen.classList.remove('is-default');
  drive.classList.add('is-loaded', 'is-reading');
  state.textContent = `${T.reading} ${entry.dataset.code}…`;
  out.replaceChildren();
  await wait(900);
  drive.classList.remove('is-reading');
  const title = render(entry);
  state.textContent = `${entry.dataset.code} · ${title?.textContent ?? ''}`;
  ejectBtn.hidden = false;
  loaded = entry;
  title?.focus({ preventScroll: true });
  busy = false;
}

async function eject({ silent = false, quiet = false } = {}) {
  if (!loaded) return;
  const entry = loaded;
  loaded = null;
  // the eject key goes down for a moment
  drive.classList.add('is-ejecting');
  setTimeout(() => drive.classList.remove('is-ejecting'), 220);
  drive.classList.remove('is-loaded', 'is-reading');
  entry.classList.remove('is-out');
  entry.querySelector('.entry__disk').style.visibility = 'hidden';
  await flyOut(entry);
  entry.querySelector('.entry__disk').style.visibility = '';
  if (!quiet) showDefault();
  if (!silent) entry.querySelector('.entry__disk').focus({ preventScroll: true });
}

ejectBtn.addEventListener('click', () => { if (!busy) eject(); });

/* ---------- the disk sticking half out of the drive ---------- */

const peek = document.querySelector('.peek');
let peekIndex = 0;
function showPeek() {
  if (!peek) return;
  const entry = entries[peekIndex % entries.length];
  peek.replaceChildren(entry.querySelector('.entry__disk .disk').cloneNode(true));
  peek.dataset.target = entry.id;
  peek.setAttribute('aria-label', `${T.push}: ${entry.querySelector('.entry__title')?.textContent ?? ''}`);
  peek.hidden = false;
  entry.classList.add('is-peeking');
}
function hidePeek() {
  if (!peek) return;
  peek.hidden = true;
  entries.forEach((e) => e.classList.remove('is-peeking'));
}
peek?.addEventListener('click', () => {
  const entry = document.getElementById(peek.dataset.target);
  if (!entry || busy) return;
  const r = peek.querySelector('.disk').getBoundingClientRect();
  const rect = { left: r.left, top: r.top, width: r.width, height: r.height };
  const ghost = ghostFrom(entry, rect);
  hidePeek();
  peekIndex++;
  insert(entry, { ghost, rect, fromPeek: true });
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
showDefault();
