// Flat, single-ink silhouettes. Everything uses currentColor so each edition
// tints them with its own ink, and `var(--paper)` punches holes that follow
// the paper colour in light and dark mode.

const svg = (viewBox, body, cls = 'plate__art') =>
  `<svg class="${cls}" viewBox="${viewBox}" aria-hidden="true" focusable="false">${body}</svg>`;

const hole = 'style="fill:var(--paper)"';
const cut = 'style="stroke:var(--paper)"';

export const plates = {
  // I. LUZ — a Roman oil lamp with its flame
  lamp: svg('0 0 220 200', `
    <g fill="currentColor">
      <path d="M26 128c0-20 34-31 80-28l58 10c13 2 15 14 2 18l-48 14c-36 10-92 8-92-14z"/>
      <path d="M68 102c6-14 32-14 38 0z"/>
      <circle cx="87" cy="86" r="6"/>
      <path d="M72 140h52l8 16H64z"/>
      <rect x="56" y="156" width="84" height="7" rx="2"/>
      <path d="M170 108c-12-12-6-32 8-48 2 18 18 26 9 42-3 7-11 10-17 6z"/>
    </g>
    <path d="M176 102c-5-6-2-14 3-20 1 8 7 11 3 18-1 2-4 3-6 2z" ${hole}/>
    <path d="M36 112c-20-4-26 20-6 24" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
    <g stroke="currentColor" stroke-width="4" stroke-linecap="round">
      <path d="M179 44V30M202 62l10-8M156 60l-10-8M206 88h10"/>
    </g>
    <path d="M34 128h120" fill="none" stroke-width="3" ${cut}/>`),

  // II. IKAY — a fingerprint under a magnifying glass
  fingerprint: svg('0 0 200 200', `
    <defs><clipPath id="fp-lens"><circle cx="84" cy="84" r="52"/></clipPath></defs>
    <g clip-path="url(#fp-lens)" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">
      <path d="M78 96c0-8 4-12 8-12s8 4 8 12v6"/>
      <path d="M68 104V94c0-12 8-20 18-20s18 8 18 20v14" stroke-dasharray="30 6"/>
      <path d="M58 112V92c0-18 12-30 28-30s28 12 28 30v22" stroke-dasharray="44 7"/>
      <path d="M48 120V90c0-24 16-40 38-40s38 16 38 40v26" stroke-dasharray="22 6 60 8"/>
      <path d="M38 124V88c0-30 20-50 48-50s48 20 48 50v30" stroke-dasharray="70 9"/>
      <path d="M30 124V86c0-36 24-58 56-58s56 22 56 58v34" stroke-dasharray="38 7 90 10"/>
      <path d="M86 92v34M74 112v22M98 118v20" stroke-dasharray="14 6"/>
    </g>
    <circle cx="84" cy="84" r="60" fill="none" stroke="currentColor" stroke-width="12"/>
    <path d="M128 128l52 52" stroke="currentColor" stroke-width="22" stroke-linecap="round"/>
    <path d="M126 126l12 12" stroke="currentColor" stroke-width="30"/>`),

  // IV. ¿Quién canta hoy? — a carnival half-mask with plumes and a stick
  mask: svg('0 0 200 200', `
    <g fill="currentColor">
      <path d="M36 66c-12-30 0-52 22-62-6 22-2 42-10 60z"/>
      <path d="M52 64c-2-28 14-46 38-50-10 18-14 36-28 52z"/>
      <path d="M68 70c6-24 26-36 48-34-14 12-22 26-40 38z"/>
      <path fill-rule="evenodd" d="M16 98c14-30 58-34 84-16 26-18 70-14 84 16 6 28-14 48-42 44-20-3-30-17-42-17s-22 14-42 17c-28 4-48-16-42-44zM50 100c10-11 30-11 38 2-8 11-30 13-38-2zM112 102c8-13 28-13 38-2-8 15-30 13-38 2z"/>
    </g>
    <path d="M176 128l-34 66" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>
    <path d="M100 82v14" stroke-width="2" ${cut}/>`),

  // V. Ares API — a Spanish guitar
  guitar: svg('0 0 200 200', `
    <g transform="rotate(-32 100 100)">
      <g fill="currentColor">
        <rect x="92" y="-6" width="16" height="34" rx="3"/>
        <rect x="95" y="24" width="10" height="66" />
        <circle cx="100" cy="102" r="28"/>
        <circle cx="100" cy="152" r="38"/>
        <rect x="80" y="110" width="40" height="30"/>
      </g>
      <circle cx="100" cy="122" r="11" ${hole}/>
      <rect x="86" y="162" width="28" height="6" rx="2" ${hole}/>
      <g stroke-width="1.2" ${cut}>
        <path d="M97 26v138M100 26v138M103 26v138"/>
      </g>
      <g fill="currentColor"><circle cx="88" cy="2" r="3.5"/><circle cx="88" cy="14" r="3.5"/><circle cx="112" cy="2" r="3.5"/><circle cx="112" cy="14" r="3.5"/></g>
    </g>`),

  // VII. Acme Studio — an escutcheon, its keyhole and a key
  keyhole: svg('0 0 220 200', `
    <path fill="currentColor" fill-rule="evenodd" d="M50 18h60a30 30 0 0 1 30 30v104a30 30 0 0 1-30 30H50a30 30 0 0 1-30-30V48a30 30 0 0 1 30-30zM80 64a17 17 0 0 0-9 31l-8 42h34l-8-42a17 17 0 0 0-9-31z"/>
    <g fill="currentColor"><circle cx="34" cy="34" r="4"/><circle cx="126" cy="34" r="4"/><circle cx="34" cy="166" r="4"/><circle cx="126" cy="166" r="4"/></g>
    <g transform="rotate(14 182 110)" fill="currentColor">
      <path fill-rule="evenodd" d="M182 30a21 21 0 1 1 0 42 21 21 0 0 1 0-42zm0 11a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/>
      <rect x="178" y="70" width="8" height="104"/>
      <rect x="186" y="154" width="15" height="7"/>
      <rect x="186" y="140" width="10" height="6"/>
      <rect x="174" y="76" width="16" height="5" rx="2"/>
    </g>`)
};

