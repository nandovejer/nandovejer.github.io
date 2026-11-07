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
  return `<svg class="barcode" viewBox="0 0 ${bits.length + quiet * 2} 40" preserveAspectRatio="none" aria-hidden="true" focusable="false" shape-rendering="crispEdges"><g fill="currentColor">${bars}</g></svg>`;
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
    // the covers print the main one; the card lists them all
    year: p.year, material: p.tech[0], tech: p.tech.join(' · '),
    status: p.demo ? u.statusOnline : u.statusRepo,
    demo: p.demo, repo: p.repo,
    // silhouettes without internal ids (they are drawn twice per page)
    art: p.plate && p.plate !== 'fingerprint' ? plates[p.plate] : null
  };
};

// Demo and code as buttons: an icon and a word. The address is in `title`.
const icon = {
  // a window with an arrow out of it: opens the live site
  demo: '<svg class="btn__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // angle brackets: the source code
  repo: '<svg class="btn__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
const links = (o, t) => `<ul class="links">
  ${o.demo ? `<li><a class="btn btn--demo" href="${o.demo}" title="${pretty(o.demo)}">${icon.demo}<span>${t.demo}</span></a></li>` : ''}
  <li><a class="btn btn--repo" href="${o.repo}" title="${pretty(o.repo)}">${icon.repo}<span>${t.repo}</span></a></li>
</ul>`;

const socials = () => `<ul class="socials">${site.socials.map((s) =>
  `<li><a href="${s.url}" rel="me noopener"><span class="socials__label">${s.label}</span> <span class="socials__handle">${esc(s.handle)}</span></a></li>`).join('')}</ul>`;

// "{github}" in a text becomes a link to that social profile (the blog shows
// its address, the rest their name).
const linkSocials = (text) => esc(text).replace(/\{(\w+)\}/g, (m, id) => {
  const s = site.socials.find((x) => x.id === id);
  return s ? `<a href="${s.url}" rel="me noopener">${esc(id === 'blog' ? s.handle : s.label)}</a>` : m;
});

// The link to the other version is only a barcode that reads its name
// (Code 128: a scanner gets the text back); the link is named for screen
// readers with aria-label.
const versionCode = (href, code, label) => `<p class="colophon__version"><a href="${href}" aria-label="${label}">
${code128(code)}</a></p>`;

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
  'libros-del-mundo':  { color: 'mist',    cover: 'atlas' },
  'string-transformer':{ color: 'teal',    cover: 'psichic' },
  'coac-analisis':     { color: 'apricot', cover: 'shake' },
  'illo-loader':       { color: 'crimson', cover: 'mixtape' },
  'js-subtype':        { color: 'blue',    cover: 'orion' }
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
        <span class="cover cover--${look.cover}" style="--chars:${Math.max(...String(o.name).split(/\s+/).map((w) => w.length))}">${covers[look.cover](o)}</span>
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
    <button type="button" class="screen__eject" aria-label="${u.eject}" title="${u.eject}" hidden>${ejectIcon}</button>
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
    <div class="deck__links"></div>
  </div>
</section>`;

/* ---------- the brand: three squares and the name ---------- */
// One square inside another inside another, all sitting in the bottom right
// corner, in three colours of the stripe under the masthead.
const brandMark = `<svg class="brand__mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <rect width="24" height="24" style="fill: var(--c-crimson)"/>
    <rect x="8" y="8" width="16" height="16" style="fill: var(--c-orange)"/>
    <rect x="16" y="16" width="8" height="8" style="fill: var(--c-teal)"/>
  </svg>`;
const brandName = `${site.nick} ${site.name.split(' ').slice(1).join(' ')}`.toUpperCase();

/* ---------- the language switch (as in LUZ's lang-switch) ----------
   A button with the current language's code opens a native popover with one
   link per language, each named in itself; the current one is
   aria-current="page". Going to the other language is navigation: no script. */
const LANG_NAME = { es: 'Español', en: 'English' };
const LANG_LABEL = { es: 'Idioma', en: 'Language' };
const langSwitch = (lang) => `<div class="lang">
    <button class="lang__button" type="button" popovertarget="lang-menu"><span class="visually-hidden">${LANG_LABEL[lang]}: </span><span aria-hidden="true">${lang.toUpperCase()}</span><span class="visually-hidden">${LANG_NAME[lang]}</span><svg class="lang__caret" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg></button>
    <nav class="lang__menu" id="lang-menu" popover aria-labelledby="lang-title">
      <p class="lang__title" id="lang-title">${LANG_LABEL[lang]}</p>
      <ul class="lang__list">
        ${Object.entries(LANG_NAME).map(([k, name]) => `<li><a class="lang__link" href="../${k}/" hreflang="${k}" lang="${k}"${k === lang ? ' aria-current="page"' : ''}><span class="lang__code" aria-hidden="true">${k.toUpperCase()}</span> ${name}</a></li>`).join('\n        ')}
      </ul>
    </nav>
  </div>`;

/* ---------- the page ---------- */

const page = (lang) => {
  const t = { ...site.i18n[lang], lang };
  const u = ui[lang];
  const other = lang === 'es' ? 'en' : 'es';
  const shelfId = lang === 'es' ? 'proyectos' : 'projects';
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
  <h1 class="masthead__title"><a class="brand" href="./" rel="home">${brandMark}<span class="brand__name">${brandName}</span><span class="visually-hidden">, ${t.kicker}</span></a></h1>
  <nav class="masthead__nav" aria-label="${u.nav}">
    <a href="#bio" data-go="bio">${u.navBio}</a>
    <a href="#${shelfId}" data-go="projects">${u.shelf}</a>
  </nav>
  ${langSwitch(lang)}
</header>
<main id="main">
${station(u)}
<section class="shelf" id="${shelfId}" aria-labelledby="shelf-title">
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
        ${o.body.map((b) => `<p>${esc(b)}</p>`).join('\n        ')}
        ${cells([[u.material, o.tech], [u.status, o.status], [u.date, o.year]], 'cells--3')}
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
  <p class="colophon__text">${linkSocials(t.colophon)}</p>
  ${versionCode(`../vhs/${lang}/`, u.vhsCode, u.vhsVersion)}
</footer>
</body>
</html>
`;
};

