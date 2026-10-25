#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { ROOT } from './lib.mjs';
const args=process.argv.slice(2),opts={};for(let i=0;i<args.length;i++){if(['--playwright','--browser','--report'].includes(args[i])&&args[i+1])opts[args[i].slice(2)]=args[++i];else throw Error('Expected --playwright --browser [--report]');}
const reportFile=path.resolve(opts.report||path.join(ROOT,'work/team-workflow/impeccable-m1/catalog-browser-report.json')),artifacts=path.join(path.dirname(reportFile),'catalog-browser-artifacts');fs.mkdirSync(artifacts,{recursive:true});
const report={checker:'Atlas catalog UI browser check',version:'1.0.0',status:'running',checks:[],errors:[],screenshots:[],limitations:['Browser functional and screenshot evidence; independent visual inspection and full AA remain separate.']};let browser;
const check=(name)=>{report.checks.push(name);console.log('PASS '+name);};
try{const pw=await import(pathToFileURL(path.resolve(opts.playwright)).href);browser=await pw.chromium.launch({executablePath:path.resolve(opts.browser),headless:true});report.browser=browser.version();const context=await browser.newContext({viewport:{width:1280,height:900}});await context.route(/https?:\/\//,r=>r.abort());const page=await context.newPage();
// Install before the application. Delay its actual callback, not event dispatch:
// Redispatch of the stopped event did not reach the app in the observed Chrome run.
await page.addInitScript(()=>{
 window.__catalogHoldRestore=false;window.__catalogHoldReady=false;window.__catalogReadyWithheld=0;window.__catalogHeldRestoreEvent=null;
 const register=window.addEventListener;
 window.addEventListener=function(type,listener,options){
  if(type!=='message'||typeof listener!=='function'||options)return register.call(this,type,listener,options);
  const wrapped=function(event){
   const frame=document.querySelector('#pBody iframe');
   const current=frame&&event.source===frame.contentWindow&&event.origin==='null'&&event.data?.type==='atlas-hazard';
   if(window.__catalogHoldReady&&current&&event.data.event==='ready'){window.__catalogReadyWithheld++;return;}
   if(window.__catalogHoldRestore&&frame&&event.source===frame.contentWindow&&event.origin==='null'&&event.data?.type==='atlas-hazard'&&event.data.event==='restored'){
    window.__catalogHeldRestoreEvent={event,deliver:()=>listener.call(this,event)};
    return;
   }
   return listener.call(this,event);
  };
  return register.call(this,type,wrapped,options);
 };
 window.__catalogReleaseRestore=()=>{
  const held=window.__catalogHeldRestoreEvent;window.__catalogHoldRestore=false;window.__catalogHeldRestoreEvent=null;
  if(!held)throw new Error('No genuine restoration callback was held');
  held.deliver();
 };
});
page.on('pageerror',e=>report.errors.push(e.message));const url=pathToFileURL(path.join(ROOT,'dist/index.html')).href;
const ready=async()=>{await page.locator('#panel[open]').waitFor();await page.locator('#pBody[data-state="ready"]').waitFor({timeout:7000});assert.equal(await page.locator('iframe').count(),1);};
const open=async id=>{await page.evaluate(value=>{location.hash='hazard-'+value;},id);await ready();};
const frame=()=>page.frameLocator('#pBody iframe');
await page.goto(url);assert.equal(await page.locator('#out .card').count(),166);assert.equal(await page.locator('.hazard-card').count(),15);check('166 element cards and15 hazard cards');
assert.equal(await page.locator('iframe').count(),0);await page.locator('#card-kpi-tile h3').hover();assert.equal(await page.locator('iframe').count(),0);
await page.locator('#card-kpi-tile .poster').hover();await page.locator('#card-kpi-tile .poster.is-playing iframe.hover-demo-frame').waitFor({timeout:4000});assert.equal(await page.locator('iframe').count(),1);
await page.locator('#q').hover();assert.equal(await page.locator('iframe').count(),0);check('catalog idle and non-poster hover create zero live frames; poster hover quick-plays and cleans up');
const preview=page.locator('#out .preview-shell img').first();if(await preview.count()){await preview.evaluate(image=>{image.src='previews/missing-image.png';});await page.waitForFunction(()=>document.querySelector('#out .preview-shell img').closest('.preview-shell').classList.contains('preview-unavailable'));assert.ok(await page.locator('#out .preview-unavailable .preview-status').first().isVisible());check('failed specimen image gives explicit fallback');}
await page.locator('#cats [data-cat=chart]').click();assert.equal(await page.locator('#out .card:not([hidden])').evaluateAll(cards=>cards.every(c=>c.dataset.cat==='chart')),true);await page.locator('#cats [data-cat=all]').click();check('desktop category navigation preserves real filtered cards');
await page.locator('[data-section="hazards"]').click();assert.equal(await page.locator('#hazard-count').textContent(),'15 of 15 problems');
await page.locator('#hq').fill('Source chips');await page.waitForTimeout(200);assert.ok(await page.locator('#hazard-card-unsourced-number').isVisible());check('search matches fixing element names');await page.locator('[data-section="elements"]').click();await page.locator('[data-section="hazards"]').click();assert.equal(await page.locator('#hq').inputValue(),'Source chips');check('section switch preserves independent filter state');
await page.locator('#hq').fill('zzzz-no-hazard');await page.waitForTimeout(200);assert.ok(await page.locator('#hazard-empty').isVisible());await page.locator('#hazard-clear').click();assert.equal(await page.locator('#hq').evaluate(el=>el===document.activeElement),true);check('empty recovery resets filters and focuses search');
await page.locator('[data-axis-filter="auto"]').click();assert.equal(await page.locator('#hazard-count').textContent(),'5 of 15 problems');await page.locator('[data-hcat="data"]').click();assert.equal(await page.locator('#hazard-count').textContent(),'0 of 15 problems');assert.equal(await page.locator('[data-hcat="data"] small').textContent(),'0');check('axis/category AND and zero-count category');
await open('topic-title');assert.match(await page.locator('#hazard-announcement').textContent(),/Filters cleared/);check('conflicting-filter deep link recovers');
await frame().locator('[data-state="after"]').click();await page.waitForTimeout(80);await page.locator('#pFoot [data-relation="element:kicker-action-title-lede"]').click();await ready();assert.ok(await page.locator('#relationship-back').isVisible());check('fixedBy opens existing isolated element');
await page.goBack();await ready();await frame().locator('[data-state="after"][aria-pressed="true"]').waitFor();assert.equal(await page.locator('#pFoot [data-relation="element:kicker-action-title-lede"]').evaluate(el=>el===document.activeElement),true);check('browser Back restores After and invoking chip focus');
await page.goForward();await ready();await page.locator('#relationship-back').click();await ready();await frame().locator('[data-state="after"][aria-pressed="true"]').waitFor();check('Forward and explicit relationship Back');
await page.locator('#close').click();await page.waitForTimeout(150);assert.equal(await page.locator('#panel').evaluate(el=>el.open),false);assert.match(page.url(),/#hazards$/);check('Close clears relationship hop into catalog');await open('wall-of-text');await frame().locator('[data-state="after"]').click();await page.evaluate(()=>{window.expandedReceived=false;window.watchExpanded=e=>{if(e.data?.type==='atlas-hazard'&&e.data.event==='state'&&e.data.snapshot?.state==='after'&&e.data.snapshot.details.some(Boolean))window.expandedReceived=true;};window.addEventListener('message',window.watchExpanded,true);});await frame().locator('#expand').click();await page.waitForFunction(()=>window.expandedReceived);await page.locator('#pFoot [data-relation]').first().click();await ready();await page.evaluate(()=>{window.__catalogHoldRestore=true;window.__catalogHeldRestoreEvent=null;});await page.locator('#relationship-back').click();await page.waitForFunction(()=>window.__catalogHeldRestoreEvent!==null);assert.equal(await page.locator('#pBody').getAttribute('data-state'),'loading');assert.equal(await frame().locator('[data-state="after"]').getAttribute('aria-pressed'),'true');assert.ok(await frame().locator('.stage details[open]').count()>0);await page.evaluate(()=>{window.removeEventListener('message',window.watchExpanded,true);window.__catalogReleaseRestore();});await ready();assert.ok(await frame().locator('.stage details[open]').count()>0);check('restore acknowledgement gates ready until After and disclosure complete');await page.locator('#close').click();await page.waitForTimeout(100);
await page.evaluate(()=>location.hash='hazard-wall-of-text');await ready();assert.equal(await page.locator('#prev').isDisabled(),true);const historyLength=await page.evaluate(()=>history.length);await page.locator('#next').click();await ready();assert.equal(await page.evaluate(()=>history.length),historyLength);check('visible-order next replaces history and first previous disabled');
await page.locator('#close').click();await page.evaluate(()=>location.hash='hazard-does-not-exist');await page.locator('#hazard-route-error:not([hidden])').waitFor();assert.equal(await page.locator('#panel').evaluate(el=>el.open),false);await page.locator('#hazard-route-error a').click();await page.locator('#hazard-route-error').waitFor({state:'hidden'});assert.equal(await page.locator('#hazard-route-error').getAttribute('hidden'),'');check('unknown route recovery');
await page.evaluate(()=>location.hash='%E0%A4%A');await page.locator('#hazard-route-error:not([hidden])').waitFor();check('malformed encoding does not throw');
await page.goto(url+'#hazard-topic-title');await ready();await page.reload();await ready();await page.evaluate(()=>window.postMessage({type:'atlas-hazard',event:'escape'},'*'));assert.equal(await page.locator('#panel').evaluate(el=>el.open),true);check('deep link refresh and forged message ignored');
await frame().locator('[data-state="before"]').focus();await page.keyboard.press('Escape');await page.waitForTimeout(150);assert.equal(await page.locator('#panel').evaluate(el=>el.open),false);assert.match(page.url(),/#hazards$/);check('iframe Escape closes without leaving refreshed deep link');
await page.evaluate(()=>{window.__catalogHoldReady=true;window.__catalogReadyWithheld=0;});await page.evaluate(()=>location.hash='hazard-topic-title');await page.waitForFunction(()=>window.__catalogReadyWithheld>0);assert.equal(await page.locator('#pBody').getAttribute('data-state'),'loading');await page.locator('#retry').waitFor({timeout:6500});assert.match(await page.locator('#pBody').textContent(),/comparison didn't load/);await page.evaluate(()=>{window.__catalogHoldReady=false;});await page.locator('#retry').click();await ready();check('handshake timeout and explicit Retry');
await frame().locator('[data-state="after"]').click();const shot=path.join(artifacts,'wide-topic-panel.png');await page.screenshot({path:shot});report.screenshots.push(shot);await page.locator('#close').click();
await page.evaluate(()=>location.hash='kpi-tile');await ready();assert.match(await page.locator('#pTitle').textContent(),/KPI/i);assert.equal(await page.locator('#pFoot').evaluate(foot=>foot.getBoundingClientRect().top>=document.querySelector('#pBody').getBoundingClientRect().bottom-1),true);check('existing element hash route');await page.locator('#close').click();await page.evaluate(()=>location.hash='kicker-action-title-lede');await ready();await page.locator('#close').click();await page.locator('#card-kicker-action-title-lede summary').click();await page.locator('#card-kicker-action-title-lede [data-relation="hazard:topic-title"]').click();await ready();assert.ok(await page.locator('#relationship-back').isVisible());await page.locator('#relationship-back').click();await ready();check('element-card reciprocal link supplies explicit return');
await page.goto(url);await page.setViewportSize({width:640,height:450});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('[aria-controls=cats]').click();await page.locator('#cats [data-cat=metric]').click();assert.equal(await page.locator('#category-current').textContent(),'Metrics & KPIs');check('200 percent equivalent reflow and mobile category disclosure');await context.close();
for(const rtl of [false,true]){const ctx=await browser.newContext({viewport:{width:320,height:800},reducedMotion:'reduce'});await ctx.route(/https?:\/\//,r=>r.abort());const p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url+'#hazards');await p.locator('[aria-controls=hazard-cats]').click();assert.equal(await p.locator('[aria-controls=hazard-cats]').getAttribute('aria-expanded'),'true');await p.locator('[data-hcat=titles]').click();assert.ok(await p.locator('#hazard-card-topic-title').isVisible());await p.locator('[data-hcat=all]').click();await p.locator('[aria-controls=hazard-cats]').click();if(rtl)await p.evaluate(()=>document.documentElement.dir='rtl');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.locator('#hazard-card-topic-title .demo-btn').click();await p.locator('#pBody[data-state="ready"]').waitFor();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await p.locator('#panel').evaluate(el=>getComputedStyle(el).animationName),'none');await p.frameLocator('#pBody iframe').locator('[data-state="after"]').click();const file=path.join(artifacts,rtl?'narrow-rtl-panel.png':'narrow-reduced-panel.png');await p.screenshot({path:file});report.screenshots.push(file);await p.locator('#close').click();const catalog=path.join(artifacts,rtl?'narrow-rtl-catalog.png':'narrow-catalog.png');await p.screenshot({path:catalog});report.screenshots.push(catalog);check('320px '+(rtl?'RTL':'LTR')+' reduced motion, panel/rail overflow');await ctx.close();}
// Bounds and hit tests exercise controls that can be clipped despite visible text.
for(const width of [320,375,640]){
 const ctx=await browser.newContext({viewport:{width,height:width===640?450:800}});
 await ctx.route(/https?:\/\//,r=>r.abort());const p=await ctx.newPage();
 p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url);
 const bounds=await p.locator('#elements-view .seg').evaluate(seg=>{
  const group=seg.getBoundingClientRect();return [...seg.querySelectorAll('button')].map(button=>{const b=button.getBoundingClientRect();return {label:button.textContent,width:b.width,height:b.height,inside:b.left>=group.left-1&&b.right<=group.right+1};});
 });assert.equal(bounds.length,3);assert.ok(bounds.every(b=>b.inside&&b.width>=44&&b.height>=44),JSON.stringify(bounds));
 await p.locator('button[data-level=advanced]').click();assert.equal(await p.locator('button[data-level=advanced]').getAttribute('aria-pressed'),'true');
 assert.ok(await p.locator('#out .card:not([hidden])').count()>0);assert.equal(await p.locator('#out .card:not([hidden])').evaluateAll(cards=>cards.every(card=>card.dataset.level==='advanced')),true);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await p.evaluate(()=>location.hash='kpi-tile');await p.locator('#pBody[data-state="ready"]').waitFor();
 const order=await p.evaluate(()=>{const stage=document.querySelector('#pBody').getBoundingClientRect(),meta=document.querySelector('#pMeta').getBoundingClientRect();return {before:stage.bottom<=meta.top+1,visible:stage.top<innerHeight&&stage.bottom>0,dom:!!(document.querySelector('#pBody').compareDocumentPosition(document.querySelector('#pMeta'))&Node.DOCUMENT_POSITION_FOLLOWING)};});
 assert.ok(order.before&&order.visible&&order.dom,JSON.stringify(order));
 await p.locator('#panel').evaluate(panel=>{panel.scrollTop=panel.scrollHeight;});
 await p.waitForTimeout(50);assert.equal(await p.locator('#close').evaluate(button=>{const b=button.getBoundingClientRect(),p=document.querySelector('#panel').getBoundingClientRect();return b.top>=p.top-1&&b.bottom<=Math.min(p.bottom,innerHeight)+1&&document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)===button;}),true);
 await p.locator('#close').click();assert.equal(await p.locator('iframe').count(),0);check(width+'px level control bounds, Advanced activation, stage-first inspector and sticky Close');await ctx.close();
}
assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.status='functional-checks-passed';process.exitCode=0;
}catch(error){report.status='failed';report.failure=error.stack;process.exitCode=1;}finally{if(browser)await browser.close();fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({report:reportFile,status:report.status,checks:report.checks.length,failure:report.failure}));}
