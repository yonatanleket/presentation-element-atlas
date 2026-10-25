#!/usr/bin/env node
import { validateHazards } from './hazards.mjs';
if (process.argv.slice(2).some(a => a !== '--strict-demos')) { console.error('Usage: node scripts/hazards-validate.mjs [--strict-demos]'); process.exit(2); }
try {
  const result = validateHazards({ strictDemos: process.argv.includes('--strict-demos') });
  console.log(`Hazards: ${result.counts.hazards} | auto rules: ${result.counts.auto} | pending demos: ${result.missingDemos.length}`);
  if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
  else console.log(result.missingDemos.length ? 'Metadata OK; demo acceptance pending' : 'Metadata and demo file presence OK; rendered/evidence acceptance separate');
} catch (error) { console.error(error.message); process.exitCode = 2; }
