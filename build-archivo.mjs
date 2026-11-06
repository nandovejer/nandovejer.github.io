#!/usr/bin/env node
// Archive portfolio — zero-dependency static build.
// Same content as the book (data/site.json, data/projects.json); only the
// interface labels live in data/archivo.json.
//   archivo/index.html                         the four versions
//   archivo/fichero/{es,en}/                   one page
//   archivo/registro/{es,en}/ (+ bio/, {id}/)  several pages
//   archivo/cinta/{es,en}/                     scroll effect
//   archivo/disquetes/{es,en}/                 floppy disks and a drive
// Usage: node build-archivo.mjs

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plates, ornaments } from './src/plates.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(root, f), 'utf8'));
const site = read('data/site.json');
const projects = read('data/projects.json');
const ui = read('data/archivo.json');
const LANGS = ['es', 'en'];
const VERSIONS = ui.versions;

const esc = (s) => String(s)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const plain = (s) => s.replace(/\[\[(.+?)\]\]/g, '$1'); // the bio's erasure marks are not used here
const pretty = (u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const pad = (n) => String(n).padStart(3, '0');

/* ---------- small pieces ---------- */

// 001 → leading zeros in ghost grey (img 12's "$1,894.0")
const num = (n, cls = '') => {
  const s = pad(n);
  const lead = s.match(/^0*/)[0].slice(0, s.length - 1);
  return `<span class="num ${cls}"><span class="num__ghost">${lead}</span>${s.slice(lead.length)}</span>`;
};

const globe = `<svg class="icon-globe" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="16" cy="16" r="13"/><ellipse cx="16" cy="16" rx="6" ry="13"/><path d="M3 16h26M5 9h22M5 23h22"/></g></svg>`;

const arrow = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;

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

const stack = (u) => `<div class="stack" aria-hidden="true"><span>NM</span><span>${u.archive}</span><span>${u.objects}</span></div>`;

const cells = (rows, cls = '') => `<dl class="cells ${cls}">${rows.filter(Boolean).map(([k, v, mod]) =>
  `<div class="cell${mod ? ` cell--${mod}` : ''}"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

// Everything one object needs, from the shared content.
const objectOf = (p, i, t, u) => {
  const c = p[t.lang];
  const n = i + 1;
  return {
    id: p.id, n, no: pad(n), code: `NM-${pad(n)}`, doc: `NM.${pad(n)}.${p.year}`,
    name: p.name, use: c.kicker, body: c.body, quote: c.quote,
    year: p.year, material: p.language,
    status: p.demo ? u.statusOnline : u.statusRepo,
    demo: p.demo, repo: p.repo,
    art: p.plate ? plates[p.plate] : ornaments[p.ornament],
    caption: p.plate ? `${t.plate} ${n}. ${c.caption}` : ''
  };
};

const links = (o, t) => `<ul class="links">
  ${o.demo ? `<li><a href="${o.demo}">${t.demo} <span>${pretty(o.demo)}</span></a></li>` : ''}
  <li><a href="${o.repo}">${t.repo} <span>${pretty(o.repo)}</span></a></li>
</ul>`;

const socials = (t) => `<ul class="socials">${site.socials.map((s) =>
  `<li><a href="${s.url}" rel="me noopener"><span class="socials__label">${s.label}</span> <span class="socials__handle">${esc(s.handle)}</span></a></li>`).join('')}</ul>`;

// The person, as object 000.
const person = (t, u, { full = true, headingLevel = 1, link = '' } = {}) => {
  const [first, ...rest] = site.name.split(' ');
  const h = `h${headingLevel}`;
  return `
<section class="person" aria-labelledby="person-name">
  <div class="person__head">
    <p class="label">${u.object}</p>
    <p class="person__num">${num(0)}</p>
    <p class="person__kicker">${t.kicker}</p>
    <p class="person__coll">${u.collection}</p>
  </div>
  <div class="person__mark">${stack(u)}${globe}</div>
  <${h} class="person__name" id="person-name"><span>${first}</span> <span>${rest.join(' ')}</span></${h}>
  <p class="person__deck">${t.deck}</p>
  ${cells([[u.era, site.i18n[t.lang].established.replace(/^Est\.\s*/, '')], [u.origin, u.originValue], [u.use, t.kicker.split('·')[0].trim()], [u.status, u.statusActive]], 'person__cells')}
  <div class="person__bio">
    <p class="label">${u.description}</p>
    ${(full ? t.bio : t.bio.slice(0, 1)).map((p) => `<p>${esc(plain(p))}</p>`).join('\n    ')}
    ${link}
  </div>
  <div class="person__contact">
    <p class="label">${u.contact}</p>
    ${socials(t)}
  </div>
</section>`;
};

const footer = (t, u) => `
<footer class="colophon">
  <div class="colophon__doc">
    <p class="label">${u.document}</p>
    <p class="colophon__no">NM.000.MMXXVI</p>
  </div>
  <p class="colophon__text">${t.colophon}</p>
  <div class="colophon__code">${barcode('NM.000.MMXXVI')}<span class="square" aria-hidden="true"></span></div>
</footer>`;

/* ---------- page shell ---------- */

const shell = ({ v, lang, sub = [], title, body, extraHead = '' }) => {
  const t = { ...site.i18n[lang], lang };
  const u = ui[lang];
  const other = lang === 'es' ? 'en' : 'es';
  const depth = 3 + sub.length;             // archivo/v/lang/…sub
  const rel = '../'.repeat(depth);
  const tail = sub.length ? `${sub.join('/')}/` : '';
  const url = `${site.baseUrl}/archivo/${v}/${lang}/${tail}`;
  return `<!doctype html>
<html lang="${lang}" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · ${u.versions[v].name}</title>
  <meta name="description" content="${esc(t.metaDescription)}">
  <meta name="color-scheme" content="light dark">
  <link rel="canonical" href="${url}">
  ${LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${site.baseUrl}/archivo/${v}/${l}/${tail}">`).join('\n  ')}
  <link rel="preload" href="${rel}assets/fonts/archivo-latin-wdth-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="${rel}assets/fonts/chakra-petch-latin-600-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${rel}assets/css/archivo.css">
  <link rel="stylesheet" href="${rel}assets/css/ar-${v}.css">
  ${extraHead}
  <script>document.documentElement.classList.replace('no-js','js')</script>
  <script type="module" src="${rel}assets/js/ar-${v}.js"></script>
