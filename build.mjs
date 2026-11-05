#!/usr/bin/env node
// Zero-dependency static build: data/*.json → {variant}/{es,en}/index.html
// plus a root index.html that presents the Abecedario versions.
// Usage: node build.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plates, ornaments } from './src/plates.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const site = JSON.parse(readFileSync(join(root, 'data/site.json'), 'utf8'));
const projects = JSON.parse(readFileSync(join(root, 'data/projects.json'), 'utf8'));

const LANGS = ['es', 'en'];
// Abecedario (two-page spread) and four single-column versions, each with
// its own kind of zoom.
const VARIANTS = ['abecedario', 'cuentahilos', 'contraforma', 'cascada', 'micrografia'];
const COLUMN = new Set(['abecedario', 'cuentahilos', 'contraforma', 'cascada', 'micrografia']);
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const esc = (s) => String(s)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

// [[word]] marks the words that survive the erasure of the bio.
const bioMarkup = (text) => esc(text).replace(/\[\[(.+?)\]\]/g, '<span class="keep">$1</span>');

// Strip the scheme and allow line breaks after each slash (narrow marginalia).
const prettyUrl = (u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').replaceAll('/', '/<wbr>');

/* ---------- pieces ---------- */

const toc = (t, variant) => `
<nav class="toc toc--${variant}" aria-labelledby="toc-${variant}">
  <h2 class="toc__title" id="toc-${variant}">${t.tocTitle}</h2>
  <ol class="toc__list">
    ${projects.map((p, i) => `<li><a href="#${p.id}"><span class="toc__num">${ROMAN[i]}</span> <span class="toc__name">${esc(p.name)}</span></a></li>`).join('\n    ')}
  </ol>
</nav>`;

const socials = (t) => `
<section class="socials" aria-labelledby="socials-title">
  <h2 class="socials__title" id="socials-title">${t.socialsTitle}</h2>
  <ul class="socials__list">
    ${site.socials.map((s) => `<li><a href="${s.url}" rel="me noopener"><span class="socials__label">${s.label}</span> <span class="socials__handle">${esc(s.handle)}</span></a></li>`).join('\n    ')}
  </ul>
</section>`;

const bio = (t) => {
  const paras = t.bio.map((p, i) => {
    const cls = [i === 0 && 'bio__lead', p.startsWith('[[') && 'starts-kept'].filter(Boolean).join(' ');
    return `<p${cls ? ` class="${cls}"` : ''}>${bioMarkup(p)}</p>`;
  });
  return `
  <div class="bio bio--erasure" id="bio">
    ${paras.join('\n    ')}
    <button class="bio__toggle" type="button" hidden data-full="${t.readFull}" data-erased="${t.readErased}">${t.readErased}</button>
  </div>`;
};

const titlePage = (t) => {
  const [first, ...rest] = site.name.split(' ');
  return `
<section class="verso" aria-labelledby="name">
  <div class="titlepage">
    <span class="monogram" aria-hidden="true">${site.monogram}</span>
    <div class="titlepage__text">
      <p class="titlepage__volume">${t.volume} <i>.I</i></p>
      <h1 class="titlepage__name" id="name"><span class="titlepage__first">${first}</span> <span class="titlepage__rest">${rest.join(' ')}</span></h1>
      <p class="titlepage__est">${t.established}</p>
      <p class="titlepage__deck">${t.deck}</p>
      <p class="titlepage__kicker">${t.kicker}</p>
    </div>
  </div>
  ${bio(t)}
  ${toc(t, 'inline')}
  ${socials(t)}
</section>`;
};

/* ---------- glyphs ---------- */

const glyphOf = (name) => (name.match(/[A-Za-zÀ-ÿ]/) || ['?'])[0].toUpperCase();
const codePoint = (g) => `U+${g.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

// The glyph table: the works as a type catalogue.
const glyphGrid = (t) => `
      <ol class="glyphs" aria-label="${t.glyphsTitle}">
        ${projects.map((p, i) => {
          const g = glyphOf(p.name);
          return `<li><a class="glyphs__cell" href="#${p.id}"><span class="glyphs__char" aria-hidden="true">${g}</span><span class="glyphs__name">${esc(p.name)}</span><span class="glyphs__meta" aria-hidden="true"><span>${ROMAN[i]}</span><span>${codePoint(g)}</span></span></a></li>`;
        }).join('\n        ')}
      </ol>`;

// Glyph inspector. In SVG the text's y is its exact baseline, so with
// font-size 1000 the guides sit on Libre Baskerville's metrics (font units).
const GLYPH_BOX = { w: 1200, h: 1420, base: 1080 };
const METRICS = [970, 770, 530, 0, -270]; // ascender, cap height, x-height, baseline, descender
const glyphInspector = (p, t) => {
  const g = glyphOf(p.name);
  const { w, h, base } = GLYPH_BOX;
  return `<svg class="glyph" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false">
      <g class="glyph__guides">
        ${METRICS.map((m, k) => `<line x1="0" x2="${w}" y1="${base - m}" y2="${base - m}" class="glyph__line glyph__line--${k}"/><text x="12" y="${base - m - 16}" class="glyph__label">${t.metrics[k]}</text>`).join('\n        ')}
      </g>
      <text class="glyph__char" x="${w / 2}" y="${base}" text-anchor="middle">${g}</text>
      <text class="glyph__code" x="${w - 12}" y="${h - 16}" text-anchor="end">${codePoint(g)}</text>
    </svg>`;
};

// Contraforma: where to dive into each letter — a point inside its counter
// (or beside it, for letters without one), in glyph-box units.
const COUNTER = { L: [700, 740], I: [840, 700], C: [660, 700], Q: [600, 690], A: [600, 650], T: [790, 830] };
const dive = (p) => {
  const g = glyphOf(p.name);
  const { w, h, base } = GLYPH_BOX;
  const [ox, oy] = COUNTER[g] ?? [w / 2, h / 2];
  return `<div class="dive" aria-hidden="true">
      <div class="dive__stage">
        <svg class="dive__glyph" viewBox="0 0 ${w} ${h}" focusable="false" style="--ox:${(ox / w * 100).toFixed(2)}%;--oy:${(oy / h * 100).toFixed(2)}%">
          <text x="${w / 2}" y="${base}" text-anchor="middle">${g}</text>
        </svg>
        <p class="dive__code">${codePoint(g)}</p>
      </div>
    </div>`;
};

// Micrografía: the letter is drawn with the chapter's own text, set tiny
// (decorative: the same text is in the chapter body, readable).
const micro = (p, t) => {
  const g = glyphOf(p.name);
  const { w, h, base } = GLYPH_BOX;
  const unit = `${p.name} · ${p[t.lang].body} · `;
  const text = unit.repeat(Math.ceil(9800 / unit.length));
  const [fx, fy] = INK[g] ?? [.5, .5];
  return `<figure class="micro" data-ink="${fx},${fy}">
      <div class="micro__viewport" aria-hidden="true">
        <div class="micro__canvas">
          <svg class="micro__svg" viewBox="0 0 ${w} ${h}" focusable="false">
            <defs><clipPath id="mg-${p.id}"><text x="${w / 2}" y="${base}" text-anchor="middle" class="micro__clip">${g}</text></clipPath></defs>
            <foreignObject x="0" y="0" width="${w}" height="${h}" clip-path="url(#mg-${p.id})">
              <div xmlns="http://www.w3.org/1999/xhtml" class="micro__text">${esc(text)}</div>
            </foreignObject>
            <text x="${w / 2}" y="${base}" text-anchor="middle" class="micro__outline">${g}</text>
          </svg>
        </div>
      </div>
      <div class="micro__controls" hidden>
        <button type="button" class="micro__btn" data-zoom="-1" aria-label="${t.zoomOut}">−</button>
        <input type="range" class="micro__range" min="1" max="8" step="0.1" value="1" aria-label="${t.zoomLabel} · ${esc(p.name)}">
        <button type="button" class="micro__btn" data-zoom="1" aria-label="${t.zoomIn}">+</button>
        <output class="micro__value">×1</output>
      </div>
      <figcaption class="micro__hint" hidden>${t.microHint}</figcaption>
    </figure>`;
};
// Where the ink is, as a fraction of each letter's bounding box (Playfair
// Display Black): the slider and buttons zoom towards it, not into empty paper.
const INK = { L: [.2, .55], I: [.5, .5], C: [.12, .5], Q: [.1, .45], A: [.74, .62], T: [.5, .62] };

/* ---------- chapters ---------- */

const chapter = (p, i, t, v) => {
  const c = p[t.lang];
  const n = ROMAN[i];
  const lead = {
    abecedario: glyphInspector(p, t),
    cuentahilos: glyphInspector(p, t),
    cascada: glyphInspector(p, t),
    contraforma: dive(p),
    micrografia: micro(p, t)
  }[v] ?? '';
  const art = p.plate
    ? `<figure class="plate plate--${p.plate}">
        ${plates[p.plate]}
        <figcaption class="plate__caption">${t.plate} ${n}. ${esc(c.caption)}</figcaption>
      </figure>`
    : `<div class="ornament ornament--${p.ornament}" aria-hidden="true">${ornaments[p.ornament]}</div>`;
  const notes = [
    p.demo && `<li><a href="${p.demo}">${t.demo}</a> <span class="notes__url">${prettyUrl(p.demo)}</span></li>`,
    `<li><a href="${p.repo}">${t.repo}</a> <span class="notes__url">${prettyUrl(p.repo)}</span></li>`
  ].filter(Boolean).join('\n          ');
  return `
  <article class="chapter${p.plate ? ' has-plate' : ' has-ornament'}" id="${p.id}" aria-labelledby="${p.id}-title" data-chapter="${n}" data-glyph="${glyphOf(p.name)}">
    ${lead}
    <header class="chapter__head">
      <p class="chapter__num"><span class="chapter__label">${t.chapter}</span> <span class="chapter__roman">${n}</span></p>
      <h3 class="chapter__title" id="${p.id}-title"><span class="ink-underline">${esc(p.name)}</span></h3>
      <p class="chapter__kicker">${esc(c.kicker)}</p>
    </header>
    ${art}
    <div class="chapter__body">
      <p>${esc(c.body)}</p>
    </div>
    <blockquote class="pull" aria-hidden="true"><p>${esc(c.quote)}</p></blockquote>
    <aside class="chapter__aside" aria-label="${esc(p.name)}">
      <dl class="meta">
        <div><dt>${t.year}</dt><dd>${p.year}</dd></div>
        <div><dt>${t.language}</dt><dd>${p.language}</dd></div>
      </dl>
      <ol class="notes">
          ${notes}
      </ol>
    </aside>
    <div class="tailpiece" aria-hidden="true">${ornaments.fleuron}</div>
  </article>`;
};

// Cascada: a type-size waterfall; each line opens its chapter.
const POINTS = [10, 12, 14, 18, 24, 30, 36, 48];
const cascade = (t, v) => projects.map((p, i) => `
  <details class="cascade" name="obras" style="--pt:${POINTS[i] ?? 48}">
    <summary class="cascade__row">
      <span class="cascade__pt" aria-hidden="true">${POINTS[i] ?? 48} pt</span>
      <span class="cascade__glyph" aria-hidden="true">${glyphOf(p.name)}</span>
      <span class="cascade__name">${esc(p.name)}</span>
      <span class="cascade__roman" aria-hidden="true">${ROMAN[i]}</span>
    </summary>
    ${chapter(p, i, t, v)}
  </details>`).join('\n');

// Type specimen block: the alphabet plus a live tester.
const specimen = (t) => `
  <section class="specimen" aria-labelledby="specimen-title">
    <h2 class="specimen__title" id="specimen-title">${t.specimenTitle}</h2>
    <p class="specimen__line specimen__line--lower" aria-hidden="true">a b c d e f g h i j k l m n ñ o p q r s t u v w x y z</p>
    <p class="specimen__line specimen__line--upper" aria-hidden="true">A B C D E F G H I J K L M N Ñ O P Q R S T U V W X Y Z</p>
    <p class="specimen__line specimen__line--figures" aria-hidden="true">1 2 3 4 5 6 7 8 9 0 . . . ( &amp; ! ? )</p>
    <div class="specimen__tester" hidden>
      <label class="specimen__label" for="specimen-input">${t.specimenLabel}</label>
      <input class="specimen__input" id="specimen-input" type="text" maxlength="40" autocomplete="off" spellcheck="false" placeholder="${t.specimenPlaceholder}">
      <output class="specimen__output" for="specimen-input" aria-hidden="true">${site.nick}</output>
    </div>
  </section>`;

const alternates = (v) => LANGS
  .map((l) => `<link rel="alternate" hreflang="${l}" href="${site.baseUrl}/${v}/${l}/">`)
  .join('\n  ');

const page = (v, lang) => {
  const t = { ...site.i18n[lang], lang };
  const other = lang === 'es' ? 'en' : 'es';
  const url = `${site.baseUrl}/${v}/${lang}/`;
  const variant = t.variants[v];
  const fonts = ['libre-baskerville-latin-400-normal', 'playfair-display-latin-wght-normal'];
  const css = ['base', 'shared', 'especimen', 'abecedario', COLUMN.has(v) && 'columna', v !== 'abecedario' && v].filter(Boolean);
  const bodyClass = ['ed', 'ed--especimen', 'ed--abecedario', COLUMN.has(v) && 'ed--columna', v !== 'abecedario' && `ed--${v}`].filter(Boolean).join(' ');
  const chapters = projects.map((p, i) => chapter(p, i, t, v)).join('\n');
  const works = {
    abecedario: `${glyphGrid(t)}\n${chapters}`,
    cuentahilos: `${glyphGrid(t)}\n${chapters}`,
    cascada: cascade(t, v)
  }[v] ?? chapters;
  return `<!doctype html>
<html lang="${lang}" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${site.name} · ${t.runningHead} · ${variant.name}</title>
  <meta name="description" content="${esc(t.metaDescription)}">
  <meta name="color-scheme" content="light dark">
  <link rel="canonical" href="${url}">
  ${alternates(v)}
  <meta property="og:title" content="${site.name} · ${t.runningHead}">
  <meta property="og:description" content="${esc(t.metaDescription)}">
  <meta property="og:url" content="${url}">
  <meta property="og:locale" content="${lang === 'es' ? 'es_ES' : 'en_GB'}">
  ${fonts.map((f) => `<link rel="preload" href="../../assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin>`).join('\n  ')}
  ${css.map((c) => `<link rel="stylesheet" href="../../assets/css/${c}.css">`).join('\n  ')}
  <script>document.documentElement.classList.replace('no-js','js')</script>
  <script type="module" src="../../assets/js/${v}.js"></script>
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">${t.skip}</a>
<div class="book">
  <header class="runhead">
    <p class="runhead__title"><a href="../../">${site.name}</a> <span aria-hidden="true">·</span> ${t.runningHead}</p>
    <p class="runhead__edition"><i>${variant.name}</i></p>
    <p class="runhead__lang"><a href="../${other}/" hreflang="${other}" lang="${other}">${t.otherEdition}</a></p>
  </header>
  ${toc(t, 'rail')}
  <main class="spread" id="main">
    ${titlePage(t)}
    <section class="recto" aria-labelledby="works-title" data-prev="${t.prevPage}" data-next="${t.nextPage}" data-of="${t.pageOf}">
      <h2 class="recto__title" id="works-title">${t.worksTitle}</h2>
      ${works}
    </section>
  </main>
  <footer class="colophon">
    ${specimen(t)}
    <h2 class="colophon__title">${t.colophonTitle}</h2>
    <p class="colophon__text"><span class="cul cul--l" aria-hidden="true"></span><span class="cul cul--r" aria-hidden="true"></span>${t.colophon}</p>
    <div class="colophon__mark" aria-hidden="true">${ornaments.hedera}</div>
  </footer>
</div>
</body>
</html>
`;
};

// Root: provisional title page presenting the versions.
const index = () => {
  const es = site.i18n.es, en = site.i18n.en;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${site.name} · Abecedario</title>
  <meta name="description" content="${esc(es.metaDescription)}">
  <meta name="color-scheme" content="light dark">
  <link rel="stylesheet" href="assets/css/base.css">
</head>
<body class="ed--index">
<main class="frontis" id="main">
  <p class="frontis__eyebrow">${es.runningHead} <span aria-hidden="true">·</span> <span lang="en">${en.runningHead}</span></p>
  <h1 class="frontis__name">${site.name}</h1>
  <p class="frontis__deck">El abecedario, en una columna y con zoom <span aria-hidden="true">·</span> <span lang="en">The alphabet, in one column and with zoom</span></p>
  <ol class="frontis__list">
    ${VARIANTS.map((v, i) => `<li class="frontis__ed">
      <span class="frontis__num" aria-hidden="true">${i === 0 ? '·' : ROMAN[i - 1]}</span>
      <h2 class="frontis__title">${es.variants[v].name} <i lang="en">${en.variants[v].name}</i></h2>
      <p class="frontis__summary">${es.variants[v].summary}</p>
      <p class="frontis__summary" lang="en">${en.variants[v].summary}</p>
      <p class="frontis__links"><a href="${v}/es/">Edición en español</a> <span aria-hidden="true">·</span> <a href="${v}/en/" hreflang="en" lang="en">English edition</a></p>
    </li>`).join('\n    ')}
  </ol>
  <p class="frontis__foot">Madrid · MMXXVI</p>
</main>
</body>
</html>
`;
};

/* ---------- write ---------- */

for (const v of VARIANTS) {
  for (const lang of LANGS) {
    const out = join(root, v, lang, 'index.html');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, page(v, lang));
    console.log('✓', `${v}/${lang}/index.html`);
  }
}
writeFileSync(join(root, 'index.html'), index());
console.log('✓ index.html');
