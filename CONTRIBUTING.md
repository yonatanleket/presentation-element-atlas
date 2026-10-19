# Contributing

Thanks for helping grow the atlas. Each element is one JSON file plus one demo page. The catalog is generated from those files, so you never edit `dist/` by hand.

## Add an element

1. **Check for duplicates.** Search the catalog (names and aliases) and `elements/`. If your idea is a variant of an existing element, add it to that element's `aliases` or `related` instead of creating a new one.
2. **Copy the templates.**
   ```sh
   cp templates/element.json elements/<id>.json
   cp templates/demo.html    demos/<id>.html
   ```
   `<id>` is a lowercase kebab slug (`^[a-z0-9]+(-[a-z0-9]+)*$`, at most 48 characters). It must match the filename and never changes once merged.
3. **Fill in the required fields** (see the field table below), then build the demo (see Demo authoring).
4. **Check your work.**
   ```sh
   node scripts/validate.mjs --strict
   node scripts/build.mjs
   ```
   Open `dist/index.html`, find your card, and open its demo.
5. **Open a pull request** that describes the element and why it is different from existing ones.

### Fields

| Field | Required | Rule |
|---|---|---|
| `id` | yes | Kebab slug, equals the filename, immutable. |
| `name` | yes | At most 60 characters, unique (ignoring case). |
| `category` | yes | One id from `categories.json`. |
| `definition` | yes | What it is, at most 200 characters. |
| `bestUse` | yes | When to use it, at most 140 characters. |
| `trigger` | yes | 1–5 content-type tags from `triggers.json`. |
| `level` | yes | `standard` or `advanced` (advanced = genuinely interactive or uncommon). |
| `sources` | yes | One or more keys from `sources.json`; use `common` when there is no single source. |
| `demo` | yes | `{ "file": "demos/<id>.html", "kind": "static" \| "animated" \| "interactive", "how": "15–60 words" }` |
| `aliases` | no | Search synonyms. |
| `related` | no | Ids of existing elements. |

`schema/element.schema.json` describes the shape; `scripts/validate.mjs` also checks the cross-file rules.

## Checklist

Before you open a pull request, confirm:

- [ ] `node scripts/validate.mjs --strict` passes and `id` equals the filename.
- [ ] The element differs from existing ones in **function**, not just styling.
- [ ] Wording is generic: no brands, employers, clients or personal anecdotes. Examples use neutral, invented situations.
- [ ] The demo uses the shared harness, has a "How it works" note whose text equals `demo.how`, is self-contained (no network, no other files), works by keyboard and respects reduced motion.
- [ ] Standard demos are a static or animated illustration; advanced demos are genuinely interactive and have a reset.
- [ ] Invented numbers carry an "Illustrative" label, and simulated UI or responses carry a "Simulated" label.
- [ ] `sources` resolve in `sources.json`, or say `common`.
- [ ] Light theme only: no dark-mode rules or theme switches.

## What gets accepted

- **Rejected:** duplicates of existing elements, elements without a demo, and entries with neither a source nor `common`.
- **Variants** (a different look for the same function) go in `aliases` or `related`.
- **New trigger tags** need a stated reason in the pull request and an entry in `triggers.json`. Prefer an existing tag. Every tag must be used by at least one element.
- **New sources** need an entry in `sources.json` with a label and a URL.

## Demo authoring

Every demo is one HTML file in `demos/` that links the shared harness:

```html
<link rel="stylesheet" href="_harness.css">
...
<script src="_harness.js"></script>
<script> AtlasDemo.init({ ... }); </script>
```

Link the harness with exactly these relative paths and reference no other files. The build inlines the harness into `dist/demos/`, so demos also work when the catalog is opened from disk. The catalog loads each demo in a sandboxed iframe (`sandbox="allow-scripts"`), so a demo cannot reach the page, storage or the network.

### Markup contract

```html
<main class="demo" data-state="loading">
  <h1 class="demo-title">Element name</h1>
  <div class="stage" role="img" aria-label="Demo: Element name">   <!-- role="group" for interactive demos -->
    <span class="label-illustrative">Illustrative</span>            <!-- when numbers are invented -->
    ... your mini-slide ...
  </div>
  <div class="controls"></div>                                       <!-- the harness fills this -->
  <details class="how" open><summary>How it works</summary><p>Same text as demo.how.</p></details>
</main>
```