</head>
<body class="ar ar--${v}">
<a class="skip" href="#main">${t.skip}</a>
<header class="masthead">
  <p class="masthead__title"><a href="${rel}archivo/">${u.archive}</a> <span aria-hidden="true">/</span> ${site.name}</p>
  <p class="masthead__version">${u.versions[v].name}</p>
  <p class="masthead__lang"><a href="${rel}archivo/${v}/${other}/${tail}" hreflang="${other}" lang="${other}">${t.otherEdition}</a></p>
</header>
<main id="main">
${body(t, u)}
</main>
${footer(t, u)}
</body>
</html>
`;
};

/* ---------- version I · Fichero (one page) ---------- */

const card = (o, t, u) => `
  <article class="card" id="${o.id}" aria-labelledby="${o.id}-title">
    <div class="card__inner">
      <div class="card__face card__front">
        <header class="card__head">
          <div><p class="label">${u.object}</p><p class="card__num">${num(o.n)}</p></div>
          <div class="card__mark">${globe}</div>
        </header>
        <h3 class="card__title" id="${o.id}-title">${esc(o.name)}</h3>
        <p class="card__use">${esc(o.use)}</p>
        <p class="card__year">${o.year}</p>
        <figure class="card__art"><div class="card__plate">${o.art}</div><span class="square" aria-hidden="true"></span>${o.caption ? `<figcaption>${esc(o.caption)}</figcaption>` : ''}</figure>
        ${cells([[u.era, o.year], [u.origin, u.originValue], [u.material, o.material], [u.status, o.status]], 'cells--4')}
        <footer class="card__foot">
          <div><p class="label">${u.document}</p><p class="card__doc">${o.doc}</p></div>
          ${barcode(o.doc)}
        </footer>
        <button class="card__flip" type="button" hidden data-front="${u.flipBack}" data-back="${u.flipFront}" aria-expanded="false">${u.flipBack} ↻</button>
      </div>
      <div class="card__face card__back">
        <p class="label">${u.catalog} ${o.code}</p>
        <p class="card__quote">“${esc(o.quote)}”</p>
        <p class="label">${u.description}</p>
        <p class="card__body">${esc(o.body)}</p>
        <p class="label">${u.links}</p>
        ${links(o, t)}
        <div class="card__backfoot">${barcode(o.code)}<span class="square" aria-hidden="true"></span></div>
      </div>
    </div>
  </article>`;

const fichero = (lang) => shell({
  v: 'fichero', lang, title: site.name,
  body: (t, u) => `
