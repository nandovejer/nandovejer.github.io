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

// The colour mode, as LUZ's <luz-theme-mode>: the radios in the colophon are
// the state; a round button steps through them (Auto, light, dark) and shows
// the chosen one's icon, named "<legend>: <choice>", and a hidden status says
// it once after a choice. Light or dark goes to <html> as data-theme and is
// kept in this browser; Auto removes both and follows the system.
const modeBox = document.querySelector('.theme-mode');
if (modeBox) {
  const radios = [...modeBox.querySelectorAll('.theme-mode__input')];
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch { /* storage off */ }
  let choice = saved === 'light' || saved === 'dark' ? saved : 'auto';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-mode__button';
  const status = document.createElement('span');
  status.className = 'theme-mode__status';
  status.setAttribute('role', 'status');
  let hush = 0;
  const render = (user) => {
    const root = document.documentElement;
    if (choice === 'auto') delete root.dataset.theme; else root.dataset.theme = choice;
    const input = radios.find((r) => r.value === choice);
    if (input) input.checked = true;
    const label = input?.closest('label');
    const icon = label?.querySelector('.theme-mode__icon');
    button.replaceChildren(...(icon ? [icon.cloneNode(true)] : []));
    const name = [modeBox.querySelector('legend')?.textContent.trim(), label?.textContent.trim()].filter(Boolean).join(': ');
    button.setAttribute('aria-label', name);
    if (user) {
      status.textContent = name;
      clearTimeout(hush);
      hush = setTimeout(() => { status.textContent = ''; }, 3000);
    }
  };
  const choose = (value) => {
    choice = value;
    try { if (value === 'auto') localStorage.removeItem('theme'); else localStorage.setItem('theme', value); } catch { /* storage off */ }
    render(true);
  };
  button.addEventListener('click', () => {
    const values = radios.map((r) => r.value);
    choose(values[(values.indexOf(choice) + 1) % values.length]);
  });
  modeBox.addEventListener('change', (e) => { if (e.target.checked && e.target.value !== choice) choose(e.target.value); });
  modeBox.prepend(button, status);
  render(false);
}

// The footer shows the visitor's today as day·month·year (VI·XI·MMXXVI).
const roman = (n) => [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  .reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
document.querySelectorAll('time.today').forEach((el) => {
  const d = new Date();
  el.textContent = `${roman(d.getDate())}·${roman(d.getMonth() + 1)}·${roman(d.getFullYear())}`;
  el.dateTime = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
