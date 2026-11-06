// Grid · Escalera — the retro stripe as a pixel staircase through the empty cells.
import { grid, emptyCells, fxLayer } from './ar-grid.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const STRIPE = ['#c8172a', '#e2373a', '#f5832a', '#f9b874', '#f5e3c3', '#93bcc0', '#4a9db1', '#3c7898', '#29557c', '#0d3249'];
const NAVY = '#0d3249';
const fx = fxLayer();
let steps = [];
let shift = 0;
let first = true;

// t: how far below the 45° diagonal a cell is; the band sits mid-page
function colour(c, r, rows, cols) {
  const t = r - c - Math.round(rows / 2 - cols / 2 - STRIPE.length / 2) - shift;
  if (t < 0) return null;
  if (t < STRIPE.length) return STRIPE[t];
  return NAVY;
}

function build() {
  const { free, rows, cols } = emptyCells();
  fx.replaceChildren();
  fx.classList.remove('is-in');
  steps = [];
  free.forEach(({ c, r }) => {
    const col = colour(c, r, rows, cols);
    if (!col) return;
    const el = document.createElement('span');
    el.className = 'step';
    el.style.gridArea = `${r + 1} / ${c + 1}`;
    el.style.setProperty('--c', col);
    // cells appear along the diagonal, top-left to bottom-right
    el.style.setProperty('--d', first && !reduce.matches ? `${((r + c) % 60) * .025}s` : '0s');
    fx.append(el);
    steps.push({ el, c, r });
  });
  requestAnimationFrame(() => fx.classList.add('is-in'));
  first = false;
  grid.dataset.rows = rows; grid.dataset.cols = cols;
}

function recolour() {
  const rows = +grid.dataset.rows, cols = +grid.dataset.cols;
  steps.forEach(({ el, c, r }) => el.style.setProperty('--c', colour(c, r, rows, cols) ?? 'transparent'));
}

grid.addEventListener('grid:layout', build);
document.addEventListener('disk:read', () => { shift = (shift + 1) % 6; recolour(); });
document.addEventListener('disk:eject', () => { shift = 0; recolour(); });
