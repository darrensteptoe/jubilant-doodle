# C3 Checkpoint — District Census + Targeting Editable Modules

Date: 2026-03-21
Status: **FROZEN**

## Scope
- District Targeting editable controls
- District Census editable controls

## Contained inventory (render/bind/sync)

### Render owners
- `syncDistrictV2Targeting`
- `syncDistrictV2Census`

### Binder owners
- Targeting: `bindDistrictV2TargetingSelect`, `bindDistrictV2TargetingModelSelect`, `bindDistrictV2TargetingField`, `bindDistrictV2TargetingCheckbox`
- Census: `bindDistrictV2CensusField`, `bindDistrictV2CensusCheckbox`, `bindDistrictV2CensusGeoSelection`

### Sync owners
- `syncSelectOptions`
- `syncInputValueFromRaw`
- `syncCheckboxCheckedFromRaw`
- `syncMultiSelectOptions`

### Structural output renderers (allowed)
- `renderDistrictV2TargetingRows`
- `renderDistrictV2CensusAggregateRows`

## Ordinary-edit rerender/rebind audit
- Targeting editable controls do not call `setInnerHtmlWithTrace(...)` in ordinary edit sync paths.
- Census editable controls do not call `setInnerHtmlWithTrace(...)` in ordinary edit sync paths.
- Binders are one-time (`data-v3DistrictV2Bound`) and hold-free.
- No `markDistrictPendingWrite`, `shouldHoldDistrictControlSync`, or `districtPendingWrites` in C3 editable paths.

## Transitional helpers retained
- `setInnerHtmlWithTrace(...)` remains for derived result table rendering:
  - `renderDistrictV2TargetingRows`
  - `renderDistrictV2CensusAggregateRows`
- Retention rationale: structural output table refresh; not editable control hydration.

## Tests added/updated for C3

1. Render lifecycle contract tests (`js/app/v3/surfaces/district/renderLifecycle.contract.test.js`)
- `c3 contract: targeting and census ordinary editable sync paths avoid structural rerender`
- `c3 contract: targeting and census binders are one-time and hold-free`

2. Persistence tests (`js/core/selectors/districtV2.persistence.test.js`)
- `district_v2 C3 targeting dropdown and numeric inputs persist after reopen`
- `district_v2 C3 census dropdown and text inputs persist after reopen`

## Command results
- `npm run check:render-lifecycle-contract` -> PASS (9/9)
- `node --test js/core/selectors/districtV2.persistence.test.js js/core/selectors/districtReplacementCards.persistence.test.js js/core/selectors/districtRaceContextPersistence.test.js` -> PASS (25/25)
- `npm run build` -> PASS

## Manual/browser parity (headless runtime)

Artifacts:
- `/tmp/district_c3_browser.log`
- `/tmp/district_c3_persist_run1.log`
- `/tmp/district_c3_persist_run2.log`
- live bundle: `assets/index-Cn4alO2m.js`

Observed parity for required controls:
1. Census dropdown (`v3DistrictV2CensusResolution`)
- `trace.auto.c3.post` canonical value matches DOM (`place`)
- `replacedSinceReference=false`

2. Census text/input (`v3DistrictV2CensusGeoSearch`)
- `trace.auto.c3.post` canonical value matches DOM (`c3-geo-probe`)
- `replacedSinceReference=false`

3. Targeting dropdown (`v3DistrictV2TargetingGeoLevel`)
- `trace.auto.c3.post` canonical value matches DOM (`tract`)
- `replacedSinceReference=false`

4. Targeting numeric (`v3DistrictV2TargetingTopN`)
- `trace.auto.c3.post` canonical value matches DOM (`53`)
- `replacedSinceReference=false`

Blur and re-sync checks:
- `blur.after.microtask` and `blur.after.raf` for all four controls show DOM value == canonical value.

Refresh/reopen checks (same browser profile):
- first run (`districtDomTraceAuto=1`) commits C3 probe values.
- second run (`districtDomTraceAuto=0`) shows `trace.init` canonical values retained after reload:
  - `v3DistrictV2CensusResolution`: `place`
  - `v3DistrictV2CensusGeoSearch`: `c3-geo-probe`
  - `v3DistrictV2TargetingGeoLevel`: `tract`
  - `v3DistrictV2TargetingTopN`: `53`

Structural mutation checks:
- No editable control-node replacement during ordinary edits for C3 controls.
- Expected structural mutations observed only in derived result tables (`TargetingResultsTbody`, `CensusAggregateTbody`).

## C3 Scorecard
- canonical read source clean: **YES**
- in-place sync clean for ordinary edits: **YES**
- DOM identity preserved for probed C3 controls: **YES**
- structural rerender isolated to derived output tables: **YES**
- persistence parity (Targeting/Census): **YES**
- subsystem frozen: **YES**
