#!/usr/bin/env node
// Open Graph cards (1200 × 630): assets/og/{es,en}/home.jpg for the cassette, the
// site's front door, and assets/og/{es,en}/<project>.jpg for each project's page, drawn in the cassette's palette from data/site.json.
// Needs Chromium (to draw the HTML) and ImageMagick (PNG → JPG); build.mjs picks
// the images up by itself when they exist. Not part of the build: run it when
// the name, the title or the look change.
// Usage: node tools/og-images.mjs [--chromium /path/to/chromium]

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(readFileSync(join(root, 'data/site.json'), 'utf8'));
const arg = (f) => { const i = process.argv.indexOf(f); return i > -1 ? process.argv[i + 1] : null; };
const chromium = arg('--chromium') || 'chromium';
// A snap Chromium can only read visible folders under $HOME, so the scratch
// folder lives next to the script and goes away afterwards.
const tmp = join(root, 'tools/og-tmp');
const font = (f) => pathToFileURL(join(root, 'assets/fonts', f)).href;
const projects = JSON.parse(readFileSync(join(root, 'data/projects.json'), 'utf8'));
const host = site.baseUrl.replace(/^https?:\/\//, '');

// spec: the small line, the big title, the line under it, and the tape's label
const card = (lang, { mono, title, line, code, label }) => {
  return `<!doctype html><html lang="${lang}"><meta charset="utf-8"><style>
@font-face{font-family:Archivo;src:url(${font('archivo-latin-wdth-normal.woff2')});font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:'Chakra Petch';src:url(${font('chakra-petch-latin-600-normal.woff2')});font-weight:600}
@font-face{font-family:'Special Elite';src:url(${font('special-elite-latin-400-normal.woff2')})}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;background:#5c6b56;color:#f4f0e4;position:relative;font-family:Archivo,sans-serif}
.wall{position:absolute;inset:0;background:radial-gradient(120% 90% at 30% 20%,#6a7a63 0,#5c6b56 45%,#46533f 100%)}
.text{position:absolute;left:84px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center}
.mono{font:600 26px 'Chakra Petch';letter-spacing:.18em;color:#ffd2a8;text-transform:uppercase;margin-bottom:28px}
h1{font:800 var(--h, 92px)/.98 Archivo;font-stretch:112%;letter-spacing:-.01em}
h2{font:600 34px/1.25 'Chakra Petch';margin-top:30px;color:#dcd8c8}
.rule{width:96px;height:8px;background:#e3412b;margin-top:40px}
.url{position:absolute;left:84px;bottom:52px;font:600 24px 'Chakra Petch';letter-spacing:.06em;color:#dcd8c8}
svg{position:absolute;right:56px;top:150px;filter:drop-shadow(0 26px 30px rgba(0,0,0,.4))}
</style><div class="wall"></div>
<div class="text"><p class="mono">${mono}</p><h1>${title}</h1><h2>${line}</h2><div class="rule"></div></div>
<p class="url">${host}</p>
<svg width="470" height="320" viewBox="0 0 470 320" aria-hidden="true">
  <rect width="470" height="320" rx="20" fill="#232323"/>
  <rect x="3" y="3" width="464" height="314" rx="17" fill="none" stroke="#ffffff22" stroke-width="2"/>
  <rect x="28" y="26" width="414" height="196" rx="10" fill="#f4efe0"/>
  <rect x="28" y="26" width="414" height="52" rx="10" fill="#e3412b"/>
  <rect x="28" y="62" width="414" height="16" fill="#e3412b"/>
  <text x="46" y="62" font-family="Special Elite" font-size="26" fill="#fff">${code}</text>
  <text x="46" y="118" font-family="Special Elite" font-size="30" fill="#232323">${label}</text>
  <path d="M46 138h378M46 164h378M46 190h260" stroke="#23232333" stroke-width="2"/>
  <rect x="120" y="226" width="230" height="70" rx="35" fill="#111"/>
  <circle cx="170" cy="261" r="25" fill="#f4efe0"/><circle cx="170" cy="261" r="12" fill="#232323"/>
  <circle cx="300" cy="261" r="25" fill="#f4efe0"/><circle cx="300" cy="261" r="12" fill="#232323"/>
  <circle cx="30" cy="294" r="8" fill="#8d8f8b"/><circle cx="440" cy="294" r="8" fill="#8d8f8b"/>
</svg></html>`;
};

const esc = (x) => String(x).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const cards = Object.keys(site.i18n).flatMap((lang) => {
  const t = site.i18n[lang];
  return [
    { lang, id: 'home', mono: `${site.nick} · ${t.runningHead}`, title: site.name, line: t.title, code: 'NM-000 · C90', label: site.name },
    ...projects.map((p, i) => ({ lang, id: p.id, mono: `${site.nick} · ${site.name}`, title: p.name, line: p[lang].kicker, code: `NM-${String(i + 1).padStart(3, '0')}`, label: p.name }))
  ];
});
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
try {
  for (const { lang, id, ...spec } of cards) {
    const html = join(tmp, `${lang}-${id}.html`), png = join(tmp, `${lang}-${id}.png`);
    const out = join(root, `assets/og/${lang}/${id}.jpg`);
    const fit = [...spec.title].length > 14 ? 60 : [...spec.title].length > 9 ? 76 : 92;
    writeFileSync(html, card(lang, Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, esc(v)]))).replace('<style>', `<style>body{--h:${fit}px}`));
    execFileSync(chromium, ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1200,630', '--virtual-time-budget=3000', `--screenshot=${png}`, pathToFileURL(html).href], { stdio: 'ignore' });
    mkdirSync(dirname(out), { recursive: true });
    execFileSync('convert', [png, '-strip', '-interlace', 'Plane', '-quality', '86', out]);
    console.log('✓', out.replace(root + '/', ''));
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
