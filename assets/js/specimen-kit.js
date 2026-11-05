// What every Specimen layout shares: tracking that "sets" as type appears,
// the cul-de-lampe colophon and the live specimen tester.
import { inView, culDeLampe } from './common.js';

export function specimenBasics() {
  inView('.titlepage, .chapter, .specimen', { threshold: .2 });
  culDeLampe();

  const tester = document.querySelector('.specimen__tester');
  if (tester) {
    const input = tester.querySelector('input');
    const output = tester.querySelector('output');
    const fallback = output.textContent;
    tester.hidden = false;
    input.addEventListener('input', () => { output.textContent = input.value.trim() || fallback; });
  }
}
