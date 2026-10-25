#!/usr/bin/env node
import {verifyDeckFiles} from './deck/verify.mjs';
import {CONTRACT_VERSION,PARSER_VERSION} from './deck/parser.mjs';
const args=process.argv.slice(2),files=[],options={};let json=false,invalid=false;
for(let i=0;i<args.length;i++){const a=args[i];if(a==='--json'){if(json)invalid=true;json=true;}else if(a==='--citation-repair'||a==='--appendix-reflow'){const key=a==='--citation-repair'?'citation':'appendix';if(options[key]||!args[i+1]||args[i+1].startsWith('--'))invalid=true;else options[key]=args[++i];}else if(a.startsWith('-'))invalid=true;else files.push(a);}
if(files.length!==2)invalid=true;
const result=invalid?{contractVersion:CONTRACT_VERSION,parserVersion:PARSER_VERSION,tool:'atlas-verify-deck',status:'invalid',exitCode:2,coverage:{format:'annotated-html-v1',rendered:false},diagnostics:[{code:'invalid-options',slideId:null,recordId:null,expected:null,actual:null}],findings:[]}:verifyDeckFiles(...files,options);
if(json)console.log(JSON.stringify(result));else{console.log(`${result.status}: ${result.diagnostics.length} diagnostics`);for(const d of result.diagnostics)console.log(`${d.code}${d.recordId?' '+d.recordId:''}`);console.log(result.coverage.limitation||'Rendered reachability/legibility not checked.');if(result.repairs?.length)console.log(JSON.stringify(result.repairs));}
process.exitCode=result.exitCode;
