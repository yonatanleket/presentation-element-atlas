// Browser-free freshness and packaging seam for actual demo previews.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export const fileHash = file => hash(fs.readFileSync(file));
export function previewDependencies(group,id) {
  return [group==='entries'?`demos/${id}.html`:`hazard-demos/${id}.html`,'scripts/capture-previews.mjs','scripts/preview-assets.mjs',...(group==='entries'?['demos/_harness.js','demos/_harness.css']:[`hazard-specimens/${id}.json`,'scripts/hazards-render.mjs','scripts/hazards-build.mjs'])];
}
export function sourceFingerprint(root, dependencies, recipe, environment) {
  const dependencyHashes = Object.fromEntries(dependencies.map(file => [file, fileHash(path.join(root,file))]));
  return {dependencyHashes, recipeHash:hash(JSON.stringify(recipe)), sourceHash:hash(JSON.stringify({dependencyHashes,recipe,environment}))};
}
const record = value => value!==null && typeof value==='object' && !Array.isArray(value);
export function loadValidatedPreviews(root) {
  const result={entries:new Map(),hazards:new Map(),warnings:[]};
  let manifest,recipes;
  try { manifest=JSON.parse(fs.readFileSync(path.join(root,'previews/manifest.json'))); recipes=JSON.parse(fs.readFileSync(path.join(root,'preview-recipes.json'))); }
  catch(error){result.warnings.push(`Preview manifest unavailable: ${error.message}`);return result;}
  if(!record(recipes)||!record(recipes.entries)||!record(recipes.hazards)){result.warnings.push('Invalid preview recipes');return result;}
  if(!record(manifest)||manifest.version!==1||!record(manifest.environment)||!record(manifest.entries)||!record(manifest.hazards)){result.warnings.push('Unsupported preview manifest version');return result;}
  for(const group of ['entries','hazards']) for(const [id,entry] of Object.entries(manifest[group]||{})) {
    try {
      if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||entry?.id!==id)throw Error('invalid preview ID');
      if(entry.status!=='ready')throw Error('capture unavailable');
      const recipe=recipes[group][id]; if(!recipe)throw Error('recipe missing');
      const dependencies=previewDependencies(group,id);
      if(JSON.stringify(Object.keys(entry.dependencyHashes||{}).sort())!==JSON.stringify([...dependencies].sort()))throw Error('dependency set mismatch');
      const fresh=sourceFingerprint(root,dependencies,recipe,manifest.environment);
      if(!Array.isArray(entry.images)||entry.images.length!==(group==='hazards'?2:recipe.secondary?2:1))throw Error('invalid image count');
      if(fresh.sourceHash!==entry.sourceHash)throw Error('stale source/recipe/capture dependency');
      const required=group==='hazards'?['before','after']:['representative'];
      for(const state of required)if(!entry.images.some(image=>image.state===state))throw Error(`missing ${state} image`);
      for(const image of entry.images){
        if(!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width!==800||!(recipe.bounds==='full-content'?image.height>=500&&image.height<=2400:[500,501].includes(image.height))||!Number.isInteger(image.bytes)||image.bytes<1)throw Error('invalid image dimensions/size');
        if(!/^previews\/(elements|hazards)\/[a-z0-9-]+\.png$/.test(image.src))throw Error('unsafe asset path');
        const data=fs.readFileSync(path.join(root,image.src));
        if(data.toString('hex',0,8)!=='89504e470d0a1a0a'||data.readUInt32BE(16)!==image.width||data.readUInt32BE(20)!==image.height||hash(data)!==image.sha256||data.length!==image.bytes)throw Error('asset dimensions/hash/bytes mismatch');
      }
      result[group].set(id,entry);
    }catch(error){result.warnings.push(`${group}/${id}: ${error.message}`);}
  }
  for(const group of ['entries','hazards']) for(const id of Object.keys(recipes[group]))if(!manifest[group]?.[id])result.warnings.push(`${group}/${id}: capture missing`);
  return result;
}
export function copyPreviewAssets(root,outDir,assets){
  for(const group of ['entries','hazards'])for(const entry of assets[group].values())for(const image of entry.images){const target=path.join(outDir,image.src);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,image.src),target);}
}
