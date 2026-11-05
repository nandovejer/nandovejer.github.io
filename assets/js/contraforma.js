// Abecedario · Contraforma — scroll through the counter of each letter.
import { inView, reduceMotion } from './common.js';
import { specimenBasics } from './specimen-kit.js';

specimenBasics();

// The chapter "arrives" once its head is on screen.
inView('.chapter__head', { threshold: .2, onEnter: (h) => h.closest('.chapter').classList.add('has-arrived') });

const dives = [...document.querySelectorAll('.dive')].map((el) => ({
  el,
  stage: el.querySelector('.dive__stage'),
  glyph: el.querySelector('.dive__glyph')
}));

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

let ticking = false;
function frame() {
  ticking = false;
  const vh = innerHeight;
  for (const d of dives) {
    const r = d.el.getBoundingClientRect();
    if (r.bottom < -vh || r.top > vh * 1.5) continue;
    const run = r.height - vh;
    const p = Math.min(1, Math.max(0, -r.top / run));
    // the letter grows for most of the run; the counter fills the screen near the end
    const s = 1 + Math.pow(p, 2.2) * 9;
    d.glyph.style.setProperty('--s', s.toFixed(3));
    // the ink fades as you pass through, so the page beyond is clean paper
    d.glyph.style.setProperty('--o', (1 - smooth(.84, .98, p)).toFixed(3));
    d.stage.style.setProperty('--o2', (1 - smooth(.02, .2, p)).toFixed(3));
  }
}

if (!reduceMotion.matches) {
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
  addEventListener('resize', frame);
  frame();
}
