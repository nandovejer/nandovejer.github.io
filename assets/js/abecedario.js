// Specimen · Abecedario — the glyph table drives the pages.
import { paging, reduceMotion } from './common.js';
import { specimenBasics } from './specimen-kit.js';

specimenBasics();

const recto = document.querySelector('.recto');
const cells = [...document.querySelectorAll('.glyphs__cell')];
let first = true;

// Mark the chosen glyph like a font editor's selection, and bring the
// inspector into view on small screens where it sits below the table.
recto.addEventListener('chapterchange', (e) => {
  const ch = e.detail.chapter;
  cells.forEach((c) => {
    if (c.hash === `#${ch.id}`) c.setAttribute('aria-current', 'true');
    else c.removeAttribute('aria-current');
  });
  if (first) { first = false; ch.classList.add('was-drawn'); return; }
  const top = ch.getBoundingClientRect().top;
  if (top > innerHeight * .75 || top < 0) {
    ch.scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }
});

// One glyph at a time, at every size.
paging({ media: 'all', scroll: false });
