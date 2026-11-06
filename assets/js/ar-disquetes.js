// Archive · Disquetes — press or drag a disk into the drive to read it.
// With no disk inserted the screen shows the bio, and each variant invites
// the reader to insert one in its own way:
//   dq--bandeja   a ghost disk keeps sliding into the slot
//   dq--asomado   a real disk sticks half out of the drive: push it in
//   dq--terminal  "insert disk in drive A: and press any key"
import { reduceMotion } from './ar-common.js';

const es = document.documentElement.lang === 'es';
const T = { reading: es ? 'Leyendo' : 'Reading', push: es ? 'Empujar dentro' : 'Push in' };
const variant = [...document.body.classList].find((c) => c.startsWith('dq--'))?.slice(4);

const station = document.querySelector('.station');
const drive = document.querySelector('.drive');
const slot = drive.querySelector('.drive__slot');
const screen = document.querySelector('.screen');
const state = screen.querySelector('.screen__state');
const out = screen.querySelector('.screen__out');
const ejectBtn = screen.querySelector('.screen__eject');
const screenCta = screen.querySelector('.screen__cta');
const deckCta = document.querySelector('.deck .cta');
const bioEntry = document.querySelector('.entry--bio');
const entries = [...document.querySelectorAll('.entry:not(.entry--bio)')];

let loaded = null;
let busy = false;
const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion.matches ? 0 : ms));

/* ---------- the disk in flight ---------- */

function ghostFrom(entry, rect) {
  const g = entry.querySelector('.entry__disk .disk').cloneNode(true);
  g.classList.add('disk-ghost');
  g.style.width = `${rect.width}px`;
  g.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
  document.body.append(g);
  return g;
}

function slotTarget(rect) {
  const s = slot.getBoundingClientRect();
  const k = (s.width * .5) / rect.width;
  const x = s.left + s.width / 2 - (rect.width * k) / 2;
  return { k, x, above: s.top - rect.height * k - 8, into: s.top + s.height / 2 };
}

async function flyIn(ghost, rect) {
  if (reduceMotion.matches) { ghost.remove(); return; }
  const { k, x, above, into } = slotTarget(rect);
  const a = ghost.animate([
    { transform: `translate(${rect.left}px, ${rect.top}px) scale(1) rotate(0deg)` },
    { transform: `translate(${x}px, ${above}px) scale(${k}) rotate(-4deg)`, offset: .6 },
    { transform: `translate(${x}px, ${into}px) scale(${k}, .01)` }
  ], { duration: 900, easing: 'cubic-bezier(.5, 0, .2, 1)', fill: 'forwards' });
  await a.finished;
  ghost.remove();
}

async function flyOut(entry) {
  const btn = entry.querySelector('.entry__disk');
  const rect = btn.getBoundingClientRect();
  if (reduceMotion.matches || rect.bottom < 0 || rect.top > innerHeight) return;
  const ghost = ghostFrom(entry, rect);
  const { k, x, above, into } = slotTarget(rect);
  const a = ghost.animate([
    { transform: `translate(${x}px, ${into}px) scale(${k}, .01)` },
    { transform: `translate(${x}px, ${above}px) scale(${k}) rotate(3deg)`, offset: .35 },
    { transform: `translate(${rect.left}px, ${rect.top}px) scale(1) rotate(0deg)` }
  ], { duration: 800, easing: 'cubic-bezier(.5, 0, .2, 1)', fill: 'forwards' });
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

// Nothing inserted: the bio, and the invitation to insert a disk.
function showDefault() {
  const title = bioEntry ? render(bioEntry) : null;
  state.textContent = `${bioEntry?.dataset.code ?? ''} · ${title?.textContent ?? ''}`;
  document.body.classList.add('is-empty');
  screen.classList.add('is-default');
  ejectBtn.hidden = true;
  if (screenCta) screenCta.hidden = false;
  if (deckCta) deckCta.hidden = false;
  showPeek();
}

async function insert(entry, { ghost, rect } = {}) {
  if (busy || entry === loaded) return;
  busy = true;
  if (loaded) await eject({ silent: true, quiet: true });
  hidePeek();
  document.body.classList.remove('is-empty');
  if (screenCta) screenCta.hidden = true;
  if (deckCta) deckCta.hidden = true;

  // bring the drive into view; the disk is lifted from where it was
  const btn = entry.querySelector('.entry__disk');
  rect ??= btn.getBoundingClientRect();
  const s = station.getBoundingClientRect();
  if (s.bottom < 80 || s.top > innerHeight * .5) station.scrollIntoView({ block: 'start' });
  ghost ??= ghostFrom(entry, rect);
  entry.classList.add('is-out');

  await flyIn(ghost, rect);
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
  const back = flyOut(entry);
  entry.classList.remove('is-out');
  entry.querySelector('.entry__disk').style.visibility = 'hidden';
  await back;
  entry.querySelector('.entry__disk').style.visibility = '';
  if (!quiet) showDefault();
  if (!silent) entry.querySelector('.entry__disk').focus({ preventScroll: true });
}

ejectBtn.addEventListener('click', () => { if (!busy) eject(); });

/* ---------- variant: a disk sticking half out of the drive ---------- */

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
  const rect = peek.querySelector('.disk').getBoundingClientRect();
  const ghost = ghostFrom(entry, rect);
  hidePeek();
  peekIndex++;
  insert(entry, { ghost, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } });
});

/* ---------- variant: "press any key" ---------- */

if (variant === 'terminal') {
  let next = 0;
  addEventListener('keydown', (e) => {
    if (loaded || busy || e.ctrlKey || e.metaKey || e.altKey) return;
    if (['Tab', 'Shift', 'Escape', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) return;
    const el = e.target instanceof Element ? e.target : null;
    if (el?.closest('a, button, input, textarea, select')) return;
    e.preventDefault();
    insert(entries[next++ % entries.length]);
  });
}

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
    const rect = ghost.getBoundingClientRect();
    if (overDrive(e.clientX, e.clientY)) {
      insert(entry, { ghost, rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height } });
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
