#!/usr/bin/env node
// Build dist/index.html from elements/*.json and copy demos/ to dist/demos/.
// Usage: node scripts/build.mjs   (Node >= 18, no dependencies)
// The page works from a static host or opened directly from disk (file://).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadAtlas, checkSchema } from './lib.mjs';

const { elements, parseErrors, categories, sources, schema } = loadAtlas();
const bad = [...parseErrors];
for (const { file, data } of elements) checkSchema(data, schema).forEach(m => bad.push(`${file}: ${m}`));
if (bad.length) { console.error('Build stopped; run node scripts/validate.mjs for details:\n  ' + bad.slice(0, 10).join('\n  ')); process.exit(1); }

const DIST = path.join(ROOT, 'dist');
const DEMOS = path.join(ROOT, 'demos');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const catOrder = categories.map(c => c.id);
const els = elements.map(e => e.data).sort((a, b) => catOrder.indexOf(a.category) - catOrder.indexOf(b.category) || a.name.localeCompare(b.name, 'en'));
const hasDemo = id => fs.existsSync(path.join(DEMOS, id + '.html'));

// ---------- Posters: static SVG stills, no script. Optional per-element override: demos/<id>.poster.svg ----------
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let x = seed || 1; return () => ((x = Math.imul(x ^ (x >>> 15), 2246822507) ^ Math.imul(x ^ (x >>> 13), 3266489909)) >>> 0) / 4294967296; }
const A = 'var(--accent)', S = 'var(--surface)', L = 'var(--line)', M = 'var(--muted)', F = 'var(--fg)', AS = 'var(--accent-soft)';
const slideBox = `<rect x="14" y="10" width="132" height="80" rx="5" fill="${S}" stroke="${L}"/>`;
const MOTIF = {
  nav: r => { const n = 8, cur = 2 + Math.floor(r() * 5); let d = ''; for (let i = 0; i < n; i++) d += `<rect x="${24 + i * 14 + (i > 3 ? 4 : 0)}" y="80" width="10" height="3" rx="1.5" fill="${i <= cur ? A : L}"/>`;
    return `${slideBox}<rect x="14" y="10" width="132" height="12" rx="5" fill="${AS}"/><rect x="22" y="14" width="34" height="4" rx="2" fill="${A}"/><rect x="24" y="34" width="70" height="7" rx="2" fill="${F}"/><rect x="24" y="47" width="96" height="4" rx="2" fill="${L}"/><rect x="24" y="55" width="80" height="4" rx="2" fill="${L}"/>${d}`; },
  story: r => `${slideBox}<rect x="24" y="22" width="30" height="4" rx="2" fill="${A}"/><rect x="24" y="32" width="${80 + r() * 30}" height="8" rx="2" fill="${F}"/><rect x="24" y="44" width="${60 + r() * 30}" height="8" rx="2" fill="${F}"/><rect x="24" y="60" width="104" height="4" rx="2" fill="${L}"/><rect x="24" y="68" width="88" height="4" rx="2" fill="${L}"/>`,
  text: r => { const hi = Math.floor(r() * 4); let d = ''; for (let i = 0; i < 4; i++) d += `<circle cx="28" cy="${30 + i * 14}" r="2.5" fill="${i === hi ? A : M}"/><rect x="36" y="${28 + i * 14}" width="${60 + r() * 40}" height="5" rx="2" fill="${i === hi ? F : L}"/>`; return slideBox + d; },
  metric: r => { let p = ''; for (let i = 0; i < 9; i++) p += `${i ? 'L' : 'M'}${84 + i * 6.5},${70 - r() * 16 - i * 1.6}`;
    return `${slideBox}<rect x="24" y="24" width="28" height="4" rx="2" fill="${M}"/><rect x="24" y="36" width="46" height="18" rx="3" fill="${F}"/><rect x="24" y="60" width="26" height="7" rx="3.5" fill="var(--ok)" opacity=".8"/><path d="${p}" fill="none" stroke="${A}" stroke-width="2"/>`; },
  chart: r => { let d = ''; for (let i = 0; i < 7; i++) { const h = 12 + r() * 48; d += `<rect x="${28 + i * 15}" y="${80 - h}" width="10" height="${h}" rx="1.5" fill="${i === 4 ? A : M}" opacity="${i === 4 ? 1 : .45}"/>`; } return `${slideBox}<line x1="24" y1="80" x2="136" y2="80" stroke="${L}"/>${d}`; },
  diagram: r => { const n = 3 + Math.floor(r() * 2); let d = ''; for (let i = 0; i < n; i++) { const x = 22 + i * (112 / n), y = 34 + (i % 2) * 18; d += `<rect x="${x}" y="${y}" width="22" height="14" rx="3" fill="${i === 1 ? AS : S}" stroke="${i === 1 ? A : M}"/>`; if (i < n - 1) d += `<path d="M${x + 22},${y + 7} L${x + 112 / n},${34 + ((i + 1) % 2) * 18 + 7}" stroke="${M}" fill="none"/>`; } return slideBox + d; },
  compare: r => { const w = r() > .5 ? 0 : 1; let d = ''; for (let i = 0; i < 2; i++) d += `<rect x="${24 + i * 58}" y="22" width="52" height="58" rx="4" fill="${i === w ? AS : S}" stroke="${i === w ? A : L}"/><rect x="${30 + i * 58}" y="30" width="30" height="5" rx="2" fill="${F}"/><rect x="${30 + i * 58}" y="42" width="38" height="3" rx="1.5" fill="${L}"/><rect x="${30 + i * 58}" y="50" width="32" height="3" rx="1.5" fill="${L}"/>`; return slideBox + d; },
  product: r => `${slideBox}<rect x="22" y="18" width="116" height="64" rx="4" fill="${S}" stroke="${M}"/><rect x="22" y="18" width="116" height="9" rx="4" fill="${L}"/><circle cx="28" cy="22.5" r="1.6" fill="${M}"/><circle cx="33" cy="22.5" r="1.6" fill="${M}"/><rect x="30" y="34" width="30" height="40" rx="2" fill="${AS}"/><rect x="66" y="34" width="${50 + r() * 14}" height="6" rx="2" fill="${F}"/><rect x="66" y="46" width="60" height="4" rx="2" fill="${L}"/><rect x="66" y="62" width="26" height="9" rx="2" fill="${A}"/>`,
  motion: r => `<rect x="10" y="16" width="100" height="64" rx="5" fill="${S}" stroke="${L}" opacity=".6"/><rect x="48" y="22" width="100" height="64" rx="5" fill="${S}" stroke="${A}"/><rect x="58" y="34" width="${50 + r() * 20}" height="7" rx="2" fill="${F}"/><path d="M24 50 h20 m-6 -5 l6 5 l-6 5" stroke="${A}" stroke-width="2" fill="none"/>`,
  explore: r => { const k = 30 + r() * 80; return `${slideBox}<path d="M24 70 C 60 ${70 - k / 2}, 90 ${30 + r() * 20}, 136 ${30 + r() * 10}" stroke="${A}" stroke-width="2" fill="none"/><line x1="24" y1="80" x2="136" y2="80" stroke="${L}" stroke-width="3" stroke-linecap="round"/><circle cx="${24 + k}" cy="80" r="5" fill="${S}" stroke="${A}" stroke-width="2"/>`; },
  audience: r => { let d = ''; for (let i = 0; i < 4; i++) { const w = 20 + r() * 80; d += `<rect x="24" y="${24 + i * 14}" width="${w}" height="8" rx="2" fill="${i === 1 ? A : M}" opacity="${i === 1 ? 1 : .4}"/>`; } return slideBox + d; },
  trust: r => `${slideBox}<rect x="24" y="28" width="${70 + r() * 30}" height="7" rx="2" fill="${F}"/><rect x="24" y="40" width="80" height="7" rx="2" fill="${F}"/><rect x="24" y="58" width="40" height="10" rx="5" fill="${AS}" stroke="${A}"/><rect x="30" y="61.5" width="28" height="3" rx="1.5" fill="${A}"/>`
};
function poster(e) {
  const custom = path.join(DEMOS, e.id + '.poster.svg');
  if (fs.existsSync(custom)) return fs.readFileSync(custom, 'utf8');
  return `<svg viewBox="0 0 160 100" aria-hidden="true" focusable="false">${MOTIF[e.category](rng(hash(e.id)))}</svg>`;
}

