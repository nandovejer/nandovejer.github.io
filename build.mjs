#!/usr/bin/env node
// Portfolio · Disquetes — zero-dependency static build.
// Content: data/site.json and data/projects.json. Interface labels: data/archivo.json.
//   es/index.html, en/index.html   the portfolio
//   index.html                     sends visitors to their language
// Usage: node build.mjs

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plates } from './src/plates.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(root, f), 'utf8'));
const site = read('data/site.json');
const projects = read('data/projects.json');
const ui = read('data/archivo.json');
const LANGS = ['es', 'en'];

const esc = (s) => String(s)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const plain = (s) => s.replace(/\[\[(.+?)\]\]/g, '$1'); // the bio's erasure marks are not used here
const pretty = (u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const pad = (n) => String(n).padStart(3, '0');

// Dates in Roman numerals: 6 Nov 2026 → VI·XI·MMXXVI (day·month·year).
// The page is built with the build date; ar-disquetes.js updates it to the
// visitor's today.
const roman = (n) => [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  .reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
const romanDate = (d) => `${roman(d.getDate())}·${roman(d.getMonth() + 1)}·${roman(d.getFullYear())}`;
const isoToday = new Date().toISOString().slice(0, 10);

/* ---------- small pieces ---------- */

// 001 → leading zeros in ghost grey
const num = (n) => {
  const s = pad(n);
  const lead = s.match(/^0*/)[0].slice(0, s.length - 1);
  return `<span class="num"><span class="num__ghost">${lead}</span>${s.slice(lead.length)}</span>`;
};

// A real Code 128 (set B) barcode of a string: the bars encode the text, with
// its check digit, so a scanner reads it back. Each pattern is 11 modules
// (13 for the stop), 1 = bar, 0 = space.
const CODE128 = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
  '11010011100', '1100011101011',
];
const code128 = (text) => {
  const codes = [...text].map((ch) => ch.charCodeAt(0) - 32);
  if (codes.some((c) => c < 0 || c > 95)) throw new Error(`Code 128 B cannot encode "${text}"`);
  const sum = codes.reduce((acc, c, i) => acc + c * (i + 1), 104);
  const bits = [104, ...codes, sum % 103, 106].map((c) => CODE128[c]).join('');
  const quiet = 10; // modules of white on each side, as scanners need
  let bars = '', i = 0;
  while (i < bits.length) {
    if (bits[i] === '1') {
      let j = i;
      while (bits[j] === '1') j++;
      bars += `<rect x="${quiet + i}" width="${j - i}" height="40"/>`;
      i = j;
    } else i++;
  }
  return `<svg class="barcode" viewBox="0 0 ${bits.length + quiet * 2} 40" preserveAspectRatio="none" role="img" aria-label="${text}" focusable="false" shape-rendering="crispEdges"><g fill="currentColor">${bars}</g></svg>`;
};

// A deterministic barcode from any string (decorative).
const barcode = (str) => {
  let h = 2166136261, x = 0, bars = '';
  for (let i = 0; i < 46; i++) {
    h ^= str.charCodeAt(i % str.length) + i; h = Math.imul(h, 16777619) >>> 0;
    const w = 1 + (h % 3), gap = 1 + ((h >> 3) % 2);
    if (i % 2 === 0) bars += `<rect x="${x}" width="${w}" height="40"/>`;
    x += w + gap;
  }
  return `<svg class="barcode" viewBox="0 0 ${x} 40" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g fill="currentColor">${bars}</g></svg>`;
};

const cells = (rows, cls = '') => `<dl class="cells ${cls}">${rows.map(([k, v]) =>
  `<div class="cell"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

const objectOf = (p, i, t, u) => {
  const c = p[t.lang];
  const n = i + 1;
  return {
    id: p.id, n, code: `NM-${pad(n)}`, doc: `NM.${pad(n)}.${p.year}`,
    name: p.name, use: c.kicker, body: c.body, quote: c.quote,
    year: p.year, material: p.language,
    status: p.demo ? u.statusOnline : u.statusRepo,
    demo: p.demo, repo: p.repo,
    // silhouettes without internal ids (they are drawn twice per page)
    art: p.plate && p.plate !== 'fingerprint' ? plates[p.plate] : null
  };
};

const links = (o, t) => `<ul class="links">
  ${o.demo ? `<li><a href="${o.demo}">${t.demo} <span>${pretty(o.demo)}</span></a></li>` : ''}
  <li><a href="${o.repo}">${t.repo} <span>${pretty(o.repo)}</span></a></li>
</ul>`;

const socials = () => `<ul class="socials">${site.socials.map((s) =>
  `<li><a href="${s.url}" rel="me noopener"><span class="socials__label">${s.label}</span> <span class="socials__handle">${esc(s.handle)}</span></a></li>`).join('')}</ul>`;

/* ---------- the disks ---------- */

// Translucent plastic colour of each disk (img: diquete-color-transaprent)
// and the cover design pasted on it (img: disquete-cover mockups).
const LOOK = {
  bio:                 { color: 'sand',    cover: 'r284' },
  luz:                 { color: 'apricot', cover: 'orion' },
  ikay:                { color: 'steel',   cover: 'psichic' },
  'chrome-local-ai':   { color: 'teal',    cover: 'mixtape' },
  'quien-canta-hoy':   { color: 'red',     cover: 'shake' },
  'ares-api':          { color: 'orange',  cover: 'tracklist' },
  'toolbar-aem':       { color: 'blue',    cover: 'radical' },
  accesibilidad:       { color: 'crimson', cover: 'bonestorm' },
  'libros-del-mundo':  { color: 'mist',    cover: 'atlas' }
};
const pad2 = (n) => String(n).padStart(2, '0');
const miniBars = (str) => barcode(str).replace('class="barcode"', 'class="cv-bars"');

// One cover per design. Every text comes from the shared content.
const covers = {
  // big code on cream, "since" line, vertical name, colour stripes (R-284)
  r284: (o) => `
          <span class="cv-title">${o.code}</span>
          <span class="cv-sub">${esc(o.use)}<br>${o.since}</span>
          <span class="cv-vert">${esc(o.short ?? o.name)}</span>
          ${miniBars(o.code)}
          <span class="cv-stripes"></span>`,
  // meta row, black band with the title, gradient stripes, footer (ORION)
  orion: (o) => `
          <span class="cv-meta"><span>${o.code}</span><span>${o.year}</span><span>${o.material}</span></span>
          <span class="cv-band"><span class="cv-title">${esc(o.name)}</span></span>
          <span class="cv-stripes"></span>
          <span class="cv-foot"><span class="cv-num">${pad2(o.n)}</span><span class="cv-small">${esc(o.use)}</span>${miniBars(o.code)}</span>`,
  // holographic foil, heavy title, side texts, pill (PSICHIC)
  psichic: (o) => `
          <span class="cv-side cv-side--l">${o.code}</span>
          <span class="cv-side cv-side--r">${o.year}</span>
          <span class="cv-small cv-top">${o.material} · ${pad2(o.n)}</span>
          <span class="cv-title">${esc(o.name)}</span>
          <span class="cv-small">${esc(o.use)}</span>
          <span class="cv-pill">NOW</span>`,
  // halftone image block, title, vertical tag (MIXTAPE)
  mixtape: (o) => `
          <span class="cv-art"></span>
          <span class="cv-title">${esc(o.name)}</span>
          <span class="cv-vert">${o.material}</span>
          <span class="cv-small">${esc(o.use)} · ${o.year}</span>`,
  // repeated lines around a loud title, corner tags (SHAKE)
  shake: (o) => `
          <span class="cv-corner">OUT</span><span class="cv-corner cv-corner--r">NOW</span>
          <span class="cv-rep">${esc(o.use)} · ${esc(o.use)}</span>
          <span class="cv-title">${esc(o.name)}</span>
          <span class="cv-rep">${o.year} · ${o.code} · ${o.year}</span>`,
  // gradient picture with a silhouette, number box, lines (TRACKLIST)
  tracklist: (o) => `
          <span class="cv-art">${o.art ?? ''}</span>
          <span class="cv-num">${pad2(o.n)}</span>
          <span class="cv-title">${esc(o.name)}</span>
          <span class="cv-lines">${esc(o.quote)}</span>`,
  // diagonal split, title, number (RADICAL)
  radical: (o) => `
          <span class="cv-title">${esc(o.name)}</span>
          <span class="cv-tag">${o.material}</span>
          <span class="cv-num">#${pad2(o.n)}</span>
          <span class="cv-small">${esc(o.use)}</span>`,
  // slanted heavy title on cream, coloured footer (BONESTORM)
  bonestorm: (o) => `
          <span class="cv-small cv-top">${esc(o.use)}</span>
          <span class="cv-title">${esc(o.name)}</span>
          <span class="cv-sub">&amp; ${o.year}</span>
          <span class="cv-foot">${o.code}</span>`,
  // globe lines behind a two-line title (variation)
  atlas: (o) => `
          <span class="cv-globe"></span>
          <span class="cv-title">${esc(o.name)}</span>
          <span class="cv-small">${esc(o.use)} · ${o.year}</span>
          <span class="cv-num">${pad2(o.n)}</span>`
};

// A 3.5" floppy disk in translucent coloured plastic (decorative; the text is
// in the entry): the magnetic disc shows through, a metal shutter carries a
// small sticker, and a printed cover is pasted on the lower half.
const disk = (o) => {
  const look = LOOK[o.id] ?? { color: 'smoke', cover: 'orion' };
  return `
      <div class="disk disk--${look.color}" aria-hidden="true">
        <span class="disk__media"></span>
        <span class="disk__arrow"></span>
        <span class="disk__hd">HD</span>
        <span class="disk__shutter">
          <span class="disk__window"></span>
          <span class="disk__sticker"><b>NM</b><span>MF2-HD<br>Floppy Disk</span></span>
        </span>
        <span class="disk__hole disk__hole--l"></span>
        <span class="disk__hole disk__hole--r"></span>
        <span class="cover cover--${look.cover}">${covers[look.cover](o)}</span>
      </div>`;
};

const entry = (o, u, content) => `
    <li class="entry${o.id === 'bio' ? ' entry--bio' : ''}" id="${o.id}" data-code="${o.code}">
      <button type="button" class="entry__disk" hidden aria-label="${u.insert}: ${esc(o.name)}">${disk(o)}</button>
      <div class="entry__static">${disk(o)}</div>
      <div class="entry__content">
        ${content}
      </div>
    </li>`;

/* ---------- the drive and its screen ---------- */

// The front of the drive; the eject key is a real button.
const ejectIcon = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5 4 15h16z"/><rect x="4" y="17" width="16" height="3" rx=".6"/></svg>`;
const driveFront = (u) => `
    <span class="drive__bezel">
      <span class="drive__slot" aria-hidden="true"><span class="drive__flap"></span></span>
      <span class="drive__door" aria-hidden="true"></span>
      <span class="drive__led" aria-hidden="true"></span>
      <span class="drive__brand" aria-hidden="true">1.44 MB</span>
      <button type="button" class="drive__btn" aria-label="${u.eject}" title="${u.eject}">${ejectIcon}</button>
    </span>`;

const screen = (u) => `
  <div class="screen">
    <p class="screen__status" aria-live="polite"><span class="label">${u.drive}</span> <span class="screen__state">${u.driveEmpty}</span></p>
    <div class="screen__out"></div>
    <button type="button" class="screen__eject" hidden>${u.eject} ⏏</button>
  </div>`;

// the reading on the screen; beside it, the drive with the cover of the disk
// that is inside sticking out of the slot (the bio's, by default)
const station = (u) => `
<section class="station" aria-label="${u.drive}">
  ${screen(u)}
  <div class="deck">
    <div class="drive">
      <span class="now-well" aria-hidden="true"><span class="now"></span></span>
      <span class="drive__face">${driveFront(u)}</span>
    </div>
    <p class="cta" hidden><span class="cta__arrow" aria-hidden="true">↓</span> <b>${u.ctaShelf}</b></p>
  </div>
</section>`;

/* ---------- the page ---------- */

const page = (lang) => {
  const t = { ...site.i18n[lang], lang };
  const u = ui[lang];
  const other = lang === 'es' ? 'en' : 'es';
  const url = `${site.baseUrl}/${lang}/`;
  const bio = { id: 'bio', n: 0, code: 'NM-000', name: site.name, year: 'MMXXVI', material: 'HTML · CSS', use: t.kicker.split('·')[0].trim(), since: t.established, short: site.nick };
  return `<!doctype html>
<html lang="${lang}" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${site.name} · ${t.runningHead}</title>
  <meta name="description" content="${esc(t.metaDescription)}">
  <meta name="color-scheme" content="light dark">
  <link rel="canonical" href="${url}">
  ${LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${site.baseUrl}/${l}/">`).join('\n  ')}
  <meta property="og:title" content="${site.name} · ${t.runningHead}">
  <meta property="og:description" content="${esc(t.metaDescription)}">
  <meta property="og:url" content="${url}">
  <link rel="preload" href="../assets/fonts/archivo-latin-wdth-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../assets/fonts/chakra-petch-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../assets/css/archivo.css">
  <link rel="stylesheet" href="../assets/css/ar-disquetes.css">
  <link rel="stylesheet" href="../assets/css/ar-disks.css">
  <link rel="stylesheet" href="../assets/css/ar-dq-asomado.css">
  <script>document.documentElement.classList.replace('no-js','js')</script>
  <script type="module" src="../assets/js/ar-disquetes.js"></script>
