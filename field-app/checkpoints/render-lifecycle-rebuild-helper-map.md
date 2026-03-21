# Render Lifecycle Rebuild Helper Map

Date: 2026-03-21

## District V2 editable runtime (current cleanse scope)

### Structural rebuild helpers (now signature-gated)
- `syncDistrictV2CandidateTable` (`js/app/v3/surfaces/districtV2/index.js`)
- `syncDistrictV2UserSplitTable` (`js/app/v3/surfaces/districtV2/index.js`)
- `syncDistrictV2CandidateHistory` (`js/app/v3/surfaces/districtV2/index.js`)

### In-place control sync helpers (new standard path)
- `syncSelectControlInPlace`
- `syncMultiSelectControlInPlace`
- `syncInputControlInPlace`
- `syncCheckboxControlInPlace`
- `replaceSelectOptionsInPlace`

All above are in `js/app/v3/surfaces/districtV2/index.js` and now back `Race Context`, `Electorate`, `Ballot`, `Candidate History`, `Census`, and `Targeting` editable control sync.

## Other rebuilt editable surfaces to audit next

Candidates with runtime `innerHTML`/template rebuild patterns in editable contexts:
- `js/app/v3/surfaces/turnout.js`
- `js/app/v3/surfaces/reach.js`
- `js/app/v3/surfaces/plan.js`
- `js/app/v3/surfaces/scenarios.js`
- `js/app/v3/surfaces/controls.js`

## Explicitly out of immediate scope (read-only/result tables)

These can keep structural row rendering where no editable control state is owned in-row:
- `js/app/v3/surfaces/warRoom/*.js` table renderers
- `js/app/v3/surfaces/outcome/sensitivity.js`
- `js/app/v3/surfaces/outcome/surface.js`
- `js/app/v3/surfaces/electionData/normalizedPreview.js`

