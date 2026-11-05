// Abecedario · Micrografía — a magnifier for letters made of text.
import { specimenBasics } from './specimen-kit.js';

specimenBasics();

const MIN = 1, MAX = 8;

document.querySelectorAll('.micro').forEach((fig) => {
  const vp = fig.querySelector('.micro__viewport');
  const canvas = fig.querySelector('.micro__canvas');
  const controls = fig.querySelector('.micro__controls');
  const range = fig.querySelector('.micro__range');
  const value = fig.querySelector('.micro__value');
  const outline = fig.querySelector('.micro__outline');
  controls.hidden = false;
  fig.querySelector('.micro__hint').hidden = false;

  // the point of the window to zoom towards: some ink of the letter
  const inkPoint = () => {
    const [fx, fy] = (fig.dataset.ink || '.5,.5').split(',').map(Number);
    const box = outline.getBBox();             // in SVG units (1200 × 1420)
    const k = vp.clientWidth / 1200;           // SVG units → px at ×1
    // where that point is now, given the current zoom and pan
    return [x + (box.x + box.width * fx) * k * z, y + (box.y + box.height * fy) * k * z];
  };

  let z = 1, x = 0, y = 0;

  const apply = () => {
    const w = vp.clientWidth, h = vp.clientHeight;
    // keep the letter covering the window: no empty edges when zoomed
    x = Math.min(0, Math.max(w - w * z, x));
    y = Math.min(0, Math.max(h - h * z, y));
    canvas.style.setProperty('--z', z);
    canvas.style.setProperty('--x', `${x}px`);
    canvas.style.setProperty('--y', `${y}px`);
    range.value = z;
    value.textContent = `×${Math.round(z * 10) / 10}`;
    fig.classList.toggle('is-zoomed', z > 1.01);
  };

  // zoom keeping the point (cx, cy) of the window fixed
  const zoomTo = (nz, cx = vp.clientWidth / 2, cy = vp.clientHeight / 2) => {
    nz = Math.min(MAX, Math.max(MIN, nz));
    x = cx - (cx - x) * (nz / z);
    y = cy - (cy - y) * (nz / z);
    z = nz;
    apply();
  };

  range.addEventListener('input', () => zoomTo(Number(range.value), ...inkPoint()));
  controls.addEventListener('click', (e) => {
    const b = e.target.closest('[data-zoom]');
    if (b) zoomTo(z * (b.dataset.zoom > 0 ? 1.6 : 1 / 1.6), ...inkPoint());
  });

  const local = (e) => {
    const r = vp.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  vp.addEventListener('dblclick', (e) => {
    const [cx, cy] = local(e);
    zoomTo(z >= MAX - .01 ? 1 : z * 2.5, cx, cy);
  });

  // trackpad pinch arrives as ctrl+wheel; plain wheel keeps scrolling the page
  vp.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const [cx, cy] = local(e);
    zoomTo(z * Math.exp(-e.deltaY * .01), cx, cy);
  }, { passive: false });

  // drag to pan, two fingers to pinch
  const pts = new Map();
  let start = null;
  vp.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, local(e));
    if (pts.size === 1 && z <= 1.01) return; // let a single finger scroll the page
    vp.setPointerCapture(e.pointerId);
    fig.classList.add('is-panning');
    start = { z, x, y, pts: new Map(pts) };
  });
  vp.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, local(e));
    const [a, b] = [...pts.values()];
    const [a0, b0] = [...start.pts.values()];
    if (pts.size >= 2 && b && b0) {
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const d0 = Math.hypot(a0[0] - b0[0], a0[1] - b0[1]) || 1;
      const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
      z = start.z; x = start.x; y = start.y;
      zoomTo(start.z * d / d0, cx, cy);
    } else {
      x = start.x + (a[0] - a0[0]);
      y = start.y + (a[1] - a0[1]);
      apply();
    }
  });
  const end = (e) => {
    pts.delete(e.pointerId);
    if (!pts.size) { start = null; fig.classList.remove('is-panning'); }
    else start = { z, x, y, pts: new Map(pts) };
  };
  vp.addEventListener('pointerup', end);
  vp.addEventListener('pointercancel', end);

  new ResizeObserver(apply).observe(vp);
  apply();
});
