#!/usr/bin/env node
// Validate every elements/<id>.json. Usage: node scripts/validate.mjs [--strict]
// --strict also fails when a demo file is missing (otherwise reported as a count).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadAtlas, checkSchema } from './lib.mjs';

const strict = process.argv.includes('--strict');
const { elements, parseErrors, categories, triggers, sources, schema } = loadAtlas();
const errors = [...parseErrors];
const catIds = new Set(categories.map(c => c.id));
const tagIds = new Set(triggers.map(t => t.id));
const ids = new Set(elements.map(e => e.data.id));
const names = new Map();
const usedTags = new Set();
const missingDemos = [];

for (const { file, data: e } of elements) {
  const err = m => errors.push(`${file}: ${m}`);
  checkSchema(e, schema).forEach(err);
  if (e.id !== path.basename(file, '.json')) err(`id "${e.id}" must equal filename`);
  const key = String(e.name || '').toLowerCase();
  if (names.has(key)) err(`name "${e.name}" duplicates ${names.get(key)}`); else names.set(key, file);
  if (e.category && !catIds.has(e.category)) err(`category "${e.category}" not in categories.json`);
  for (const t of e.trigger || []) { usedTags.add(t); if (!tagIds.has(t)) err(`trigger "${t}" not in triggers.json`); }
  for (const s of e.sources || []) if (!(s in sources)) err(`source "${s}" not in sources.json`);
  for (const r of e.related || []) if (!ids.has(r)) err(`related "${r}" is not an element id`);
  if (e.demo) {
    if (e.demo.file !== `demos/${e.id}.html`) err(`demo.file must be "demos/${e.id}.html"`);
    const words = String(e.demo.how || '').trim().split(/\s+/).length;
    if (words < 15 || words > 60) err(`demo.how must be 15-60 words (has ${words})`);
    const demoPath = path.join(ROOT, e.demo.file);
    if (!fs.existsSync(demoPath)) missingDemos.push(e.id);
    else {
      const page = fs.readFileSync(demoPath, 'utf8');
      if (!page.includes('href="_harness.css"') || !page.includes('src="_harness.js"')) err('demo must link _harness.css and _harness.js');
      if (!/AtlasDemo\.init\(/.test(page)) err('demo must call AtlasDemo.init(...)');
      const howM = page.match(/<details class="how"[^>]*>\s*<summary>[\s\S]*?<\/summary>\s*<p>([\s\S]*?)<\/p>/);
      const norm = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
      if (!howM) err('demo needs a <details class="how"><summary>How it works</summary><p>...</p></details> note');
      else if (e.demo.how && norm(howM[1]) !== norm(e.demo.how)) err('demo "How it works" text differs from demo.how in the element file');
      // Self-contained: the only files a demo may reference are the shared harness files.
      for (const m of page.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
        const ref = m[1];
        if (ref.startsWith('#') || ref === '_harness.css' || ref === '_harness.js' || ref.startsWith('data:')) continue;
        err(`demo references "${ref}"; demos must be self-contained (inline assets, no network)`);
      }
      if (/@import|url\(\s*["']?(?!data:|#)/i.test(page)) err('demo loads a CSS resource (@import or url()); inline it as data: instead');
      if (/prefers-color-scheme\s*:\s*dark|data-theme/i.test(page)) err('demo contains dark-theme rules; the atlas is light only');
    }
  }
}
for (const t of tagIds) if (!usedTags.has(t)) errors.push(`triggers.json: tag "${t}" is not used by any element`);
if (strict) missingDemos.forEach(id => errors.push(`${id}.json: demo file demos/${id}.html is missing`));

console.log(`Elements: ${elements.length} | categories: ${catIds.size} | trigger tags: ${tagIds.size} | sources: ${Object.keys(sources).length}`);
console.log(`Demos present: ${elements.length - missingDemos.length} | missing: ${missingDemos.length}${strict ? '' : ' (not a failure without --strict)'}`);
if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
}
console.log('OK');
