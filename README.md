# Presentation Element Atlas

An open catalog of slide elements: what each one is, when to use it, and a live demo of how it works. It covers 166 elements in 12 categories, from progress bars and KPI tiles to sankeys, explorable sliders and audience polls.

Use it to pick the right element for a slide, to share a vocabulary with the people you build decks with, or to copy a working demo into your own talk.

## Browse

Open `dist/index.html` in a browser. It works straight from disk or from any static host. No server or install is needed.

- **Search** matches names, definitions, "best for" text and aliases. Press Esc to clear it.
- **Standard / Advanced** filters by level. Advanced elements are interactive or less common.
- **Category chips** narrow the list to one category.
- **Demo** opens a side panel with the element's live demo. Use ← and → to step through the current results, and Esc or Back to close.
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

## Demo status

Every element has a live demo: all 166 run in the catalog panel and on their own from `dist/demos/`. If you add an element without a demo, its panel shows "No demo yet" until you add `demos/<id>.html`.

## Contributing

New elements, demos and fixes are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the steps, the checklist and the demo authoring guide.

## License

[MIT](LICENSE) © 2026 Presentation Element Atlas contributors. Sample numbers in demos are invented and labeled "Illustrative".