</head>
<body class="ar ar--disquetes dq--asomado">
<a class="skip" href="#main">${t.skip}</a>
<header class="masthead">
  <h1 class="masthead__title"><a href="./" rel="home">${site.name} <span aria-hidden="true">/</span> ${t.kicker}</a></h1>
  <p class="masthead__lang"><a href="../${other}/" hreflang="${other}" lang="${other}">${t.otherEdition}</a></p>
</header>
<main id="main">
${station(u)}
<section class="shelf" aria-labelledby="shelf-title">
  <header class="section-head">
    <h2 id="shelf-title">${u.shelf}</h2>
    <p class="section-head__count">${num(projects.length)} ${u.objects}</p>
  </header>
  <ol class="shelf__list">
    ${entry(bio, u, `<h3 class="entry__title">${site.name}</h3>
        <p class="entry__use">${t.kicker}</p>
        <p class="entry__quote">${t.deck}</p>
        ${t.bio.map((p) => `<p>${esc(plain(p))}</p>`).join('\n        ')}
        ${socials()}`)}
    ${projects.map((p, i) => {
      const o = objectOf(p, i, t, u);
      return entry(o, u, `<h3 class="entry__title">${esc(o.name)}</h3>
        <p class="entry__use">${esc(o.use)} · ${o.year}</p>
        <p class="entry__quote">“${esc(o.quote)}”</p>
        <p>${esc(o.body)}</p>
        ${cells([[u.material, o.material], [u.status, o.status], [u.document, o.doc]], 'cells--3')}
        ${links(o, t)}`);
    }).join('')}
  </ol>
