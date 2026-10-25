// Annotated HTML v1: deliberately bounded, static, dependency-free parser.
export const CONTRACT_VERSION='atlas-evidence-v1';
export const PARSER_VERSION='atlas-bounded-html-v1';
export const idPattern=/^[a-z][a-z0-9-]*$/;
export class DeckError extends Error { constructor(code,recordId=null,slideId=null,actual=null){super(code);Object.assign(this,{code,recordId,slideId,actual});} }
const fail=(code,id=null,slide=null,actual=null)=>{throw new DeckError(code,id,slide,actual);};
export const normalizeText=s=>s.normalize('NFC').replace(/[\s\p{White_Space}]/gu,' ').replace(/ +/g,' ').trim();
export function decodeEntities(s){return s.replace(/&(?:[^\s<&;]*;)?/g, token=>{const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'};if(/^&(?:amp|lt|gt|quot|apos|nbsp);$/.test(token))return named[token.slice(1,-1)];if(/^&#(?:[0-9]+|x[0-9a-fA-F]+);$/.test(token)){const v=token[2]==='x'?parseInt(token.slice(3,-1),16):Number(token.slice(2,-1));if(v>0&&v<=0x10ffff&&!(v>=0xd800&&v<=0xdfff))return String.fromCodePoint(v);}fail('unsupported-entity',null,null,token);});}
const tags=new Set('main section article div h1 h2 h3 h4 h5 h6 p span strong em b i small sup sub ul ol li table caption thead tbody tfoot tr th td blockquote q cite code pre a br details summary figure figcaption'.split(' '));
const inline=new Set('span strong em b i small sup sub q cite code a br'.split(' '));
const atlas=new Set('deck slide title body optional claim copy source fact kind source-id source-status'.split(' ').map(x=>'data-atlas-'+x));
const markers=new Set(['data-atlas-slide','data-atlas-title','data-atlas-body']);
const ownKeys=['claim','copy','source'];
const attr=(n,key)=>n.attrs['data-atlas-'+key];
export const elementChildren=n=>n.children.filter(x=>typeof x!=='string');
export function nodeText(n){if(typeof n==='string')return n;if(n.tag==='br')return ' ';return n.children.map(nodeText).join('');}
function ancestors(n){const out=[];for(let p=n.parent;p;p=p.parent)out.push(p);return out;}
export function parseDeck(input){
 if(Buffer.byteLength(input,'utf8')>8*1024*1024)fail('unsupported-content');
 const doc={tag:'#document',attrs:Object.create(null),children:[],parent:null};let current=doc,pos=0,doctype=false;input=input.replace(/^\uFEFF/,'');
 while(pos<input.length){
  if(input.startsWith('<!--',pos)){const end=input.indexOf('-->',pos+4);if(end<0||/--/.test(input.slice(pos+4,end)))fail('invalid-structure');pos=end+3;continue;}
  if(input[pos]!=='<'){let end=input.indexOf('<',pos);if(end<0)end=input.length;current.children.push(decodeEntities(input.slice(pos,end)));pos=end;continue;}
  if(/^<!doctype html>/i.test(input.slice(pos))){if(doctype||current!==doc||doc.children.some(x=>typeof x!=='string'||x.trim()))fail('invalid-structure');doctype=true;pos+=15;continue;}
  const close=/^<\/([a-z][a-z0-9-]*)\s*>/i.exec(input.slice(pos));
  if(close){if(current===doc||current.tag!==close[1].toLowerCase())fail('invalid-structure');current=current.parent;pos+=close[0].length;continue;}
  const start=/^<([a-z][a-z0-9-]*)/i.exec(input.slice(pos));if(!start)fail('invalid-structure');pos+=start[0].length;
  const n={tag:start[1].toLowerCase(),attrs:Object.create(null),children:[],parent:current};let self=false;
  for(;;){const space=/^\s*/.exec(input.slice(pos))[0];pos+=space.length;if(input.startsWith('/>',pos)){self=true;pos+=2;break;}if(input[pos]==='>'){pos++;break;}if(!space)fail('invalid-structure');const a=/^([a-z_:][a-z0-9_:.-]*)/i.exec(input.slice(pos));if(!a)fail('invalid-structure');pos+=a[0].length;const key=a[1].toLowerCase();if(Object.hasOwn(n.attrs,key))fail('duplicate-attribute');const afterName=pos;pos+=/^\s*/.exec(input.slice(pos))[0].length;let value='';if(input[pos]==='='){pos++;pos+=/^\s*/.exec(input.slice(pos))[0].length;const q=input[pos++];if(q!=="'"&&q!=='"')fail('invalid-structure');const end=input.indexOf(q,pos);if(end<0)fail('invalid-structure');value=decodeEntities(input.slice(pos,end));pos=end+1;}else {pos=afterName;if(!markers.has(key)&&!['hidden','inert'].includes(key))fail('unsupported-attribute',null,null,key);}n.attrs[key]=value;}
  // These browser text modes are outside v1; do not tokenize their contents as HTML.
  if(['xmp','plaintext','noembed','noframes','textarea'].includes(n.tag))fail('unsupported-content');
  if(ancestors(n).length>256)fail('unsupported-content');
  current.children.push(n);
  if(ancestors(n).some(p=>attr(p,'deck')!==undefined)&&!tags.has(n.tag))fail('unsupported-content');
  if(['script','style'].includes(n.tag)){const inside=ancestors(n).some(p=>attr(p,'deck')!==undefined);if(inside)fail('unsupported-content');if(self)fail('invalid-structure');const re=new RegExp('</'+n.tag+'\\s*>','ig');re.lastIndex=pos;const match=re.exec(input);if(!match)fail('invalid-structure');pos=re.lastIndex;continue;}
  if(self&&!['br','meta','link','img','input','hr'].includes(n.tag))fail('invalid-structure');if(!['br','meta','link','img','input','hr'].includes(n.tag))current=n;
 }
 if(current!==doc)fail('invalid-structure');
 const all=[];function collect(n){if(typeof n==='string')return;all.push(n);n.children.forEach(collect);}collect(doc);
 const shells=all.filter(n=>n.tag==='html');if(shells.length){const shell=shells[0],children=elementChildren(shell);if(shells.length!==1||shell.parent!==doc||elementChildren(doc).length!==1||children.some(n=>!['head','body'].includes(n.tag))||children.filter(n=>n.tag==='head').length>1||children.filter(n=>n.tag==='body').length!==1||children[0]?.tag==='body'&&children.length>1)fail('invalid-structure');const head=children.find(n=>n.tag==='head');if(head&&elementChildren(head).some(n=>!['title','meta','link','style','script'].includes(n.tag)))fail('invalid-structure');}
 const roots=all.filter(n=>attr(n,'deck')!==undefined);if(roots.length!==1||attr(roots[0],'deck')!=='1')fail('invalid-structure');const root=roots[0];
 if(!['main','div'].includes(root.tag))fail('invalid-structure');
 // Ancestor concealment affects the selected root too.
 for(const n of [root,...ancestors(root)]){hidden(n);if(['template','noscript','iframe','canvas','svg','textarea','title'].includes(n.tag))fail('unsupported-content');}
 const ids=new Map(),slides=[],claims=[],copies=[],sources=[],facts=[],links=[];
 function register(id,n,slide){if(!idPattern.test(id))fail('invalid-structure',id,slide);if(ids.has(id)&&ids.get(id)!==n)fail('duplicate-id',id,slide);ids.set(id,n);}
 function walk(n,slide=null,owner=null,fact=null){
  if(typeof n==='string'){if(n.trim()&&!owner)fail('unowned-text',null,slide?.id);if(/\p{Nd}/u.test(n)&&owner?.type!=='source'&&!['number','date'].includes(fact?.kind))fail('unclassified-number',fact?.id||owner?.id,slide?.id);return;}
  if(!tags.has(n.tag))fail('unsupported-content');hidden(n);
  for(const [k,v] of Object.entries(n.attrs)){if(['hidden','inert','aria-hidden'].includes(k))fail(k==='aria-hidden'?'unsupported-attribute':'hidden-evidence');if(!['id','class','style','lang','dir'].includes(k)&&!(n.tag==='a'&&['href','rel','target'].includes(k))&&!atlas.has(k))fail('unsupported-attribute',null,slide?.id,k);if(markers.has(k)&&v!=='')fail('invalid-structure');}
  if(Object.hasOwn(n.attrs,'dir')&&!['ltr','rtl','auto'].includes(n.attrs.dir)||Object.hasOwn(n.attrs,'target')&&!['_self','_blank'].includes(n.attrs.target))fail('invalid-structure');
  const types=ownKeys.filter(k=>attr(n,k)!==undefined);if((types.length||attr(n,'fact')!==undefined)&&['slide','deck'].some(k=>attr(n,k)!==undefined))fail('invalid-structure');if(attr(n,'title')!==undefined&&attr(n,'body')!==undefined)fail('invalid-structure');if(types.length+(attr(n,'fact')!==undefined)>1)fail('invalid-structure');
  const logical=types.length?attr(n,types[0]):attr(n,'fact');if(logical!==undefined&&n.attrs.id!==undefined&&n.attrs.id!==logical)fail('invalid-structure',logical);if(n.attrs.id!==undefined)register(n.attrs.id,n,slide?.id);if(logical!==undefined)register(logical,n,slide?.id);
  if(attr(n,'deck')!==undefined&&n!==root)fail('invalid-structure');if(n===root&&(logical!==undefined||attr(n,'slide')!==undefined))fail('invalid-structure');
  if(attr(n,'slide')!==undefined){if(slide||n.parent!==root||!['section','article','div'].includes(n.tag)||!n.attrs.id)fail('invalid-structure');slide={id:n.attrs.id,optional:attr(n,'optional')==='true',node:n};slides.push(slide);}
  if(attr(n,'optional')!==undefined&&(!['true','false'].includes(attr(n,'optional'))||attr(n,'slide')===undefined))fail('invalid-structure');
  for(const k of ['title','body'])if(attr(n,k)!==undefined&&(!slide||n.parent!==slide.node||!(k==='title'?/^(h[1-6]|div)$/:/^(div|section)$/).test(n.tag)))fail('invalid-structure');
  if(types.length){if(!slide||owner)fail('invalid-structure');owner={id:logical,type:types[0],slideId:slide.id,normalizedText:normalizeText(nodeText(n)),node:n};if(!owner.normalizedText)fail('invalid-structure',logical,slide.id);({claim:claims,copy:copies,source:sources})[owner.type].push(owner);}
  if(attr(n,'fact')!==undefined){if(!owner||owner.type!=='claim'||fact)fail('invalid-structure');const kind=attr(n,'kind');if(!['number','name','date','quote','unit'].includes(kind))fail('invalid-structure');fact={id:logical,kind,slideId:slide.id,claimId:owner.id,normalizedText:normalizeText(nodeText(n)),sourceId:attr(n,'source-id')??null,missing:attr(n,'source-status')==='missing',node:n};if(!fact.normalizedText)fail('invalid-structure');facts.push(fact);if(!['number','date'].includes(kind)&&/\p{Nd}/u.test(fact.normalizedText))fail('unclassified-number',logical,slide.id);}
  if(attr(n,'kind')!==undefined&&attr(n,'fact')===undefined)fail('invalid-structure');
  if(attr(n,'source-status')!==undefined&&attr(n,'source-status')!=='missing')fail('invalid-structure');
  if(fact?.node===n&&fact.kind==='number'){if((attr(n,'source-id')!==undefined)===(attr(n,'source-status')!==undefined))fail('invalid-structure');if(fact.sourceId&& !idPattern.test(fact.sourceId)&&fact.sourceId.trim())fail('invalid-structure');}else if(attr(n,'source-id')!==undefined||attr(n,'source-status')!==undefined)fail('invalid-structure');
  if(n.tag==='a'&&owner)links.push({ownerId:owner.id,slideId:slide.id,href:n.attrs.href??'',normalizedText:normalizeText(nodeText(n)),position:links.filter(x=>x.ownerId===owner.id).length});
  structure(n);n.children.forEach(c=>walk(c,slide,owner,fact));
 }
 // Deck-level whitespace is not audience text; every other run is closed by walk.
 walk(root);
 if(!slides.length)fail('invalid-structure');
 for(const s of slides){for(const k of ['title','body'])if(elementChildren(s.node).filter(n=>attr(n,k)!==undefined).length!==1)fail('invalid-structure',s.id,s.id);}
 for(const n of elementChildren(root))if(attr(n,'slide')===undefined)fail('invalid-structure');
 return {contractVersion:CONTRACT_VERSION,parserVersion:PARSER_VERSION,root,tree:doc,slides,claims,copies,sources,facts,links,ids};
}
function hidden(n){if(Object.hasOwn(n.attrs,'hidden')||Object.hasOwn(n.attrs,'inert')||n.attrs['aria-hidden']==='true'||/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(n.attrs.style||''))fail('hidden-evidence');}
function structure(n){const kids=elementChildren(n),as=ancestors(n);if((n.tag==='p'||n.tag==='a'||/^h[1-6]$/.test(n.tag))&&as.some(p=>p.tag===n.tag||/^h[1-6]$/.test(n.tag)&&/^h[1-6]$/.test(p.tag)))fail('invalid-structure');if((inline.has(n.tag)||n.tag==='p'||/^h[1-6]$/.test(n.tag)||n.tag==='summary')&&kids.some(k=>!inline.has(k.tag)))fail('invalid-structure');const restrict={ul:['li'],ol:['li'],thead:['tr'],tbody:['tr'],tfoot:['tr'],tr:['th','td']};if(restrict[n.tag]&&(kids.some(k=>!restrict[n.tag].includes(k.tag))||n.children.some(k=>typeof k==='string'&&k.trim())))fail('invalid-structure');if(n.tag==='li'&&!['ul','ol'].includes(n.parent.tag)||['th','td'].includes(n.tag)&&n.parent.tag!=='tr'||n.tag==='tr'&&!['table','thead','tbody','tfoot'].includes(n.parent.tag)||['caption','thead','tbody','tfoot'].includes(n.tag)&&n.parent.tag!=='table'||n.tag==='summary'&&n.parent.tag!=='details')fail('invalid-structure');if(n.tag==='table'){if(n.children.some(k=>typeof k==='string'&&k.trim()))fail('invalid-structure');const names=kids.map(k=>k.tag);if(names.some(x=>!['caption','thead','tbody','tfoot','tr'].includes(x))||names.includes('tr')&&names.some(x=>['thead','tbody','tfoot'].includes(x))||['caption','thead','tbody','tfoot'].some(x=>names.filter(y=>x===y).length>1)||names.includes('caption')&&names[0]!=='caption')fail('invalid-structure');const order={caption:0,thead:1,tbody:2,tfoot:3,tr:2};if(names.some((x,i)=>i&&order[x]<order[names[i-1]]))fail('invalid-structure');}if(n.tag==='details'&&(kids[0]?.tag!=='summary'||kids.filter(k=>k.tag==='summary').length!==1||!normalizeText(nodeText(kids[0]))))fail('invalid-structure');}