- **Stage**: a 16:10 frame of a 480×300 logical canvas. `1em` is 16 logical pixels and scales with the frame. Size everything inside the stage in `em` and keep text at `.8em` or larger. Building blocks in `_harness.css`: `.fill`, `.pad`, `.col`, `.row`, `.center`, `.card`, `.kicker`, `.h`, `.p`, `.muted`, `.big`, `.pill` (`.ok`, `.warn`, `.bad`, `.adv`), `.sbtn` (`.primary`), `.fx` (standard transition), `.hide`, `.sr-only`, and the mini deck `.deck` > `.deck-bar` / `.deck-body` / `.deck-foot`.
- **Tokens**: use the CSS variables (`--accent`, `--line`, `--muted`, `--ok`, `--warn`, `--bad` and their `-soft` versions). Light only.
- **Title**: shown when the demo is opened on its own, and visually hidden inside the catalog panel, whose header already shows the name.

### `AtlasDemo.init(options)`

A demo is a timeline of frames `0..frames`. Frame 0 is the idle start and the last frame is the finished state. The harness owns the buttons, state, autoplay, reduced motion, shortcuts and status line. Your demo only draws frames.

| Option | Default | Meaning |
|---|---|---|
| `frames` | `0` | Number of steps after frame 0. `0` = no timeline (pure interactive demo: only Reset is shown). |
| `render(frame, ctx)` | none | Draw the whole stage for `frame`. Must be idempotent: any frame can be drawn at any time. |
| `stepMs` | `900` | Delay between frames during Play. |
| `autoplay` | `true` | Play once when opened. Never autoplays under reduced motion. |
| `step` | `true` | Show the Step button (only when `frames > 1`). |
| `loop` | `false` | Ambient loop; adds a Pause/Resume button. |
| `interactive` | `false` | The stage has its own controls; done/status text is left to you. |
| `reset(ctx)` | none | Restore stage controls and internal state. Called on init and on Reset, before `render(0)`. |
| `idleText`, `playText`, `doneText` | `''`, `''`, `'Done'` | Status line text for those moments. |

`ctx` gives you `ctx.animate` (false for jumps, reset and reduced motion: skip count-ups and movement then), `ctx.reduced`, `ctx.stage`, `ctx.status(text)` (writes to the polite live region) and `ctx.setState(state)`.

`init` returns `{ play, step, reset, goto(n), frame, status, setState }`.

The helper `AtlasDemo.countUp(node, to, { animate, from, decimals, prefix, suffix, duration })` counts a number up, or sets it directly when `animate` is false or reduced motion is on.

### Behavior the harness gives you

- **States** on `.demo[data-state]`: `loading` → `idle` → `playing` → `done`.
- **Controls**: Play/Replay, Step ▸, Pause (loops only), Reset. All are native buttons at least 44px tall.
- **Reduced motion**: shows the final frame with no autoplay. Replay and Step still change states, but transitions are cut to near zero.
- **Keyboard**: Tab reaches stage controls, then the harness buttons. The shortcuts P (play), N (step) and R (reset) work when focus is outside the stage. Inside the stage, handle arrow keys yourself and flip left/right when `document.dir === 'rtl'`.
- **"How it works"** opens on wide screens and collapses on phones (inside the catalog panel the device screen width decides).
- **Escape**: an Escape key press that no stage control consumes closes the catalog panel (the harness posts `event: 'escape'`). If your stage uses Escape to close its own popover or menu, call `e.preventDefault()` when it does.
- **Catalog handshake**: the harness posts `{ type: 'atlas-demo', event: 'ready' }` to the catalog. If that message does not arrive within 5 seconds, the panel shows "This demo didn't load" with a Retry button. Errors post `event: 'error'`.

### Recipes

- **Standard** (`kind: "static"` or `"animated"`): a CSS/SVG illustration that builds over a few frames. No input is needed.
- **Exception:** a standard element whose subject is itself a control or live input (for example a chapter menu or an audience poll) may use `kind: "interactive"`, because a static picture of it would not show how it works.
- **Advanced** (`kind: "interactive"`): at least one real control (button, slider, drag, key or input) that visibly changes state, operable by keyboard, with `reset` restoring the start. If an advanced element cannot be meaningfully interactive, set it to `standard` and say why in the pull request.
- **Data**: use plausible, invented values and add `<span class="label-illustrative">Illustrative</span>`. Label simulated UI or responses "Simulated".
- See `demos/kpi-tile.html` (simple animated), `demos/segmented-progress-bar.html` (multi-step) and `demos/context-aware-next-reveal-button.html` (interactive) for reference.
