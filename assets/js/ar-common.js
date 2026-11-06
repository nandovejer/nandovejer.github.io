// Archive · shared helpers.
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Add a class once elements come into view.
export function inView(els, { threshold = .15, className = 'is-inview', onEnter } = {}) {
  const list = typeof els === 'string' ? document.querySelectorAll(els) : els;
  if (!('IntersectionObserver' in window)) {
    list.forEach((el) => { el.classList.add(className); onEnter?.(el); });
    return;
  }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add(className); onEnter?.(e.target); io.unobserve(e.target); }
  }), { threshold });
  list.forEach((el) => io.observe(el));
}

// Count a number up (keeps its zero padding).
export function countUp(el, { duration = 1200 } = {}) {
  const to = Number(el.dataset.to);
  const width = el.textContent.trim().length;
  if (reduceMotion.matches || !to) { el.textContent = String(to).padStart(width, '0'); return; }
  const t0 = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = String(Math.round(to * eased)).padStart(width, '0');
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Roll the digits of a "num" element to a new value, split-flap style.
export function rollNumber(numEl, n, { pad = 3 } = {}) {
  const s = String(n).padStart(pad, '0');
  const lead = s.match(/^0*/)[0].slice(0, s.length - 1);
  const render = (txt) => {
    const l = txt.slice(0, lead.length), r = txt.slice(lead.length);
    numEl.innerHTML = `<span class="num__ghost">${l}</span>${r}`;
  };
  if (reduceMotion.matches) { render(s); return; }
  let i = 0;
  const steps = 7;
  const id = setInterval(() => {
    i++;
    if (i >= steps) { clearInterval(id); render(s); return; }
    render(s.split('').map((c, k) => (k < lead.length ? c : String((Number(c) + steps - i) % 10))).join(''));
  }, 45);
}
