# C8 Freeze — District Completeness Restoration + Canon/Wiring Audit

Date: 2026-03-21  
Scope: District-only completeness restoration, Race Template model clarification, Election Data vs Census boundary audit, right-rail Race Context refresh correction

## Restored District V2 features
1. Turnout Baseline card restored (`turnoutA`, `turnoutB`, `bandWidth`).
2. Census map shell/status lane restored (visible shell + map status text lane).
3. VTD ZIP intake/status lane restored (file input + clear action + status lane).
4. Right rail Race Context refresh corrected to canonical chain (no stale compatibility read dependency for race-context display rows).

## Canon/wiring audit findings

### A) Election Data vs Census boundary
- C8 removed District election-data row-count fallback that depended on Census preview rows.
- Updated in `js/appRuntime.js`:
  - `normalizedRowCount` now derives from canonical Election Data row count only.
  - derived election row count fallback to Census preview rows removed.
- District Census UI intentionally does **not** restore advisory/election-preview tables.

### B) Right rail ownership
- `renderAssumptionsModule` now reads race context from `selectDistrictCanonicalView(state)`.
- Race & scenario block now includes explicit canonical rows:
  - race template
  - office level
  - election type
  - seat context
  - partisanship mode
  - election date

### C) Template override wiring
- Race Template remains preset/profile selector.
- Explicit dimensions remain separate canonical fields.
- Template-dimension changes still use `mode: "untouched"` path; canonical sync remains explicit through template-field actions.
- Detailed model note captured in `checkpoints/district-race-template-canonical-model.md`.

### D) Transitional compatibility paths touched in C8
- Kept (transitional):
  - District mirror writes in `js/appRuntime.js` top-level compatibility state.
  - Census derived compatibility fields (`bridgeMapStatusText`, `bridgeMapQaVtdZipStatusText`) consumed by bridge-derived Census view.
- Safe to remove later (after adapter migration):
  - Census preview-row fallback dependency for Election Data summary (removed in C8).
- Needs replacement before removal:
  - remaining District mirror read paths in model-input/summary compatibility flow.

## Render/control contract checks (C8 scope)
- Turnout baseline controls mount/bind once and dispatch through `setDistrictFormField`.
- Turnout baseline sync is in-place (`syncInputValueFromRaw`), no `innerHTML` replace in ordinary edit flow.
- Census map/VTD lane uses non-destructive lanes; no ordinary edit control node replacement introduced.

## Tests added/updated (C8)
- `js/app/v3/surfaces/district/renderLifecycle.contract.test.js`
  - C8 turnout lifecycle contract checks.
  - C8 census map/VTD wire checks.
  - C8 non-restoration checks for legacy advisory/election-preview UI.
- `js/core/selectors/districtV2.persistence.test.js`
  - C8 turnout baseline persistence across reopen/navigation snapshots.
- `js/app/renderAssumptions.contract.test.js` (new)
  - right-rail race context canonical selector usage checks.
- `js/app/v3/surfaces/district/c8.boundary.test.js` (new)
  - Election Data vs Census fallback decoupling checks.
  - non-restoration of legacy Census election advisory/preview UI checks.
- `js/app/v3/surfaces/district/phase5.integrity.test.js`
  - added `turnoutBaseline` module import expectation.
- `js/app/v3/qaGates.js`
  - District selectors migrated to District V2 IDs for QA/tooling parity.

## Browser/manual parity evidence (C8)

Logs:
- `/tmp/district_c8_run1.log`
- `/tmp/district_c8_refresh.log`
- `/tmp/district_c8_nav_outcome.log`
- `/tmp/district_c8_nav_back.log`

Observed bundle:
- `assets/index-Cuav02pi.js`

Confirmed:
1. Turnout baseline edit parity:
  - `trace.auto.c3.post` for `v3DistrictV2TurnoutA`, `v3DistrictV2TurnoutB`, `v3DistrictV2BandWidth` shows:
    - `replacedSinceReference=false`
    - canonical values updated (3, 3, 7)
2. Refresh/reopen parity:
  - District reload shows turnout status: `Anchored · A 3.0% · B 3.0% · ±7.0%`
3. Navigation parity:
  - Outcome stage opened in same profile (`/tmp/district_c8_nav_outcome.log`).
  - Return to District retains turnout anchored status and right-rail race-context values (`/tmp/district_c8_nav_back.log`).
4. Map/VTD lanes visible:
  - `v3DistrictV2CensusMapShell` present.
  - `v3DistrictV2CensusMapQaVtdZip` + `v3DistrictV2CensusMapQaVtdZipStatus` present.
5. Right rail Race Context parity:
  - race template change dispatch shows canonical-after = `federal`.
  - assumptions right rail shows canonical race-context rows (`race template`, `office level`, `election type`, `seat context`, `partisanship mode`, `election date`) aligned with District edits.

## Freeze status
C8 is frozen in this pass.