// ---------- Markup ----------
const catLabel = Object.fromEntries(categories.map(c => [c.id, c.label]));
const counts = Object.fromEntries(categories.map(c => [c.id, els.filter(e => e.category === c.id).length]));
const card = e => {
  const search = [e.name, e.definition, e.bestUse, ...(e.aliases || [])].join(' ').toLowerCase();
  return `<article class="card" id="card-${e.id}" data-id="${e.id}" data-cat="${e.category}" data-level="${e.level}" data-search="${esc(search)}">
<button class="poster" type="button" tabindex="-1" aria-hidden="true" data-open="${e.id}">${poster(e)}</button>
<div class="ch"><h3>${esc(e.name)}</h3>${e.level === 'advanced' ? '<span class="pill-adv">Advanced</span>' : ''}</div>
<p class="def">${esc(e.definition)}</p>
<p class="use"><b>Best for</b> ${esc(e.bestUse)}</p>
<div class="cf"><button class="demo-btn" type="button" data-open="${e.id}" aria-label="Demo: ${esc(e.name)}"><span aria-hidden="true">▶</span> Demo</button><span class="cat-mono">${e.category}</span></div>
</article>`;
};
const sections = categories.map(c => {
  const items = els.filter(e => e.category === c.id);
  if (!items.length) return '';
  return `<section class="cat" id="c-${c.id}" data-cat="${c.id}"><h2>${esc(c.label)}<span class="n">${items.length}</span></h2><p class="cd">${esc(c.description)}</p><div class="grid">${items.map(card).join('\n')}</div></section>`;
}).join('\n');

