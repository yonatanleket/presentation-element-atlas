#!/usr/bin/env node
// Regression tests through the public validator and CLI. Node >=18; no dependencies.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, readJSON, checkSchema } from './lib.mjs';
import { validateAtlas } from './validation.mjs';
import { testHazards } from '../tests/hazards/test.mjs';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-validator-'));
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }
const base = readJSON('tests/validator/valid-element.json');
const file = path.join(root, 'elements', `${base.id}.json`);
const demo = path.join(root, base.demo.file);
const originalDemo = fs.readFileSync(path.join(ROOT, base.demo.file), 'utf8');
function write(record = base) { fs.writeFileSync(file, JSON.stringify(record)); fs.writeFileSync(demo, originalDemo); }
function result(strict = true) { return validateAtlas({ root, strict }); }
function cli(args) { return spawnSync(process.execPath, [path.join(ROOT, 'scripts/validate.mjs'), '--root', root, ...args], { encoding: 'utf8' }); }
try {
  for (const dir of ['elements', 'demos', 'schema']) fs.mkdirSync(path.join(root, dir));
  fs.copyFileSync(path.join(ROOT, 'schema/element.schema.json'), path.join(root, 'schema/element.schema.json'));
  for (const name of ['categories', 'sources']) fs.copyFileSync(path.join(ROOT, `${name}.json`), path.join(root, `${name}.json`));
  fs.writeFileSync(path.join(root, 'triggers.json'), JSON.stringify(base.trigger.map(id => ({ id }))));
  write();
  test('valid fixture accepted by module and strict CLI', () => { assert.deepEqual(result().errors, []); assert.equal(cli(['--strict']).status, 0); });
  for (const fixture of readJSON('tests/validator/invalid-records.json')) {
    test(fixture.name, () => {
      let record = structuredClone(base);
      const { remove, replace, ...patch } = fixture.mutation;
      if ('replace' in fixture.mutation) record = replace;
      else { for (const [key, value] of Object.entries(patch)) Object.defineProperty(record, key, { value, enumerable: true, configurable: true, writable: true }); if (remove) delete record[remove]; }
      write(record);
      assert.ok(result().errors.some(error => error.includes(fixture.expected)), JSON.stringify(result().errors));
      const run = cli(['--strict']); assert.equal(run.status, 1, run.stderr);
    });
  }
  write();
  test('missing demo is strict-only failure', () => { fs.unlinkSync(demo); assert.deepEqual(result(false).errors, []); assert.ok(result().errors.some(e => e.includes('is missing'))); });
  for (const [name, change, expected] of [
    ['harness missing', s => s.replace('src="_harness.js"', 'src="bad.js"'), 'demo must link'],
    ['external asset', s => s + '<img src="https://example.invalid/image.png">', 'must be self-contained'],
    ['CSS resource', s => s + '<style>@import "https://example.invalid/test.css";</style>', 'CSS resource'],
    ['dark theme', s => s + '<style>@media(prefers-color-scheme:dark){}</style>', 'dark-theme'],
    ['missing init', s => s.replace('AtlasDemo.init(', 'Wrong.init('), 'call AtlasDemo.init'],
    ['mismatched note', s => s.replace(base.demo.how, 'A different note.'), 'differs from demo.how']
  ]) test(name, () => { write(); fs.writeFileSync(demo, change(originalDemo)); assert.ok(result().errors.some(e => e.includes(expected)), JSON.stringify(result().errors)); });
  test('malformed JSON gives validation exit 1', () => { write(); fs.writeFileSync(file, '{bad'); assert.equal(cli(['--strict']).status, 1); });
  test('duplicate names rejected', () => { write(); const p = path.join(root, 'elements', 'other.json'); fs.writeFileSync(p, JSON.stringify({ ...base, id: 'other' })); assert.ok(result().errors.some(e => e.includes('duplicates'))); fs.unlinkSync(p); });
  test('unsupported CLI arguments exit 2', () => assert.equal(cli(['--surprise']).status, 2));
  test('schema nested item types rejected', () => assert.ok(checkSchema([1], { type: 'array', items: { type: 'string' } }).length));
  test('catalog strict validation', () => assert.deepEqual(validateAtlas({ strict: true }).errors, []));
  const hazardPassed = testHazards();
  console.log(`OK: ${passed} validator regression tests; ${hazardPassed} hazard regression tests`);
  for (const suite of ['tests/hazards/pairs.test.mjs', 'tests/integrity/test.mjs', 'tests/lint/test.mjs']) {
    const run = spawnSync(process.execPath, [suite], { cwd: ROOT, stdio: 'inherit' });
    assert.equal(run.status, 0, `${suite} failed`);
  }
  console.log('OK: validator, hazards, frozen pairs, integrity and lint suites');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
