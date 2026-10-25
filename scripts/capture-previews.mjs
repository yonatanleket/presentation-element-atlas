#!/usr/bin/env node
// Optional authoring tool: uses installed browser tooling, never installed runtime dependencies.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {hash,fileHash,sourceFingerprint,loadValidatedPreviews,previewDependencies} from './preview-assets.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i++){
 if(['--playwright','--browser','--only','--report','--concurrency'].includes(args[i])&&args[i+1])options[args[i].slice(2)]=args[++i];
 else if(args[i]==='--check')options.check=true;
 else throw Error('Usage: capture-previews.mjs --playwright <module> --browser <executable> [--only id,id] [--concurrency 2] [--report path] [--check]');
}
if(options.check){const checked=loadValidatedPreviews(root);console.log(JSON.stringify({elements:checked.entries.size,hazards:checked.hazards.size,warnings:checked.warnings},null,2));process.exitCode=checked.warnings.length?1:0;}
else {
 if(!options.playwright||!options.browser)throw Error('Explicit installed Playwright and Chrome paths required');
 const started=Date.now(),recipes=JSON.parse(fs.readFileSync(path.join(root,'preview-recipes.json')));
 const pw=await import(pathToFileURL(path.resolve(options.playwright)).href);
 const browser=await pw.chromium.launch({executablePath:path.resolve(options.browser),headless:true});
 const environment={browser:browser.version(),browserExecutableHash:fileHash(options.browser),playwrightVersion:JSON.parse(fs.readFileSync(path.join(path.dirname(options.playwright),'package.json'))).version,platform:os.platform(),release:os.release(),arch:os.arch(),viewport:{width:600,height:1000},deviceScaleFactor:800/544,locale:'en-US',timezoneId:'UTC',colorScheme:'light',reducedMotion:'reduce',fonts:'Actual local system fallback fonts; document.fonts.ready; no injected fonts',capture:'stage-only PNG; source styles; all CSS animation/transition disabled',network:'http/https blocked'};
 const manifestPath=path.join(root,'previews/manifest.json');
 let old={};try{old=JSON.parse(fs.readFileSync(manifestPath));}catch{}
 // Preserve prior captures only in the same recorded environment.
 const manifest=JSON.stringify(old.environment)===JSON.stringify(environment)?old:{version:1,environment,entries:{},hazards:{}};
 manifest.generatedAt=new Date().toISOString();
 const selected=options.only?.split(','),jobs=[];
 for(const group of ['entries','hazards'])for(const [id,recipe]of Object.entries(recipes[group]))if(!selected||selected.includes(id))jobs.push({group,id,recipe});
 if(selected?.some(id=>!jobs.some(j=>j.id===id)))throw Error('Unknown --only ID');
 const report={startedAt:new Date().toISOString(),environment,concurrency:Math.max(1,Math.min(3,Number(options.concurrency)||2)),entries:[]};
 async function action(page,a){const loc=page.locator(a.selector);if(a.type==='click')await loc.click({timeout:2000});else if(a.type==='value')await loc.evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},a.value);else throw Error('Unsupported finite action '+a.type);}
 async function capture(job){
  const {group,id,recipe}=job,file=group==='entries'?`demos/${id}.html`:`hazard-demos/${id}.html`;
  const deps=previewDependencies(group,id);
  const fingerprint=sourceFingerprint(root,deps,recipe,environment);
  const entry={id,status:'error',...fingerprint,description:recipe.description,...(recipe.limitation?{limitation:recipe.limitation}:{}),images:[],errors:[]};manifest[group][id]=entry;
  const context=await browser.newContext({...environment.viewport,viewport:environment.viewport,deviceScaleFactor:environment.deviceScaleFactor,locale:'en-US',timezoneId:'UTC',colorScheme:'light',reducedMotion:'reduce'});
  const page=await context.newPage();const blocked=[];
  await context.route(/https?:\/\//,route=>{blocked.push(route.request().url());return route.abort();});
  page.on('pageerror',error=>entry.errors.push(error.message));
  page.on('requestfailed',request=>{if(!/^https?:/.test(request.url()))entry.errors.push(`Asset failed: ${request.url()} ${request.failure()?.errorText}`);});
  if(group==='entries')await page.addInitScript(()=>{let atlas;Object.defineProperty(window,'AtlasDemo',{configurable:true,get:()=>atlas,set(value){atlas=value;const original=value.init;value.init=opts=>{const render=opts.render;const controller=original({...opts,autoplay:false,render(n,ctx){ctx.animate=false;if(render)render(n,ctx);}});window.__atlasCapture={controller,frames:opts.frames||0};return controller;};}});});
  try{
   await page.goto(pathToFileURL(path.join(root,file)).href);
   if(group==='entries')await page.waitForFunction(()=>window.__atlasCapture,undefined,{timeout:5000});else await page.waitForFunction(()=>window.AtlasHazard,undefined,{timeout:5000});
   if(await page.locator('.stage').count()!==1)throw Error('Expected exactly one .stage');
   await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
   await page.evaluate(()=>document.fonts.ready);
   if(recipe.bounds==='full-content'){
    const heights=[];for(const state of ['before','after']){await page.locator(`[data-state="${state}"]`).click();heights.push(await page.locator('.stage').evaluate(el=>el.scrollHeight));}
    const height=Math.max(...heights)+2;
    await page.locator('.stage').evaluate((el,height)=>{el.style.height=height+'px';el.style.aspectRatio='auto';},height);
   }
   const states=group==='entries'?[{frame:recipe.frame,actions:recipe.actions,state:'representative'},...(recipe.secondary?[recipe.secondary]:[])]:recipe.states.map(state=>({state,actions:recipe.actions}));
   for(const state of states){
    if(group==='entries')await page.evaluate(frame=>{const c=window.__atlasCapture;c.controller.reset();c.controller.goto(frame==='last'?c.frames:frame);},state.frame);
    else await page.locator(`[data-state="${state.state}"]`).click();
    for(const a of state.actions||[])await action(page,a);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const stage=page.locator('.stage'),box=await stage.boundingBox();if(!box||box.width<100||box.height<100)throw Error('Empty stage bounds');
    const text=await stage.innerText();
    if(!text.trim()&&!(await stage.locator('canvas,svg').count()))throw Error('Blank stage without text/canvas/svg');
    const src=`previews/${group==='entries'?'elements':'hazards'}/${id}-${state.state}-${fingerprint.sourceHash.slice(0,12)}.png`;
    const data=await stage.screenshot({path:path.join(root,src),animations:'disabled'});
    entry.images.push({src,width:data.readUInt32BE(16),height:data.readUInt32BE(20),bytes:data.length,sha256:hash(data),state:state.state,description:recipe.description,frame:group==='entries'?await page.evaluate(()=>window.__atlasCapture.controller.frame):undefined,visibleText:text,illustrativeLabels:await stage.locator('.label-illustrative').allTextContents()});
   }
   if(blocked.length)entry.errors.push(`External network requests blocked: ${blocked.join(', ')}`);
   if(entry.errors.length)throw Error('Runtime or asset errors');
   entry.status='ready';
  }catch(error){entry.errors.push(error.message);}
  finally{await context.close();report.entries.push({id,group,status:entry.status,errors:entry.errors,images:entry.images.length});console.log(`${group}/${id}: ${entry.status}${entry.errors.length?' '+entry.errors.join('; '):''}`);}
 }
 try{let cursor=0;await Promise.all(Array.from({length:report.concurrency},async()=>{while(cursor<jobs.length)await capture(jobs[cursor++]);}));}
 finally{await browser.close();fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');report.durationMs=Date.now()-started;report.summary={selected:jobs.length,ready:report.entries.filter(e=>e.status==='ready').length,failed:report.entries.filter(e=>e.status!=='ready').length,bytes:[...Object.values(manifest.entries),...Object.values(manifest.hazards)].reduce((sum,e)=>sum+e.images.reduce((n,i)=>n+i.bytes,0),0)};fs.writeFileSync(path.resolve(options.report||'work/team-workflow/app-redesign/preview-capture-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));if(report.summary.failed)process.exitCode=1;}
}