const data = els.map(e => ({ id: e.id, name: e.name, cat: e.category, level: e.level, demo: hasDemo(e.id),
  sources: e.sources.map(k => sources[k]).filter(Boolean) }));
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const nAdv = els.filter(e => e.level === 'advanced').length;

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
:root{
  color-scheme: light;
  --bg:#f6f7f9; --surface:#ffffff; --stage:#eef0f4;
  --fg:#1b1e24; --muted:#565c6b; --line:#d9dce2;
  --accent:#2f4bd8; --accent-soft:#e8ecfd;
  --adv:#9a4a0b; --adv-soft:#fbefe2;
  --ok:#11734f;
  --radius:10px; --radius-sm:8px;
  --ease-out:cubic-bezier(.23,1,.32,1);
  --f-display:"Bricolage Grotesque","Avenir Next",system-ui,sans-serif;
  --f-body:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
  --f-mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
}
body{background:var(--bg);color:var(--fg);font:15px/1.55 var(--f-body)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
*{box-sizing:border-box}
[hidden]{display:none!important}
body{margin:0;padding-inline:max(16px,env(safe-area-inset-left,0px)) max(16px,env(safe-area-inset-right,0px));padding-block:0 64px}
.wrap{max-width:1180px;margin:0 auto}
header.intro{padding-block:48px 20px;display:grid;gap:10px}
h1{font:700 clamp(32px,5vw,52px)/1.05 var(--f-display);margin:0;text-wrap:balance;letter-spacing:-.01em}
.lede{max-width:68ch;color:var(--muted);margin:0}
.stats{display:flex;flex-wrap:wrap;gap:6px 18px;font:400 13px var(--f-mono);color:var(--muted)}
.stats b{color:var(--fg);font-weight:500}
.rail{position:sticky;top:0;z-index:5;background:var(--bg);padding-block:12px;border-bottom:1px solid var(--line);display:grid;gap:10px}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
input[type=search]{flex:1 1 260px;min-width:0;min-height:44px;font:inherit;padding:9px 12px;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface);color:var(--fg)}
.chip{font:500 13px var(--f-body);min-height:36px;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--fg);cursor:pointer;white-space:nowrap}
.chip[aria-pressed=true]{background:var(--fg);color:var(--surface);border-color:var(--fg)}
.chip small{font:400 11px var(--f-mono);opacity:.75;margin-inline-start:5px}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:var(--radius-sm);overflow:hidden;background:var(--surface)}
.seg .chip{border:0;border-radius:0;min-height:42px}
.count{font:400 13px var(--f-mono);color:var(--muted);margin-inline-start:auto}
@media (max-width:600px){#cats{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}.count{margin-inline-start:0}}
section.cat{padding-top:36px}
section.cat h2{font:700 22px/1.2 var(--f-display);margin:0 0 4px;display:flex;gap:10px;align-items:baseline}
section.cat h2 .n{font:400 12px var(--f-mono);color:var(--muted)}
section.cat p.cd{margin:0 0 14px;color:var(--muted);max-width:70ch;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:12px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:12px 14px 14px;display:flex;flex-direction:column;gap:8px;min-width:0}
.poster{display:block;width:100%;aspect-ratio:16/10;padding:0;border:0;border-radius:var(--radius-sm);background:var(--stage);cursor:pointer;overflow:hidden}
.poster svg{display:block;width:100%;height:100%}
.ch{display:flex;gap:8px;align-items:baseline;justify-content:space-between}
.card h3{margin:0;font:600 15.5px/1.3 var(--f-body)}
.pill-adv{font:500 11.5px/1 var(--f-body);padding:4px 8px;border-radius:99px;background:var(--adv-soft);color:var(--adv);white-space:nowrap}
.card p{margin:0}
.def{font-size:14px}
.use{color:var(--muted);font-size:13.5px}
.use b{font-weight:600;color:var(--fg)}
.cf{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;padding-top:4px}
.demo-btn{min-height:44px;padding:0 16px;font:500 14px var(--f-body);border-radius:var(--radius-sm);border:1px solid var(--accent);background:var(--accent-soft);color:var(--accent);cursor:pointer}
.cat-mono{font:400 12px var(--f-mono);color:var(--muted)}
.empty{padding:48px 0;color:var(--muted);text-align:center}
.empty button{margin-top:10px}
.btn{min-height:44px;padding:0 14px;font:500 14px var(--f-body);border-radius:var(--radius-sm);border:1px solid var(--line);background:var(--surface);color:var(--fg);cursor:pointer}
.btn:disabled{opacity:.4;cursor:default}
footer{margin-top:48px;padding-top:16px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}
@media (hover:hover) and (pointer:fine){.card{transition:border-color .15s var(--ease-out)}.card:hover{border-color:var(--accent)}.btn:not(:disabled):hover,.chip:hover{border-color:var(--accent)}}
/* Demo panel */
dialog#panel{margin:0;margin-inline-start:auto;padding:0;border:0;border-inline-start:1px solid var(--line);width:min(560px,100vw);max-width:100vw;height:100%;max-height:100%;
  background:var(--bg);color:var(--fg);box-shadow:-12px 0 32px rgba(27,30,36,.12)}