</section>
</main>
<footer class="colophon">
  <div class="colophon__doc">
    <p class="label">${u.today}</p>
    <p class="colophon__no"><time class="today" datetime="${isoToday}">${romanDate(new Date())}</time></p>
  </div>
  <p class="colophon__text">${t.colophon}</p>
  <div class="colophon__code">${code128('SOYNANDO.COM')}<span class="square" aria-hidden="true"></span></div>
</footer>
</body>
</html>
`;
};

// Sends visitors to their language; without JS, offers both.
const toLanguage = (prefix) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${site.name}</title>
  <meta name="color-scheme" content="light dark">
  ${LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${site.baseUrl}/${l}/">`).join('\n  ')}
  <link rel="alternate" hreflang="x-default" href="${site.baseUrl}/">
  <script>
    (function () {
      var l = (navigator.languages && navigator.languages[0]) || navigator.language || '';
      location.replace('${prefix}' + (/^es\\b/i.test(l) ? 'es' : 'en') + '/' + location.hash);
    })();
  </script>
</head>
<body>
  <p><a href="${prefix}es/">Edición en español</a> · <a href="${prefix}en/" hreflang="en" lang="en">English edition</a></p>
</body>
</html>
`;

/* ---------- write ---------- */

const write = (path, html) => {
  const f = join(root, path);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, html);
  console.log('✓', path);
};

rmSync(join(root, 'archivo'), { recursive: true, force: true }); // old prototype paths
for (const lang of LANGS) {
  rmSync(join(root, lang), { recursive: true, force: true });
  write(`${lang}/index.html`, page(lang));
}
write('index.html', toLanguage(''));
