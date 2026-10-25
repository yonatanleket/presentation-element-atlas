import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const cases=JSON.parse(fs.readFileSync(new URL('./manifest.json',import.meta.url)));let failed=0;const actualResults=[];const totals={controls:0,mutations:0,invalid:0};
for(const c of cases){try{for(const p of c.policies??[])assert.equal(createHash('sha256').update(fs.readFileSync(p.file)).digest('hex'),p.hash,'policy hash changed');for(const [file,hash] of [[c.baseline,c.baselineHash],...(c.candidateHash&&fs.existsSync(c.candidate)?[[c.candidate,c.candidateHash]]:[])])assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),hash,'fixture hash changed');const run=spawnSync(process.execPath,['scripts/verify-deck.mjs',c.baseline,c.candidate,...c.flags,'--json'],{encoding:'utf8'});const r=JSON.parse(run.stdout);actualResults.push({id:c.id,exitCode:run.status,primary:r.diagnostics[0]??null,counts:r.counts,repairs:r.repairs,pass:run.status===c.expectedExit&&(r.diagnostics[0]?.code??null)===c.expectedPrimary});assert.equal(run.status,c.expectedExit,JSON.stringify(r));if(c.expectedPrimary)assert.equal(r.diagnostics[0]?.code,c.expectedPrimary,JSON.stringify(r));else assert.deepEqual(r.diagnostics,[]);if(c.recordId)assert.equal(r.diagnostics[0]?.recordId,c.recordId,JSON.stringify(r));if(c.id==='I-C03')assert.match(r.coverage.limitation,/annotated-content integrity passed; rendered reachability\/legibility not checked/);if(c.id==='I-N07')assert.deepEqual(r.counts.claimCounts.find(s=>s.slideId==='s2'),{slideId:'s2',expected:1,actual:0});if(c.id==='I-P01')assert.equal(r.repairs.length,1);if(c.id==='I-P05')assert.equal(r.repairs.length,1);totals[c.expectedExit===0?'controls':c.expectedExit===1?'mutations':'invalid']++;console.log('PASS '+c.id);}catch(e){failed++;console.error('FAIL '+c.id+' '+e.message);}}
fs.writeFileSync(new URL('./results.json',import.meta.url),JSON.stringify({datasetVersion:'v1',node:process.version,command:'node tests/integrity/test.mjs',cases:actualResults},null,2)+'\n');
console.log(JSON.stringify({passed:cases.length-failed,total:cases.length,totals}));process.exitCode=failed?1:0;
// Additional contract checks outside frozen denominators; public CLI only.
import os from 'node:os';import path from 'node:path';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-integrity-'));
let extra=0;
try {
 const base=fs.readFileSync(cases[0].baseline,'utf8');const original=path.join(temp,'original.html'),candidate=path.join(temp,'candidate.html');
 function check(name,a,b,exit,code,flags=[]){fs.writeFileSync(original,a);fs.writeFileSync(candidate,b);const r=spawnSync(process.execPath,['scripts/verify-deck.mjs',original,candidate,...flags,'--json'],{encoding:'utf8'});assert.equal(r.status,exit,name+' '+r.stdout+r.stderr);const v=JSON.parse(r.stdout);if(code)assert.equal(v.diagnostics[0].code,code,name);extra++;}
 const entities='A &amp; &lt; &gt; &quot; &#39; &apos; &nbsp; &#65; &#x41;';
 check('all supported entities',base.replace('Response time fell',entities),base.replace('Response time fell',entities),0);
 for(const entity of ['&','&amp','&#0;','&#xD800;','&#1114112;'])check('invalid entity '+entity,base,base.replace('Mira',entity),2,'unsupported-entity');
 check('case insensitive syntax',base,base.replaceAll('<span','<SPAN').replaceAll('</span>','</SPAN>').replaceAll('data-atlas-fact','DATA-ATLAS-FACT'),0);
 check('same-node logical and html ID',base,base.replace('data-atlas-fact="v1"','id="v1" data-atlas-fact="v1"'),0);
 check('conflicting html ID',base,base.replace('data-atlas-fact="v1"','id="other" data-atlas-fact="v1"'),2,'invalid-structure');
 check('hidden ancestor',base,'<html><body style="display:none">'+base+'</body></html>',2,'hidden-evidence');
 for(const tag of ['template','noscript','iframe','canvas','svg','textarea'])check('unsupported root ancestor '+tag,base,'<'+tag+'>'+base+'</'+tag+'>',2,'unsupported-content');
 check('self closing nonvoid',base,base.replace('Mira','<span/>Mira'),2,'invalid-structure');
 check('nested fact',base,base.replace('>12<','><span data-atlas-fact="extra" data-atlas-kind="number" data-atlas-source-status="missing">12</span><'),2,'invalid-structure');
 check('unknown annotation',base,base.replace('data-atlas-claim="c1"','data-atlas-claim="c1" data-atlas-secret="yes"'),2,'unsupported-attribute');
 check('no presentation policy needed unchanged',base,base,0);
 for(const flags of [['--citation-repair'],['--appendix-reflow'],['--citation-repair','x','--citation-repair','y'],['--surprise']])check('invalid CLI '+flags.join(' '),base,base,2,'invalid-options',flags);
 // Independent review regressions: raw-text boundaries, table foster parenting,
 // JavaScript object-property names, and empty enum values must fail closed.
 for(const tag of ['xmp','plaintext','noembed','noframes'])check('unsupported raw-text mode '+tag,base,'<'+tag+'>'+base+'</'+tag+'>',2,'unsupported-content');
 const tableSource=base.replace('<p data-atlas-source="src1">Fictional lab log, October release.</p>','<table data-atlas-source="src1">Fictional lab log, October release.</table>');
 check('bare source text cannot be foster parented out of table',base,tableSource,2,'invalid-structure');
 check('prototype property remains a rejected unknown attribute',base,base.replace('data-atlas-claim="c1"','data-atlas-claim="c1" __proto__="ignored"'),2,'unsupported-attribute');
 check('empty direction is outside enum',base,base.replace('data-atlas-claim="c1"','data-atlas-claim="c1" dir=""'),2,'invalid-structure');
 check('empty link target is outside enum',base,base.replace('reported','<a href="https://example.invalid/" target="">reported</a>'),2,'invalid-structure');
 console.log('OK: '+extra+' supplemental contract checks');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
