// Abecedario · Cuentahílos — letters that fly into the inspector, and a loupe.
import { paging, reduceMotion, fontsReady } from './common.js';
import { specimenBasics } from './specimen-kit.js';

specimenBasics();

const recto = document.querySelector('.recto');
const cells = [...document.querySelectorAll('.glyphs__cell')];
const es = document.documentElement.lang === 'es';
let origin = null; // the cell the reader just pressed
cells.forEach((c) => c.addEventListener('click', () => { origin = c; }));

/* ---------- zoom 1: the letter flies from its slot into the inspector ---------- */

function fly(fromEl, toEl, chapter) {
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const ghost = document.createElement('span');
  ghost.className = 'zoom-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.textContent = fromEl.textContent;
  ghost.style.fontSize = getComputedStyle(fromEl).fontSize;
  ghost.style.left = `${a.left + scrollX}px`;
  ghost.style.top = `${a.top + scrollY}px`;
  document.body.append(ghost);
  const g = ghost.getBoundingClientRect();
  // scale by height (the SVG box includes the font's ascent and descent)
  const k = (b.height * .82) / g.height;
  const dx = b.left + b.width / 2 - (g.left + g.width * k / 2);
  const dy = b.top + b.height * .1 - g.top;
  chapter.classList.add('is-landing');
  const anim = ghost.animate([
    { transform: 'translate(0, 0) scale(1)', color: getComputedStyle(fromEl).color },
    { transform: `translate(${dx * .5}px, ${dy * .35}px) scale(${1 + (k - 1) * .3})`, offset: .45 },
    { transform: `translate(${dx}px, ${dy}px) scale(${k})`, color: getComputedStyle(toEl).fill }
  ], { duration: 950, easing: 'cubic-bezier(.6, 0, .2, 1)', fill: 'forwards' });
  anim.onfinish = () => { chapter.classList.remove('is-landing'); ghost.animate([{ opacity: 1 }, { opacity: 0 }], 250).onfinish = () => ghost.remove(); };
}

let first = true;
recto.addEventListener('chapterchange', (e) => {
  const ch = e.detail.chapter;
  let active = null;
  cells.forEach((c) => {
    const on = c.hash === `#${ch.id}`;
    if (on) { c.setAttribute('aria-current', 'true'); active = c; } else c.removeAttribute('aria-current');
  });
  if (first) { first = false; return; }
  const from = (origin ?? active)?.querySelector('.glyphs__char');
  origin = null;
  const to = ch.querySelector('.glyph__char');
  // land the inspector in view, then fly the letter there
  ch.scrollIntoView({ block: 'start', behavior: 'auto' });
  if (from && to && !reduceMotion.matches) {
    // the strip has just scrolled away: start from where its letter now is
    requestAnimationFrame(() => fly(from, to, ch));
  }
  refreshLoupe();
});

paging({ media: 'all', scroll: false });

/* ---------- zoom 2: the linen tester ---------- */

const book = document.querySelector('.book');
const loupe = document.createElement('div');
loupe.className = 'loupe';
loupe.setAttribute('aria-hidden', 'true');
const content = document.createElement('div');
content.className = 'loupe__content';
loupe.append(content);
document.body.append(loupe);

const toggle = document.createElement('button');
toggle.type = 'button';
toggle.className = 'loupe-toggle';
toggle.setAttribute('aria-pressed', 'false');
toggle.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="13" height="13"/><path d="M3 6h2M3 9h2M3 12h2M6 3v2M9 3v2M12 3v2M15 15l6 6"/></svg><span>${es ? 'Cuentahílos' : 'Linen tester'}</span>`;
document.body.append(toggle);

const MAG = 2.6;
let on = false;
let last = { x: innerWidth / 2, y: innerHeight / 2 };

function refreshLoupe() {
  if (!on) return;
  const clone = book.cloneNode(true);
  clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  // show everything fully set in the copy (no pending entrance animations)
  clone.querySelectorAll('.titlepage, .chapter, .specimen').forEach((el) => el.classList.add('is-inview'));
  clone.querySelectorAll('.zoom-ghost').forEach((el) => el.remove());
  clone.inert = true;
  clone.style.width = `${book.offsetWidth}px`;
  content.replaceChildren(clone);
  place(last.x, last.y);
}

function place(x, y) {
  last = { x, y };
  const r = book.getBoundingClientRect();
  const size = loupe.offsetWidth;
  const bx = x - r.left, by = y - r.top;
  loupe.style.transform = `translate(${x}px, ${y}px)`;
  content.style.transform = `translate(${size / 2 - bx * MAG}px, ${size / 2 - by * MAG}px) scale(${MAG})`;
}

const setOn = (v) => {
  on = v;
  toggle.setAttribute('aria-pressed', String(v));
  loupe.classList.toggle('is-on', v);
  if (v) refreshLoupe();
  else content.replaceChildren();
};

toggle.addEventListener('click', (e) => {
  setOn(!on);
  if (on) place(e.clientX || innerWidth / 2, (e.clientY || innerHeight / 2) - 160);
});
addEventListener('pointermove', (e) => { if (on) place(e.clientX, e.clientY); }, { passive: true });
addEventListener('scroll', () => { if (on) place(last.x, last.y); }, { passive: true });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && on) setOn(false); });
addEventListener('resize', () => refreshLoupe());
document.addEventListener('input', () => refreshLoupe());
fontsReady.then(() => refreshLoupe());
