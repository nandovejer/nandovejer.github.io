// Archive · Cinta — scroll-driven tape of objects.
import { inView, countUp, rollNumber, reduceMotion } from './ar-common.js';

const tape = document.querySelector('.tape');
const track = tape.querySelector('.tape__track');
const stage = tape.querySelector('.tape__stage');
const panels = [...track.querySelectorAll('.panel')];
const counter = tape.querySelector('.tape__current .num') ?? tape.querySelector('.tape__current');
const person = document.querySelector('.person');
const wide = matchMedia('(min-width: 37.5em)');

let pinned = false;
let current = -1;
let ticking = false;

const clamp = (v) => Math.min(1, Math.max(0, v));

function frame() {
  ticking = false;
  // the name splits apart as the header leaves the screen
  const pr = person.getBoundingClientRect();
  person.style.setProperty('--sp', clamp(-pr.top / pr.height).toFixed(3));

  if (!pinned) return;
  const r = tape.getBoundingClientRect();
  const run = r.height - innerHeight;
  const p = clamp(-r.top / run);
  const max = track.scrollWidth - stage.clientWidth;
  track.style.setProperty('--x', `${(-p * max).toFixed(1)}px`);
  tape.style.setProperty('--p', p.toFixed(4));

  const i = Math.min(panels.length - 1, Math.round(p * (panels.length - 1)));
  if (i !== current) {
    current = i;
    panels.forEach((el, k) => el.classList.toggle('is-current', k === i));
    rollNumber(counter, i + 1);
  }
  // a little parallax: each plate drifts against the tape
  const mid = innerWidth / 2;
  panels.forEach((el) => {
    const b = el.getBoundingClientRect();
    if (b.right < 0 || b.left > innerWidth) return;
    const off = (b.left + b.width / 2 - mid) / innerWidth;
    el.querySelector('.panel__art').style.transform = `translateX(${(off * -40).toFixed(1)}px) rotate(${(off * -6).toFixed(2)}deg)`;
  });
}

const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };

function setPinned(on) {
  pinned = on;
  tape.classList.toggle('is-pinned', on);
  if (!on) {
    track.style.removeProperty('--x');
    panels.forEach((el) => { el.classList.remove('is-current'); el.querySelector('.panel__art').style.transform = ''; });
  }
  current = -1;
  frame();
}

// Tabbing into a panel that is off to the side: scroll to where it is in view.
track.addEventListener('focusin', (e) => {
  if (!pinned) return;
  const i = panels.indexOf(e.target.closest('.panel'));
  if (i < 0) return;
  const r = tape.getBoundingClientRect();
  const run = r.height - innerHeight;
  const top = scrollY + r.top + run * (i / (panels.length - 1));
  scrollTo({ top, behavior: 'auto' });
});

const decide = () => setPinned(wide.matches && !reduceMotion.matches);
wide.addEventListener('change', decide);
reduceMotion.addEventListener?.('change', decide);
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
decide();

inView('.figures', { onEnter: (s) => s.querySelectorAll('.count').forEach((c) => countUp(c)) });
