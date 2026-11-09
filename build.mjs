#!/usr/bin/env node
// Portfolio · Disquetes — zero-dependency static build.
// Content: data/site.json and data/projects.json (technology links: data/tech.json). Interface labels: data/archivo.json.
//   es/index.html, en/index.html   the portfolio
//   index.html                     sends visitors to their language
// Usage: node build.mjs

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plates } from './src/plates.mjs';
import { createVoice, trackParts, headParts, VOICES } from './src/speech.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(root, f), 'utf8'));
// --check: change nothing, fail if a page or a voice clip is out of date (the
// pre-commit hook); --no-audio: build the pages without making clips;
// --say: print what every clip says.
const flag = (f) => process.argv.includes(f);
const CHECK = flag('--check');
const voice = createVoice(root);
const site = read('data/site.json');
const projects = read('data/projects.json');
const ui = read('data/archivo.json');
const techUrl = read('data/tech.json');
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

// The technologies, each a link to its site (data/tech.json); one missing
// there is printed as plain text and the build says so.
const techMissing = new Set();
const techLinks = (list) => list.map((name) => {
  const url = techUrl[name];
  if (!url) { techMissing.add(name); return esc(name); }
  return `<a class="tech" href="${esc(url)}" rel="noopener" target="_blank">${esc(name)}</a>`;
}).join(' · ');

const objectOf = (p, i, t, u) => {
  const c = p[t.lang];
  const n = i + 1;
  return {
    id: p.id, n, code: `NM-${pad(n)}`, doc: `NM.${pad(n)}.${p.year}`,
    name: p.name, use: c.kicker, body: c.body, quote: c.quote,
    // the covers print the main one; the card lists them all
    year: p.year, material: p.tech[0], tech: techLinks(p.tech),
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
// the favicon: the same mark, as a file
const ICON = '../../assets/favicon.svg';
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
    <button class="lang__button" type="button" popovertarget="lang-menu"><span class="visually-hidden">${LANG_LABEL[lang]}: </span><span aria-hidden="true">${lang.toUpperCase()}</span><span class="visually-hidden">${LANG_NAME[lang]}</span></button>
    <nav class="lang__menu" id="lang-menu" popover aria-labelledby="lang-title">
      <p class="lang__title" id="lang-title">${LANG_LABEL[lang]}</p>
      <ul class="lang__list">
        ${Object.entries(LANG_NAME).map(([k, name]) => `<li><a class="lang__link" href="../${k}/" hreflang="${k}" lang="${k}"${k === lang ? ' aria-current="page"' : ''}><span class="lang__code" aria-hidden="true">${k.toUpperCase()}</span> ${name}</a></li>`).join('\n        ')}
      </ul>
    </nav>
  </div>`;

/* ---------- the chrome every version shares (chrome.css, chrome.js) ----------
   The same masthead and colophon on Disquetes, VHS and any version to come.
   `bioHref` is where the Bio link goes without JS; `version` is the barcode
   to the other version: { href, code, label }. */
const masthead = (lang, t, u, { bioHref }) => `<header class="masthead">
  <h1 class="masthead__title"><a class="brand" href="./" rel="home">${brandMark}<span class="brand__text"><span class="brand__name">${brandName}</span><span class="brand__kicker"><span class="visually-hidden">, </span>${t.kicker}</span></span></a></h1>
  <nav class="masthead__nav" aria-label="${u.nav}">
    <a href="${bioHref}" data-go="bio">${u.navBio}</a>
    <a href="#${lang === 'es' ? 'proyectos' : 'projects'}" data-go="projects">${u.shelf}</a>
  </nav>
  ${langSwitch(lang)}
</header>`;
const colophon = (t, u, version, extra = '') => `<footer class="colophon">
  <div class="colophon__doc">
    <p class="label">${u.today}</p>
    <p class="colophon__no"><time class="today" datetime="${isoToday}">${romanDate(new Date())}</time></p>
  </div>
  <p class="colophon__text">${linkSocials(t.colophon)}${extra ? ` ${extra}` : ''}</p>
  ${versionCode(version.href, version.code, version.label)}
</footer>`;

/* ---------- the page ---------- */

const page = (lang) => {
  const t = { ...site.i18n[lang], lang };
  const u = ui[lang];
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
  <link rel="icon" href="${ICON}" type="image/svg+xml">
  <link rel="canonical" href="${url}">
  ${LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${site.baseUrl}/${l}/">`).join('\n  ')}
  <meta property="og:title" content="${site.name} · ${t.runningHead}">
  <meta property="og:description" content="${esc(t.metaDescription)}">
  <meta property="og:url" content="${url}">
  <link rel="preload" href="../assets/fonts/archivo-latin-wdth-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../assets/fonts/chakra-petch-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../assets/css/archivo.css">
  <link rel="stylesheet" href="../assets/css/chrome.css">
  <link rel="stylesheet" href="../assets/css/ar-disquetes.css">
  <link rel="stylesheet" href="../assets/css/ar-disks.css">
  <link rel="stylesheet" href="../assets/css/ar-dq-asomado.css">
  <script>document.documentElement.classList.replace('no-js','js')</script>
  <script type="module" src="../assets/js/ar-disquetes.js"></script>
