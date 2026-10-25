(function () {
'use strict';
const payload = JSON.parse(document.getElementById('atlas-data').textContent);
const elements = new Map(payload.elements.map(e => [e.id,e])), hazards = new Map(payload.hazards.map(h => [h.id,h]));
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const html = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const filters = {elements:{q:'',cat:'all',level:'all',surface:'slide',fresh:false},hazards:{q:'',cat:'all',axis:'all'}};
const NEW_DAYS = 30, isNew = added => !!added && (Date.now() - Date.parse(added + 'T00:00:00Z')) / 864e5 < NEW_DAYS;
let section='elements', current=null, invoker=null, catalogScroll=null, frameTimer=null, inputTimer=null, closing=false;
const snapshots = new Map();
let pendingRestore=null, restoreSequence=0, hoverTimer=null, hoverFrame=null, hoverPoster=null;
const panel=$('#panel'), body=$('#pBody');
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
function stopHoverPreview(){
 clearTimeout(hoverTimer);hoverTimer=null;
 if(hoverFrame){hoverFrame.remove();hoverFrame=null;}
 if(hoverPoster){hoverPoster.classList.remove('is-playing');hoverPoster=null;}
}
function startHoverPreview(posterEl){
 if(panel.open||reducedMotion?.matches)return;
 const id=posterEl?.dataset.hoverDemo, item=id&&elements.get(id);
 if(!item?.demo)return;
 if(hoverPoster===posterEl&&hoverFrame)return;
 stopHoverPreview();
 hoverPoster=posterEl;
 hoverTimer=setTimeout(()=>{
  if(panel.open||hoverPoster!==posterEl)return;
  const frame=document.createElement('iframe');
  frame.className='hover-demo-frame';
  frame.title='Quick preview: '+item.name;
  frame.setAttribute('sandbox','allow-scripts');
  frame.setAttribute('tabindex','-1');
  frame.setAttribute('aria-hidden','true');
  frame.src='demos/'+encodeURIComponent(id)+'.html#quickplay';
  // Sandboxed file:// frames have an opaque origin, so readiness is signalled by the load event.
  frame.addEventListener('load',()=>{if(hoverFrame===frame&&hoverPoster===posterEl)posterEl.classList.add('is-playing');});
  frame.addEventListener('error',()=>{if(hoverFrame===frame)stopHoverPreview();});
  posterEl.querySelector('.preview-shell')?.append(frame);
  hoverFrame=frame;
 },180);
}
document.addEventListener('pointerover',event=>{
 if(event.pointerType&&event.pointerType!=='mouse')return;
 const posterEl=event.target.closest?.('.poster[data-hover-demo]');
 if(posterEl){startHoverPreview(posterEl);return;}
 const pairEl=event.target.closest?.('.problem-pair');
 if(pairEl&&!reducedMotion?.matches)pairEl.classList.add('is-previewing');
});
document.addEventListener('pointerout',event=>{
 const pairEl=event.target.closest?.('.problem-pair');
 if(pairEl&&(!event.relatedTarget||!pairEl.contains(event.relatedTarget)))pairEl.classList.remove('is-previewing');
 if(!hoverPoster)return;
 const leaving=event.target.closest?.('.poster[data-hover-demo]');
 if(leaving===hoverPoster&&(!event.relatedTarget||!hoverPoster.contains(event.relatedTarget)))stopHoverPreview();
});
function syncCategoryLabels(){
 const selected=$('#cats [aria-pressed="true"]'), problem=$('#hazard-cats [aria-pressed="true"]');
 $('#category-current').textContent=selected?.childNodes[0]?.textContent.trim()||'All';
 $('#problem-category-current').textContent=problem?.childNodes[0]?.textContent.trim()||'All';
}
$$('.category-toggle').forEach(button=>button.addEventListener('click',()=>{
 const expanded=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(expanded));
 document.getElementById(button.getAttribute('aria-controls')).classList.toggle('is-expanded',expanded);
}));
function previewError(image){image.closest('.preview-shell')?.classList.add('preview-unavailable');image.setAttribute('aria-hidden','true');}
// Capture handles image failure even when native lazy images load after filtering.
document.addEventListener('error',event=>{if(event.target.matches?.('.preview-shell img'))previewError(event.target);},true);
$$('.preview-shell img').forEach(image=>{if(image.complete&&!image.naturalWidth)previewError(image);});
function pressed(selector,key,value){$$(selector).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===value)));}
function applyElements(){syncCategoryLabels();const s=filters.elements;let total=0;const onSurface=[...elements.values()].filter(e=>e.surface===s.surface).length;$$('#out .card').forEach(c=>{c.hidden=!(c.dataset.surface===s.surface&&(s.cat==='all'||c.dataset.cat===s.cat)&&(s.level==='all'||c.dataset.level===s.level)&&(!s.fresh||isNew(c.dataset.added))&&c.dataset.search.includes(s.q));if(!c.hidden)total++;});$$('#out section.cat').forEach(c=>{const n=c.querySelectorAll('.card:not([hidden])').length;c.hidden=!n;c.querySelector('.n').textContent=n;});$('#count').textContent=total+' of '+onSurface;$('#surface-empty').hidden=onSurface>0;$('#empty').hidden=total>0||onSurface===0;$('#emptyMsg').textContent=s.q?'No elements match “'+$('#q').value.trim()+'”.':'No elements match these filters.';dropHiddenHoverPreview();}
// Newest first inside each category while the New filter is on; build order otherwise.
const buildOrder=new Map($$('#out .card').map((c,i)=>[c,i]));
function orderCards(){$$('#out .grid').forEach(g=>{const cards=[...g.children].filter(c=>c.matches('.card'));cards.sort((a,b)=>filters.elements.fresh?(b.dataset.added||'').localeCompare(a.dataset.added||'')||buildOrder.get(a)-buildOrder.get(b):buildOrder.get(a)-buildOrder.get(b));cards.forEach(c=>g.append(c));});}
$$('#out .card[data-added]').forEach(c=>{const badge=c.querySelector('.pill-new');if(badge)badge.hidden=!isNew(c.dataset.added);});
function setSurface(value){if(!$('[data-surface-filter="'+value+'"]'))value='slide';const s=filters.elements;if(s.surface!==value){s.surface=value;s.cat='all';pressed('#cats [data-cat]','cat','all');}$$('[data-surface-filter]').forEach(b=>{const on=b.dataset.surfaceFilter===value;b.setAttribute('aria-checked',String(on));b.tabIndex=on?0:-1;});$$('#cats [data-cat]').forEach(b=>{if(b.dataset.cat!=='all')b.hidden=b.dataset.surface!==value;});$('#q').placeholder=value==='web'?'Search web sections, e.g. pricing, FAQ, hero':'Search elements, e.g. funnel, slider, poll';$('#cats [data-cat="all"] small').textContent=[...elements.values()].filter(e=>e.surface===value).length;applyElements();}
function sectionHash(sec){return sec==='elements'&&filters.elements.surface!=='slide'?'#surface-'+filters.elements.surface:'#'+sec;}
function applyHazards(){syncCategoryLabels();const s=filters.hazards, cards=$$('.hazard-card');let total=0;cards.forEach(c=>{c.hidden=!((s.cat==='all'||c.dataset.category===s.cat)&&(s.axis==='all'||c.dataset.axis===s.axis)&&c.dataset.search.includes(s.q));if(!c.hidden)total++;});$$('.hazard-cat').forEach(c=>{const n=c.querySelectorAll('.hazard-card:not([hidden])').length;c.hidden=!n;c.querySelector('.n').textContent=n;});$$('[data-hcat]').forEach(b=>{b.querySelector('small').textContent=cards.filter(c=>(b.dataset.hcat==='all'||b.dataset.hcat===c.dataset.category)&&(s.axis==='all'||s.axis===c.dataset.axis)&&c.dataset.search.includes(s.q)).length;});$('#hazard-count').textContent=total+' of '+hazards.size+' problems';$('#hazard-empty').hidden=total>0;$('#hazard-empty-message').textContent=s.q?'No slide problems match “'+$('#hq').value.trim()+'”.':'No slide problems match these filters.';dropHiddenHoverPreview();}
function dropHiddenHoverPreview(){if(hoverPoster?.closest('.card')?.hidden)stopHoverPreview();}
function resetHazards(){filters.hazards={q:'',cat:'all',axis:'all'};$('#hq').value='';pressed('[data-hcat]','hcat','all');pressed('[data-axis-filter]','axisFilter','all');applyHazards();}
function setSection(value){stopHoverPreview();section=value;$('.intro:not(.hazards-intro)').hidden=value!=='elements';$('#elements-view').hidden=value!=='elements';$('#hazards-view').hidden=value!=='hazards';$$('[data-section]').forEach(a=>{if(a.dataset.section===value)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});requestAnimationFrame(sizeRails);}
function sizeRails(){$$('.rail').forEach(rail=>{rail.classList.remove('compact-rail');if(!rail.closest('[hidden]')&&rail.getBoundingClientRect().height>innerHeight/3)rail.classList.add('compact-rail');});}
$('#q').addEventListener('input',e=>{filters.elements.q=e.target.value.trim().toLowerCase();clearTimeout(inputTimer);inputTimer=setTimeout(applyElements,150);});
$('#surfaces').addEventListener('click',e=>{const b=e.target.closest('[data-surface-filter]');if(!b)return;setSurface(b.dataset.surfaceFilter);history.replaceState({atlas:true,depth:0,section:'elements'},'',sectionHash('elements'));});
// Radio group: one tab stop; arrow keys move selection (mirrored in RTL), Home/End jump.
$('#surfaces').addEventListener('keydown',e=>{const list=$$('[data-surface-filter]'),i=list.indexOf(document.activeElement);if(i<0)return;const rtl=getComputedStyle(e.currentTarget).direction==='rtl';const step={ArrowRight:rtl?-1:1,ArrowDown:1,ArrowLeft:rtl?1:-1,ArrowUp:-1}[e.key];let j=e.key==='Home'?0:e.key==='End'?list.length-1:step==null?-1:(i+step+list.length)%list.length;if(j<0)return;e.preventDefault();list[j].focus();list[j].click();});
$('#new-filter').addEventListener('click',e=>{filters.elements.fresh=!filters.elements.fresh;e.currentTarget.setAttribute('aria-pressed',String(filters.elements.fresh));orderCards();applyElements();});
$('#q').addEventListener('keydown',e=>{if(e.key==='Escape'&&e.target.value){e.stopPropagation();e.target.value='';filters.elements.q='';applyElements();}});
$$('button[data-level]').forEach(b=>b.addEventListener('click',()=>{filters.elements.level=b.dataset.level;pressed('button[data-level]','level',b.dataset.level);applyElements();}));
$('#cats').addEventListener('click',e=>{const b=e.target.closest('[data-cat]');if(!b)return;filters.elements.cat=b.dataset.cat;pressed('#cats [data-cat]','cat',b.dataset.cat);applyElements();});
$('#clear').addEventListener('click',()=>{filters.elements={...filters.elements,q:'',cat:'all',level:'all',fresh:false};$('#q').value='';pressed('button[data-level]','level','all');pressed('#cats [data-cat]','cat','all');$('#new-filter').setAttribute('aria-pressed','false');orderCards();applyElements();$('#q').focus();});
$('#hq').addEventListener('input',e=>{filters.hazards.q=e.target.value.trim().toLowerCase();clearTimeout(inputTimer);inputTimer=setTimeout(applyHazards,150);});
$('#hq').addEventListener('keydown',e=>{if(e.key==='Escape'&&e.target.value){e.stopPropagation();e.target.value='';filters.hazards.q='';applyHazards();}});
$('#hazard-cats').addEventListener('click',e=>{const b=e.target.closest('[data-hcat]');if(!b)return;filters.hazards.cat=b.dataset.hcat;pressed('[data-hcat]','hcat',b.dataset.hcat);applyHazards();const heading=$('#hc-'+b.dataset.hcat);if(heading&&!heading.hidden)heading.scrollIntoView({block:'start'});});
$('#hazard-axes').addEventListener('click',e=>{const b=e.target.closest('[data-axis-filter]');if(!b)return;filters.hazards.axis=b.dataset.axisFilter;pressed('[data-axis-filter]','axisFilter',b.dataset.axisFilter);applyHazards();});
$('#hazard-clear').addEventListener('click',()=>{resetHazards();$('#hq').focus();});
function fragment(route){return route?(route.kind==='hazard'?'#hazard-':'#')+route.id:sectionHash(section);}
function parseHash(){let hash;try{hash=decodeURIComponent(location.hash.slice(1));}catch{return {invalid:true};}if(hash==='hazards')return {section:'hazards'};if(hash==='elements'||!hash)return {section:'elements',surface:'slide'};if(hash.startsWith('surface-')){const surface=hash.slice(8);return $('[data-surface-filter="'+surface+'"]')?{section:'elements',surface}:{section:'elements',surface:'slide',canonical:true};}if(hash.startsWith('hazard-')){const id=hash.slice(7);return hazards.has(id)?{route:{kind:'hazard',id}}:{invalid:true};}return elements.has(hash)?{route:{kind:'element',id:hash}}:{section:'elements'};}
function same(a,b){return a?.kind===b?.kind&&a?.id===b?.id;}
function ids(kind){return $$(kind==='hazard'?'.hazard-card':'#out .card').filter(c=>!c.hidden).map(c=>c.dataset.id);}
function currentPreview(){const item=current&&(current.kind==='hazard'?hazards.get(current.id):elements.get(current.id));return item?.preview;}
function stillMarkup(preview){return preview?'<div class="preview-shell"><img src="'+html(preview.path)+'" width="'+preview.width+'" height="'+preview.height+'" alt=""></div>':'';}
function message(text,retry){body.dataset.state='error';body.innerHTML='<div class="msg">'+stillMarkup(currentPreview())+'<p>'+html(text)+'</p>'+(retry?'<button type="button" class="btn" id="retry">Retry</button>':'')+'</div>';if(retry)$('#retry').addEventListener('click',()=>loadFrame(current));}
function loadFrame(route){clearTimeout(frameTimer);pendingRestore=null;body.innerHTML='';body.dataset.state='loading';const frame=document.createElement('iframe'),item=route.kind==='hazard'?hazards.get(route.id):elements.get(route.id);frame.title=(route.kind==='hazard'?'Comparison: ':'Demo: ')+item.name;frame.setAttribute('sandbox','allow-scripts');frame.src=(route.kind==='hazard'?'hazard-demos/':'demos/')+encodeURIComponent(route.id)+'.html';body.append(frame);const loading=document.createElement('div');loading.className='panel-loading';if(item.preview){const image=document.createElement('img');image.src=item.preview.path;image.width=item.preview.width;image.height=item.preview.height;image.alt='';const shell=document.createElement('div');shell.className='preview-shell';shell.append(image);loading.append(shell);}const status=document.createElement('span');status.textContent=route.kind==='hazard'?'Loading comparison…':'Loading demo…';loading.append(status);body.append(loading);frameTimer=setTimeout(()=>{if(body.dataset.state==='loading')message(route.kind==='hazard'?"This comparison didn't load.":"This demo didn't load.",true);},5000);}
function relationLinks(route){if(route.kind==='hazard')return '<div class="relations"><b>Fixed by</b>'+hazards.get(route.id).fixedBy.map(id=>'<a href="#'+id+'" data-relation="element:'+id+'">'+html(elements.get(id).name)+'</a>').join('')+'</div>';return (elements.get(route.id).hazards||[]).length?'<div class="relations"><b>Helps with</b>'+elements.get(route.id).hazards.map(id=>'<a href="#hazard-'+id+'" data-relation="hazard:'+id+'">'+html(hazards.get(id).name)+'</a>').join('')+'</div>':'';}
function showPanel(route,state){stopHoverPreview();const wasOpen=panel.open;current=route;setSection(route.kind==='hazard'?'hazards':'elements');if(route.kind==='element'&&elements.get(route.id).surface!==filters.elements.surface)setSurface(elements.get(route.id).surface);$('#hazard-route-error').hidden=true;
 if(route.kind==='hazard'&&$('#hazard-card-'+route.id).hidden){resetHazards();$('#hazard-announcement').textContent='Filters cleared to show this slide problem.';}
 const item=route.kind==='hazard'?hazards.get(route.id):elements.get(route.id);$('#pTitle').textContent=item.name;$('#pReturn').hidden=!state.parentRoute;if(state.parentRoute){const parent=state.parentRoute.kind==='hazard'?hazards.get(state.parentRoute.id):elements.get(state.parentRoute.id);$('#pReturn').innerHTML='<button class="btn" type="button" id="relationship-back">Back to '+html(parent.name)+'</button>';$('#relationship-back').addEventListener('click',()=>{if(same(state.parentRoute,state.entryRoute))history.back();else {const back={...state,route:state.parentRoute,parentRoute:null};history.replaceState(back,'',fragment(back.route));sync(back);}});}else $('#pReturn').innerHTML='';
 $('#pMeta').hidden=false;if(route.kind==='hazard'){$('#pMeta').innerHTML='<p class="hazard-label">'+html(payload.hazardCats[item.category])+' · '+html(item.axis==='auto'?'HTML rule':item.axis==='rendered'?'Visual review':'Human review')+(item.id==='topic-title'?' · Heuristic':'')+'</p><b>Why it fails the audience</b><p>'+html(item.audienceImpact)+'</p>'+(item.axis!=='auto'?'<p class="review-note">Guidance requiring review.</p>':'');$('#pFoot').innerHTML=relationLinks(route)+'<details><summary>Severity guidance by delivery mode</summary>'+Object.entries(item.severityByMode).map(([k,v])=>'<p>'+html(k)+': '+html(v)+'</p>').join('')+'</details>';}else{$('#pMeta').innerHTML='<b>What it is</b><p>'+html(item.definition)+'</p><b>Best for</b><p>'+html(item.bestUse)+'</p><p class="hazard-label">'+html(item.kind==='animated'?'Motion specimen':item.kind==='interactive'?'Interactive specimen':'Static specimen')+' · illustrative demo</p>';$('#pFoot').innerHTML='Source: '+item.sources.map(s=>s.url?'<a href="'+html(s.url)+'" target="_blank" rel="noopener">'+html(s.label)+'</a>':html(s.label)).join(', ')+relationLinks(route);}
 if(item.preview?.limitation)$('#pMeta').innerHTML+='<p class="preview-limitation">'+html(item.preview.limitation)+'</p>';
 if(route.kind==='hazard')$('#pMeta').innerHTML+='<p class="specimen-caption">Fictional Before/After examples</p>';
 const visible=ids(route.kind),index=visible.indexOf(route.id);$('#prev').disabled=index<=0;$('#next').disabled=index<0||index===visible.length-1;$('#prev').setAttribute('aria-label','Previous '+route.kind);$('#next').setAttribute('aria-label','Next '+route.kind);loadFrame(route);if(!wasOpen)panel.showModal();$('#pTitle').focus();const card=$(route.kind==='hazard'?'#hazard-card-'+route.id:'#card-'+route.id);if(card&&!wasOpen&&state.depth===0)card.scrollIntoView({block:'center'});
}
function hidePanel(state){clearTimeout(frameTimer);pendingRestore=null;body.innerHTML='';current=null;if(panel.open)panel.close();setSection(state?.section||state?.originSection||section);const target=invoker&&document.contains(invoker)&&!invoker.closest('[hidden]')?invoker:$(section==='hazards'?'#hq':'#q');requestAnimationFrame(()=>{target?.focus({preventScroll:true});if(catalogScroll&&catalogScroll.section===section)scrollTo(0,catalogScroll.y);});}
function sync(state){if(state?.route){if(!same(current,state.route)||!panel.open){const prior=current;showPanel(state.route,state);if(prior){const chip=$('#pFoot [data-relation="'+prior.kind+':'+prior.id+'"]');if(chip)chip.focus();}}}else hidePanel(state);}
function openRoute(route,from,relationship){const previous=history.state?.atlas?history.state:{atlas:true,depth:0,section};let state;if(!panel.open){invoker=from||document.activeElement;catalogScroll={section,y:scrollY};state={atlas:true,route,depth:1,originSection:section,originSurface:filters.elements.surface,entryRoute:route,parentRoute:null};history.pushState(state,'',fragment(route));}else if(relationship){if(previous.depth===0){const origin=previous.originSection||section;history.replaceState({atlas:true,depth:0,section:origin},'',sectionHash(origin));history.pushState({...previous,depth:1,originSection:origin},'',fragment(current));}state={...previous,route,depth:2,parentRoute:current};if(previous.depth<2)history.pushState(state,'',fragment(route));else history.replaceState(state,'',fragment(route));}else{state={...previous,route,parentRoute:null,entryRoute:route};history.replaceState(state,'',fragment(route));}showPanel(route,state);}
function closePanel(){if(!panel.open)return;const state=history.state;if(state?.originSurface&&state.originSurface!==filters.elements.surface)setSurface(state.originSurface);const origin=state?.originSection||(current.kind==='hazard'?'hazards':'elements');hidePanel({section:origin});if(state?.atlas&&state.depth>0){closing=true;history.go(-state.depth);}else history.replaceState({atlas:true,depth:0,section:origin},'',sectionHash(origin));}
function routeLocation(){const parsed=parseHash();if(parsed.invalid){hidePanel({section:'hazards'});$('#hazard-route-error').hidden=false;history.replaceState({atlas:true,depth:0,section:'hazards'},'',location.href);return;}$('#hazard-route-error').hidden=true;if(parsed.surface)setSurface(parsed.surface);if(parsed.canonical){history.replaceState({atlas:true,depth:0,section:'elements'},'',sectionHash('elements'));sync({atlas:true,depth:0,section:'elements'});return;}const st=parsed.route?{atlas:true,route:parsed.route,depth:0,originSection:parsed.route.kind==='hazard'?'hazards':'elements',entryRoute:parsed.route}: {atlas:true,depth:0,section:parsed.section};history.replaceState(st,'',location.href);sync(st);}
window.addEventListener('popstate',()=>{if(closing){closing=false;const base={atlas:true,depth:0,section};history.pushState(base,'',sectionHash(section));sync(base);return;}const st=history.state;if(st?.atlas)sync(st);else routeLocation();});
window.addEventListener('hashchange',()=>{if(closing)return;const st=history.state;if(st?.atlas&&((st.route&&fragment(st.route)===location.hash)||(!st.route&&sectionHash(st.section)===location.hash)))return;routeLocation();});
document.addEventListener('click',event=>{const tab=event.target.closest('[data-section]');if(tab){event.preventDefault();if(panel.open)closePanel();setSection(tab.dataset.section);history.replaceState({atlas:true,depth:0,section},'',sectionHash(section));return;}const hazard=event.target.closest('[data-open-hazard]'),element=event.target.closest('[data-open]'),relation=event.target.closest('[data-relation]');if(hazard){openRoute({kind:'hazard',id:hazard.dataset.openHazard},$('#hazard-card-'+hazard.dataset.openHazard+' .demo-btn'));return;}if(element){openRoute({kind:'element',id:element.dataset.open},$('#card-'+element.dataset.open+' .demo-btn'));return;}if(relation){event.preventDefault();const [kind,id]=relation.dataset.relation.split(':');if(!panel.open&&relation.dataset.originHazard){openRoute({kind:'hazard',id:relation.dataset.originHazard},relation);openRoute({kind,id},relation,true);}else if(!panel.open&&relation.dataset.originElement){openRoute({kind:'element',id:relation.dataset.originElement},relation);openRoute({kind,id},relation,true);}else openRoute({kind,id},relation,panel.open);}});
function move(delta){if(!current)return;const list=ids(current.kind),id=list[list.indexOf(current.id)+delta];if(id)openRoute({kind:current.kind,id});}
panel.addEventListener('keydown',event=>{if((event.key==='ArrowLeft'||event.key==='ArrowRight')&&event.target===panel){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}});
$('#close').addEventListener('click',closePanel);$('#prev').addEventListener('click',()=>move(-1));$('#next').addEventListener('click',()=>move(1));panel.addEventListener('cancel',e=>{e.preventDefault();closePanel();});
window.addEventListener('message',event=>{if(hoverFrame&&event.source===hoverFrame.contentWindow&&event.data?.type==='atlas-demo'){if(event.data.event==='error')stopHoverPreview();return;}const frame=body.querySelector('iframe');if(!frame||event.source!==frame.contentWindow||event.origin!=='null'||!event.data||!current)return;const expected=current.kind==='hazard'?'atlas-hazard':'atlas-demo';if(event.data.type!==expected)return;if(event.data.event==='ready'){
 if(current.kind==='hazard'&&snapshots.has(current.id)){
  const saved=structuredClone(snapshots.get(current.id));pendingRestore={requestId:++restoreSequence,snapshot:saved};
  frame.contentWindow.postMessage({type:'atlas-hazard-control',event:'restore',requestId:pendingRestore.requestId,snapshot:saved},'*');
 }else{clearTimeout(frameTimer);body.dataset.state='ready';}
}else if(event.data.event==='restored'&&current.kind==='hazard'&&pendingRestore&&event.data.requestId===pendingRestore.requestId){
 const expected=pendingRestore.snapshot,actual=event.data.snapshot;
 const restored=actual&&actual.state===expected.state&&Array.isArray(actual.details)&&actual.details.length===(expected.details||[]).length&&actual.details.every((open,i)=>open===expected.details[i])&&(!Number.isInteger(expected.agendaIndex)||actual.agendaIndex===expected.agendaIndex);
 if(!restored){pendingRestore=null;message("This comparison didn't load.",true);return;}
 snapshots.set(current.id,actual);pendingRestore=null;clearTimeout(frameTimer);body.dataset.state='ready';
}else if(event.data.event==='state'&&current.kind==='hazard'&&event.data.snapshot&&!pendingRestore)snapshots.set(current.id,event.data.snapshot);else if(event.data.event==='error')message(current.kind==='hazard'?"This comparison didn't load.":"This demo didn't load.",true);else if(event.data.event==='escape')closePanel();});
window.addEventListener('resize',sizeRails);applyElements();applyHazards();routeLocation();
})();
