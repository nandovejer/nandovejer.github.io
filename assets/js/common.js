// Shared progressive enhancements. Without JS every variant is a complete,
// readable page: full bio, every chapter visible, underlines drawn.

export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const NS = 'http://www.w3.org/2000/svg';
export const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

/* ---------- The erased poem and its red thread (img 3) ---------- */

export function erasure({ startErased = true } = {}) {
  const bio = document.querySelector('.bio--erasure');
  const btn = bio?.querySelector('.bio__toggle');
  if (!btn) return;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'bio__thread');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(NS, 'path');
  svg.append(path);
  bio.prepend(svg);

  const draw = (animate) => {
    if (!bio.classList.contains('is-erased')) return;
    const box = bio.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const pts = [...bio.querySelectorAll('.keep')].flatMap((k) =>
      [...k.getClientRects()].map((r) => ({
        x: r.left - box.left + r.width / 2,
        top: r.top - box.top - 3,
        bottom: r.bottom - box.top + 3
      })));
    if (!pts.length) return;
    // Leave each box from below and enter the next from above, swinging sideways.
    let d = `M ${-24} ${pts[0].top - 34} C ${pts[0].x * .4} ${pts[0].top - 40}, ${pts[0].x} ${pts[0].top - 30}, ${pts[0].x} ${pts[0].top}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const swing = (i % 2 ? 1 : -1) * Math.min(90, box.width * .18);
      d += ` M ${a.x} ${a.bottom} C ${a.x + swing} ${a.bottom + 40}, ${b.x - swing} ${b.top - 40}, ${b.x} ${b.top}`;
    }
    const last = pts[pts.length - 1];
    d += ` M ${last.x} ${last.bottom} C ${last.x + 30} ${last.bottom + 50}, ${box.width * .8} ${last.bottom + 20}, ${box.width + 20} ${last.bottom + 60}`;
    path.setAttribute('d', d);

    const len = path.getTotalLength();
    path.style.transition = 'none';
    path.style.strokeDasharray = `${len}`;
    if (animate && !reduceMotion.matches) {
      path.style.strokeDashoffset = `${len}`;
      path.getBoundingClientRect();
      path.style.transition = 'stroke-dashoffset 2.6s cubic-bezier(.5, 0, .3, 1)';
    }
    path.style.strokeDashoffset = '0';
  };

  const setErased = (on, animate = true) => {
    bio.classList.toggle('is-erased', on);
    btn.textContent = on ? btn.dataset.full : btn.dataset.erased;
    if (on) fontsReady.then(() => draw(animate));
  };

  btn.hidden = false;
  btn.addEventListener('click', () => setErased(!bio.classList.contains('is-erased')));
  setErased(startErased, false);

  if (startErased && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries, io) => {
      if (entries.some((e) => e.isIntersecting)) { fontsReady.then(() => draw(true)); io.disconnect(); }
    }, { threshold: .3 }).observe(bio);
  }

  let lastWidth = bio.clientWidth;
  new ResizeObserver(() => {
    if (bio.clientWidth === lastWidth) return;
    lastWidth = bio.clientWidth;
    draw(false);
  }).observe(bio);
}

/* ---------- Mark elements once they come into view ---------- */

export function inView(selector, { threshold = .25, className = 'is-inview', onEnter } = {}) {
  const els = document.querySelectorAll(selector);
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => { el.classList.add(className); onEnter?.(el); });
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add(className); onEnter?.(e.target); io.unobserve(e.target); }
    });
  }, { threshold });
  els.forEach((el) => io.observe(el));
}

/* ---------- Pages that turn ---------- */

export function paging({ media = '(min-width: 64em)', scroll = true } = {}) {
  const recto = document.querySelector('.recto');
  if (!recto) return;
  const chapters = [...recto.querySelectorAll('.chapter')];
  const tocLinks = [...document.querySelectorAll('.toc a')];
  const wide = matchMedia(media);
  let current = 0;
  let pager = null;

  const indexOfHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    const i = chapters.findIndex((c) => c.id === id);
    return i < 0 ? null : i;
  };

  const show = (i, { dir = 0, focus = false, initial = false } = {}) => {
    current = Math.max(0, Math.min(chapters.length - 1, i));
    chapters.forEach((c, j) => {
      c.classList.toggle('is-current', j === current);
      c.classList.remove('turn-next', 'turn-prev');
    });
    const ch = chapters[current];
    if (dir && !reduceMotion.matches) {
      ch.classList.add(dir > 0 ? 'turn-next' : 'turn-prev');
      ch.addEventListener('animationend', () => ch.classList.remove('turn-next', 'turn-prev'), { once: true });
    }
    ch.classList.add('is-inview');
    tocLinks.forEach((a) => {
      if (a.hash === `#${ch.id}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    if (pager) {
      pager.prev.disabled = current === 0;
      pager.next.disabled = current === chapters.length - 1;
      pager.status.innerHTML = `<b>${ch.dataset.chapter}</b> ${recto.dataset.of} ${chapters[chapters.length - 1].dataset.chapter}`;
    }
    recto.dispatchEvent(new CustomEvent('chapterchange', { detail: { chapter: ch } }));
    // On first paint, touching the hash makes the browser jump to it on load.
    if (initial) return;
    if (location.hash !== `#${ch.id}`) history.replaceState(null, '', `#${ch.id}`);
    if (focus) {
      const h = ch.querySelector('.chapter__title');
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    }
    if (scroll && recto.getBoundingClientRect().top < 0) {
      recto.scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }
  };

  const makePager = () => {
    const nav = document.createElement('nav');
    nav.className = 'pager';
    nav.setAttribute('aria-label', `${recto.dataset.prev} / ${recto.dataset.next}`);
    nav.innerHTML = `
      <button class="pager__btn" type="button" data-dir="-1">← ${recto.dataset.prev}</button>
      <p class="pager__status" aria-live="polite"></p>
      <button class="pager__btn" type="button" data-dir="1">${recto.dataset.next} →</button>`;
    const [prev, next] = nav.querySelectorAll('button');
    nav.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b && !b.disabled) show(current + Number(b.dataset.dir), { dir: Number(b.dataset.dir) });
    });
    recto.append(nav);
    return { nav, prev, next, status: nav.querySelector('.pager__status') };
  };

  const onKey = (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowRight' && current < chapters.length - 1) show(current + 1, { dir: 1 });
    if (e.key === 'ArrowLeft' && current > 0) show(current - 1, { dir: -1 });
  };

  const onHash = () => {
    const i = indexOfHash();
    if (i !== null && i !== current) show(i, { dir: i > current ? 1 : -1, focus: true });
  };

  const enable = () => {
    recto.classList.add('is-paged');
    pager = makePager();
    show(indexOfHash() ?? 0, { initial: true });
    addEventListener('keydown', onKey);
    addEventListener('hashchange', onHash);
  };

  const disable = () => {
    recto.classList.remove('is-paged');
    pager?.nav.remove();
    pager = null;
    chapters.forEach((c) => c.classList.remove('is-current', 'turn-next', 'turn-prev'));
    tocLinks.forEach((a) => a.removeAttribute('aria-current'));
    removeEventListener('keydown', onKey);
    removeEventListener('hashchange', onHash);
  };

  if (wide.matches) enable();
  wide.addEventListener('change', (e) => (e.matches ? enable() : disable()));

  return {
    get current() { return current; },
    get count() { return chapters.length; },
    get enabled() { return recto.classList.contains('is-paged'); },
    go(i, { focus = false } = {}) {
      if (!recto.classList.contains('is-paged') || i === current) return;
      show(i, { dir: i > current ? 1 : -1, focus });
    }
  };
}

/* ---------- Cul-de-lampe: fit the triangle to the colophon text ---------- */

export function culDeLampe() {
  const p = document.querySelector('.colophon__text');
  if (!p?.querySelector('.cul')) return;
  const fit = () => {
    // The narrowing adds lines, which changes the height: iterate to a fixed point.
    p.style.removeProperty('--cul-h');
    let h = 0;
    for (let i = 0; i < 8; i++) {
      const lineH = parseFloat(getComputedStyle(p).lineHeight);
      const range = document.createRange();
      range.selectNodeContents(p);
      const rects = [...range.getClientRects()].filter((r) => r.width > 1);
      if (!rects.length) return;
      const textH = rects[rects.length - 1].bottom - rects[0].top;
      const next = Math.max(lineH * 3, Math.round(textH - lineH * .5));
      if (Math.abs(next - h) < 2) break;
      h = next;
      p.style.setProperty('--cul-h', `${h}px`);
    }
  };
  fontsReady.then(fit);
  let lastW = p.clientWidth;
  new ResizeObserver(() => { if (p.clientWidth !== lastW) { lastW = p.clientWidth; fit(); } }).observe(p);
}
