import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { ROOT, readJSON } from '../../scripts/lib.mjs';
import { HAZARD_IDS } from '../../scripts/hazards.mjs';
import { renderHazardDeck } from '../../scripts/hazards-render.mjs';
import { verifyDeckFiles } from '../../scripts/deck/verify.mjs';
const hash = data => createHash('sha256').update(data).digest('hex');
export function testHazardPairs() {
  const results = [];
  for (const id of HAZARD_IDS) {
    const dir = path.join(ROOT, 'tests/hazards/pairs', id), before = path.join(dir, 'before.html'), after = path.join(dir, 'after.html');
    const inventory = fs.readFileSync(path.join(ROOT, 'hazard-specimens', id + '.json'));
    const manifest = readJSON(`tests/hazards/pairs/${id}/manifest.json`), spec = JSON.parse(inventory);
    assert.equal(hash(fs.readFileSync(before)), manifest.baselineHash, `${id}: original changed`);
    assert.equal(hash(inventory), manifest.inventoryHash, `${id}: authored inventory changed without new reference review`);
    // A candidate may rewrap the same protected evidence; never rewrite its trusted original.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-hazard-before-'));
    try {
      const rendered = path.join(tmp, 'rendered.html'); fs.writeFileSync(rendered, renderHazardDeck(spec, 'before'));
      const beforeResult = verifyDeckFiles(before, rendered);
      assert.equal(beforeResult.exitCode, 0, `${id}: Before evidence differs from original: ${JSON.stringify(beforeResult.diagnostics)}`);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    assert.equal(renderHazardDeck(spec, 'after') + '\n', fs.readFileSync(after, 'utf8'), `${id}: After renderer differs from frozen expected snapshot`);
    const options = {};
    if (fs.existsSync(path.join(dir, 'citation.json'))) options.citation = path.join(dir, 'citation.json');
    if (fs.existsSync(path.join(dir, 'appendix.json'))) options.appendix = path.join(dir, 'appendix.json');
    const control = verifyDeckFiles(before, before);
    assert.equal(control.exitCode, 0, `${id}: original invalid: ${JSON.stringify(control.diagnostics)}`);
    const result = verifyDeckFiles(before, after, options);
    assert.equal(result.exitCode, 0, `${id}: pair integrity: ${JSON.stringify(result.diagnostics)}`);
    if (Object.keys(options).length) assert.notEqual(verifyDeckFiles(before, after).exitCode, 0, `${id}: policy repair incorrectly accepted by default`);
    results.push({ id, exitCode: result.exitCode, counts: result.counts, repairs: result.repairs, policies: result.policies, limitation: result.coverage.limitation });
    console.log(`PASS hazard pair: ${id} (structural only)`);
  }
  return results;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.join(ROOT, 'tests/hazards/pairs.test.mjs')) {
  const results = testHazardPairs(); console.log(`OK: ${results.length} frozen hazard pairs; browser reachability/legibility pending`);
}
