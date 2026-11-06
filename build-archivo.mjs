#!/usr/bin/env node
// Archive portfolio · Disquetes — zero-dependency static build.
// Content: data/site.json and data/projects.json. Interface labels: data/archivo.json.
//   archivo/disquetes/{es,en}/index.html   the portfolio
//   archivo/index.html, index.html         send visitors to their language
// Usage: node build-archivo.mjs

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    id: p.id, code: `NM-${pad(n)}`, doc: `NM.${pad(n)}.${p.year}`,
    name: p.name, use: c.kicker, body: c.body, quote: c.quote,
    year: p.year, material: p.language,
    status: p.demo ? u.statusOnline : u.statusRepo,
    demo: p.demo, repo: p.repo
  };
};

const links = (o, t) => `<ul class="links">
  ${o.demo ? `<li><a href="${o.demo}">${t.demo} <span>${pretty(o.demo)}</span></a></li>` : ''}
  <li><a href="${o.repo}">${t.repo} <span>${pretty(o.repo)}</span></a></li>
</ul>`;

const socials = () => `<ul class="socials">${site.socials.map((s) =>
  `<li><a href="${s.url}" rel="me noopener"><span class="socials__label">${s.label}</span> <span class="socials__handle">${esc(s.handle)}</span></a></li>`).join('')}</ul>`;

// A labelled 3.5" floppy disk (decorative; the text is in the entry).
const disk = (o, u) => `
      <div class="disk" aria-hidden="true">
        <span class="disk__shutter"><span></span></span>
        <span class="disk__notch"></span>
        <span class="disk__hd">HD</span>
        <span class="disk__label">
          <span class="disk__small">${esc(o.name)}<br>${o.year} · ${o.material}</span>
          <span class="disk__cat">${u.catalog}</span>
          <span class="disk__code">${o.code}</span>
          <span class="disk__row"><span>${esc(o.use)}</span><span class="square"></span></span>
        </span>
      </div>`;

const entry = (o, u, content) => `
    <li class="entry${o.id === 'bio' ? ' entry--bio' : ''}" id="${o.id}" data-code="${o.code}">
      <button type="button" class="entry__disk" hidden aria-label="${u.insert}: ${esc(o.name)}">${disk(o, u)}</button>
      <div class="entry__static">${disk(o, u)}</div>
      <div class="entry__content">
        ${content}
      </div>
    </li>`;

/* ---------- the page ---------- */

const page = (lang) => {
  const t = { ...site.i18n[lang], lang };
  const u = ui[lang];
  const other = lang === 'es' ? 'en' : 'es';
  const url = `${site.baseUrl}/${PATH}/${lang}/`;
  const bio = { id: 'bio', code: 'NM-000', name: site.name, year: 'MMXXVI', material: 'HTML · CSS', use: t.kicker.split('·')[0].trim() };
  return `<!doctype html>
<html lang="${lang}" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${site.name} · ${t.runningHead}</title>
  <meta name="description" content="${esc(t.metaDescription)}">
  <meta name="color-scheme" content="light dark">
  <link rel="canonical" href="${url}">
  ${LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${site.baseUrl}/${PATH}/${l}/">`).join('\n  ')}
  <meta property="og:title" content="${site.name} · ${t.runningHead}">
  <meta property="og:description" content="${esc(t.metaDescription)}">
  <meta property="og:url" content="${url}">
  <link rel="preload" href="../../../assets/fonts/archivo-latin-wdth-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="../../../assets/fonts/chakra-petch-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../../../assets/css/archivo.css">
  <link rel="stylesheet" href="../../../assets/css/ar-disquetes.css">
  <script>document.documentElement.classList.replace('no-js','js')</script>
  <script type="module" src="../../../assets/js/ar-disquetes.js"></script>
</head>
<body class="ar ar--disquetes">
<a class="skip" href="#main">${t.skip}</a>
<header class="masthead">
  <h1 class="masthead__title">${site.name} <span aria-hidden="true">/</span> ${t.kicker}</h1>
  <p class="masthead__lang"><a href="../${other}/" hreflang="${other}" lang="${other}">${t.otherEdition}</a></p>
</header>
<main id="main">
<section class="station" aria-label="${u.drive}">
  <div class="drive" aria-hidden="true">
    <span class="drive__bezel">
      <span class="drive__slot"><span class="drive__flap"></span></span>
      <span class="drive__door"></span>
      <span class="drive__led"></span>
      <span class="drive__brand">1.44 MB</span>
      <span class="drive__btn"></span>
    </span>
  </div>
  <div class="screen">
    <p class="screen__status" aria-live="polite"><span class="label">${u.drive}</span> <span class="screen__state">${u.driveEmpty}</span></p>
    <div class="screen__out"></div>
    <button type="button" class="screen__eject" hidden>${u.eject} ⏏</button>
  </div>
</section>
<section class="shelf" aria-labelledby="shelf-title">
  <header class="section-head">
    <h2 id="shelf-title">${u.shelf}</h2>
    <p class="section-head__count">${num(projects.length + 1)} ${u.objects}</p>
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
const redirect = (prefix) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${site.name}</title>
  <meta name="color-scheme" content="light dark">
  ${LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${site.baseUrl}/${PATH}/${l}/">`).join('\n  ')}
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
for (const lang of LANGS) write(`${PATH}/${lang}/index.html`, page(lang));
write('archivo/index.html', redirect('disquetes/'));
write('index.html', redirect(`${PATH}/`));
