import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from '../../scripts/lib.mjs';
import { validateHazards } from '../../scripts/hazards.mjs';
export function testHazards() {
  let passed = 0;
  const test = (name, fn) => { fn(); passed++; console.log(`PASS hazards: ${name}`); };
  const baseline = validateHazards();
  test('all approved15 metadata accepted and reverse links derived', () => {
    assert.deepEqual(baseline.errors, []); assert.equal(baseline.counts.auto, 5);
    assert.ok(baseline.reverseLinks['kicker-action-title-lede'].includes('topic-title'));
  });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-hazards-'));
  try {
    for (const dir of ['hazards', 'elements', 'schema']) fs.cpSync(path.join(ROOT, dir), path.join(root, dir), { recursive: true });
    for (const file of ['categories.json', 'triggers.json', 'sources.json']) fs.copyFileSync(path.join(ROOT, file), path.join(root, file));
    const file = path.join(root, 'hazards', 'topic-title.json'), original = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [name, mutation, expected] of [
      ['null record', () => null, 'expected object'],
      ['unsupported version', h => ({ ...h, schemaVersion: '2.0.0' }), 'schemaVersion:'],
      ['missing mode', h => { delete h.severityByMode.pitch; return h; }, 'pitch: required'],
      ['unknown mode', h => { h.severityByMode.extra = 'high'; return h; }, 'extra: unknown field'],
      ['bad severity', h => { h.severityByMode.pitch = 'critical'; return h; }, 'pitch:'],
      ['broken fixing element', h => ({ ...h, fixedBy: ['missing'] }), 'not an element id'],
      ['empty fixing elements', h => ({ ...h, fixedBy: [] }), 'at least 1'],
      ['duplicate fixing element', h => ({ ...h, fixedBy: [h.fixedBy[0], h.fixedBy[0]] }), 'must be unique'],
      ['wrong rule ID', h => ({ ...h, ruleId: 'wall-of-text' }), 'approved ruleId'],
      ['auto axis changed', h => ({ ...h, axis: 'judgment' }), 'retain auto axis'],
      ['wrong demo path', h => ({ ...h, demo: { ...h.demo, file: 'hazard-demos/wrong.html' } }), 'demo.file must be'],
      ['unknown field', h => ({ ...h, surprise: true }), 'unknown field']
    ]) test(name, () => { fs.writeFileSync(file, JSON.stringify(mutation(structuredClone(original)))); assert.ok(validateHazards({ root }).errors.some(e => e.includes(expected))); });
    for (const key of ['__proto__', 'constructor', 'toString']) for (const nested of [false, true]) {
      test(`hostile ${nested ? 'mode' : 'root'} key ${key}`, () => {
        const record = structuredClone(original), target = nested ? record.severityByMode : record;
        Object.defineProperty(target, key, { value: 'high', enumerable: true });
        fs.writeFileSync(file, JSON.stringify(record));
        assert.ok(validateHazards({ root }).errors.some(e => e.includes(`${nested ? 'severityByMode.' : ''}${key}: unknown field`)));
      });
    }
    fs.writeFileSync(file, JSON.stringify(original));
    test('strict demo gate remains failed before pairs exist', () => assert.ok(validateHazards({ root, strictDemos: true }).errors.some(e => e.includes('hazard demo is missing'))));
    test('missing approved entry rejected', () => { fs.unlinkSync(file); assert.ok(validateHazards({ root }).errors.some(e => e.includes('approved entry "topic-title" is missing'))); });
    return passed;
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
