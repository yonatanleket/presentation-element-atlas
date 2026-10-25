// Validation shared by CLI, build, and fixture runner. No process side effects.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadAtlas, checkSchema } from './lib.mjs';
import { validateHazards } from './hazards.mjs';

export function validateAtlas({ root = ROOT, strict = false } = {}) {
  const { elements, parseErrors, categories, triggers, sources, schema } = loadAtlas(root);
  const errors = [...parseErrors];
  const catIds = new Set(categories.map(c => c.id));
  const tagIds = new Set(triggers.map(t => t.id));
  const ids = new Set(elements.map(e => e.data?.id));
  const names = new Map();
  const usedTags = new Set();
  const missingDemos = [];

  for (const { file, data: e } of elements) {
    const err = m => errors.push(`${file}: ${m}`);
    const shapeErrors = checkSchema(e, schema);
    shapeErrors.forEach(err);
    if (!e || typeof e !== 'object' || Array.isArray(e)) continue;
    if (e.id !== path.basename(file, '.json')) err(`id "${e.id}" must equal filename`);
    const key = String(e.name || '').toLowerCase();
    if (names.has(key)) err(`name "${e.name}" duplicates ${names.get(key)}`); else names.set(key, file);
    if (e.category && !catIds.has(e.category)) err(`category "${e.category}" not in categories.json`);
    for (const t of Array.isArray(e.trigger) ? e.trigger : []) { usedTags.add(t); if (!tagIds.has(t)) err(`trigger "${t}" not in triggers.json`); }
    for (const s of Array.isArray(e.sources) ? e.sources : []) if (!Object.hasOwn(sources, s)) err(`source "${s}" not in sources.json`);
    for (const r of Array.isArray(e.related) ? e.related : []) if (!ids.has(r)) err(`related "${r}" is not an element id`);
    if (e.demo && typeof e.demo === 'object' && typeof e.demo.file === 'string') {
      if (e.demo.file !== `demos/${e.id}.html`) err(`demo.file must be "demos/${e.id}.html"`);
      const words = String(e.demo.how || '').trim().split(/\s+/).length;
      if (words < 15 || words > 60) err(`demo.how must be 15-60 words (has ${words})`);
      const demoPath = path.join(root, 'demos', `${e.id}.html`);
      if (!fs.existsSync(demoPath)) missingDemos.push(e.id);
      else {
        const page = fs.readFileSync(demoPath, 'utf8');
        if (!page.includes('href="_harness.css"') || !page.includes('src="_harness.js"')) err('demo must link _harness.css and _harness.js');
        if (!/AtlasDemo\.init\(/.test(page)) err('demo must call AtlasDemo.init(...)');
        const howM = page.match(/<details class="how"[^>]*>\s*<summary>[\s\S]*?<\/summary>\s*<p>([\s\S]*?)<\/p>/);
        const norm = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
        if (!howM) err('demo needs a <details class="how"><summary>How it works</summary><p>...</p></details> note');
        else if (typeof e.demo.how === 'string' && norm(howM[1]) !== norm(e.demo.how)) err('demo "How it works" text differs from demo.how in the element file');
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

  // Metadata is enforced as soon as a hazard collection exists. Full pair presence
  // has its separate explicit --strict-demos gate until specimens are implemented.
  if (fs.existsSync(path.join(root, 'hazards'))) errors.push(...validateHazards({ root }).errors);
  return { errors, missingDemos, counts: { elements: elements.length, categories: catIds.size, triggers: tagIds.size, sources: Object.keys(sources).length } };
}
