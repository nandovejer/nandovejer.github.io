// Grid versions — keeps every block a whole number of square cells tall, and
// tells the effect layers (defrag, staircase) which cells are left empty.
// Emits `grid:layout` on the grid whenever the layout settles.

export const grid = document.querySelector('.g');

export const cols = () => getComputedStyle(grid).gridTemplateColumns.split(' ').length;
export const cell = () => grid.clientWidth / cols();
const rowsOf = (el) => getComputedStyle(el).gridTemplateRows.split(' ').filter(Boolean).length;

function fit() {
  const c = cell();
  grid.querySelectorAll('.fit').forEach((blk) => {
    const inner = blk.querySelector('.blk__in') ?? blk.firstElementChild;
    if (!inner) return;
    const cs = getComputedStyle(blk);
    const h = inner.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const span = Math.max(1, Math.ceil(h / c - 0.04));
    if (blk.style.gridRow !== `span ${span}`) blk.style.gridRow = `span ${span}`;
  });
  // the shelf spans as many page rows as it has rows of its own
  grid.querySelectorAll('.b-shelf').forEach((s) => { s.style.gridRow = `span ${rowsOf(s)}`; });
}

// Which cells (col, row; 0-based) hold no block.
export function emptyCells() {
  const c = cell();
  const n = cols();
  const R = rowsOf(grid);
  const g = grid.getBoundingClientRect();
  const taken = new Set();
  const mark = (el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const c0 = Math.round((r.left - g.left) / c), c1 = Math.round((r.right - g.left) / c);
    const r0 = Math.round((r.top - g.top) / c), r1 = Math.round((r.bottom - g.top) / c);
    for (let y = r0; y < r1; y++) for (let x = c0; x < c1; x++) taken.add(`${x},${y}`);
  };
  [...grid.children].forEach((el) => {
    if (el.matches('.gap, .g__fx, .g__hover')) return;
    if (el.matches('.b-shelf')) el.querySelectorAll('.blk, .entry').forEach(mark);
    else mark(el);
  });
  const free = [];
  for (let y = 0; y < R; y++) for (let x = 0; x < n; x++) if (!taken.has(`${x},${y}`)) free.push({ c: x, r: y });
  return { free, cols: n, rows: R };
}

// An absolutely positioned layer with the page's grid, under the blocks.
export function fxLayer() {
  let fx = grid.querySelector('.g__fx');
  if (!fx) {
    fx = document.createElement('div');
    fx.className = 'g__fx';
    fx.setAttribute('aria-hidden', 'true');
    grid.prepend(fx);
  }
  return fx;
}

let queued = false;
function relayout() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    fit();
    requestAnimationFrame(() => grid.dispatchEvent(new CustomEvent('grid:layout')));
  });
}

// Cuaderno: the empty cell under the pointer is marked.
function hoverCells() {
  const mark = document.createElement('span');
  mark.className = 'g__hover';
  mark.setAttribute('aria-hidden', 'true');
  grid.append(mark);
  let free = new Set();
  grid.addEventListener('grid:layout', () => { free = new Set(emptyCells().free.map((f) => `${f.c},${f.r}`)); });
  grid.addEventListener('pointermove', (e) => {
    const c = cell();
    const g = grid.getBoundingClientRect();
    const x = Math.floor((e.clientX - g.left) / c), y = Math.floor((e.clientY - g.top) / c);
    const on = free.has(`${x},${y}`);
    mark.classList.toggle('is-on', on);
    if (on) Object.assign(mark.style, { left: `${x * c + 1}px`, top: `${y * c + 1}px`, width: `${c - 1}px`, height: `${c - 1}px` });
  });
  grid.addEventListener('pointerleave', () => mark.classList.remove('is-on'));
}

if (grid) {
  if (document.body.classList.contains('gv--cuaderno') && matchMedia('(hover: hover)').matches) hoverCells();
  const ro = new ResizeObserver(relayout);
  ro.observe(grid);
  grid.querySelectorAll('.fit > .blk__in').forEach((el) => ro.observe(el));
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(relayout);
  relayout();
}
