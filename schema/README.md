# Element record versions

Every element and template declares `"schemaVersion": "1.0.0"`. The validator and build accept exactly the explicitly supported version, currently `1.0.0`; malformed, absent and newer versions fail closed. This is a SemVer format version, independent of the catalog release version.

Increment major for incompatible record changes; minor for compatible optional fields or constraints; patch for clarifications that do not change accepted data. Before accepting another version, update the schema support list, validator fixtures, templates, migration instructions and changelog together. A newer version is never assumed compatible solely because its major number matches.

The initial migration adds only `schemaVersion` to the 166 existing records. For an old unversioned record, add `"schemaVersion": "1.0.0"` without altering its other fields, then run `node scripts/validate.mjs --strict` and `node scripts/test.mjs`. Future incompatible migrations must provide explicit field transformations.

The dependency-free checker supports only the keywords listed in `scripts/lib.mjs`; adding a JSON Schema keyword requires checker implementation and rejection fixtures. This is not a general Draft 2020-12 validator.

## Hazard metadata foundation

`hazard.schema.json` uses the same explicit format1.0.0 policy. Required six-mode severity keys, approved15 IDs, five auto rule IDs and existing fixing-element references are validated by `scripts/hazards.mjs`. Exactly15 records form the M1 set; reciprocal element relationships are derived from `fixedBy`, never stored twice. Metadata validation runs in the main validator/build when the collection exists.

Run `node scripts/hazards-validate.mjs` for metadata status. `--strict-demos` additionally rejects missing pair files; file presence alone never proves evidence integrity, keyboard access or contrast. Foundation records deliberately report15 pending demos until the next implementation increment. Before/After prose describes the approved treatment; exact protected specimen inventory is a separate artifact required before pair construction.
