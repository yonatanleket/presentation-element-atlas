# M1 fictional benchmark originals

Dataset `m1-h2h-fictional-v1`, authored 2026-10-21. These three static HTML decks use invented people, organizations, statements, dates, metrics and source lines. Each deck labels that fact outside its single comparison root. They are deliberately seeded contract tests, not real-world evidence or a representative traffic sample.

| Original | Slot | Required slides | Authored expected findings |
|---|---:|---:|---|
| `pitch-original.html` | 4 min | 6 | s2 topic title; s3 seven bullets; s4 unsourced number; deck timing |
| `report-original.html` | 6 min | 5 | s2 exactly 81 body tokens; s3 topic title; s4 unsourced number |
| `training-original.html` | 8 min | 7 | s2 seven bullets; s3 exactly 81 body tokens; s4 topic title |

`manifest.json` is the frozen authored rule/location oracle, original byte hashes, counts and policy hashes. `authored-content.json` is the underlying fictional content used to render the originals. The three `*-evidence.json` files independently specify exact slide/copy/claim/fact/source records from that author content; they were not extracted from Atlas output. Every deck includes names, dates, a quote, units and legitimate sourced quantitative content. Copy, claims, numbers and associations remain separate records. No actual external source is cited or asserted credible.

The two `*-citation-provenance.json` files pin the original same-slide source that the fixture author supplied for the deliberately disconnected metric. The pitch `*-appendix-policy.json` permits s5/s6 to move to optional appendix slides; the original still has six required slides. Policies are pinned to the original SHA-256 bytes, never candidate content. No empty policy is supplied for training. This is fixture-author policy, not a statement about Yonatan's content or real-world citation truth.

The authoring helper at `work/team-workflow/impeccable-m1/h2h/materialize-fixtures.py` refuses to overwrite differing existing bytes. A revision needs a new dataset version, explanation and fresh matched runs. File permissions are not a lock; hashes are the audit boundary. `SHA256SUMS` pins all files in this fixture directory except itself.

One read-only Atlas lint and one identity-verifier run per original are recorded separately under `work/team-workflow/impeccable-m1/h2h/`. They check fixture/oracle consistency, not comparator performance or proof of general factual integrity. Independent review is required before comparator runs. Browser loading, visibility, contrast and fix-flow usability have not been measured by that crosscheck.
