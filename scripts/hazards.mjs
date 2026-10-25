// Hazard metadata foundation. Runtime Node >=18; no dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJSON, checkSchema, loadAtlas } from './lib.mjs';
export const HAZARD_IDS = Object.freeze(['wall-of-text', 'bullet-overload', 'topic-title', 'unsourced-number', 'time-slot-overload', 'chart-without-takeaway', 'three-dimensional-pie', 'unlabeled-axis', 'rainbow-palette', 'small-body-text', 'repetitive-layout', 'transition-overload', 'filler-agenda', 'buried-decision', 'unqualified-metric']);
export const AUTO_RULE_IDS = Object.freeze(HAZARD_IDS.slice(0, 5));
export function loadHazards(root = ROOT) {
  const hazards = [], parseErrors = [];
  for (const file of fs.readdirSync(path.join(root, 'hazards')).filter(f => f.endsWith('.json')).sort()) {
    try { hazards.push({ file, data: JSON.parse(fs.readFileSync(path.join(root, 'hazards', file), 'utf8')) }); }
    catch (error) { parseErrors.push(`${file}: invalid JSON (${error.message})`); }
  }
  return { hazards, parseErrors, schema: readJSON('schema/hazard.schema.json', root) };
}
export function validateHazards({ root = ROOT, strictDemos = false } = {}) {
  const { hazards, parseErrors, schema } = loadHazards(root);
  const elementIds = new Set(loadAtlas(root).elements.map(e => e.data?.id));
  const errors = [...parseErrors], missingDemos = [], seen = new Set(), names = new Set();
  const reverseLinks = {};
  for (const { file, data: hazard } of hazards) {
    const err = m => errors.push(`${file}: ${m}`);
    checkSchema(hazard, schema).forEach(err);
    if (!hazard || typeof hazard !== 'object' || Array.isArray(hazard)) continue;
    if (hazard.id !== path.basename(file, '.json')) err('id must equal filename');
    if (!HAZARD_IDS.includes(hazard.id)) err('id is not in the approved M1 set');
    if (seen.has(hazard.id)) err('duplicate hazard id'); seen.add(hazard.id);
    const name = String(hazard.name || '').toLowerCase();
    if (names.has(name)) err('duplicate hazard name'); names.add(name);
    if (hazard.axis === 'auto') {
      if (!AUTO_RULE_IDS.includes(hazard.id) || hazard.ruleId !== hazard.id) err('auto hazard must use its approved ruleId equal to id');
    } else {
      if ('ruleId' in hazard) err('ruleId exists only on auto hazards');
      if (AUTO_RULE_IDS.includes(hazard.id)) err('approved auto hazard must retain auto axis');
    }
    for (const id of Array.isArray(hazard.fixedBy) ? hazard.fixedBy : []) {
      if (!elementIds.has(id)) err(`fixedBy "${id}" is not an element id`);
      else (reverseLinks[id] ||= []).push(hazard.id);
    }
    if (hazard.demo && typeof hazard.demo === 'object' && typeof hazard.demo.file === 'string') {
      const expected = `hazard-demos/${hazard.id}.html`;
      if (hazard.demo.file !== expected) err(`demo.file must be "${expected}"`);
      if (!fs.existsSync(path.join(root, expected))) missingDemos.push(hazard.id);
    }
  }
  for (const id of HAZARD_IDS) if (!seen.has(id)) errors.push(`hazards: approved entry "${id}" is missing`);
  if (hazards.length !== 15) errors.push(`hazards: expected exactly 15 records, got ${hazards.length}`);
  if (strictDemos) for (const id of missingDemos) errors.push(`${id}: hazard demo is missing`);
  for (const ids of Object.values(reverseLinks)) ids.sort((a, b) => HAZARD_IDS.indexOf(a) - HAZARD_IDS.indexOf(b));
  return { errors, missingDemos, hazards, reverseLinks, counts: { hazards: hazards.length, auto: hazards.filter(h => h.data?.axis === 'auto').length } };
}
