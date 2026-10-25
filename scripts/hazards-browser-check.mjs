#!/usr/bin/env node
// Optional Playwright browser evidence, using immutable fixture originals rather than candidate metadata.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, readJSON } from './lib.mjs';
import { HAZARD_IDS } from './hazards.mjs';
import { stageText } from './hazards-render.mjs';
import { verifyDeckFiles } from './deck/verify.mjs';
import { scanTextContrast } from './contrast-browser.mjs';
const opts = {}, args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (['--playwright', '--browser', '--report', '--only'].includes(args[i]) && args[i + 1]) opts[args[i].slice(2)] = args[++i];
  else { console.error('Usage: node scripts/hazards-browser-check.mjs --playwright <module> --browser <executable> [--report <json>] [--only <id,id>]'); process.exit(2); }
}
const output = path.resolve(opts.report || path.join(ROOT, 'work/team-workflow/impeccable-m1/hazard-browser-report.json'));
const artifacts = path.join(path.dirname(output), 'hazard-browser-artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const report = { checker: 'Atlas hazard browser check', version: '1.0.0', status: 'incomplete', entries: [], limitations: ['Text contrast is bounded by Atlas Rendered Contrast1.0.2; required UI indicators and pixel backgrounds need review.', 'Structural integrity compares each actual default selected root before opening details; expanded native open attributes are outside parser v1.', 'No automatic audience-comprehension claim. All15 need independent visual review.'] };
let browser;
try {
  if (!opts.playwright || !opts.browser) throw new Error('Explicit installed Playwright module and Chrome executable required');
  const pw = await import(pathToFileURL(path.resolve(opts.playwright)).href);
  browser = await pw.chromium.launch({ executablePath: path.resolve(opts.browser), headless: true }); report.browser = browser.version();
  const selected = opts.only ? opts.only.split(',') : HAZARD_IDS;
  if (new Set(selected).size !== selected.length || selected.some(id => !HAZARD_IDS.includes(id))) throw new Error('--only must list unique approved hazard IDs');
  report.selection = { ids: selected, totalAvailable: HAZARD_IDS.length };
  for (const id of selected) for (const width of [600, 390]) for (const motion of ['no-preference', 'reduce']) {
    const entry = { id, width, motion, errors: [], states: [] }; report.entries.push(entry);
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: motion });
    await context.route(/https?:\/\//, route => route.abort());
    const page = await context.newPage(); page.on('pageerror', error => entry.errors.push(error.message));
    try {
      await page.goto(pathToFileURL(path.join(ROOT, 'hazard-demos', id + '.html')).href);
      if (await page.locator('[data-atlas-deck]').count() !== 1) throw new Error('Expected exactly one mounted selected deck root');
      if (await page.evaluate(() => window.AtlasHazard.state) !== 'before') throw new Error('Default state must be Before');
      const pairDir = path.join(ROOT, 'tests/hazards/pairs', id), original = path.join(pairDir, 'before.html'), policy = {};
      if (fs.existsSync(path.join(pairDir, 'citation.json'))) policy.citation = path.join(pairDir, 'citation.json');
      if (fs.existsSync(path.join(pairDir, 'appendix.json'))) policy.appendix = path.join(pairDir, 'appendix.json');
      for (const state of ['before', 'after']) {
        if (state === 'after') { await page.locator('[data-state="after"]').focus(); await page.keyboard.press('Enter'); }
        if (await page.locator('[data-atlas-deck]').count() !== 1) throw new Error(`${state}: duplicate deck roots`);
        const serialized = await page.evaluate(() => window.AtlasHazard.serialize());
        const file = path.join(artifacts, `${id}-${width}-${motion}-${state}.html`); fs.writeFileSync(file, serialized);
        const result = verifyDeckFiles(original, file, state === 'after' ? policy : {});
        if (result.exitCode) throw new Error(`${state}: actual DOM integrity ${JSON.stringify(result.diagnostics)}`);
        entry.states.push({ state, integrityExit: result.exitCode, counts: result.counts, repairs: result.repairs, serialized: file });
      }
      if (await page.evaluate(() => document.activeElement?.getAttribute('data-state')) !== 'after') throw new Error('Keyboard toggle moved focus');
      if (await page.locator('[data-state="after"]').getAttribute('aria-pressed') !== 'true') throw new Error('After pressed state missing');
      const minimumTextSize = await page.locator('.stage [data-atlas-claim],.stage [data-atlas-copy],.stage [data-atlas-source],.stage [data-atlas-fact]').evaluateAll(nodes => Math.min(...nodes.map(n => parseFloat(getComputedStyle(n).fontSize))));
      entry.minimumFixedTextSize = minimumTextSize;
      if (minimumTextSize < 12) throw new Error(`Fixed stage text below12px: ${minimumTextSize}`);
      if (id === 'filler-agenda') {
        if (await page.locator('[data-agenda-index][aria-current="step"]').count() !== 1 || await page.locator('.stage .agenda .current-section').count() !== 1) throw new Error('Current agenda marker missing');
        await page.locator('[data-agenda-index="2"]').click();
        if (await page.locator('[data-agenda-index="2"]').getAttribute('aria-current') !== 'step' || !(await page.locator('.stage .current-section').textContent()).includes('Agree the review')) throw new Error('Agenda section route did not update marker');
        entry.agendaMarker = 'initial and selected section marker passed';
        if (width === 600 && motion === 'no-preference') await page.locator('.stage').screenshot({ path: path.join(artifacts, 'filler-agenda-marker-after.png') });
      }
      if (id === 'time-slot-overload') {
        await page.locator('[data-appendix-slide="slide-3"]').click();
        const reached = await page.evaluate(() => { const stage=document.querySelector('.stage'),slide=document.getElementById('slide-3'),label=stage.querySelector('.appendix-boundary');const box=stage.getBoundingClientRect(),s=slide.getBoundingClientRect(),l=label?.getBoundingClientRect();return stage.scrollTop>0&&s.top>=box.top&&s.top<box.bottom&&l&&l.top>=box.top&&l.bottom<box.bottom; });
        if (!reached || !(await page.locator('#appendix-status').textContent()).startsWith('Appendix:')) throw new Error('Visible appendix boundary/direct route failed');
        entry.appendixRoute = 'boundary and direct backup access passed';
        if (width === 600 && motion === 'no-preference') await page.locator('.stage').screenshot({ path: path.join(artifacts, 'time-slot-appendix-route.png') });
        await page.locator('#main-talk').click(); if (await page.locator('.stage').evaluate(el=>el.scrollTop) !== 0) throw new Error('Main talk return route failed');
      }
      await page.locator('#expand').click();
      if (await page.locator('.stage details:not([open])').count()) throw new Error('Full stage expansion failed');
      const contrast = await page.evaluate(scanTextContrast);
      entry.afterContrast = { measurements: contrast.measurements.length, failures: contrast.issues.filter(i => i.kind === 'failure'), unmeasurable: contrast.issues.filter(i => i.kind === 'unmeasurable') };
      await page.locator('.full-text > summary').click();
      const displayed = await page.locator('.full-text pre').textContent();
      if (displayed !== stageText(readJSON(`hazard-specimens/${id}.json`))) throw new Error('Full-text route changed inventory text');
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Horizontal page overflow');
      if (id === 'transition-overload') { await page.locator('#motion').click(); if (motion === 'reduce' && await page.locator('[data-atlas-deck]').evaluate(el => getComputedStyle(el).animationName) !== 'none') throw new Error('Reduced motion transition active'); }
      await page.locator('[data-state="before"]').click();
      if (await page.locator('[data-atlas-deck]').count() !== 1 || await page.locator('[data-state="before"]').getAttribute('aria-pressed') !== 'true') throw new Error('Return to Before failed');
      if (width === 600 && motion === 'no-preference' && ['topic-title', 'three-dimensional-pie', 'time-slot-overload'].includes(id)) {
        await page.locator('[data-state="after"]').click(); await page.locator('.stage').screenshot({ path: path.join(artifacts, `${id}-after.png`) });
      }
    } catch (error) { entry.errors.push(error.message); }
    finally { await context.close(); }
    console.log(`${id} ${width} ${motion}: ${entry.errors.length ? 'FAILED' : 'checks passed; visual/AA review pending'}`);
  }
  report.summary = { demos: new Set(report.entries.map(e => e.id)).size, scenarios: report.entries.length, serializedStates: report.entries.reduce((n, e) => n + e.states.length, 0), scenarioFailures: report.entries.filter(e => e.errors.length).length, boundedContrastFailures: report.entries.reduce((n, e) => n + (e.afterContrast?.failures.length || 0), 0) };
  process.exitCode = report.summary.scenarioFailures || report.summary.boundedContrastFailures ? 1 : 2;
} catch (error) { report.error = error.message; process.exitCode = 2; }
finally { if (browser) await browser.close(); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ report: output, summary: report.summary, error: report.error, status: report.status })); }
