// Archive · Fichero — cards that turn over.
import { inView } from './ar-common.js';

const cards = [...document.querySelectorAll('.card')];

cards.forEach((card, i) => {
  card.style.setProperty('--i', i % 4);
  const btn = card.querySelector('.card__flip');
  const front = card.querySelector('.card__front');
  const back = card.querySelector('.card__back');
  // the button lives outside the faces, so it is always there to turn back
  card.append(btn);
  btn.hidden = false;
  card.classList.add('is-flippable');

  const set = (flipped) => {
    card.classList.toggle('is-flipped', flipped);
    btn.setAttribute('aria-expanded', String(flipped));
    btn.textContent = `${flipped ? btn.dataset.back : btn.dataset.front} ↻`;
    front.inert = flipped;   // only the visible face is reachable
    back.inert = !flipped;
  };
  set(false);
  btn.addEventListener('click', () => set(!card.classList.contains('is-flipped')));
});

inView(cards, { threshold: .1 });