</head>
<body class="ar ar--disquetes dq--asomado">
<a class="skip" href="#main">${t.skip}</a>
${masthead(lang, t, u, { bioHref: '#bio' })}
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
${colophon(t, u, { href: `../vhs/${lang}/`, code: u.vhsCode, label: u.vhsVersion })}
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
  <link rel="icon" href="${ICON}" type="image/svg+xml">
  <link rel="canonical" href="${url}">
  ${LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${site.baseUrl}/vhs/${l}/">`).join('\n  ')}
  <meta property="og:title" content="${site.name} · ${t.runningHead} · VHS">
  <meta property="og:description" content="${esc(t.metaDescription)}">
  <meta property="og:url" content="${url}">
  <link rel="preload" href="../../assets/fonts/archivo-latin-wdth-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../../assets/fonts/chakra-petch-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../../assets/css/archivo.css">
  <link rel="stylesheet" href="../../assets/css/chrome.css">
  <link rel="stylesheet" href="../../assets/css/vhs.css">
  <script>document.documentElement.classList.replace('no-js','js')</script>
  <script type="module" src="../../assets/js/vhs.js"></script>
</head>
<body class="vhs">
<a class="skip" href="#main">${t.skip}</a>
${masthead(lang, t, u, { bioHref: '#tv' })}
<main id="main">
<section class="room" aria-label="${v.tv}">
  <div class="room__row">
    <ul class="tapes tapes--side tapes--l">${site.socials.slice(0, half).map(socialTape).join('')}
    </ul>
    <div class="tv" id="tv" data-play="${v.play}" data-eject="${v.ejectOsd}" data-channel="${v.channel}" data-page="${v.page}" data-playing="${v.playing}">
      <div class="tv__body">
        <div class="tv__bezel">
          <div class="tv__screen" id="tv-screen" popover="manual" role="region" aria-label="${v.tv}">
            <canvas class="tv__noise" width="160" height="120" aria-hidden="true"></canvas>
            <p class="tv__osd" aria-hidden="true"><span class="osd__mode">${v.channel}</span><span class="osd__clock"></span></p>
            <div class="tv__out">${bioPages}
            </div>
            <p class="osd__page" aria-hidden="true"></p>
            <p class="osd__hint" aria-hidden="true">${v.hint}</p>
            <span class="tv__full-keys">
              <button type="button" class="tv__osd-key" data-full="rew" aria-label="${v.rew}" title="${v.rew}"><span aria-hidden="true">◀◀</span></button>
              <button type="button" class="tv__osd-key" data-full="ff" aria-label="${v.ff}" title="${v.ff}"><span aria-hidden="true">▶▶</span></button>
            </span>
            <button type="button" class="tv__close" aria-label="${v.exitFull}" title="${v.exitFull}">
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M5 5 19 19M19 5 5 19" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square"/></svg>
            </button>
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
            <button type="button" class="tv__key" data-tv="play" aria-label="${v.playFull}" title="${v.playFull}" aria-controls="tv-screen" aria-expanded="false"><span aria-hidden="true">▶</span></button>
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
${colophon(t, u, { href: `../../cassette/${lang}/`, code: u.cassetteCode, label: u.cassetteVersion })}
</body>
</html>
`;
};

/* ---------- the cassette version ----------
   After a photo of an oak wall cabinet on a sage wall: on top a brushed
   aluminium panel with a small CRT showing a blue waveform, a cassette deck
   with the tape seen through its door, two round speakers, the keys (four
   silver, the eject orange), two level meters and a lit strip naming the tape in;
   below, oak slots with the cassettes spine out. The projects (and the
   socials) are the tapes; one goes into the deck and plays. Beside the
   cabinet, the liner notes (J-card) of the tape in: side A is the text, a
   track per paragraph; side B the facts and links. With no project in, the
   house tape (the bio) is in the deck. */

// Each tape: shell colour (the cassette seen in the deck), J-card colour
// (its spine on the shelf and the band of its label), lettering.
const CAS = {
  bio: ['cream', 'red', 'cond'], luz: ['smoke', 'yellow', 'cond'], ikay: ['white', 'sky', 'wide'],
  'chrome-local-ai': ['smoke', 'black', 'mono'], 'quien-canta-hoy': ['black', 'pink', 'script'],
  'ares-api': ['cream', 'orange', 'serif'], 'toolbar-aem': ['black', 'cream', 'cond'],
  accesibilidad: ['white', 'mint', 'wide'], 'libros-del-mundo': ['smoke', 'tan', 'script'],
  'string-transformer': ['black', 'white', 'mono'], 'coac-analisis': ['cream', 'red', 'cond'],
  'illo-loader': ['smoke', 'black', 'serif'], 'js-subtype': ['white', 'fade', 'wide'],
  github: ['black', 'black', 'mono'], x: ['white', 'white', 'wide'], blog: ['cream', 'yellow', 'script'], linkedin: ['black', 'sky', 'cond']
};
const casOf = (id) => CAS[id] ?? ['black', 'cream', 'cond'];
// A track's length from its words (a paragraph read aloud, more or less).
const trackLen = (text) => 25 + Math.round(String(text).split(/\s+/).length * .9);

// The level meters under the speaker, after a mixer's master meter: pairs of
// LED columns (left and right, the voice and the tape, two pairs of frequency
// bands) with the scale between them, top to bottom; the top two red, the
// next four orange, the rest green.
const VU_SCALE = ['OVER', '10', '7', '4', '2', '1', '0', '−1', '−2', '−3', '−5', '−7', '−10', '−15', '−24'];
const VU_COL = `<span class="vu__col">${'<i></i>'.repeat(VU_SCALE.length)}</span>`;
// A meter: two columns with the scale between them and their names below.
const vu = (foot, cls) => `<div class="vu${cls}" aria-hidden="true">${VU_COL}<span class="vu__scale">${VU_SCALE.map((t) => `<b>${t}</b>`).join('')}</span>${VU_COL}<span class="vu__foot">${foot}</span></div>`;
// The works in the bay, seen when the tape is out (after a Panasonic deck):
// a black moulded bed with a fine grain, the two spindles with their springs
// where the hubs go, a bright plate between them, a screw, the step down to
// the head and, in the cut-out along the foot, the head, the capstan, the
// pinch roller, the guide posts and a glimpse of the brass works.
const spindle = (x, y) => `<g transform="translate(${x} ${y})">
      <circle r="60" fill="#050505"/><circle r="60" fill="none" stroke="#3a3a38" stroke-width="2" transform="translate(1.5 2.5)" opacity=".7"/>
      ${[48, 42, 36, 30].map((r, i) => `<circle r="${r}" fill="none" stroke="url(#tw-steel)" stroke-width="3.6" opacity="${1 - i * .1}"/><circle r="${r - 2}" fill="none" stroke="#000" stroke-width="1.2" opacity=".6"/>`).join('')}
      <g fill="#1b1b1a" stroke="#000" stroke-width="1">${[0, 60, 120, 180, 240, 300].map((a) => `<rect x="-5" y="-28" width="10" height="12" rx="2" transform="rotate(${a})"/>`).join('')}</g>
      <circle r="20" fill="url(#tw-knob)" stroke="#000" stroke-width="1.5"/>
      <circle r="7" fill="url(#tw-steel)" stroke="#2a2a28"/><circle r="2" cx="-1.5" cy="-1.5" fill="#fff" opacity=".8"/>
    </g>`;
const post = (x, y, r = 11) => `<g transform="translate(${x} ${y})"><circle r="${r + 5}" fill="#000" opacity=".55" transform="translate(3 4)"/><circle r="${r}" fill="url(#tw-knob)" stroke="#000"/><ellipse rx="${r * .45}" ry="${r * .3}" cx="${-r * .3}" cy="${-r * .4}" fill="#fff" opacity=".18"/></g>`;
const WORKS = `<svg class="tdeck__works" viewBox="0 0 1000 650" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <filter id="tw-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 -.18"/><feComposite in2="SourceGraphic" operator="in"/></filter>
      <linearGradient id="tw-bed" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#2b2b2a"/><stop offset=".6" stop-color="#1e1e1d"/><stop offset="1" stop-color="#161615"/></linearGradient>
      <linearGradient id="tw-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f4f1"/><stop offset=".45" stop-color="#9a9c99"/><stop offset=".7" stop-color="#d9dad6"/><stop offset="1" stop-color="#6c6e6b"/></linearGradient>
      <linearGradient id="tw-plate" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3e4e0"/><stop offset=".38" stop-color="#c3c5c1"/><stop offset=".42" stop-color="#d8d9d5"/><stop offset="1" stop-color="#a3a5a1"/></linearGradient>
      <linearGradient id="tw-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8bf74"/><stop offset=".5" stop-color="#9c7f34"/><stop offset="1" stop-color="#6e5822"/></linearGradient>
      <radialGradient id="tw-knob" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#4a4a48"/><stop offset=".55" stop-color="#1c1c1b"/><stop offset="1" stop-color="#0a0a0a"/></radialGradient>
    </defs>
    <rect width="1000" height="650" fill="#0c0c0c"/>
    <path d="M28 40 H330 l18 22 H652 l18 -22 H972 V626 H700 V500 H300 V626 H28 Z" fill="url(#tw-bed)"/>
    <rect width="1000" height="650" fill="#fff" filter="url(#tw-grain)" opacity=".16"/>
    <path d="M28 40 H330 l18 22 H652 l18 -22 H972" fill="none" stroke="#5a5a57" stroke-width="2.5"/>
    <path d="M28 40 V626 H300 V500 H700 V626 H972 V40" fill="none" stroke="#000" stroke-width="3" opacity=".6"/>
    <path d="M300 626 V500 H700" fill="none" stroke="#4a4a47" stroke-width="2" transform="translate(-2 -2)"/>
    <path d="M60 438 H940" stroke="#000" stroke-width="5" opacity=".8"/><path d="M60 443 H940" stroke="#4a4a47" stroke-width="2"/>
    <path d="M60 443 H940 V626 H60 Z" fill="#000" opacity=".14"/>
    <rect x="420" y="222" width="160" height="96" rx="7" fill="url(#tw-plate)" stroke="#6f716d" stroke-width="2"/>
    <path d="M432 232 H520 L470 308 H432 Z" fill="#fff" opacity=".22"/>
    ${spindle(282, 270)}
    ${spindle(718, 270)}
    <g transform="translate(500 388)"><circle r="17" fill="#000" opacity=".6"/><circle r="13" fill="url(#tw-steel)" stroke="#1a1a19" stroke-width="1.5"/><path d="M-7 0 H7 M0 -7 V7" stroke="#2a2a28" stroke-width="3.2" stroke-linecap="round"/></g>
    ${post(190, 560, 13)}
    ${post(810, 560, 13)}
    <rect x="300" y="500" width="400" height="150" fill="#070707"/>
    <path d="M318 650 V566 h70 l20 -26 h120 V650 Z" fill="url(#tw-brass)" opacity=".8"/>
    <path d="M560 650 V590 h120 V650 Z" fill="url(#tw-brass)" opacity=".55"/>
    <rect x="440" y="600" width="36" height="50" fill="#d8d9d5" opacity=".75"/>
    <path d="M330 640 h340" stroke="#000" stroke-width="10" opacity=".35"/>
    <rect x="404" y="540" width="26" height="40" rx="4" fill="url(#tw-steel)" stroke="#2d2d2b"/>
    <g transform="translate(500 548)"><rect x="-44" y="-26" width="88" height="58" rx="10" fill="url(#tw-steel)" stroke="#2d2d2b" stroke-width="2"/><rect x="-36" y="-20" width="72" height="16" rx="5" fill="#bfc1bd" stroke="#6a6c69"/><path d="M0 -20 V-4" stroke="#1d1d1c" stroke-width="2"/><circle cx="-30" cy="18" r="4" fill="#3a3a38"/><circle cx="30" cy="18" r="4" fill="#3a3a38"/></g>
    <g transform="translate(626 540)"><circle r="26" fill="url(#tw-knob)" stroke="#000" stroke-width="2"/><circle r="9" fill="#2b2b2a" stroke="#000"/></g>
    <g transform="translate(672 520)"><circle r="7" fill="url(#tw-steel)" stroke="#2a2a28"/></g>
    ${post(354, 520, 9)}
    ${post(660, 600, 9)}
    <path d="M300 500 H700" stroke="#000" stroke-width="4"/>
  </svg>`;

// The cassette, face on (in the deck).
const cassette = (o) => {
  const [shell, band, type] = casOf(o.id);
  return `<span class="cassette sh--${shell} jc--${band} ty--${type}" aria-hidden="true"><span class="cassette__body">
          <span class="cassette__label">
            <span class="cassette__side">A</span>
            <span class="cassette__title">${esc(o.name)}</span>
            <span class="cassette__meta">${esc(o.use ?? '')}${o.year ? ` · ${o.year}` : ''}</span>
            <span class="cassette__band"></span>
            <span class="cassette__window"><span class="reel reel--l"></span><span class="reel reel--r"></span></span>
            <span class="cassette__code"><span>${o.code}</span><span>${o.length ?? 'C60'}</span></span>
          </span>
          <span class="cassette__foot"></span>
        </span></span>`;
};

// The case, spine out (on the stack): the J-card's spine, lying flat as on
// the poster: a logo, the title and a second line, the catalogue number.
const caseSpine = (o) => {
  const [, band, type] = casOf(o.id);
  const h = hash(o.id);
  const off = `--dx:${(h % 9) - 4}px;--rot:${(((h >> 4) % 5) - 2) * .15}deg;--fade:${(.82 + ((h >> 7) % 19) / 100).toFixed(2)}`;
  return `<span class="cspine jc--${band} ty--${type}" style="${off};--chars:${[...String(o.name)].length}" aria-hidden="true"><span class="cspine__card">
          <span class="cspine__logo">NM</span>
          <span class="cspine__text"><span class="cspine__title">${esc(o.name)}</span><span class="cspine__sub">${esc(o.use ?? '')}</span></span>
          <span class="cspine__code"><span>${o.code}</span><span>${o.length ?? 'STEREO'}</span></span>
        </span></span>`;
};

// A virgin tape: a blank J-card spine, nothing written on it (decoration).
const blankSpine = (i) => {
  const h = hash(`blank${i}`);
  return `<span class="cspine cspine--blank${i % 3 === 1 ? ' cspine--smoke' : ''}" style="--dx:${(h % 7) - 3}px;--fade:1" aria-hidden="true"><span class="cspine__card">
          <span class="cspine__band"><b>NM</b></span>
          <span class="cspine__lines"></span>
          <span class="cspine__len">${i % 2 ? 'C90' : 'C60'}</span>
        </span></span>`;
};

// The liner notes: a blank J-card, typed on a manual typewriter. The band (the
// brand, the length in a grey panel, the type in the tape's colour), the
// title written under it, the spine printed upside down between two folds,
// and inside the ruled lines with side A and side B as numbered tracks.
// Each part of the card that is read aloud carries its clip in data-say.
const said = (url) => (url ? ` data-say="${url}"` : '');
const notes = (o, c, lang, { a, b }) => {
  const len = o.length ?? 'C60';
  const track = (side) => (x, i) => `
              <li class="track" data-no="${side}${i + 1}"${said(voice.clip(lang, trackParts(x)))}><div class="track__body">${x.title ? `<p class="track__title">${x.title}</p>` : ''}${x.body}</div></li>`;
  const [, band, type] = casOf(o.id);
  return `
          <div class="jcard"${said(voice.clip(lang, headParts(o)))}>
            <div class="hspine jc--${band} ty--${type}" aria-hidden="true">
              <span class="hspine__logo">NM</span>
              <span class="hspine__text"><span class="hspine__title">${esc(o.name)}</span><span class="hspine__sub">${esc(o.use ?? '')}</span></span>
              <span class="hspine__code"><span>${o.code}</span><span>${len}</span></span>
            </div>
            <p class="jcard__tagline" aria-hidden="true">${c.tagline}</p>
            <header class="notes__head">
              <p class="notes__code">${o.code} · ${len}</p>
              <h3 class="notes__title">${esc(o.name)}</h3>
              <p class="notes__use">${esc(o.use)}${o.year ? ` · ${o.year}` : ''}</p>
              ${o.quote ? `<p class="notes__quote">“${esc(o.quote)}”</p>` : ''}
            </header>
            <div class="jcard__spine" aria-hidden="true"><span class="jcard__spine-in"><span class="jcard__spine-len">${len}</span><span class="jcard__spine-brand">${brandMark}<b>NM</b></span></span></div>
            <div class="jcard__inside">
              <p class="notes__side"><b aria-hidden="true">A</b> ${c.sideA}</p>
              <ol class="tracks">${a.map(track('A')).join('')}
              </ol>
              <p class="notes__side"><b aria-hidden="true">B</b> ${c.sideB}</p>
              <ol class="tracks">${b.map(track('B')).join('')}
              </ol>
            </div>
            <div class="jcard__foot" aria-hidden="true">
              <span><b>B</b> ${c.dateTime}<br>${c.noise} ☐${c.on} ☐${c.off}</span>
              <span><b>A</b> ${c.dateTime}<br>${c.noise} ☐${c.on} ☐${c.off}</span>
            </div>
          </div>`;
};

const cassettePage = (lang) => {
  const t = { ...site.i18n[lang], lang };
  const u = ui[lang];
  const c = u.cassette;
  const shelfId = lang === 'es' ? 'proyectos' : 'projects';
  const url = `${site.baseUrl}/cassette/${lang}/`;
  // the house tape, the bio: titled "Sobre mí" / "About me"; it stands first in
  // the rack and is in the deck whenever no project is
  const bio = {
    id: 'bio', code: 'NM-000', name: c.about, use: t.kicker, year: null, length: 'C90',
    quote: plain(t.deck).replace(/^“|”$/g, '')
  };
  const bioNotes = notes(bio, c, lang, {
    a: t.bio.map((p) => plain(p)).map((p) => ({ body: `<p>${esc(p)}</p>`, sec: trackLen(p) })),
    b: [{ title: c.socials, body: socials(), sec: 90 }]
  });
  const projectSlot = (o) => `
      <li class="slot cas-item" id="${o.id}">
        <button type="button" class="slot__case" aria-label="${c.insert}: ${esc(o.name)}">
        ${caseSpine(o)}
        </button>
        <div class="cas-item__tape" hidden>${cassette(o)}</div>
        <div class="cas-item__notes" hidden>${notes(o, c, lang, {
          a: o.body.map((p) => ({ body: `<p>${esc(p)}</p>`, sec: trackLen(p) })),
          b: [
            { title: c.facts, body: cells([[u.material, o.tech], [u.status, o.status], [u.date, o.year]], 'cells--3'), sec: 75 },
            { title: c.links, body: links(o, t), sec: 40 }
          ]
        })}
        </div>
      </li>`;
  const socialSlot = (s) => `
      <li class="slot slot--social">
        <a class="slot__case" href="${s.url}" rel="me noopener" aria-label="${s.label}: ${esc(s.handle)}">
        ${caseSpine({ id: s.id, name: s.label, use: s.handle, code: s.id.toUpperCase() })}
        </a>
      </li>`;
  return `<!doctype html>
<html lang="${lang}" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${site.name} · ${t.runningHead} · Cassette</title>
  <meta name="description" content="${esc(t.metaDescription)}">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="${ICON}" type="image/svg+xml">
  <link rel="canonical" href="${url}">
  ${LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${site.baseUrl}/cassette/${l}/">`).join('\n  ')}
  <meta property="og:title" content="${site.name} · ${t.runningHead} · Cassette">
  <meta property="og:description" content="${esc(t.metaDescription)}">
  <meta property="og:url" content="${url}">
  <link rel="preload" href="../../assets/fonts/archivo-latin-wdth-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../../assets/fonts/chakra-petch-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../../assets/css/archivo.css">
  <link rel="stylesheet" href="../../assets/css/chrome.css">
  <link rel="preload" href="../../assets/fonts/special-elite-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../../assets/css/cassette.css">
  <script>document.documentElement.classList.replace('no-js','js')</script>
  <script type="module" src="../../assets/js/cassette.js"></script>
</head>
<body class="cas">
<a class="skip" href="#main">${t.skip}</a>
${masthead(lang, t, u, { bioHref: '#liner' })}
<main id="main">
<div class="studio">
  <div class="studio__spine" aria-hidden="true"></div>
  <div class="studio__deck">
  <div class="cabinet" id="deck" data-playing="${c.playing}" data-stopped="${c.stopped}" data-ejected="${c.ejected}" data-copied="${c.copied}">
    <section class="panels" aria-label="${c.deck}">
      <div class="unit"><div class="panel panel--top">
      <div class="panel__top">
        <span class="grille" aria-hidden="true"></span>
      </div>
      <div class="panel__meter" aria-hidden="true">
        <span class="counter"><span class="counter__label">${c.counter}</span><span class="counter__win"><b>0</b><b>0</b><b>0</b></span><span class="counter__reset"></span></span>
        <p class="strip"><span class="strip__text">NM-000 · ${esc(site.name)}</span><span class="strip__led"></span></p>
      </div>
      <div class="panel__plate">
        ${vu('<b>L</b><b>dB</b><b>R</b>', '')}
        ${vu(`<b>${c.voice}</b><b></b><b>${c.tape}</b>`, ' vu--src')}
        ${vu('<b>60</b><b>Hz</b><b>250</b>', ' vu--band')}
        ${vu('<b>1K</b><b>Hz</b><b>8K</b>', ' vu--band')}
        <p class="osd" hidden><span class="osd__mode">■ STOP</span><span class="osd__no">A1</span><span class="osd__count">000</span><span class="osd__title">${esc(site.name)}</span></p>
        <span class="vkeys">
        <button type="button" class="vkey mute" aria-pressed="false" aria-label="${c.mute}" title="${c.mute}">
          <span class="vkey__cap" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path class="mute__cone" d="M3 9h4l5-4v14l-5-4H3z"/><path class="mute__waves" d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/><path class="mute__x" d="M16 9.5l5 5M21 9.5l-5 5"/></svg></span>
          <small aria-hidden="true">${c.voice}</small>
        </button>
        <button type="button" class="vkey" data-latch="double" aria-pressed="false" aria-label="${c.double}" title="${c.double}">
          <span class="vkey__cap" aria-hidden="true"><b class="vkey__text">2×</b></span>
          <small aria-hidden="true">${c.doubleKey}</small>
        </button>
        <button type="button" class="vkey" data-latch="repeat" aria-pressed="false" aria-label="${c.repeat}" title="${c.repeat}">
          <span class="vkey__cap" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M4 11V9a3 3 0 0 1 3-3h11"/><path d="M15 3l3 3-3 3"/><path d="M20 13v2a3 3 0 0 1-3 3H6"/><path d="M9 21l-3-3 3-3"/></svg></span>
          <small aria-hidden="true">${c.repeatKey}</small>
        </button>
        <button type="button" class="vkey" data-act="shuffle" aria-label="${c.shuffle}" title="${c.shuffle}">
          <span class="vkey__cap" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M4 7h3l10 10h3"/><path d="M17 4l3 3-3 3"/><path d="M4 17h3l3-3"/><path d="M14 7h3l3 3"/><path d="M17 14l3 3-3 3"/></svg></span>
          <small aria-hidden="true">${c.shuffleKey}</small>
        </button>
        <button type="button" class="vkey" data-act="side" aria-label="${c.side}" title="${c.side}">
          <span class="vkey__cap" aria-hidden="true"><b class="vkey__text vkey__text--ab">A·B</b></span>
          <small aria-hidden="true">${c.sideKey}</small>
        </button>
        <button type="button" class="vkey" data-act="link" aria-label="${c.link}" title="${c.link}">
          <span class="vkey__cap" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/></svg></span>
          <small aria-hidden="true" data-label="${c.linkKey}">${c.linkKey}</small>
        </button>
        </span>
      </div>
      </div></div>
      <div class="unit"><div class="panel panel--deck">
      <div class="tdeck">
        <div class="tdeck__bay">
          ${WORKS}
          <div class="tdeck__well">${cassette(bio)}</div>
        </div>
      </div>
      <div class="keys">
          <button type="button" class="key key--eject" data-key="eject" aria-label="${c.eject}" title="${c.eject}"><span class="key__label" aria-hidden="true">EJECT</span><span class="key__cap" aria-hidden="true"><i>⏏</i></span></button>
          <button type="button" class="key key--play" data-key="play" aria-label="${c.play}" title="${c.play}" aria-pressed="false"><span class="key__label" aria-hidden="true">PLAY</span><span class="key__cap" aria-hidden="true"><i>▶</i></span></button>
          <button type="button" class="key" data-key="rew" aria-label="${c.rew}" title="${c.rew}"><span class="key__label" aria-hidden="true">REW</span><span class="key__cap" aria-hidden="true"><i>◀◀</i></span></button>
          <button type="button" class="key" data-key="ff" aria-label="${c.ff}" title="${c.ff}"><span class="key__label" aria-hidden="true">F.FWD</span><span class="key__cap" aria-hidden="true"><i>▶▶</i></span></button>
          <button type="button" class="key" data-key="stop" aria-label="${c.stop}" title="${c.stop}"><span class="key__label" aria-hidden="true">STOP</span><span class="key__cap" aria-hidden="true"><i>■</i></span></button>
          <button type="button" class="key" data-key="pause" aria-label="${c.pause}" title="${c.pause}" aria-pressed="false"><span class="key__label" aria-hidden="true">PAUSE</span><span class="key__cap" aria-hidden="true"><i>❚❚</i></span></button>
      </div>
      </div></div>
      <p class="bb__state visually-hidden" aria-live="polite"></p>
    </section>
  </div>
  </div>
  <article class="liner" id="liner" aria-label="${c.liner}">
    <div class="liner__out">${bioNotes}
    </div>
  </article>
</div>
<p class="studio__cta"><span class="studio__arrow" aria-hidden="true">↓</span> <b>${c.cta}</b></p>
<section class="rack" id="${shelfId}" aria-labelledby="shelf-title">
  <header class="section-head">
    <h2 id="shelf-title">${u.shelf}</h2>
    <p class="section-head__count">${num(projects.length + 1)} ${c.tapes}</p>
  </header>
  <div class="rack__cabinet">
    <ol class="rack__slots">
      <li class="slot cas-item cas-bio" id="bio">
        <button type="button" class="slot__case" aria-label="${c.insert}: ${esc(bio.name)}">
        ${caseSpine(bio)}
        </button>
        <div class="cas-item__tape" hidden>${cassette(bio)}</div>
        <div class="cas-item__notes" hidden>${bioNotes}
        </div>
      </li>${projects.map((p, i) => {
      const o = objectOf(p, i, t, u);
      const total = o.body.reduce((n, b) => n + trackLen(b), 0);
      return projectSlot({ ...o, length: total > 15 * 60 ? 'C90' : 'C60' });
    }).join('')}${Array.from({ length: 7 }, (_, i) => `
      <li class="slot slot--blank">${blankSpine(i)}</li>`).join('')}
      <li class="slot slot--empty"></li>
    </ol>
  </div>
</section>
<section class="rack rack--links" id="${lang === 'es' ? 'enlaces' : 'links'}" aria-labelledby="links-title">
  <header class="section-head">
    <h2 id="links-title">${c.socials}</h2>
    <p class="section-head__count">${num(site.socials.length)} ${c.tapes}</p>
  </header>
  <div class="rack__cabinet">
    <ol class="rack__slots">${site.socials.map(socialSlot).join('')}
    </ol>
  </div>
</section>
</main>
${colophon(t, u, { href: `../../${lang}/`, code: u.diskCode, label: u.diskVersion }, voiceCredit(lang, c))}
</body>
</html>
`;
};

// Who reads the tapes (the voices are CC0; credit given all the same).
const voiceCredit = (lang, c) => {
  const [locale, name, quality] = VOICES[lang].model.split('-'); // es_ES-davefx-medium
  const card = `https://huggingface.co/rhasspy/piper-voices/tree/main/${locale.slice(0, 2)}/${locale}/${name}/${quality}`;
  return c.voiceCredit
    .replace('{voice}', `<a href="${card}">${name}</a>`)
    .replace('{piper}', '<a href="https://github.com/OHF-Voice/piper1-gpl">Piper</a>');
};

// Sends visitors to their language; without JS, offers both.
const toLanguage = (prefix, icon = 'assets/favicon.svg') => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${site.name}</title>
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="${icon}" type="image/svg+xml">
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

const stale = [];
const write = (path, html) => {
  const f = join(root, path);
  if (CHECK) {
    // the footer's "today" is the day it was built; it says nothing about being up to date
    const same = (x) => x.replace(/<time class="today"[^>]*>[^<]*<\/time>/g, '');
    if (!existsSync(f) || same(readFileSync(f, 'utf8')) !== same(html)) stale.push(path);
    return;
  }
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, html);
  console.log('✓', path);
};
const clear = (dir) => { if (!CHECK) rmSync(join(root, dir), { recursive: true, force: true }); };

