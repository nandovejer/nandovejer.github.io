// Archive · shared helpers.
import { holdHead } from './chrome.js';

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Scrolls by dy over ms with its own easing, so the end time is known.
export function scrollAlong(dy, ms) {
  if (!dy) return;
  holdHead(reduceMotion.matches ? 100 : ms + 150);
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
export function glideTo(el, block) {
  return new Promise((resolve) => {
    holdHead(1200);
    const done = () => { removeEventListener('scrollend', done); clearTimeout(t); holdHead(150); resolve(); };
    const t = setTimeout(done, reduceMotion.matches ? 0 : 900);
    addEventListener('scrollend', done, { once: true });
    el.scrollIntoView({ block, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  });
}
