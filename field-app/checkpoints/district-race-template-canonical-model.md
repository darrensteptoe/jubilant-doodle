# District Race Template Canonical Model (C8)

Date: 2026-03-21  
Scope: Race Template semantics, override behavior, and right-rail wiring

## Canonical interpretation
- Race Template is kept as a canonical preset/profile selector (`templateProfile.raceType`).
- Race Template is **not** treated as a replacement for explicit race descriptors.
- Explicit canonical race descriptors remain separate canonical fields:
  - `templateProfile.officeLevel`
  - `templateProfile.electionType`
  - `templateProfile.seatContext`
  - `templateProfile.partisanshipMode`
  - `templateProfile.salienceLevel`

## Auto-set behavior when Race Template changes
- `districtBridgeSetFormField("raceType", value)` applies `applyTemplateDefaultsForRace(next, value, { mode: "untouched" })` in `js/appRuntime.js`.
- This sets template defaults for the selected race profile on top-level compatibility fields, then synchronizes canonical template/form/universe via domain actions:
  - `updateDistrictTemplateFieldAction(...)`
  - `updateDistrictFormFieldAction(...)`
  - `updateDistrictUniverseFieldAction(...)`

## Override behavior
- Explicit template-dimension edits (`officeLevel`, `electionType`, `seatContext`, `partisanshipMode`, `salienceLevel`) call:
  - `applyTemplateDefaultsForRace(next, next.raceType, { mode: "untouched", ...overrides })`
- With `mode: "untouched"`, user-edited values are treated as explicit overrides rather than a full forced reset.
- Overridden dimension values are synchronized back into canonical template fields using `updateDistrictTemplateFieldAction`.

## Whether later template changes overwrite overrides
- Re-selecting race template (`raceType`) runs template apply with `mode: "untouched"` and then syncs canonical template fields.
- Explicit dimension selections remain represented canonically through direct template field actions.
- This means the model preserves explicit canonical dimensions while still allowing template-driven defaults/hints.

## Right-rail read path (C8 correction)
- Right rail assumptions rendering now reads District canonical race context via:
  - `selectDistrictCanonicalView(state)` in `js/app/renderAssumptions.js`
- Race & scenario block now explicitly renders canonical:
  - race template
  - office level
  - election type
  - seat context
  - partisanship mode
  - election date
- This removes dependence on stale compatibility-only reads for Race Context display parity.

## Summary
- Race Template remains canonical as a profile selector.
- Structural race descriptors stay explicit canonical fields.
- Right rail now reflects the same canonical District chain used by District V2 controls.