${person(t, u)}
<section class="wall" aria-labelledby="wall-title">
  <header class="section-head">
    <h2 id="wall-title">${t.worksTitle}</h2>
    <p class="section-head__count">${num(projects.length)} ${u.objects}</p>
  </header>
  <div class="wall__grid">
    ${projects.map((p, i) => card(objectOf(p, i, t, u), t, u)).join('\n')}
  </div>
</section>`
});

/* ---------- version II · Registro (several pages) ---------- */

const stats = (u) => {
  const years = projects.map((p) => p.year);
  const min = Math.min(...years), max = Math.max(...years);
  return `<dl class="stats">
    <div class="stat"><dt>${u.statObjects}</dt><dd><span class="count" data-to="${projects.length}">${String(projects.length).padStart(2, '0')}</span></dd></div>
    <div class="stat"><dt>${u.statYears}</dt><dd>${min}<span class="stat__dash">–</span>${max}</dd></div>
    <div class="stat"><dt>${u.statDemos}</dt><dd><span class="count" data-to="${projects.filter((p) => p.demo).length}">${String(projects.filter((p) => p.demo).length).padStart(2, '0')}</span></dd></div>
    <div class="stat stat--accent"><dt>${u.statDeps}</dt><dd>00</dd></div>
  </dl>`;
};

const ledgerPage = (lang) => shell({
  v: 'registro', lang, title: site.name,
  extraHead: '<meta name="view-transition" content="same-origin">',
  body: (t, u) => {
    const materials = [...new Set(projects.map((p) => p.language))];
    return `
${person(t, u, { full: false, link: `<p><a class="more" href="bio/">${u.readBio} →</a></p>` })}
<section class="ledger" aria-labelledby="ledger-title">
  <header class="section-head">
    <h2 id="ledger-title">${t.worksTitle}</h2>
    <p class="section-head__count">${num(projects.length)} ${u.objects}</p>
  </header>
  ${stats(u)}
  <div class="filters" hidden role="group" aria-label="${u.filterBy}">
    <button type="button" class="chip" aria-pressed="true" data-material="">${u.all}</button>
    ${materials.map((m) => `<button type="button" class="chip" aria-pressed="false" data-material="${m}">${m}</button>`).join('')}
  </div>
  <table class="ledger__table">
    <caption class="visually-hidden">${t.worksTitle}</caption>
    <thead><tr>
      ${[['n', '№'], ['name', u.object], ['year', u.era], ['use', u.use], ['material', u.material], ['status', u.status]].map(([k, l]) =>
        `<th scope="col" data-key="${k}"><span class="th-label">${l}</span></th>`).join('')}
    </tr></thead>
    <tbody>
      ${projects.map((p, i) => {
        const o = objectOf(p, i, t, u);
        return `<tr data-n="${o.n}" data-name="${esc(o.name)}" data-year="${o.year}" data-use="${esc(o.use)}" data-material="${o.material}" data-status="${o.status}">
        <td data-label="№">${num(o.n)}</td>
        <th scope="row" data-label="${u.object}"><a href="${o.id}/" style="view-transition-name: t-${o.id}">${esc(o.name)}</a></th>
        <td data-label="${u.era}">${o.year}</td>
        <td data-label="${u.use}">${esc(o.use)}</td>
        <td data-label="${u.material}">${o.material}</td>
        <td data-label="${u.status}"><span class="status${o.demo ? ' status--on' : ''}">${o.status}</span></td>
      </tr>`;
      }).join('\n      ')}
    </tbody>
  </table>
