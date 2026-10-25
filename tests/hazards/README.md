# Hazard specimens and pair checks

`hazard-specimens/<id>.json` is the authored fictional inventory: stable slides, copy/claim/source owners, typed facts and original presentation policy. Labels and explanatory interface text stay outside the compared deck root. `scripts/hazards-render.mjs` renders only the selected state; `scripts/hazards-build.mjs` compiles self-contained `hazard-demos/<id>.html` pages. There is one mounted annotated root, default Before, no autoplay, and native keyboard toggles. Closed stage disclosures have an Open all action and a separate full-text route.

`pairs/<id>/before.html` is a frozen trusted reference, never derived from observed candidate DOM. Its byte hash and original inventory hash are pinned in `manifest.json`. `after.html` is a frozen expected candidate snapshot. Production build/test never invokes `freeze-originals.mjs`; that explicit initial authoring script refuses to overwrite originals. Review evidence/inventory changes before creating a new reference version; do not refresh a baseline merely to make a failing candidate pass.

The only allowed original-authored repairs are the citation map for `unsourced-number` and appendix eligibility for `time-slot-overload`. Policy files pin the original byte hash. No candidate supplies source provenance, and missing source material is never invented. Without those explicit policy files the verifier rejects these repairs. Other specimens keep associations/status unchanged.

```sh
node scripts/hazards-build.mjs
node tests/hazards/pairs.test.mjs
node scripts/hazards-validate.mjs --strict-demos
```

Structural pair checks preserve owners/facts/links/text/associations. They permit presentation rewrapping of the exact evidence. They do not prove visual reachability or comprehension. With explicit installed Playwright/Chrome paths, run the actual selected-root browser check:

```sh
node scripts/hazards-browser-check.mjs --playwright /absolute/path/to/playwright/index.mjs --browser /absolute/path/to/Chrome --report work/team-workflow/impeccable-m1/hazard-browser-report.json
```

The browser runner verifies 120 serialized roots across 15 demos, two widths and two motion settings against the immutable original and selected policies; it separately exercises native keyboard focus/toggle state, full text, details expansion, overflow and reduced motion. Expanded native `open` attributes are outside the current parser grammar, so structural capture occurs before expansion. Functional success still exits 2 with incomplete visual/AA acceptance; detected failures exit 1. Intentionally poor Before presentation is distinct from fixed-state contrast and the original166 positive demos.
