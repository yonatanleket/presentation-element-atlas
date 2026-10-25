// Explicit fixture-authoring step. Refuses to overwrite any existing trusted original.
// Production build/test never invokes this script or derives references from candidate DOM.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, readJSON } from '../../scripts/lib.mjs';
import { HAZARD_IDS } from '../../scripts/hazards.mjs';
import { renderHazardDeck } from '../../scripts/hazards-render.mjs';
for (const id of HAZARD_IDS) {
  const spec = readJSON(`hazard-specimens/${id}.json`), dir = path.join(ROOT, 'tests/hazards/pairs', id);
  if (fs.existsSync(path.join(dir, 'before.html'))) throw new Error(`Original already frozen: ${id}`);
  fs.mkdirSync(dir, { recursive: true });
  const before = renderHazardDeck(spec, 'before') + '\n', after = renderHazardDeck(spec, 'after') + '\n';
  fs.writeFileSync(path.join(dir, 'before.html'), before, { flag: 'wx' });
  fs.writeFileSync(path.join(dir, 'after.html'), after, { flag: 'wx' });
  const baselineHash = createHash('sha256').update(before).digest('hex');
  const inventoryHash = createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'hazard-specimens', id + '.json'))).digest('hex');
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ id, fictional: true, baselineHash, inventoryHash, provenance: 'Authored fictional inventory and original presentation policy; never derived from candidate DOM.' }, null, 2) + '\n');
  if (spec.citationRepair) fs.writeFileSync(path.join(dir, 'citation.json'), JSON.stringify({ baselineHash, factSources: spec.citationRepair }, null, 2) + '\n');
  if (spec.appendixEligibleSlideIds) fs.writeFileSync(path.join(dir, 'appendix.json'), JSON.stringify({ baselineHash, appendixEligibleSlideIds: spec.appendixEligibleSlideIds }, null, 2) + '\n');
}
console.log('Frozen15 authored original pairs and original-provenance hashes.');
