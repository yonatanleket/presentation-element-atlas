// Shared loading helpers for validate.mjs and build.mjs. Node >= 18, no dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const readJSON = (p, root = ROOT) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
export const SCHEMA_VERSION = '1.0.0';

export function loadAtlas(root = ROOT) {
  const dir = path.join(root, 'elements');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  const elements = [];
  const parseErrors = [];
  for (const f of files) {
    try { elements.push({ file: f, data: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }); }
    catch (e) { parseErrors.push(`${f}: invalid JSON (${e.message})`); }
  }
  return {
    elements, parseErrors,
    categories: readJSON('categories.json', root),
    triggers: readJSON('triggers.json', root),
    sources: readJSON('sources.json', root),
    schema: readJSON('schema/element.schema.json', root)
  };
}

// Minimal JSON Schema subset: type, required, properties, additionalProperties:false,
// enum, pattern, minLength, maxLength, minItems, maxItems, uniqueItems, items.
export function checkSchema(value, schema, at = '') {
  const errs = [];
  const t = schema.type;
  const actual = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
  if (t && actual !== t) return [`${at || '(root)'}: expected ${t}, got ${actual}`];
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${at}: "${value}" not one of ${schema.enum.join(', ')}`);
  if (t === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errs.push(`${at}: shorter than ${schema.minLength}`);
    if (schema.maxLength != null && value.length > schema.maxLength) errs.push(`${at}: longer than ${schema.maxLength} (${value.length})`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${at}: "${value}" does not match ${schema.pattern}`);
  }
  if (t === 'array') {
    if (schema.minItems != null && value.length < schema.minItems) errs.push(`${at}: needs at least ${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) errs.push(`${at}: at most ${schema.maxItems} items`);
    if (schema.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) errs.push(`${at}: items must be unique`);
    if (schema.items) value.forEach((v, i) => errs.push(...checkSchema(v, schema.items, `${at}[${i}]`)));
  }
  if (t === 'object') {
    for (const k of schema.required || []) if (!Object.hasOwn(value, k)) errs.push(`${at ? at + '.' : ''}${k}: required`);
    for (const [k, v] of Object.entries(value)) {
      const sub = schema.properties && Object.hasOwn(schema.properties, k) ? schema.properties[k] : undefined;
      if (sub) errs.push(...checkSchema(v, sub, at ? `${at}.${k}` : k));
      else if (schema.additionalProperties === false) errs.push(`${at ? at + '.' : ''}${k}: unknown field`);
    }
  }
  return errs;
}
