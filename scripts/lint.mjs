// Five deterministic Report-mode heuristics over the shared validated HTML model.
import fs from 'node:fs';
import path from 'node:path';
import {parseDeck, normalizeText, nodeText, elementChildren, CONTRACT_VERSION, PARSER_VERSION} from './deck/parser.mjs';
import {validateHazards, AUTO_RULE_IDS} from './hazards.mjs';
const phrases=Object.freeze(['overview','background','results','metrics','roadmap','conclusion','quarterly support']);
const rank={low:1,medium:2,high:3};
export const limitations=Object.freeze([
 'Annotated HTML v1 only; rendered reachability/legibility not checked.',
 'Report-mode deterministic heuristics; no semantic or grammatical judgment.',
 'Possible topic title: finite prefix dictionary; Results improved is a known false positive.',
 'Source association is checked, not citation credibility. Dates and numeric source text are excluded.',
 'Body tokens are whitespace-delimited; closed disclosure counts. Optional slides are excluded from pacing.'
]);
const diagnostic=(code,actual=null,recordId=null,slideId=null)=>({code,slideId,recordId,expected:null,actual});
export function lintCLI(args){
 const report={contractVersion:CONTRACT_VERSION,parserVersion:PARSER_VERSION,tool:'atlas-lint-v1',status:'invalid',exitCode:2,coverage:{format:'annotated-html-v1',rendered:false,limitations},diagnostics:[],findings:[],counts:null,assumptions:null};
 let json=args.includes('--json');
 try{
  const opts={slidesPerMinute:1,failOn:'medium'},seen=new Set();let file;
  for(let i=0;i<args.length;i++){
   const a=args[i];
   if(a.startsWith('-')){
    if(!['--minutes','--slides-per-minute','--fail-on','--json'].includes(a)||seen.has(a))throw diagnostic('invalid-options',a);
    seen.add(a);if(a==='--json')continue;
    const v=args[++i];if(v===undefined)throw diagnostic('invalid-options',a);
    if(a==='--fail-on'){if(!Object.hasOwn(rank,v))throw diagnostic('invalid-options',v);opts.failOn=v;}
    else {if(!v.trim()||!Number.isFinite(Number(v))||Number(v)<=0)throw diagnostic('invalid-options',v);opts[a==='--minutes'?'minutes':'slidesPerMinute']=Number(v);}
   }else if(file===undefined)file=a;else throw diagnostic('invalid-options',a);
  }
  if(!file||!seen.has('--minutes')||!Number.isFinite(opts.minutes*opts.slidesPerMinute))throw diagnostic('invalid-options','A deck and finite positive --minutes are required; timing product must be finite.');
  if(!['.html','.htm'].includes(path.extname(file).toLowerCase()))throw diagnostic('unsupported-format',file);
  let input;try {input=fs.readFileSync(file);input=new TextDecoder('utf-8',{fatal:true}).decode(input);}catch(error){throw diagnostic('input-unavailable',error.message);}
  const deck=parseDeck(input);
  let metadata;try{metadata=validateHazards();if(metadata.errors.length)throw Error(metadata.errors.join('; '));}catch(error){throw diagnostic('metadata-unavailable',error.message);}
  const rules=new Map(metadata.hazards.filter(h=>AUTO_RULE_IDS.includes(h.data.id)).map(h=>[h.data.ruleId,h.data]));
  const add=(ruleId,slideId,location,observed,threshold)=>{const rule=rules.get(ruleId);if(!rule||!Object.hasOwn(rank,rule.severityByMode.report)||!rule.fixedBy.length)throw diagnostic('metadata-unavailable',ruleId);report.findings.push({ruleId,slideId,location,severity:rule.severityByMode.report,suggestedElementIds:[...rule.fixedBy],observed,threshold});};
  const inside=(node,ancestor)=>{for(let n=node;n;n=n.parent)if(n===ancestor)return true;return false;};
  for(const slide of deck.slides){
   const body=elementChildren(slide.node).find(n=>Object.hasOwn(n.attrs,'data-atlas-body'));
   const title=elementChildren(slide.node).find(n=>Object.hasOwn(n.attrs,'data-atlas-title'));
   // Join distinct protected owners with spaces, even when no whitespace separates wrappers.
   const bodyText=normalizeText([...deck.claims,...deck.copies].filter(x=>x.slideId===slide.id&&inside(x.node,body)).map(x=>x.normalizedText).join(' '));
   const tokens=bodyText?bodyText.split(' ').length:0;
   if(tokens>80)add('wall-of-text',slide.id,'body',tokens,80);
   let listIndex=0;
   function lists(n){if(['ul','ol'].includes(n.tag)){listIndex++;const count=elementChildren(n).filter(c=>c.tag==='li').length;if(count>6)add('bullet-overload',slide.id,`body/list/${listIndex}`,count,6);}elementChildren(n).forEach(lists);}
   lists(body);
   const titleText=normalizeText(nodeText(title)),lower=titleText.toLowerCase();
   if(phrases.some(p=>lower===p||lower.startsWith(p)&&/^[\s:—–-]/u.test(lower.slice(p.length))))add('topic-title',slide.id,'title',titleText,phrases);
   for(const fact of deck.facts.filter(f=>f.slideId===slide.id&&f.kind==='number')){
    if(fact.missing||!deck.sources.some(s=>s.id===fact.sourceId&&s.slideId===slide.id&&s.normalizedText))add('unsourced-number',slide.id,`fact/${fact.id}`,fact.sourceId,null);
   }
  }
  const total=deck.slides.length,optional=deck.slides.filter(s=>s.optional).length,required=total-optional,allowance=Math.floor(opts.minutes*opts.slidesPerMinute);
  report.counts={slides:total,claims:deck.claims.length,facts:deck.facts.length,sources:deck.sources.length,required,optional,total};
  report.assumptions={...opts,required,optional,total,allowance,mode:'report',topicTitlePhrases:phrases};
  if(required>allowance)add('time-slot-overload',null,'deck',required,allowance);
  report.exitCode=report.findings.some(f=>rank[f.severity]>=rank[opts.failOn])?1:0;
  report.status=report.findings.length?'findings':'passed';
 }catch(error){report.status='invalid';report.exitCode=2;report.findings=[];report.counts=null;report.assumptions=null;report.diagnostics=[error.code?diagnostic(error.code,error.actual??null,error.recordId??null,error.slideId??null):diagnostic('runtime-error',error.message)];}
 return {report,json};
}
export function humanReport(r){
 const lines=[`Atlas lint: ${r.status} (exit ${r.exitCode})`];
 for(const d of r.diagnostics)lines.push(`${d.code}${d.slideId?' ['+d.slideId+']':''}: ${d.actual??d.recordId??'invalid input'}`);
 if(r.assumptions){const a=r.assumptions;lines.push(`Slides: ${a.required} required, ${a.optional} optional, ${a.total} total. Timing: ${a.minutes} minutes × ${a.slidesPerMinute} slides/minute; allowance ${a.allowance}; fail on ${a.failOn}.`);lines.push(`Checked ${r.counts.claims} claims, ${r.counts.facts} facts, ${r.counts.sources} sources; ${r.findings.length} findings.`);}
 for(const f of r.findings)lines.push(`${f.severity} ${f.ruleId} [${f.slideId??'deck'} / ${f.location}]${f.ruleId==='topic-title'?' possible topic title':''}: observed ${JSON.stringify(f.observed)}, threshold ${JSON.stringify(f.threshold)}; suggested elements: ${f.suggestedElementIds.join(', ')}`);
 lines.push(...limitations);return lines.join('\n')+'\n';
}
