#!/usr/bin/env node
// Copies what the site takes from LUZ (https://luzds.com, github.com/nandovejer/luz)
// into assets/vendor/luz/, so the site is served as it is, from its own repository:
//   tokens.min.css      @luz-ds/tokens: the --luz-* custom properties (no styles of its own)
//   theme-mode.min.js   @luz-ds/core: <luz-theme-mode>, the colour-mode switch
//   theme-boot.min.js   @luz-ds/core: sets data-mode before the first paint
// The site's own look is in assets/css/themes/ (a LUZ theme per version).
// LUZ is in beta: the versions are pinned here. To update them, change them,
// run `node tools/luz-sync.mjs`, rebuild and compare the pages before committing.
// Needs npm and network. Usage: node tools/luz-sync.mjs

import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const VERSIONS = { tokens: '0.4.1', core: '0.4.1' };
const FILES = [['tokens', 'dist/tokens.min.css', 'tokens.min.css'], ['core', 'dist/theme-mode.min.js', 'theme-mode.min.js'], ['core', 'dist/theme-boot.min.js', 'theme-boot.min.js']];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets/vendor/luz');
const tmp = mkdtempSync(join(tmpdir(), 'luz-'));
try {
  mkdirSync(out, { recursive: true });
  const unpacked = {};
  for (const name of Object.keys(VERSIONS)) {
    const dir = join(tmp, name);
    mkdirSync(dir);
    execFileSync('npm', ['pack', `@luz-ds/${name}@${VERSIONS[name]}`, '--silent'], { cwd: dir, stdio: 'ignore' });
    const tgz = readdirSync(dir).find((f) => f.endsWith('.tgz'));
    execFileSync('tar', ['xzf', tgz], { cwd: dir });
    unpacked[name] = join(dir, 'package');
  }
  for (const [pkg, from, to] of FILES) {
    copyFileSync(join(unpacked[pkg], from), join(out, to));
    console.log('✓', `assets/vendor/luz/${to}`);
  }
  copyFileSync(join(unpacked.tokens, 'LICENSE'), join(out, 'LICENSE'));
  writeFileSync(join(out, 'README.md'), `# LUZ, copied

Copies of [\`@luz-ds/tokens\`](https://github.com/nandovejer/luz/tree/main/packages/tokens) ${VERSIONS.tokens} and [\`@luz-ds/core\`](https://github.com/nandovejer/luz/tree/main/packages/core) ${VERSIONS.core} (MIT, see LICENSE). Do not edit: change the versions in \`tools/luz-sync.mjs\` and run it.

\`\`\`sh
node tools/luz-sync.mjs
\`\`\`
`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
