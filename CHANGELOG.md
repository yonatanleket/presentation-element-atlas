# Changelog

## Unreleased

- Make web demos legible on phones: the web stage gets a 10px font floor and, below 600px, keeps a 560px minimum width inside a keyboard-focusable sideways scroller. The plan comparison matrix now fits at every width. A new browser check asserts every web demo keeps text at 8px or more with nothing cut off at 320, 375 and 640px.
- Show related elements: links are derived in both directions at build time and shown in card details and the demo panel, marked when they cross between Slides and Web. No element records change.
- Make trigger tags searchable, and show them as chips in the panel that search the catalog. Hide the New chip when the current surface has nothing added in the last 30 days.
- Add a Content sections category with four land-book section types: value proposition, how it works, resource teaser grid and about us (34 web sections in total).
- Derive expected preview heights from the stage aspect with clear errors; replace the unused `SCHEMA_VERSION` with `SCHEMA_VERSIONS`; fix stale docs. Contrast report for all 200 demos: `work/team-workflow/web-phase/contrast-report.json` (0 measured failures).
- Add 30 web page sections in five categories (hero, navigation, pricing, social proof, conversion), each with an original, network-free live demo on a new 16:9 web stage (`demos/_web.css`) and a captured preview. Catalog gains a Slides / Web sections switch (`#surface-web`), a New filter and badge, surface-aware category chips and a debounced search. Four trigger tags (`conversion-ask`, `pricing-plans`, `social-proof`, `consent-choice`) and four gallery sources join the registries. All previews were recaptured.
- Add element format `1.1.0` with optional `surface` (`slide` | `web`) and `added` date fields; `1.0.0` records stay valid unchanged. Categories carry a `surface`, and five web categories (hero, navigation, pricing, social proof, conversion) join the 12 slide categories.
- Establish element schema format `1.0.0`; migrate all 166 records and the authoring template. Unsupported or absent format versions fail validation and build.
- Share strict record, reference and demo validation between CLI and build; add validator regression fixtures and `node scripts/test.mjs`.
- Preserve source element fields and existing catalog/demo behavior during migration.
- Add optional Atlas Rendered Contrast 1.0.2 timeline sampler with eleven rendered checker specimens and explicit incomplete-coverage reporting. Full all-state AA acceptance remains pending.
- Add approved15 hazard metadata records, versioned schema, template, cross-file validation and derived reciprocal relationship data. Demo pairs/catalog UI remain the next increment; `hazards-validate.mjs --strict-demos` exposes the pending file-presence gate.
- Reject inherited property names in closed schemas and source references; cover hostile keys at record and severity-mode depth.
- Improve contrast for stepped-code line numbers and amber status icons; classify sibling SVG/gradient backing as unmeasurable rather than assuming a light stage background.
- Add Elements/Hazards browsing, combined hazard filters/counts, stable comparison routes, derived fixing/reverse links and one sandboxed comparison panel with relationship return/history handling.
- Preserve comparison selection/disclosure/scroll across fixing-element hops; add reproducible catalog UI browser checks and integrated regression-suite command.
- Keep fixed agenda labels at least12px and expose a current-section tracker; add visible/direct appendix access around the preserved optional-slide evidence.
- Add pointer quick-play: hovering an element poster mounts one sandboxed `#quickplay` demo frame over the still and removes it on leave, while hover/focus on other cards, reduced motion and touch keep the inert still.
- Add hover crossfade preview to Slide problems Before/After pairs and align the section with the elements catalog: sticky Problem categories sidebar, search plus review-method segmented rail on one row, matching card header/footer and details structure.
