#!/usr/bin/env node
// Build dist/index.html from elements/*.json and copy demos/ to dist/demos/.
// Usage: node scripts/build.mjs   (Node >= 18, no dependencies)
// The page works from a static host or opened directly from disk (file://).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadAtlas } from './lib.mjs';
import { validateAtlas } from './validation.mjs';
import { HAZARD_IDS, validateHazards } from './hazards.mjs';
import {loadValidatedPreviews, copyPreviewAssets} from './preview-assets.mjs';

const { errors: bad } = validateAtlas({ strict: true });
if (bad.length) { console.error('Build stopped; run node scripts/validate.mjs --strict for details:\n  ' + bad.slice(0, 10).join('\n  ')); process.exit(1); }
const { elements, categories, sources } = loadAtlas();

const DIST = path.join(ROOT, 'dist');
const DEMOS = path.join(ROOT, 'demos');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const catOrder = categories.map(c => c.id);
const els = elements.map(e => e.data).sort((a, b) => catOrder.indexOf(a.category) - catOrder.indexOf(b.category) || a.name.localeCompare(b.name, 'en'));
const hasDemo = id => fs.existsSync(path.join(DEMOS, id + '.html'));
const hazardResult = validateHazards({ strictDemos: true });
if (hazardResult.errors.length) throw new Error(hazardResult.errors.join('\n'));
const hazards = HAZARD_IDS.map(id => hazardResult.hazards.find(h => h.data.id === id).data);
const elById = Object.fromEntries(els.map(e => [e.id, e]));
const hazardCats = {text:'Text',titles:'Titles',data:'Data','color-type':'Color & type',layout:'Layout',motion:'Motion',structure:'Structure',evidence:'Evidence'};
const reverse = hazardResult.reverseLinks;
const relatedHazards = id => (reverse[id] || []).map(h => `<a href="#hazard-${h}" data-relation="hazard:${h}" data-origin-element="${id}">${esc(hazards.find(x => x.id === h).name)}</a>`).join('');


// Real stage captures are validated at the build seam; missing captures remain explicit.
const validatedPreviews = loadValidatedPreviews(ROOT);
for (const warning of validatedPreviews.warnings) console.warn('Preview: '+warning);
const previewAssets = new Map();
for (const [id, entry] of validatedPreviews.entries) {
 const image=entry.images[0];
 if(image)previewAssets.set(id,{path:image.src,width:image.width,height:image.height,alt:image.description||entry.description,limitation:typeof entry.limitation==='string'?entry.limitation.trim():''});
}
for (const [id, entry] of validatedPreviews.hazards) for(const image of entry.images) previewAssets.set('hazard:'+id+':'+image.state,{path:image.src,width:image.width,height:image.height,alt:image.description||entry.description,limitation:typeof entry.limitation==='string'?entry.limitation.trim():''});
let previewIndex = 0;
function limitationCaption(key) {
 const limitation=previewAssets.get(key)?.limitation;
 return limitation ? `<p class="preview-limitation">${esc(limitation)}</p>` : '';
}
function poster(key, label) {
  const asset = previewAssets.get(key);
  const eager = previewIndex++ < 6;
  return `<div class="preview-shell${asset ? '' : ' preview-unavailable'}"><span class="preview-status">Preview unavailable</span>${asset ? `<img src="${esc(asset.path)}" width="${asset.width}" height="${asset.height}" alt="${esc(asset.alt || label)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">` : ''}</div>`;
}

// ---------- Markup ----------
const counts = Object.fromEntries(categories.map(c => [c.id, els.filter(e => e.category === c.id).length]));
const card = e => {
  const search = [e.name, e.definition, e.bestUse, ...(e.aliases || [])].join(' ').toLowerCase();
  return `<article class="card" id="card-${e.id}" data-id="${e.id}" data-cat="${e.category}" data-level="${e.level}" data-search="${esc(search)}">
<div class="poster" data-hover-demo="${e.id}" data-open="${e.id}">${poster(e.id, e.name)}</div>
<p class="specimen-caption">Illustrative demo</p>${limitationCaption(e.id)}
<div class="ch"><h3>${esc(e.name)}</h3>${e.level === 'advanced' ? '<span class="pill-adv">Advanced</span>' : ''}</div>

<p class="use"><b>Best for</b> ${esc(e.bestUse)}</p>
<details class="card-details"><summary>Definition & related problems</summary><p class="def">${esc(e.definition)}</p>${reverse[e.id] ? `<div class="relations"><b>Helps with</b>${relatedHazards(e.id)}</div>` : ''}</details>
<div class="cf"><button class="demo-btn" type="button" data-open="${e.id}" aria-label="Try demo: ${esc(e.name)}">Try demo</button><span class="cat-mono">${e.demo.kind === 'animated' ? 'Motion' : e.demo.kind === 'interactive' ? 'Interactive' : 'Still'}</span></div>
</article>`;
};
const sections = categories.map(c => {
  const items = els.filter(e => e.category === c.id);
  if (!items.length) return '';
  return `<section class="cat" id="c-${c.id}" data-cat="${c.id}"><h2>${esc(c.label)}<span class="n">${items.length}</span></h2><p class="cd">${esc(c.description)}</p><div class="grid">${items.map(card).join('\n')}</div></section>`;
}).join('\n');

