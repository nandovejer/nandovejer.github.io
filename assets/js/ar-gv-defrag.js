// Grid · Defrag — the empty cells behave like the sectors of a disk.
import { grid, emptyCells, fxLayer } from './ar-grid.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const STRIPE = ['#c8172a', '#e2373a', '#f5832a', '#f9b874', '#93bcc0', '#4a9db1', '#3c7898', '#29557c'];
const fx = fxLayer();
let secs = [];          // [{el, c, r}] in reading order
let state = { mode: 'fragmented', color: null };

// a stable pseudo-random number per cell
const rand = (c, r) => { let h = (c * 73856093) ^ (r * 19349663); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function paint({ animate = false } = {}) {
  const used = state.mode === 'defragmented' ? Math.round(secs.length * .28) : 0;
  secs.forEach((s, i) => {
    let color = 'transparent', o = 0;
    if (state.mode === 'fragmented') {
      const v = rand(s.c, s.r);
      if (v < .24) { color = STRIPE[Math.floor(rand(s.r, s.c) * STRIPE.length)]; o = .55; }
    } else if (i < used) { color = state.color; o = .85; }
    s.el.style.setProperty('--c', color);
    s.el.style.setProperty('--o', o);
    s.el.style.setProperty('--d', animate && !reduce.matches ? `${(i / secs.length) * .9}s` : '0s');
  });
}

function build() {
  const { free } = emptyCells();
  fx.replaceChildren();
  secs = free.map(({ c, r }) => {
    const el = document.createElement('span');
    el.className = 'sec';
    el.style.gridArea = `${r + 1} / ${c + 1}`;
    fx.append(el);
    return { el, c, r };
  });
  paint();
}

// a reading head sweeping the sectors while the drive reads
async function scan() {
  if (reduce.matches) return;
  const step = Math.max(1, Math.floor(secs.length / 40));
  for (let i = 0; i < secs.length; i += step) {
    secs[i].el.classList.add('is-scan');
    setTimeout(() => secs[i]?.el.classList.remove('is-scan'), 120);
    await new Promise((r) => setTimeout(r, 900 / (secs.length / step)));
  }
}

grid.addEventListener('grid:layout', build);
document.addEventListener('disk:read', (e) => {
  state = { mode: 'defragmented', color: e.detail.color || '#f5832a' };
  scan();
  paint({ animate: true });
});
document.addEventListener('disk:eject', () => {
  state = { mode: 'fragmented', color: null };
  paint({ animate: true });
});

// a small legend under the drive, like the defrag window
const deck = document.querySelector('.deck');
if (deck) {
  const es = document.documentElement.lang === 'es';
  const legend = document.createElement('p');
  legend.className = 'defrag-legend';
  legend.setAttribute('aria-hidden', 'true');
  legend.innerHTML = `<span style="--sw:#f5832a">${es ? 'Fragmentado' : 'Fragmented'}</span><span style="--sw:#29557c">${es ? 'Contiguo' : 'Contiguous'}</span><span style="--sw:transparent">${es ? 'Libre' : 'Free'}</span>`;
  deck.append(legend);
}