</section>`;
  }
});

const pager = (i, t, u) => {
  const prev = i > 0 ? projects[i - 1] : null;
  const next = i < projects.length - 1 ? projects[i + 1] : null;
  return `<nav class="pager" aria-label="${u.prev} / ${u.next}">
    ${prev ? `<a class="pager__prev" href="../${prev.id}/" rel="prev"><span class="label">← ${u.prev}</span> ${num(i)} ${esc(prev.name)}</a>` : `<a class="pager__prev" href="../bio/" rel="prev"><span class="label">← ${u.prev}</span> ${num(0)} ${u.bio}</a>`}
    <a class="pager__up" href="../">${u.backToLedger}</a>
    ${next ? `<a class="pager__next" href="../${next.id}/" rel="next"><span class="label">${u.next} →</span> ${num(i + 2)} ${esc(next.name)}</a>` : '<span></span>'}
  </nav>`;
};

const poster = (o, t, u, i) => `
<article class="poster" aria-labelledby="poster-title">
  <header class="poster__head">
    <div><p class="label">${u.object}</p><p class="poster__num">${num(o.n)}</p></div>
    <div class="poster__meta"><p>${u.archive}</p><p>${u.collection}</p></div>
    <div class="poster__mark">${stack(u)}${globe}</div>
  </header>
  <h1 class="poster__title" id="poster-title" style="view-transition-name: t-${o.id}">${esc(o.name)}</h1>
  <p class="poster__use">${esc(o.use)}</p>
  <p class="poster__year">${o.year}</p>
  <figure class="poster__art"><div class="poster__plate">${o.art}</div><span class="square" aria-hidden="true"></span>${o.caption ? `<figcaption>${esc(o.caption)}</figcaption>` : ''}</figure>
  <div class="poster__text">
    <p class="poster__quote">“${esc(o.quote)}”</p>
    <p class="label">${u.description}</p>
    <p>${esc(o.body)}</p>
    <p class="label">${u.links}</p>
    ${links(o, t)}
  </div>
  ${cells([[u.era, o.year], [u.origin, u.originValue], [u.use, esc(o.use)], [u.material, o.material], [u.status, o.status], [u.catalog, o.code]], 'cells--6')}
  <footer class="poster__foot">
    <div><p class="label">${u.document}</p><p class="poster__doc">${o.doc}</p></div>
    ${barcode(o.doc)}<span class="square" aria-hidden="true"></span>
  </footer>
</article>
${pager(i, t, u)}`;

const projectPage = (lang, i) => {
  const p = projects[i];
  return shell({
    v: 'registro', lang, sub: [p.id], title: `${p.name} · ${site.name}`,
    extraHead: '<meta name="view-transition" content="same-origin">',
    body: (t, u) => poster(objectOf(p, i, t, u), t, u, i)
  });
};

const bioPage = (lang) => shell({
  v: 'registro', lang, sub: ['bio'], title: `${ui[lang].bio} · ${site.name}`,
  extraHead: '<meta name="view-transition" content="same-origin">',
  body: (t, u) => `${person(t, u)}
<nav class="pager" aria-label="${u.next}">
  <span></span>
  <a class="pager__up" href="../">${u.backToLedger}</a>
  <a class="pager__next" href="../${projects[0].id}/" rel="next"><span class="label">${u.next} →</span> ${num(1)} ${esc(projects[0].name)}</a>
</nav>`
});

/* ---------- version III · Cinta (scroll effect) ---------- */

const panel = (o, t, u) => `
    <article class="panel" id="${o.id}" aria-labelledby="${o.id}-title" data-n="${o.n}">
      <div class="panel__top">
        <div><p class="label">${u.object}</p><p class="panel__num">${num(o.n)}</p></div>
        <p class="panel__year">${o.year}</p>
      </div>
      <h3 class="panel__title" id="${o.id}-title">${esc(o.name)}</h3>
      <p class="panel__use">${esc(o.use)}</p>
      <figure class="panel__art">${o.art}</figure>
      <p class="panel__body">${esc(o.body)}</p>
      ${cells([[u.material, o.material], [u.status, o.status], [u.catalog, o.code]], 'cells--3')}
      <div class="panel__band">
        <p class="panel__quote">“${esc(o.quote)}”</p>
        ${links(o, t)}
      </div>
    </article>`;

const perYear = (u) => {
  const years = [...new Set(projects.map((p) => p.year))].sort();
  const max = Math.max(...years.map((y) => projects.filter((p) => p.year === y).length));
  return `<figure class="years">
    <figcaption class="label">${u.perYear}</figcaption>
    <ol class="years__list">
      ${years.map((y) => {
        const c = projects.filter((p) => p.year === y).length;
        return `<li style="--h:${(c / max).toFixed(3)}"><span class="years__bar" aria-hidden="true"></span><span class="years__n">${String(c).padStart(2, '0')}</span><span class="years__y">${y}</span></li>`;
      }).join('')}
    </ol>
  </figure>`;
};

const cinta = (lang) => shell({
  v: 'cinta', lang, title: site.name,
  body: (t, u) => `
${person(t, u)}
<section class="tape" aria-labelledby="tape-title" style="--count:${projects.length}">
  <div class="tape__stage">
    <header class="tape__hud">
      <h2 id="tape-title">${t.worksTitle}</h2>
      <p class="tape__counter" aria-hidden="true"><span class="tape__current">${num(1)}</span><span class="tape__of">/ ${pad(projects.length)}</span></p>
      <div class="tape__progress" aria-hidden="true"><span></span></div>
    </header>
    <div class="tape__track">
      ${projects.map((p, i) => panel(objectOf(p, i, t, u), t, u)).join('\n')}
    </div>
  </div>