/* ---------- the VHS version ---------- */
// The same content in a room with a yellow TV/video combo on a shelf (img:
// vhs.jpg). The projects are VHS tapes, spine out, on the shelves below; the
// socials stand beside the TV. A tape goes into the video recorder and the
// TV plays it: the sleeve as the picture, then the text, page by page.

// Spine colours, after the tapes in the photo (black, red, cream, yellow…).
const SPINE = {
  bio: 'c', luz: 'a', ikay: 'f', 'chrome-local-ai': 'e', 'quien-canta-hoy': 'b',
  'ares-api': 'g', 'toolbar-aem': 'd', accesibilidad: 'a', 'libros-del-mundo': 'h',
  'string-transformer': 'c', 'coac-analisis': 'b', 'illo-loader': 'e', 'js-subtype': 'f',
  github: 'a', x: 'f', blog: 'd', linkedin: 'e'
};
// The lettering of each spine, as varied as on a real shelf: condensed sans,
// serif capitals, script, wide sans, monospaced.
const TYPE = {
  luz: 'serif', ikay: 'wide', 'chrome-local-ai': 'cond', 'quien-canta-hoy': 'script',
  'ares-api': 'serif', 'toolbar-aem': 'mono', accesibilidad: 'wide', 'libros-del-mundo': 'script',
  'string-transformer': 'cond', 'coac-analisis': 'serif', 'illo-loader': 'script', 'js-subtype': 'mono',
  github: 'mono', x: 'wide', blog: 'script', linkedin: 'cond'
};
// Real cases are not all alike: a little taller or shorter, wider or thinner.
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const shape = (id) => {
  const h = hash(id);
  return `--h:${(.94 + (h % 7) / 100).toFixed(2)};--w:${(.9 + ((h >> 3) % 21) / 100).toFixed(2)}`;
};
const longest = (s) => Math.max(...String(s).split(/\s+/).map((w) => w.length));
const yy = (y) => String(y).slice(-2);

// The spine of the case: studio badge, a line over the title, the title
// along the spine, a small picture, the age circle (the year), VHS and the
// catalogue number. All decorative: the button or link carries the name.
const spine = (o) => `<span class="spine sp--${SPINE[o.id] ?? 'a'} ty--${TYPE[o.id] ?? 'cond'}" style="--chars:${[...String(o.name)].length}" aria-hidden="true">
          <span class="spine__logo">NM</span>
          <span class="spine__body">
            <span class="spine__title">${esc(o.name)}</span>
            <span class="spine__kicker">${esc(o.use ?? '')}</span>
          </span>
          <span class="spine__pic">${o.art ?? `<b>${esc(String(o.name).replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1))}</b>`}</span>
          ${o.rate ? `<span class="spine__rate rate--${o.rate}">${o.rate}</span>` : ''}
          <span class="spine__vhs">VHS</span>
          <span class="spine__cat">${o.code ?? 'NM'}</span>
        </span>`;

