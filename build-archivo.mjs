#!/usr/bin/env node
// Archive portfolio · Disquetes — zero-dependency static build.
// Content: data/site.json and data/projects.json. Interface labels: data/archivo.json.
//   archivo/disquetes/asomado/{es,en}/index.html   the portfolio
//   index.html, archivo/, archivo/disquetes/       send visitors to their language
// Usage: node build-archivo.mjs

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
const PATH = 'archivo/disquetes';

const esc = (s) => String(s)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const plain = (s) => s.replace(/\[\[(.+?)\]\]/g, '$1'); // the bio's erasure marks are not used here
const pretty = (u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const pad = (n) => String(n).padStart(3, '0');

/* ---------- small pieces ---------- */

// 001 → leading zeros in ghost grey
const num = (n) => {
  const s = pad(n);
  const lead = s.match(/^0*/)[0].slice(0, s.length - 1);
  return `<span class="num"><span class="num__ghost">${lead}</span>${s.slice(lead.length)}</span>`;
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

// One variant kept: the cover of the disk inside sticks out of the drive.
const VARIANTS = ['asomado'];

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
const station = (v, u) => `
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

const page = (v, lang) => {
  const t = { ...site.i18n[lang], lang };
  const u = ui[lang];
  const other = lang === 'es' ? 'en' : 'es';
  const url = `${site.baseUrl}/${PATH}/${v}/${lang}/`;
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
  ${LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${site.baseUrl}/${PATH}/${v}/${l}/">`).join('\n  ')}
  <meta property="og:title" content="${site.name} · ${t.runningHead}">
  <meta property="og:description" content="${esc(t.metaDescription)}">
  <meta property="og:url" content="${url}">
  <link rel="preload" href="../../../../assets/fonts/archivo-latin-wdth-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../../../../assets/fonts/chakra-petch-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../../../../assets/css/archivo.css">
  <link rel="stylesheet" href="../../../../assets/css/ar-disquetes.css">
  <link rel="stylesheet" href="../../../../assets/css/ar-disks.css">
  <link rel="stylesheet" href="../../../../assets/css/ar-dq-${v}.css">
  <script>document.documentElement.classList.replace('no-js','js')</script>
  <script type="module" src="../../../../assets/js/ar-disquetes.js"></script>
</head>
<body class="ar ar--disquetes dq--${v}">
<a class="skip" href="#main">${t.skip}</a>
<header class="masthead">
  <h1 class="masthead__title"><a href="./" rel="home">${site.name} <span aria-hidden="true">/</span> ${t.kicker}</a></h1>
  <p class="masthead__lang"><a href="../${other}/" hreflang="${other}" lang="${other}">${t.otherEdition}</a></p>
</header>
<main id="main">
${station(v, u)}
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
    <p class="label">${u.document}</p>
    <p class="colophon__no">NM.000.MMXXVI</p>
  </div>
  <p class="colophon__text">${t.colophon}</p>
  <div class="colophon__code">${barcode('NM.000.MMXXVI')}<span class="square" aria-hidden="true"></span></div>
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
  ${LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${site.baseUrl}/${PATH}/asomado/${l}/">`).join('\n  ')}
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

rmSync(join(root, 'archivo'), { recursive: true, force: true });
for (const v of VARIANTS) for (const lang of LANGS) write(`${PATH}/${v}/${lang}/index.html`, page(v, lang));
write(`${PATH}/index.html`, toLanguage('asomado/'));
write('archivo/index.html', toLanguage('disquetes/asomado/'));
write('index.html', toLanguage(`${PATH}/asomado/`));
