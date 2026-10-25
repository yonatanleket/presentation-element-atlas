#!/usr/bin/env node
// Optional test tooling: installed Playwright and a Chrome executable. No runtime dependencies.
// Usage documented in tests/contrast/README.md. Never returns an all-state AA pass.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadAtlas } from './lib.mjs';
import { scanTextContrast } from './contrast-browser.mjs';
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i++) {
  if (['--playwright', '--browser', '--report', '--only'].includes(args[i]) && args[i + 1]) options[args[i].slice(2)] = args[++i];
  else if (args[i] === '--self-test') options.selfTest = true;
  else { console.error('Usage: node scripts/check-contrast.mjs --playwright <module> --browser <executable> [--report <json>] [--self-test] [--only <id,id>]'); process.exit(2); }
}
const reportPath = path.resolve(options.report || path.join(ROOT, 'work/team-workflow/impeccable-m1/contrast-report.json'));
const report = { checker: 'Atlas Rendered Contrast', version: '1.0.2', timestamp: new Date().toISOString(), status: 'incomplete', limitations: [
  'Computed DOM text/background colors only; no pixel sampling. Transparent ancestor backgrounds are composited over white.',
  'Sibling backing layers, pseudo-element text and native control text are not proven by this checker.',
  'Required UI indicators, focus rings, charts and nontext contrast require independent assessment.',
  'Gradients/images, opacity/filter/blend groups, SVG text, overlap and offscreen text are unmeasurable.',
  'Timeline frames are deterministic; transient animations, hover/focus, arbitrary interactive paths are not exhausted.'
], demos: [], failures: [], unmeasurable: [] };
let browser;
try {
  if (!options.playwright || !options.browser) throw new Error('Provide installed test-tool module via --playwright and executable via --browser; no browser measurement has run.');
  const pw = await import(pathToFileURL(path.resolve(options.playwright)).href);
  browser = await pw.chromium.launch({ executablePath: path.resolve(options.browser), headless: true });
  report.browser = browser.version();
  report.playwright = { module: path.resolve(options.playwright), version: JSON.parse(fs.readFileSync(path.join(path.dirname(path.resolve(options.playwright)), 'package.json'), 'utf8')).version };
  if (options.selfTest) {
    const page = await browser.newPage();
    await page.setContent(fs.readFileSync(path.join(ROOT, 'tests/contrast/specimens.html'), 'utf8'));
    const scan = await page.evaluate(scanTextContrast);
    const find = (id, kind) => scan.issues.some(i => i.target === '#' + id && i.kind === kind);
    for (const [id, kind] of [['fail', 'failure'], ['gradient', 'unmeasurable'], ['opacity', 'unmeasurable'], ['svg-text', 'unmeasurable'], ['text-fill', 'unmeasurable'], ['text-stroke', 'unmeasurable'], ['sibling-gradient', 'unmeasurable'], ['sibling-svg', 'unmeasurable']]) if (!find(id, kind)) throw new Error(`Self-test missed ${id} / ${kind}`);
    for (const id of ['pass', 'large', 'alpha']) if (scan.issues.some(i => i.target === '#' + id) || !scan.measurements.some(i => i.target === '#' + id)) throw new Error(`Self-test rejected or skipped ${id}`);
    report.selfTest = '11 known pass/fail/unsupported specimens accepted'; await page.close();
  }
  const atlas = loadAtlas();
  const selectedIds = options.only ? options.only.split(',') : atlas.elements.map(e => e.data.id);
  if (new Set(selectedIds).size !== selectedIds.length || selectedIds.some(id => !atlas.elements.some(e => e.data.id === id))) throw new Error('--only must name unique existing demo IDs');
  report.selection = { ids: selectedIds, totalAvailable: atlas.elements.length, scope: options.only ? 'targeted recheck' : 'all demos' };
  for (const { data: demo } of atlas.elements.filter(e => selectedIds.includes(e.data.id))) {
    const entry = { id: demo.id, snapshots: [], errors: [] }; report.demos.push(entry);
    for (const width of [600, 390]) for (const motion of ['no-preference', 'reduce']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: motion });
      // Block all network; only local files/data URLs belong to standalone demos.
      await context.route(/https?:\/\//, route => route.abort());
      const page = await context.newPage();
      page.on('pageerror', error => entry.errors.push(error.message));
      await page.addInitScript(() => {
        let atlas;
        Object.defineProperty(window, 'AtlasDemo', { configurable: true, get: () => atlas, set(value) {
          atlas = value; const original = value.init;
          value.init = opts => { const render = opts.render; const controller = original({ ...opts, autoplay: false, render(n, ctx) { ctx.animate = false; if (render) render(n, ctx); } }); window.__atlasAudit = { controller, frames: opts.frames || 0 }; return controller; };
        } });
      });
      await page.goto(pathToFileURL(path.join(ROOT, demo.demo.file)).href);
      await page.waitForFunction(() => window.__atlasAudit, undefined, { timeout: 5000 });
      await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
      const frames = await page.evaluate(() => window.__atlasAudit.frames);
      for (let frame = 0; frame <= frames; frame++) {
        await page.evaluate(n => window.__atlasAudit.controller.goto(n), frame);
        const scan = await page.evaluate(scanTextContrast);
        const state = { width, motion, frame };
        entry.snapshots.push({ ...state, measured: scan.measurements.length, failures: scan.issues.filter(i => i.kind === 'failure').length, unmeasurable: scan.issues.filter(i => i.kind === 'unmeasurable').length });
        for (const issue of scan.issues) (issue.kind === 'failure' ? report.failures : report.unmeasurable).push({ demo: demo.id, ...state, ...issue });
      }
      await context.close();
    }
    console.log(`${demo.id}: ${entry.snapshots.length} rendered timeline snapshots`);
  }
  report.summary = { demos: report.demos.length, snapshots: report.demos.reduce((n, d) => n + d.snapshots.length, 0), measuredTextNodes: report.demos.reduce((n, d) => n + d.snapshots.reduce((m, s) => m + s.measured, 0), 0), failures: report.failures.length, unmeasurable: report.unmeasurable.length, runtimeErrors: report.demos.reduce((n, d) => n + d.errors.length, 0) };
  process.exitCode = report.failures.length ? 1 : 2;
} catch (error) { report.error = error.message; process.exitCode = 2; }
finally {
  if (browser) await browser.close();
  fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ report: reportPath, status: report.status, summary: report.summary, error: report.error }));
}