// The sleeve, shown on the TV as the picture of the tape.
const sleeve = (o, u) => `<span class="sleeve sp--${SPINE[o.id] ?? 'a'}" style="--chars:${longest(o.name)}" aria-hidden="true">
            <span class="sleeve__studio">${u.vhs.studio}</span>
            <span class="sleeve__art">${o.art ?? `<span class="sleeve__code">${o.code}</span>`}</span>
            <span class="sleeve__title">${esc(o.name)}</span>
            <span class="sleeve__foot"><span class="spine__rate rate--${o.rate}">${o.rate}</span><span class="sleeve__vhs">VHS</span></span>
          </span>`;

// What the TV plays: three pages (the sleeve and title, the text, the facts).
const tvPages = (o, u, { text, facts }) => `
          <section class="tvp tvp--cover">
            ${sleeve(o, u)}
            <div class="tvp__head">
              <p class="tvp__code">${o.code}</p>
              <h3 class="tvp__title">${esc(o.name)}</h3>
              <p class="tvp__use">${esc(o.use)} · ${o.year}</p>
              <p class="tvp__quote">“${esc(o.quote)}”</p>
            </div>
          </section>
          <section class="tvp tvp--text">${text}</section>
          <section class="tvp tvp--facts">${facts}</section>`;

const vhsPage = (lang) => {
  const t = { ...site.i18n[lang], lang };
  const u = ui[lang];
  const v = u.vhs;
  const other = lang === 'es' ? 'en' : 'es';
  const shelfId = lang === 'es' ? 'proyectos' : 'projects';
  const url = `${site.baseUrl}/vhs/${lang}/`;
  const bio = {
    id: 'bio', n: 0, code: 'NM-000', name: site.name, year: 'MMXXVI', rate: yy(new Date().getFullYear()),
    use: t.kicker, quote: plain(t.deck).replace(/^“|”$/g, ''), art: null
  };
  const [p1, ...rest] = t.bio.map((p) => `<p>${esc(plain(p))}</p>`);
  const bioPages = tvPages(bio, u, {
    text: [p1, rest[0] ?? ''].join(''),
    facts: `${rest.slice(1).join('')}${socials()}`
  });
  const socialTape = (s) => `
      <li class="tape tape--social" style="${shape(s.id)}">
        <a class="tape__spine" href="${s.url}" rel="me noopener" aria-label="${s.label}: ${esc(s.handle)}">
        ${spine({ id: s.id, name: s.label, use: s.handle, code: s.id.toUpperCase() })}
        </a>
      </li>`;
  const half = Math.ceil(site.socials.length / 2);
  return `<!doctype html>
<html lang="${lang}" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${site.name} · ${t.runningHead} · VHS</title>
  <meta name="description" content="${esc(t.metaDescription)}">
  <meta name="color-scheme" content="dark">
  <link rel="canonical" href="${url}">
  ${LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${site.baseUrl}/vhs/${l}/">`).join('\n  ')}
  <meta property="og:title" content="${site.name} · ${t.runningHead} · VHS">
  <meta property="og:description" content="${esc(t.metaDescription)}">
  <meta property="og:url" content="${url}">
  <link rel="preload" href="../../assets/fonts/archivo-latin-wdth-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../../assets/fonts/chakra-petch-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../../assets/css/archivo.css">
  <link rel="stylesheet" href="../../assets/css/vhs.css">
  <script>document.documentElement.classList.replace('no-js','js')</script>
  <script type="module" src="../../assets/js/vhs.js"></script>
</head>
<body class="vhs">
<a class="skip" href="#main">${t.skip}</a>
<header class="masthead">
  <h1 class="masthead__title"><a href="./" rel="home">${site.name} <span aria-hidden="true">/</span> ${t.kicker}</a></h1>
  <nav class="masthead__nav" aria-label="${u.nav}">
    <a href="#tv" data-go="bio">${u.navBio}</a>
    <a href="#${shelfId}" data-go="projects">${u.shelf}</a>
  </nav>
  <p class="masthead__lang"><a href="../${other}/" hreflang="${other}" lang="${other}">${t.otherEdition}</a></p>