// Engraving textures, defined once per page and referenced by url(#…).
// Kept out of display:none (patterns there stop rendering in some browsers).
export const engravingDefs = `<svg class="svg-defs" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute">
  <defs>
    <pattern id="burin" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
      <path d="M0 0v5" stroke="currentColor" stroke-width="1.6"/>
    </pattern>
    <pattern id="burin-cross" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
      <path d="M0 0v6M0 0h6" stroke="currentColor" stroke-width="1.3"/>
    </pattern>
    <pattern id="stipple" width="6" height="6" patternUnits="userSpaceOnUse">
      <circle cx="1.2" cy="1.4" r=".75" fill="currentColor"/><circle cx="4.2" cy="4.4" r=".55" fill="currentColor"/>
    </pattern>
  </defs>
</svg>`;

// Hero for the engraving variant: a sailing ship under stippled clouds (img 7).
// Uses the patterns above; outlines in currentColor.
// A square sail hanging from its yard, bellied forward by the wind.
const sail = (x, y1, y2, w) =>
  `<path d="M${x - w} ${y1}Q${x + 6} ${y1 + 5} ${x + w} ${y1}Q${x + w + 7} ${(y1 + y2) / 2} ${x + w + 3} ${y2}Q${x + 4} ${y2 + 8} ${x - w - 3} ${y2}Q${x - w + 4} ${(y1 + y2) / 2} ${x - w} ${y1}Z"/>` +
  `<path d="M${x - w - 3} ${y1}h${2 * w + 6}" fill="none" stroke-width="2.6"/>`;
const cloud = (cx, cy, s) => `<g transform="translate(${cx} ${cy}) scale(${s})">
  <path d="M-62 14c-14 0-18-18-4-22 0-16 20-22 30-12 6-18 34-20 42-4 12-10 32-2 30 14 16 0 18 22 2 24z"/></g>`;

