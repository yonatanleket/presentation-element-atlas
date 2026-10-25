# Presentation Element Atlas

An open catalog of slide elements: what each one is, when to use it, and a live demo of how it works. It covers 166 elements in 12 categories, from progress bars and KPI tiles to sankeys, explorable sliders and audience polls.

Use it to pick the right element for a slide, to share a vocabulary with the people you build decks with, or to copy a working demo into your own talk.

## Browse

Open `dist/index.html` in a browser. It works straight from disk or from any static host. No server or install is needed.

- **Search** matches names, definitions, "best for" text and aliases. Press Esc to clear it.
- **Standard / Advanced** filters by level. Advanced elements are interactive or less common.
- **Categories** in the desktop sidebar narrow the list; on mobile, open the Categories disclosure.
- **Try demo** opens a centered inspector with the element's live demo. Use the previous/next buttons to step through current results, and Esc or Back to close. Definitions and Best for remain beside the live demo.
- **Deep links:** `dist/index.html#kpi-tile` opens that element's demo directly. The hash is the element id.

## How it is organized

```
elements/<id>.json        one file per element (the source of truth)
demos/<id>.html           one live demo per element
demos/_harness.css|js     the shared demo frame every demo uses
categories.json           the 12 categories
triggers.json             controlled list of content-type tags (what kind of content an element suits)
sources.json              references cited by elements ("common" = common practice)
schema/element.schema.json  JSON Schema for element files
templates/                copyable element.json and demo.html
scripts/validate.mjs      checks every element file
scripts/build.mjs         generates dist/
dist/                     the generated catalog (committed, so it can be browsed without building)
```

Each element file lists the content types it suits in `trigger` (for example `single-key-number`, `trend-over-time` or `options-comparison`). Tools can read `elements/*.json` to suggest elements for a given slide.

## Build

Requires Node 18 or later. There are no dependencies to install.

```sh
node scripts/validate.mjs           # schema and cross-file checks; missing demos are counted, not failed
node scripts/validate.mjs --strict  # also fails on missing demos
node scripts/build.mjs              # writes dist/index.html and dist/demos/
```

Adding one valid file to `elements/` and rebuilding adds exactly one card.

## Real specimen previews

Cards use inert, 800px-wide captures of each actual demo stage, with labeled full-content overview exceptions, with authored state recipes in `preview-recipes.json`. Motion and interactive specimens carry a text cue; use Try demo to explore behavior. Pointing at an element poster with a mouse mounts one sandboxed quick-play frame over the still after a short delay, and it is unmounted when the pointer leaves; keyboard focus never loads a frame, and reduced-motion or touch devices keep the still. Only one sandboxed live frame is mounted at a time.

The optional authoring command `node scripts/capture-previews.mjs --playwright /absolute/path/to/playwright/index.mjs --browser /absolute/path/to/Chrome` regenerates `previews/manifest.json` and content-addressed PNGs. Capture requires an existing Playwright/browser installation; browsing and building require no install. Build validates source, harness, recipe and capture-environment fingerprints plus asset hashes, dimensions and byte lengths, then copies valid images into `dist/previews/`. Missing, stale or broken captures show **Preview unavailable** while Try demo remains usable. The first six element images load eagerly; remaining images use native lazy loading with reserved 16:10 dimensions. Captures add bytes over the previous SVG motifs; no speed improvement is claimed.

## Demo status

Every element has a live demo: all 166 run in the catalog panel and on their own from `dist/demos/`. If you add an element without a demo, its panel shows "No demo yet" until you add `demos/<id>.html`.

## Contributing

New elements, demos and fixes are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the steps, the checklist and the demo authoring guide.

## License

[MIT](LICENSE) © 2026 Presentation Element Atlas contributors. Sample numbers in demos are invented and labeled "Illustrative".

## Verification

Run `node scripts/test.mjs` for validator regression fixtures, `node scripts/validate.mjs --strict` for all source records and demos, and `node scripts/build.mjs` to regenerate the catalog. Element format compatibility follows [the version policy](schema/README.md).

Optional browser contrast measurement is documented in [tests/contrast/README.md](tests/contrast/README.md). Its report distinguishes measured failures from unmeasurable cases and incomplete interaction/nontext coverage; it cannot certify AA on its own.

## Slide problems

Switch between Elements and Slide problems to browse 15 educational audience problems. Search matches the problem and fixing element names; category and review-method filters combine. HTML rules describe five supported checks (Topic title is heuristic); Visual review and Human review remain guidance. The catalog does not scan or automatically fix a deck. A comparison shows the same fictional evidence Before and After, with fixing-element links and a return route. Element cards derive reciprocal Helps with links from the same hazard records.

Open `dist/index.html#hazards`, or a stable `#hazard-topic-title` link. Existing `#kpi-tile` element routes continue to work. Build packages both element and hazard demos in sandboxed frames. `node scripts/test.mjs` runs the validator/hazard, frozen-pair, integrity and lint suites; browser/visual checks are separate.

The reproducible catalog UI check is `node scripts/catalog-browser-check.mjs --playwright /absolute/path/to/playwright/index.mjs --browser /absolute/path/to/Chrome --report work/team-workflow/impeccable-m1/catalog-browser-report.json`. It retains the original navigation, filters, relationship history/focus and timeout criteria, and also exercises zero/one-frame activation, image failure fallback when captures are available, desktop/mobile category navigation, zoom-equivalent reflow and narrow/reduced-motion/RTL surfaces and saves screenshots. A functional pass does not certify full AA; the original all-demo contrast report retains unresolved unmeasurable/manual coverage.
