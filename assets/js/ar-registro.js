// Archive · Registro — count, filter and sort the register.
import { inView, countUp } from './ar-common.js';

inView('.stats', { onEnter: (s) => s.querySelectorAll('.count').forEach((c) => countUp(c)) });

const table = document.querySelector('.ledger__table');
if (table) {
  const tbody = table.tBodies[0];
  const rows = [...tbody.rows];

  /* ---------- filter by material ---------- */
  const filters = document.querySelector('.filters');
  filters.hidden = false;
  filters.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    filters.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    const m = chip.dataset.material;
    rows.forEach((r) => r.classList.toggle('is-hidden', !!m && r.dataset.material !== m));
  });

  /* ---------- sort by any column ---------- */
  const numeric = new Set(['n', 'year']);
  table.querySelectorAll('thead th').forEach((th) => {
    const key = th.dataset.key;
    const label = th.querySelector('.th-label');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'th-sort';
    btn.append(label);
    th.append(btn);
    th.setAttribute('aria-sort', key === 'n' ? 'ascending' : 'none');
    btn.addEventListener('click', () => {
      const dir = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
      table.querySelectorAll('thead th').forEach((o) => o.setAttribute('aria-sort', 'none'));
      th.setAttribute('aria-sort', dir);
      const sign = dir === 'ascending' ? 1 : -1;
      const sorted = [...rows].sort((a, b) => {
        const x = a.dataset[key], y = b.dataset[key];
        return sign * (numeric.has(key) ? Number(x) - Number(y) : x.localeCompare(y, document.documentElement.lang));
      });
      const apply = () => tbody.append(...sorted);
      // rows glide to their new place where View Transitions exist
      if (document.startViewTransition) {
        sorted.forEach((r, i) => { r.style.viewTransitionName = `row-${r.dataset.n}`; });
        document.startViewTransition(apply).finished.finally(() => sorted.forEach((r) => { r.style.viewTransitionName = ''; }));
      } else apply();
    });
  });
}
