import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicCss = path.join(frontendRoot, 'public', 'css', 'remixicon.css');
const indexHtml = path.join(frontendRoot, 'index.html');
const netlifyHeaders = path.join(frontendRoot, 'public', '_headers');

function collectSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(fullPath);
    return entry.isFile() && /\.(jsx?|tsx?)$/.test(entry.name) && !entry.name.endsWith('.test.js')
      ? [fullPath]
      : [];
  });
}

test('vendors only used Remix Icon glyphs and loads their font locally', () => {
  const css = readFileSync(publicCss, 'utf8');
  const usedIcons = new Set();
  for (const sourceFile of collectSourceFiles(path.join(frontendRoot, 'src'))) {
    const source = readFileSync(sourceFile, 'utf8');
    for (const [, icon] of source.matchAll(/\b(ri-[a-z0-9-]+)\b/g)) usedIcons.add(icon);
  }

  assert.ok(usedIcons.size > 0);
  for (const icon of usedIcons)
    assert.match(
      css,
      new RegExp(`\\.${icon}:before\\s*\\{\\s*content:`),
      `${icon} has a local glyph`,
    );
  assert.match(css, /url\(['"]?\/fonts\/remixicon\.woff2['"]?\)/);
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /https?:\/\//);
  assert.match(readFileSync(indexHtml, 'utf8'), /href="\/css\/remixicon\.css"/);
  assert.doesNotMatch(readFileSync(indexHtml, 'utf8'), /cdn\.jsdelivr\.net/);
  assert.doesNotMatch(readFileSync(netlifyHeaders, 'utf8'), /cdn\.jsdelivr\.net/);
});
