import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../',import.meta.url));
const folder=path.join(root,'tests/lint');
for(const line of fs.readFileSync(path.join(folder,'SHA256SUMS'),'utf8').trim().split('\n')){const [hash,file]=line.split('  ');assert.equal(createHash('sha256').update(fs.readFileSync(path.join(folder,file))).digest('hex'),hash,'frozen hash '+file);}
const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
const suggestions={'wall-of-text':['collapsible-detail-card','slidedoc-page'],'bullet-overload':['fragment-builds'],'topic-title':['kicker-action-title-lede'],'unsourced-number':['sourced-footer','source-chips'],'time-slot-overload':['appendix-backup-slides','pacing-timer']};
function run(args,entry=path.join(root,'scripts/atlas.mjs')){return spawnSync(process.execPath,[entry,...args],{cwd:root,encoding:'utf8'});}
let passed=0;
for(const c of manifest.cases){
 const input=path.join(folder,c.input);
 if(c.inputHash)assert.equal(createHash('sha256').update(fs.readFileSync(input)).digest('hex'),c.inputHash,c.id+' immutable input hash');
 for(const json of [true,false]){
  const result=run(['lint',input,...c.args,...(json?['--json']:[])]);
  assert.equal(result.status,c.expectedExit,c.id+': '+result.stdout+result.stderr);
  if(json){
   const r=JSON.parse(result.stdout);assert.equal(result.stderr,'',c.id+' JSON stderr');
   assert.equal(r.exitCode,c.expectedExit,c.id);assert.equal(r.diagnostics[0]?.code??null,c.primaryDiagnostic,c.id);
   assert.deepEqual(r.findings.map(({ruleId,slideId,location,observed,threshold})=>({ruleId,slideId,location,observed,threshold})),c.findings,c.id);
   for(const f of r.findings){assert.equal(f.severity,f.ruleId==='unsourced-number'?'high':'medium',c.id);assert.deepEqual(f.suggestedElementIds,suggestions[f.ruleId],c.id);}
   if(c.expectedExit===2){assert.equal(r.status,'invalid',c.id);assert.equal(r.counts,null,c.id);}
   else {assert.ok(r.assumptions.minutes>0,c.id);assert.ok(r.assumptions.slidesPerMinute>0,c.id);const option=k=>c.args[c.args.indexOf(k)+1];assert.equal(r.assumptions.minutes,Number(option('--minutes')),c.id);assert.equal(r.assumptions.slidesPerMinute,c.args.includes('--slides-per-minute')?Number(option('--slides-per-minute')):1,c.id);assert.equal(r.assumptions.failOn,c.args.includes('--fail-on')?option('--fail-on'):'medium',c.id);for(const [k,v] of Object.entries(c.counts??{}))assert.equal(r.counts[k],v,c.id);assert.equal(r.coverage.rendered,false);assert.ok(r.coverage.limitations.some(s=>s.includes('false positive')));}
  } else {
   if(c.primaryDiagnostic)assert.ok(result.stdout.includes(c.primaryDiagnostic),c.id);
   else {assert.match(result.stdout,/required, .*optional, .*total/);assert.match(result.stdout,/Timing:/);for(const f of c.findings){assert.ok(result.stdout.includes(f.ruleId),c.id);assert.ok(result.stdout.includes(f.slideId??'deck'),c.id);assert.ok(result.stdout.includes('suggested elements:'),c.id);}}
  }
 }
 passed++;
}
// Real executable wrapper, including invocation outside the repository.
const wrapper=spawnSync(path.join(root,'atlas'),['lint',path.join(folder,'inputs/clean.html'),'--minutes','10','--json'],{cwd:os.tmpdir(),encoding:'utf8'});
assert.equal(wrapper.status,0,wrapper.stderr);assert.deepEqual(JSON.parse(wrapper.stdout).findings,[]);
for(const args of [[],['wrong','--json'],['lint','--minutes','10','--json']]){const r=run(args);assert.equal(r.status,2);if(args.includes('--json'))assert.equal(JSON.parse(r.stdout).diagnostics[0].code,'invalid-options');}
// Runtime UTF-8 rejection and missing source metadata must fail closed.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-lint-test-'));
try{
 const bad=path.join(temp,'bad.html');fs.writeFileSync(bad,Buffer.from([0xc3,0x28]));const utf=run(['lint',bad,'--minutes','10','--json']);assert.equal(utf.status,2);
 fs.cpSync(path.join(root,'scripts'),path.join(temp,'scripts'),{recursive:true});
 const missing=run(['lint',path.join(folder,'inputs/clean.html'),'--minutes','10','--json'],path.join(temp,'scripts/atlas.mjs'));
 assert.equal(missing.status,2,missing.stderr);assert.equal(JSON.parse(missing.stdout).diagnostics[0].code,'metadata-unavailable');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log(`Lint: ${passed}/${manifest.cases.length} frozen and supplemental cases passed in JSON and human modes; wrapper, invalid command, UTF-8 and metadata fail-closed checks passed.`);