const hazardCard = h => {
 const search = [h.name,h.audienceImpact,...h.fixedBy.map(id=>elById[id].name)].join(' ').toLowerCase();
 const axisLabel = h.axis === 'auto' ? (h.id === 'topic-title' ? 'HTML rule · Heuristic' : 'HTML rule') : h.axis === 'rendered' ? 'Visual review' : 'Human review';
 return `<article class="card hazard-card" id="hazard-card-${h.id}" data-id="${h.id}" data-category="${h.category}" data-axis="${h.axis}" data-search="${esc(search)}"><div class="problem-pair" data-open-hazard="${h.id}"><figure><figcaption>Before</figcaption>${poster('hazard:'+h.id+':before', 'Before: '+h.name)}</figure><figure><figcaption>After</figcaption>${poster('hazard:'+h.id+':after', 'After: '+h.name)}</figure><div class="pair-crossfade" aria-hidden="true">${poster('hazard:'+h.id+':after', '')}<span class="pair-badge">After fix</span></div></div><p class="specimen-caption">Fictional Before/After examples · hover to preview fix</p>${limitationCaption('hazard:'+h.id+':before')}<div class="ch"><h3>${esc(h.name)}</h3><span class="pill-axis">${esc(axisLabel)}</span></div><p class="use"><b>Audience impact</b> ${esc(h.audienceImpact)}</p><div class="relations"><b>Fixed by</b>${h.fixedBy.map(id => `<a href="#${id}" data-relation="element:${id}" data-origin-hazard="${h.id}">${esc(elById[id].name)}</a>`).join('')}</div><div class="cf"><button class="demo-btn" type="button" data-open-hazard="${h.id}">Compare before / after</button><span class="cat-mono">${esc(hazardCats[h.category])}</span></div></article>`;
};
const hazardSections = Object.entries(hazardCats).map(([id,label]) => `<section class="hazard-cat" id="hc-${id}" data-category="${id}"><h2>${label}<span class="n"></span></h2><div class="grid">${hazards.filter(h=>h.category===id).map(hazardCard).join('')}</div></section>`).join('');
const extraCss = fs.readFileSync(path.join(ROOT,'templates/catalog-hazards.css'),'utf8');
const redesignCss = fs.readFileSync(path.join(ROOT,'templates/catalog-redesign.css'),'utf8');
const catalogScript = fs.readFileSync(path.join(ROOT,'scripts/catalog-ui.js'),'utf8');
const data = els.map(e => ({ id: e.id, name: e.name, cat: e.category, level: e.level, demo: hasDemo(e.id),
  definition:e.definition, bestUse:e.bestUse, kind:e.demo.kind, preview:previewAssets.get(e.id), sources: e.sources.map(k => sources[k]).filter(Boolean), hazards: reverse[e.id] || [] }));