dialog#panel[open]{display:flex;flex-direction:column;animation:slidein .22s var(--ease-out)}
dialog#panel::backdrop{background:rgba(27,30,36,.28)}
@keyframes slidein{from{transform:translateX(24px);opacity:.4}to{transform:none;opacity:1}}
[dir=rtl] dialog#panel{box-shadow:12px 0 32px rgba(27,30,36,.12)}
.ph{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line);background:var(--surface)}
.ph h2{flex:1;margin:0;font:700 18px/1.2 var(--f-display);min-width:0;overflow-wrap:anywhere}
.ph h2:focus{outline:none}
.pb{flex:1;min-height:0;position:relative}
.pb iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:var(--bg)}
.msg{margin:16px;padding:24px 16px;border:1.5px dashed var(--line);border-radius:var(--radius-sm);background:var(--stage);text-align:center;color:var(--muted);display:grid;gap:10px;justify-items:center}
.msg code{font:400 13px var(--f-mono);color:var(--fg)}
.pfoot{padding:8px 14px;border-top:1px solid var(--line);font-size:13px;color:var(--muted);background:var(--surface)}
.pfoot a{color:var(--accent)}
@media (max-width:560px){dialog#panel{width:100vw;border:0}}
</style>
</head>
<body>
<div class="wrap">
<header class="intro">
<h1>Presentation Element Atlas</h1>
<p class="lede">An open catalog of slide elements: what each one is, when to use it, and a live demo of how it works. Search or filter, open a demo, and copy the idea into your own talk.</p>
<div class="stats"><span><b>${els.length}</b> elements</span><span><b>${categories.length}</b> categories</span><span><b>${nAdv}</b> advanced</span></div>
</header>
<div class="rail">
<div class="row">
<input type="search" id="q" placeholder="Search elements, e.g. funnel, slider, poll" aria-label="Search elements">
<div class="seg" role="group" aria-label="Level">
<button class="chip" type="button" data-level="all" aria-pressed="true">All</button><button class="chip" type="button" data-level="standard" aria-pressed="false">Standard</button><button class="chip" type="button" data-level="advanced" aria-pressed="false">Advanced</button>
</div>
<span class="count" id="count" aria-live="polite">${els.length} of ${els.length}</span>
</div>
<div class="row" id="cats" role="group" aria-label="Categories">
<button class="chip" type="button" data-cat="all" aria-pressed="true">All<small>${els.length}</small></button>${categories.map(c => `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="false">${esc(c.label)}<small>${counts[c.id]}</small></button>`).join('')}
</div>
</div>
<main id="out">
${sections}
<div class="empty" id="empty" hidden><p id="emptyMsg">No elements match.</p><button class="btn" type="button" id="clear">Clear filters</button></div>
</main>
<footer><p>Open source under the MIT License. Each element is one JSON file and one demo; see CONTRIBUTING.md in the repository to add one. Demo numbers are illustrative.</p></footer>
</div>

<dialog id="panel" aria-labelledby="pTitle">
<div class="ph">
<h2 id="pTitle" tabindex="-1"></h2>
<button class="btn" type="button" id="prev" aria-label="Previous element">←</button>
<button class="btn" type="button" id="next" aria-label="Next element">→</button>
<button class="btn" type="button" id="close">Close</button>
</div>
<div class="pb" id="pBody" data-state="loading"></div>
<div class="pfoot" id="pFoot"></div>
</dialog>

<script type="application/json" id="atlas-data">${json}</script>
<script>
(function(){
'use strict';
var DATA=JSON.parse(document.getElementById('atlas-data').textContent);
var byId={};DATA.forEach(function(e){byId[e.id]=e;});
var $=function(s){return document.querySelector(s);};
var cards=[].slice.call(document.querySelectorAll('.card'));
var sections=[].slice.call(document.querySelectorAll('section.cat'));
var state={q:'',level:'all',cat:'all'};
var escH=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};

function apply(){
  var shown=0;
  cards.forEach(function(c){
    var ok=(state.cat==='all'||c.dataset.cat===state.cat)&&(state.level==='all'||c.dataset.level===state.level)&&(!state.q||c.dataset.search.indexOf(state.q)>-1);
    c.hidden=!ok; if(ok) shown++;
  });
  sections.forEach(function(s){var n=s.querySelectorAll('.card:not([hidden])').length;s.hidden=!n;s.querySelector('.n').textContent=n;});
  $('#count').textContent=shown+' of '+cards.length;
  $('#empty').hidden=shown>0;
  if(!shown) $('#emptyMsg').textContent=state.q?'No elements match ‘'+$('#q').value.trim()+'’.':'No elements match these filters.';
}
function press(group,btn){document.querySelectorAll(group).forEach(function(b){b.setAttribute('aria-pressed',String(b===btn));});}
$('#q').addEventListener('input',function(e){state.q=e.target.value.trim().toLowerCase();apply();});
$('#q').addEventListener('keydown',function(e){if(e.key==='Escape'&&e.target.value){e.target.value='';state.q='';apply();}});
document.querySelectorAll('[data-level]').forEach(function(b){b.addEventListener('click',function(){state.level=b.dataset.level;press('[data-level]',b);apply();});});
$('#cats').addEventListener('click',function(e){var b=e.target.closest('[data-cat]');if(!b)return;state.cat=b.dataset.cat;press('#cats [data-cat]',b);apply();});
$('#clear').addEventListener('click',function(){state={q:'',level:'all',cat:'all'};$('#q').value='';press('[data-level]',document.querySelector('[data-level=all]'));press('#cats [data-cat]',document.querySelector('#cats [data-cat=all]'));apply();$('#q').focus();});

// ---------- Demo panel ----------
var panel=$('#panel'),body=$('#pBody'),current=null,invoker=null,pushed=false,timer=null;
function visibleIds(){return cards.filter(function(c){return !c.hidden;}).map(function(c){return c.dataset.id;});}
function setMsg(state,html){body.dataset.state=state;body.innerHTML='<div class="msg">'+html+'</div>';}
function loadDemo(e){
  clearTimeout(timer);
  body.innerHTML='';
  if(!e.demo){setMsg('missing','<p>No demo yet — add <code>demos/'+e.id+'.html</code></p><p>See CONTRIBUTING.md, “Demo authoring”.</p>');return;}
  body.dataset.state='loading';
  var f=document.createElement('iframe');
  f.setAttribute('sandbox','allow-scripts');
  f.setAttribute('title','Demo: '+e.name);
  f.src='demos/'+encodeURIComponent(e.id)+'.html';
  body.appendChild(f);
  timer=setTimeout(function(){if(body.dataset.state==='loading'){setMsg('error','<p>This demo didn’t load.</p><button class="btn" type="button" id="retry">Retry</button>');$('#retry').addEventListener('click',function(){loadDemo(e);});}},5000);
}
window.addEventListener('message',function(ev){
  var f=body.querySelector('iframe');
  // Only the current demo frame may talk to the page: same window object, sandboxed (opaque "null") origin.
  if(!f||ev.source!==f.contentWindow||ev.origin!=='null'||!ev.data||ev.data.type!=='atlas-demo')return;
  if(ev.data.event==='ready'&&body.dataset.state==='loading'){body.dataset.state='ready';clearTimeout(timer);}
  else if(ev.data.event==='escape'&&panel.open){close(false);}
});
function render(id){
  var e=byId[id]; current=id;
  $('#pTitle').textContent=e.name;
  $('#pFoot').innerHTML=(e.level==='advanced'?'Advanced · ':'')+'Source: '+e.sources.map(function(s){return s.url?'<a href="'+escH(s.url)+'" target="_blank" rel="noopener">'+escH(s.label)+'</a>':escH(s.label);}).join(', ');
  var ids=visibleIds(),i=ids.indexOf(id);
  $('#prev').disabled=i<=0; $('#next').disabled=i<0||i>=ids.length-1;
  loadDemo(e);
}
function setHash(id,push){
  try{ if(push){location.hash=id;} else {history.replaceState(null,'',id?'#'+id:location.pathname+location.search);} }
  catch(err){ location.hash=id||''; }
}
function open(id,opts){
  opts=opts||{};
  if(!byId[id])return;
  if(!panel.open){invoker=opts.invoker||document.activeElement;panel.showModal();pushed=false;if(opts.history!==false&&location.hash!=='#'+id){setHash(id,true);pushed=true;}}
  else if(opts.history!==false&&location.hash!=='#'+id){setHash(id,false);}
  render(id);
  $('#pTitle').focus();
}
function close(fromHash){
  if(!panel.open)return;
  clearTimeout(timer);body.innerHTML='';current=null;
  panel.close();
  if(!fromHash){ if(pushed){pushed=false;history.back();} else setHash('',false); }
  pushed=false;
  var back=invoker&&document.contains(invoker)?invoker:null;
  if(back) back.focus();
}
function move(d){var ids=visibleIds(),i=ids.indexOf(current),n=ids[i+d];if(n){invoker=document.querySelector('#card-'+n+' .demo-btn');open(n);}}
document.addEventListener('click',function(e){var b=e.target.closest('[data-open]');if(!b)return;var id=b.dataset.open;open(id,{invoker:document.querySelector('#card-'+id+' .demo-btn')});});
$('#close').addEventListener('click',function(){close(false);});
$('#prev').addEventListener('click',function(){move(-1);});
$('#next').addEventListener('click',function(){move(1);});
panel.addEventListener('cancel',function(e){e.preventDefault();close(false);});
panel.addEventListener('click',function(e){if(e.target===panel){var r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close(false);}});
panel.addEventListener('keydown',function(e){
  if(e.target.tagName==='IFRAME')return;
  var rtl=document.dir==='rtl';
  if(e.key==='ArrowRight'){e.preventDefault();move(rtl?-1:1);} else if(e.key==='ArrowLeft'){e.preventDefault();move(rtl?1:-1);}
});
window.addEventListener('hashchange',function(){
  var id=decodeURIComponent(location.hash.slice(1));
  if(byId[id]){ if(current!==id) open(id,{history:false}); }
  else if(panel.open){ pushed=false; close(true); }
});
var start=decodeURIComponent(location.hash.slice(1));
apply();
if(byId[start]){ var c=document.getElementById('card-'+start); if(c) c.scrollIntoView({block:'center'}); open(start,{history:false,invoker:c&&c.querySelector('.demo-btn')}); }
})();
</script>
</body>
</html>
`;

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'demos'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'), html);
// Demos run in a sandboxed iframe (opaque origin). Opened from disk (file://), such a frame cannot load
// sibling files, so the dist copy of each demo gets the harness inlined. Source demos keep the relative links.
const harnessCss = fs.readFileSync(path.join(DEMOS, '_harness.css'), 'utf8');
const harnessJs = fs.readFileSync(path.join(DEMOS, '_harness.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
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
const withDemo = data.filter(d => d.demo).length;
console.log(`Built dist/index.html: ${els.length} cards, ${withDemo} with demos, ${els.length - withDemo} showing "No demo yet". Copied ${copied} file(s) to dist/demos/.`);
