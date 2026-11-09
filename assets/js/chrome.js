// Chrome · the header and footer every version shares (see chrome.css).
//   · the masthead's height as --head-h, so anchors and glides stop under it
//   · the masthead hides going down and comes back going up
//   · the footer's today, in Roman numerals
// Each version's own script imports holdHead (through ar-common.js's glides)
// so the page's own glides do not hide or bring back the masthead.

// While the page glides on its own, the masthead keeps its place (shown or
// hidden): only the visitor's own scrolling hides or brings it back.
let headHoldUntil = 0;
export const holdHead = (ms) => { headHoldUntil = Math.max(headHoldUntil, performance.now() + ms); };

const head = document.querySelector('.masthead');
if (head) {
  const setHead = () => {
    document.documentElement.style.setProperty('--head-h', `${Math.round(head.getBoundingClientRect().height)}px`);
  };
  new ResizeObserver(setHead).observe(head);
  setHead();

  // It stays while the language list is open or focus is inside it.
  const langMenu = head.querySelector('[popover]');
  let lastY = scrollY, ticking = false;
  const update = () => {
    ticking = false;
    const y = Math.max(0, scrollY), dy = y - lastY;
    if (performance.now() < headHoldUntil) { lastY = y; return; }
    if (Math.abs(dy) < 6) return; // ignore jitter
    lastY = y;
    const busyHead = head.contains(document.activeElement) || langMenu?.matches(':popover-open');
    head.classList.toggle('is-hidden', dy > 0 && y > head.offsetHeight && !busyHead);
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  head.addEventListener('focusin', () => head.classList.remove('is-hidden'));

  // The menu on phones: the three bars open and close the panel from the right;
  // a link in it, Esc, a click on the dimmed page or the masthead sliding away
  // close it, and the page under it does not scroll while it is open.
  const menu = head.querySelector('.masthead__menu');
  if (menu) {
    const setOpen = (on) => { head.classList.toggle('is-open', on); menu.setAttribute('aria-expanded', String(on)); document.documentElement.classList.toggle('menu-open', on); };
    menu.addEventListener('click', () => setOpen(!head.classList.contains('is-open')));
    head.querySelector('.masthead__drawer').addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && head.classList.contains('is-open')) { setOpen(false); menu.focus(); } });
    // outside the masthead, or on the dimmed page (the masthead's own ::before, under its bar)
    addEventListener('click', (e) => { if (!head.contains(e.target) || (e.target === head && e.clientY > head.getBoundingClientRect().bottom)) setOpen(false); });
    new MutationObserver(() => { if (head.classList.contains('is-hidden')) setOpen(false); }).observe(head, { attributes: true, attributeFilter: ['class'] });
  }
}

// The colour mode is LUZ's <luz-theme-mode> (assets/vendor/luz/theme-mode.min.js).

// The footer shows the visitor's today as day·month·year (VI·XI·MMXXVI).
const roman = (n) => [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  .reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
document.querySelectorAll('time.today').forEach((el) => {
  const d = new Date();
  el.textContent = `${roman(d.getDate())}·${roman(d.getMonth() + 1)}·${roman(d.getFullYear())}`;
  el.dateTime = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
