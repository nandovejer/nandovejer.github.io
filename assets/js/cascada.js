// Abecedario · Cascada — the waterfall pours in and opens one line at a time.
import { inView, reduceMotion } from './common.js';
import { specimenBasics } from './specimen-kit.js';

specimenBasics();

const lines = [...document.querySelectorAll('.cascade')];
lines.forEach((d, i) => d.querySelector('.cascade__row').style.setProperty('--i', i));
inView('.cascade', { threshold: .1 });

// One open at a time (for browsers without <details name>).
lines.forEach((d) => d.addEventListener('toggle', () => {
  if (!d.open) return;
  lines.forEach((o) => { if (o !== d && o.open) o.open = false; });
  // keep the opened line at the top of the view
  requestAnimationFrame(() => {
    const top = d.getBoundingClientRect().top;
    if (top < 0 || top > innerHeight * .4) {
      d.scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }
  });
}));

// Links to a chapter (the contents list, or a shared URL) open its line.
const openFromHash = () => {
  const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  const d = target?.closest('.cascade');
  if (d && !d.open) d.open = true;
};
addEventListener('hashchange', openFromHash);
openFromHash();