</header>
<main id="main">
<section class="room" aria-label="${v.tv}">
  <div class="room__row">
    <ul class="tapes tapes--side tapes--l">${site.socials.slice(0, half).map(socialTape).join('')}
    </ul>
    <div class="tv" id="tv" data-play="${v.play}" data-eject="${v.ejectOsd}" data-channel="${v.channel}" data-page="${v.page}" data-playing="${v.playing}">
      <div class="tv__body">
        <div class="tv__bezel">
          <div class="tv__screen">
            <canvas class="tv__noise" width="160" height="120" aria-hidden="true"></canvas>
            <p class="tv__osd" aria-hidden="true"><span class="osd__mode">${v.channel}</span><span class="osd__clock"></span></p>
            <div class="tv__out">${bioPages}
            </div>
            <p class="osd__page" aria-hidden="true"></p>
          </div>
        </div>
        <div class="tv__panel">
          <span class="tv__brand" aria-hidden="true">NANDO</span>
          <span class="tv__badge" aria-hidden="true"><b>VHS</b><span>HQ</span></span>
          <span class="vcr" aria-hidden="true">
            <span class="vcr__slot"><span class="vcr__flap">
              <span class="vcr__label">${v.recorder}</span>
              <span class="vcr__small">ON SCREEN DISPLAY · HQ · TWIN SPEED</span>
            </span></span>
          </span>
          <span class="tv__speaker" aria-hidden="true"></span>
          <span class="tv__power" aria-hidden="true"><span class="tv__button"></span><span class="tv__led"></span><span class="tv__jack"></span><span class="tv__jack"></span></span>
          <span class="tv__keys">
            <button type="button" class="tv__key" data-tv="rew" aria-label="${v.rew}" title="${v.rew}"><span aria-hidden="true">◀◀</span></button>
            <button type="button" class="tv__key" data-tv="play" aria-label="${v.play}" title="${v.play}"><span aria-hidden="true">▶</span></button>
            <button type="button" class="tv__key" data-tv="ff" aria-label="${v.ff}" title="${v.ff}"><span aria-hidden="true">▶▶</span></button>
            <button type="button" class="tv__key tv__key--eject" data-tv="eject" aria-label="${v.eject}" title="${v.eject}"><span aria-hidden="true">⏏</span></button>
          </span>
          <span class="tv__foot" aria-hidden="true"></span>
        </div>
      </div>
      <p class="tv__state visually-hidden" aria-live="polite"></p>
    </div>
    <ul class="tapes tapes--side tapes--r">${site.socials.slice(half).map(socialTape).join('')}
    </ul>
  </div>
  <p class="room__cta" hidden><span class="room__arrow" aria-hidden="true">↓</span> ${v.cta}</p>
  <div class="bio-pages" hidden>${bioPages}
  </div>
</section>
<section class="shelf" id="${shelfId}" aria-labelledby="shelf-title">
  <header class="section-head">
    <h2 id="shelf-title">${u.shelf}</h2>
    <p class="section-head__count">${num(projects.length)} ${v.tapes}</p>
  </header>
  <ol class="tapes tapes--shelf">
    ${projects.map((p, i) => {
      const o = { ...objectOf(p, i, t, u), rate: yy(p.year) };
      const art = p.plate && p.plate !== 'fingerprint' ? p.plate : p.ornament;
      o.art = art ? plates[art] : null;
      return `
    <li class="tape tape--project" id="${o.id}" data-code="${o.code}" style="${shape(o.id)}">
      <button type="button" class="tape__spine" aria-label="${v.insert}: ${esc(o.name)}">
        ${spine(o)}
      </button>
      <div class="tape__content">${tvPages(o, u, {
        text: o.body.map((b) => `<p>${esc(b)}</p>`).join(''),
        facts: `${cells([[u.material, o.tech], [u.status, o.status], [u.date, o.year]], 'cells--3')}
            ${links(o, t)}`
      })}
      </div>
    </li>`;
    }).join('')}
  </ol>
</section>
</main>
<footer class="colophon">
  <div class="colophon__doc">
    <p class="label">${u.today}</p>
    <p class="colophon__no"><time class="today" datetime="${isoToday}">${romanDate(new Date())}</time></p>
  </div>
  <p class="colophon__text">${linkSocials(t.colophon)}</p>
  ${versionCode(`../../${lang}/`, u.diskCode, u.diskVersion)}
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
rmSync(join(root, 'vhs'), { recursive: true, force: true });
for (const lang of LANGS) write(`vhs/${lang}/index.html`, vhsPage(lang));
write('vhs/index.html', toLanguage(''));
