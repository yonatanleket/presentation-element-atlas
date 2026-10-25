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
    // surface and added arrived in format 1.1.0; a 1.0.0 record carrying them claims the wrong format.
    if (e.schemaVersion === '1.0.0') for (const k of ['surface', 'added']) if (Object.hasOwn(e, k)) err(`${k} requires schemaVersion 1.1.0`);
    if (typeof e.added === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.added)) {
      const d = new Date(e.added + 'T00:00:00Z');
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== e.added) err(`added "${e.added}" is not a real date`);
      else if (d.getTime() > Date.now()) err(`added "${e.added}" is in the future`);
    }
    const cat = categories.find(c => c.id === e.category);
    if (cat && (cat.surface || 'slide') !== (e.surface || 'slide')) err(`surface "${e.surface || 'slide'}" does not match category "${e.category}" (surface "${cat.surface || 'slide'}")`);
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
        const web = (e.surface || 'slide') === 'web', linksWeb = page.replace(/<!--[\s\S]*?-->/g, '').includes('<link rel="stylesheet" href="_web.css">');
        if (web && (!linksWeb || !/class="demo"[^>]*data-surface="web"/.test(page) || !/class="stage"[^>]*data-aspect="web"/.test(page))) err('web demo must link _web.css and mark .demo data-surface="web" and .stage data-aspect="web"');
        if (!web && linksWeb) err('only web-surface demos may link _web.css');
        const howM = page.match(/<details class="how"[^>]*>\s*<summary>[\s\S]*?<\/summary>\s*<p>([\s\S]*?)<\/p>/);
        const norm = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
        if (!howM) err('demo needs a <details class="how"><summary>How it works</summary><p>...</p></details> note');
        else if (typeof e.demo.how === 'string' && norm(howM[1]) !== norm(e.demo.how)) err('demo "How it works" text differs from demo.how in the element file');
        // Self-contained: the only files a demo may reference are the shared harness files (plus _web.css for web demos).
        for (const m of page.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
          const ref = m[1];
          if (ref.startsWith('#') || ref === '_harness.css' || ref === '_harness.js' || ref === '_web.css' || ref.startsWith('data:')) continue;
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
