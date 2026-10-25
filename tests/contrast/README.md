# Rendered contrast checks

`Atlas Rendered Contrast 1.0.2` uses a real headless Chrome page through separately installed Playwright. The catalog runtime remains dependency free. Supply explicit module and browser paths:

```sh
node scripts/check-contrast.mjs --playwright /absolute/path/to/playwright/index.mjs --browser /absolute/path/to/Chrome --self-test --report work/team-workflow/impeccable-m1/contrast-report.json
```

The self-test exercises known normal-text failure, normal/large-text passes, transparent ancestor compositing, and unsupported gradient/opacity/SVG backing, text-fill overrides and text stroke. Every one of the 166 demos is sampled at every harness timeline frame at widths 600 and 390 pixels, normal and reduced motion. Animation is disabled and the render callback receives `animate=false` for stable states. No random interactive path, hover/focus or transient animation coverage is claimed. Pure interactive demos cover their initial state only.

Text uses computed sRGB foreground and composited ancestor background, WCAG luminance and 4.5:1 ordinary / 3:1 large text (24px, or 18.667px bold). Disabled controls are exempt. Unsupported cases are recorded as unmeasurable. Backgrounds provided by siblings or pseudo-elements and native input values need separate inspection; this is not a pixel checker. Required UI indicators and focus rings remain a manual gate.

Exit 1 means measured contrast failures. Exit 2 means tooling/run failure or incomplete coverage (including when no measured failures occur). This bounded checker **never emits an overall AA pass**. The M1-a gate requires zero unresolved real failures and completion of the remaining manual/pixel/interaction assessment. Reports include checker/browser, viewport/state counts, failures and limitations.

For a focused correction recheck, pass `--only code-with-stepped-line-highlight,rag-status,full-bleed-image-overlay` and a new `--report` path. Never overwrite the original all-demo raw report. Checker1.0.2 adds painted-sibling hit-stack detection and two hostile gradient/SVG backing specimens (eleven total); detected layered backing is unmeasurable, not inferred as the light ancestor surface. Pseudo-element/pixel evidence remains incomplete.
