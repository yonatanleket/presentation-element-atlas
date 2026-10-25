#!/usr/bin/env node
// Usage: node scripts/validate.mjs [--strict] [--root <atlas-directory>]
import path from 'node:path';
import { ROOT } from './lib.mjs';
import { validateAtlas } from './validation.mjs';
const args = process.argv.slice(2);
let strict = false, root = ROOT;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--strict') strict = true;
  else if (args[i] === '--root' && args[i + 1] && !args[i + 1].startsWith('--')) root = path.resolve(args[++i]);
  else { console.error('Usage: node scripts/validate.mjs [--strict] [--root <atlas-directory>]'); process.exit(2); }
}
try {
  const { errors, missingDemos, counts: c } = validateAtlas({ root, strict });
  console.log(`Elements: ${c.elements} | categories: ${c.categories} | trigger tags: ${c.triggers} | sources: ${c.sources}`);
  console.log(`Demos present: ${c.elements - missingDemos.length} | missing: ${missingDemos.length}${strict ? '' : ' (not a failure without --strict)'}`);
  if (errors.length) { console.error(`\n${errors.length} error(s):\n` + errors.map(e => '  - ' + e).join('\n')); process.exitCode = 1; }
  else console.log('OK');
} catch (error) { console.error(`Cannot validate atlas: ${error.message}`); process.exitCode = 2; }