clear('archivo'); // old prototype paths
for (const lang of LANGS) {
  clear(lang);
  write(`${lang}/index.html`, page(lang));
}
write('index.html', toLanguage(''));
clear('vhs');
for (const lang of LANGS) write(`vhs/${lang}/index.html`, vhsPage(lang));
write('vhs/index.html', toLanguage('', '../assets/favicon.svg'));
clear('cassette');
for (const lang of LANGS) write(`cassette/${lang}/index.html`, cassettePage(lang));
write('cassette/index.html', toLanguage('', '../assets/favicon.svg'));
if (techMissing.size) console.warn(`! no link in data/tech.json for: ${[...techMissing].join(', ')}`);

/* ---------- the voice ---------- */

try {
  const { missing, orphans } = voice.finish({ check: CHECK, noAudio: flag('--no-audio'), list: flag('--say') });
  if (CHECK) {
    const problems = [
      ...stale.map((p) => `  page out of date: ${p}`),
      ...missing.map((k) => `  clip missing: assets/audio/${k}.opus`),
      ...orphans.map((f) => `  clip no longer used: assets/audio/${f}`)
    ];
    if (problems.length) {
      console.error(`✗ the build is out of date — run node build.mjs and commit what it changes:\n${problems.join('\n')}`);
      process.exit(1);
    }
    console.log('✓ pages and voice clips up to date');
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