</section>
<section class="figures" aria-label="${u.statObjects}">
  ${stats(u)}
  ${perYear(u)}
</section>`
});

/* ---------- version IV · Disquetes (creative) ---------- */

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

const disquetes = (lang) => shell({
  v: 'disquetes', lang, title: site.name,
  body: (t, u) => {
    const bioObj = { id: 'bio', n: 0, code: 'NM-000', name: site.name, year: 'MMXXVI', material: 'HTML · CSS', use: t.kicker.split('·')[0].trim() };
    return `
<section class="station" aria-label="${u.drive}">
  <div class="drive" aria-hidden="true">
    <span class="drive__brand">NM · 1.44 MB</span>
    <span class="drive__slot"><span class="drive__flap"></span></span>
    <span class="drive__led"></span>
    <span class="drive__btn"></span>
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
    <li class="entry entry--bio" id="bio" data-code="${bioObj.code}">
      <button type="button" class="entry__disk" hidden aria-label="${u.insert}: ${bioObj.name}">${disk(bioObj, u)}</button>
      <div class="entry__static">${disk(bioObj, u)}</div>
      <div class="entry__content">
        <h3 class="entry__title">${bioObj.name}</h3>
        <p class="entry__use">${t.kicker}</p>
        <p class="entry__quote">${t.deck}</p>
        ${t.bio.map((p) => `<p>${esc(plain(p))}</p>`).join('')}
        ${socials(t)}
      </div>
    </li>
    ${projects.map((p, i) => {
      const o = objectOf(p, i, t, u);
      return `<li class="entry" id="${o.id}" data-code="${o.code}">
      <button type="button" class="entry__disk" hidden aria-label="${u.insert}: ${esc(o.name)}">${disk(o, u)}</button>
      <div class="entry__static">${disk(o, u)}</div>
      <div class="entry__content">
        <h3 class="entry__title">${esc(o.name)}</h3>
        <p class="entry__use">${esc(o.use)} · ${o.year}</p>
        <p class="entry__quote">“${esc(o.quote)}”</p>
        <p>${esc(o.body)}</p>
        ${cells([[u.material, o.material], [u.status, o.status], [u.document, o.doc]], 'cells--3')}
        ${links(o, t)}
      </div>
    </li>`;
    }).join('\n    ')}
  </ol>
</section>`;
  }
});

/* ---------- index of the four versions ---------- */

const index = () => {
  const es = ui.es, en = ui.en;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${es.archive} · ${site.name}</title>
  <meta name="color-scheme" content="light dark">
  <link rel="stylesheet" href="../assets/css/archivo.css">
</head>
<body class="ar ar--index">
<main id="main" class="versions">
  <header class="versions__head">
    <p class="label">${es.archive} · <span lang="en">${en.archive}</span></p>
    <h1 class="versions__title">${site.name}</h1>
    ${stack(es)}
  </header>
  <ol class="versions__list">
    ${VERSIONS.map((v, i) => `<li class="versions__item">
      <p class="versions__num">${num(i + 1)}</p>
      <h2>${es.versions[v].name} <span lang="en">/ ${en.versions[v].name}</span></h2>
      <p>${es.versions[v].summary}</p>
      <p lang="en" class="versions__en">${en.versions[v].summary}</p>
      <p class="versions__links"><a href="${v}/es/">Español</a> <a href="${v}/en/" hreflang="en" lang="en">English</a></p>
    </li>`).join('\n    ')}
  </ol>
</main>
</body>
</html>
`;
};

/* ---------- write ---------- */

const out = (path, html) => {
  const f = join(root, 'archivo', path, 'index.html');
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, html);
  console.log('✓', `archivo/${path ? `${path}/` : ''}index.html`);
};

rmSync(join(root, 'archivo'), { recursive: true, force: true });
for (const lang of LANGS) {
  out(`fichero/${lang}`, fichero(lang));
  out(`registro/${lang}`, ledgerPage(lang));
  out(`registro/${lang}/bio`, bioPage(lang));
  projects.forEach((p, i) => out(`registro/${lang}/${p.id}`, projectPage(lang, i)));
  out(`cinta/${lang}`, cinta(lang));
  out(`disquetes/${lang}`, disquetes(lang));
}
out('', index());