const json = JSON.stringify({ elements: data, hazards:hazards.map(h=>({...h,preview:previewAssets.get('hazard:'+h.id+':before')})), hazardCats }).replace(/</g, '\\u003c');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Presentation Element Atlas</title>
<meta name="description" content="An open catalog of ${els.length} presentation elements, each with a definition, when to use it and a live demo.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
${redesignCss}
${extraCss}
</style>
</head>
<body>
<header class="masthead"><div class="wrap masthead-inner"><a class="brand" href="#elements">Presentation Element Atlas</a><nav class="section-switch" aria-label="Catalog section"><a href="#elements" data-section="elements" aria-current="page">Elements</a><a href="#hazards" data-section="hazards">Slide problems <span>15</span></a></nav></div></header>
<div class="wrap">
<header class="intro"><h1>Find the right way to show your idea.</h1><p class="lede">A visual library of ${els.length} presentation elements. Explore a specimen, then try it for yourself.</p></header>
<div id="elements-view" class="catalog-layout"><aside class="category-sidebar"><button class="category-toggle btn" type="button" aria-expanded="false" aria-controls="cats">Categories <span id="category-current">All</span></button><p class="sidebar-title">Categories</p><div class="row" id="cats" role="group" aria-label="Categories"><button class="chip" type="button" data-cat="all" aria-pressed="true">All<small>${els.length}</small></button>${categories.map(c => `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="false">${esc(c.label)}<small>${counts[c.id]}</small></button>`).join('')}</div></aside><div class="catalog-sheet"><div class="rail">
<div class="row">
<input type="search" id="q" placeholder="Search elements, e.g. funnel, slider, poll" aria-label="Search elements">
<div class="seg" role="group" aria-label="Level">
<button class="chip" type="button" data-level="all" aria-pressed="true">All</button><button class="chip" type="button" data-level="standard" aria-pressed="false">Standard</button><button class="chip" type="button" data-level="advanced" aria-pressed="false">Advanced</button>
</div>
<span class="count" id="count" aria-live="polite">${els.length} of ${els.length}</span>
</div>
</div>
<main id="out">
${sections}
<div class="empty" id="empty" hidden><p id="emptyMsg">No elements match.</p><button class="btn" type="button" id="clear">Clear filters</button></div>
</main>
</div></div>
<div id="hazards-view" hidden><header class="intro hazards-intro"><h2 id="hazards-heading" tabindex="-1">Slide problems</h2><p class="lede">See what makes a slide hard to follow, compare a fix, then explore the elements behind it.</p><p class="scope-note">Fictional Before/After examples. 15 educational problems, including five supported HTML rules. Topic title is a heuristic; the other comparisons require visual or human review. This library does not scan or automatically fix your deck.</p></header>
<div id="hazard-route-error" class="empty" hidden><p>This slide problem link is unavailable.</p><a href="#hazards" class="btn">Browse all slide problems</a></div>
<div class="catalog-layout"><aside class="category-sidebar"><button class="category-toggle btn" type="button" aria-expanded="false" aria-controls="hazard-cats">Categories <span id="problem-category-current">All</span></button><p class="sidebar-title">Problem categories</p><div class="row" id="hazard-cats" role="group" aria-label="Problem categories"><button class="chip" type="button" data-hcat="all" aria-pressed="true">All<small>15</small></button>${Object.entries(hazardCats).map(([id,label])=>`<button class="chip" type="button" data-hcat="${id}" aria-pressed="false">${label}<small></small></button>`).join('')}</div></aside><div class="catalog-sheet"><div class="rail" id="hazard-rail"><div class="row"><input type="search" id="hq" aria-label="Search slide problems" placeholder="Search slide problems or fixing elements"><div class="seg" id="hazard-axes" role="group" aria-label="Review method">${[['all','All'],['auto','HTML rules'],['rendered','Visual review'],['judgment','Human review']].map(([id,label])=>`<button type="button" class="chip" data-axis-filter="${id}" aria-pressed="${id==='all'}">${label}</button>`).join('')}</div><span id="hazard-count" class="count" aria-live="polite">15 of 15 problems</span></div></div>
<p id="hazard-announcement" class="announcement" role="status"></p><main id="hazard-out">${hazardSections}<div class="empty" id="hazard-empty" hidden><p id="hazard-empty-message"></p><button class="btn" type="button" id="hazard-clear">Clear filters</button></div></main></div></div></div>
<footer><p>Open source under the MIT License. Each element is one JSON file and one demo; see CONTRIBUTING.md in the repository to add one. Demo numbers are illustrative.</p></footer>
</div>

<dialog id="panel" aria-labelledby="pTitle">
<div class="ph">
<h2 id="pTitle" tabindex="-1"></h2>
<button class="btn" type="button" id="prev" aria-label="Previous element">←</button>
<button class="btn" type="button" id="next" aria-label="Next element">→</button>
<button class="btn" type="button" id="close">Close</button>
</div>
<div id="pReturn" hidden></div>
<div class="pb" id="pBody" data-state="loading"></div>
<div id="pMeta" hidden></div>
<div class="pfoot" id="pFoot"></div>
</dialog>

<script type="application/json" id="atlas-data">${json}</script>
<script>
${catalogScript}
</script>
</body>
</html>
`;

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'demos'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), html);
copyPreviewAssets(ROOT,DIST,validatedPreviews);
// Demos run in a sandboxed iframe (opaque origin). Opened from disk (file://), such a frame cannot load
// sibling files, so the dist copy of each demo gets the harness inlined. Source demos keep the relative links.
const harnessCss = fs.readFileSync(path.join(DEMOS, '_harness.css'), 'utf8') + '\n.quickplay body{background:var(--stage);overflow:hidden}.quickplay .demo{max-width:none;padding:0;gap:0;height:100dvh}.quickplay .stage{max-width:none;height:100%;border:0;border-radius:0}.quickplay .controls,.quickplay .how{display:none!important}';
const harnessJs = (fs.readFileSync(path.join(DEMOS, '_harness.js'), 'utf8') + '\nif(location.hash.indexOf("quickplay")!==-1)document.documentElement.classList.add("quickplay");').replace(/<\/script/gi, '<\\/script');
let copied = 0;
for (const f of fs.readdirSync(DEMOS)) {
  if (f.endsWith('.poster.svg')) continue;
  const src = path.join(DEMOS, f), dst = path.join(DIST, 'demos', f);
  if (f.endsWith('.html') && !f.startsWith('_')) {
    const page = fs.readFileSync(src, 'utf8')
      .replace(/<link rel="stylesheet" href="_harness\.css">/, () => `<style>\n${harnessCss}</style>`)
      .replace(/<script src="_harness\.js"><\/script>/, () => `<script>\n${harnessJs}</script>`);
    fs.writeFileSync(dst, page);
  } else fs.copyFileSync(src, dst);
  copied++;
}
fs.cpSync(path.join(ROOT, 'hazard-demos'), path.join(DIST, 'hazard-demos'), { recursive: true });
const withDemo = data.filter(d => d.demo).length;
console.log(`Built dist/index.html: ${els.length} cards, ${withDemo} with demos, ${els.length - withDemo} showing "No demo yet". Copied ${copied} file(s) to dist/demos/.`);