export const ship = `<svg class="hero__art" viewBox="0 0 480 270" aria-hidden="true" focusable="false">
  <g class="hero__clouds" fill="url(#stipple)" stroke="currentColor" stroke-width="1">
    ${cloud(92, 58, 1.05)}${cloud(408, 40, .85)}${cloud(36, 150, .55)}${cloud(456, 136, .55)}
  </g>
  <g class="hero__ship">
    <g fill="url(#burin)" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">
      <path d="M392 180L304 60l14 132z"/>
      <path d="M372 186L304 104l10 88z"/>
      <path d="M138 198L182 104v94z"/>
    </g>
    <g stroke="currentColor" stroke-width="3" stroke-linecap="round">
      <path d="M190 214V34M246 214V20M302 214V46M326 204l70-28"/>
    </g>
    <g fill="url(#burin)" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
      ${sail(190, 58, 96, 17)}${sail(190, 104, 148, 21)}${sail(190, 156, 196, 23)}
      ${sail(246, 44, 86, 19)}${sail(246, 94, 142, 23)}${sail(246, 150, 196, 25)}
      ${sail(302, 70, 106, 15)}${sail(302, 114, 154, 18)}${sail(302, 162, 198, 19)}
    </g>
    <g fill="currentColor">
      <path d="M190 34q12 2 22 7-10 5-22 7zM246 20q14 2 26 7-12 5-26 7zM302 46q10 2 20 6-10 4-20 6z"/>
    </g>
    <path d="M128 204h214l-10 10c-6 18-24 30-58 32h-80c-34-2-52-14-58-30z" fill="url(#burin-cross)" stroke="currentColor" stroke-width="2"/>
    <path d="M128 204l-6-20h46l4 20z" fill="url(#burin)" stroke="currentColor" stroke-width="2"/>
    <path d="M140 222h196" stroke="currentColor" stroke-width="1.5"/>
  </g>
</svg>`;

export const ornaments = {
  // three-star asterism
  asterism: svg('0 0 120 48', `
    <g fill="currentColor">
      <path d="M60 2l3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/>
      <path d="M44 22l3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/>
      <path d="M76 22l3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/>
    </g>`, 'ornament__art'),

  // symmetric vine scroll with a lozenge at its heart
  vine: svg('0 0 160 48', `
    <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
      <path d="M72 24c-8-14-30-16-38-4-6 10 4 20 12 14 6-4 2-12-4-10"/>
      <path d="M88 24c8-14 30-16 38-4 6 10-4 20-12 14-6-4-2-12 4-10"/>
      <path d="M72 24c-10 10-30 14-50 10M88 24c10 10 30 14 50 10"/>
    </g>
    <path fill="currentColor" d="M80 14l10 10-10 10-10-10z"/>
    <g fill="currentColor"><circle cx="20" cy="34" r="3"/><circle cx="140" cy="34" r="3"/></g>`, 'ornament__art'),

  // hedera, the printer's ivy leaf
  hedera: svg('0 0 160 48', `
    <path fill="currentColor" d="M80 44C64 34 50 28 50 16c0-8 8-11 14-8 7 3 12 8 16 14 4-6 9-11 16-14 6-3 14 0 14 8 0 12-14 18-30 28z"/>
    <path d="M80 44c2 2 4 3 6 2" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <g stroke="currentColor" stroke-width="1.5"><path d="M8 24h34M118 24h34"/></g>
    <g fill="currentColor"><circle cx="8" cy="24" r="2.5"/><circle cx="152" cy="24" r="2.5"/></g>`, 'ornament__art'),

  // tail-piece used between chapters
  fleuron: svg('0 0 60 24', `
    <path fill="currentColor" d="M30 2c4 6 10 8 16 10-6 2-12 4-16 10-4-6-10-8-16-10 6-2 12-4 16-10z"/>
    <g fill="currentColor"><circle cx="6" cy="12" r="2"/><circle cx="54" cy="12" r="2"/></g>`, 'ornament__art')
};
