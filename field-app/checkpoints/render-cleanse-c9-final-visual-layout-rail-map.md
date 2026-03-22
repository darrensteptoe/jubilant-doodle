# C9 Freeze — Final Visual / Layout / Rail / District Map Pass

Date: 2026-03-21  
Scope: C9 only (shell/rail cleanup, ordering/layout standardization, District map polish, Election Data vs Census boundary preservation, visual standardization)

## C9 implementation summary

### 1) Shell and debug chrome cleanup
- Removed top-strip glossary shortcut cluster from normal app chrome.
- Hid runtime diagnostics block by default (`#v3RuntimeDiagnostics`), with diagnostics still available via explicit debug toggle/query/localStorage path.
- Removed visible topbar build badge from normal live UI.

### 2) Right rail behavior/order cleanup
- Right rail now defaults to `Results` mode on load.
- Added manual-intent routing so glossary/manual/help interactions switch rail to `Manual`.
- Preserved explicit user switch-back path to `Results`.
- Removed rail metadata rows for universe-basis/source-note; retained snapshot hash.
- Reordered rail sections to:
  1. key results
  2. validation/guardrails
  3. Monte Carlo + risk framing
  4. stress summary
  5. metadata

### 3) Page/module ordering and density layout pass
- District: moved `District summary` to top; removed standalone Election Data summary module from District stack.
- Election Data: restored `Election Data summary` as top module.
- Outcome: moved `Outcome summary` to top; normalized interpretation block style class.
- Reach: reordered with summary-first decision flow.
- Turnout: moved to `two-col` density layout and reordered for input-before-comparison flow.
- Plan: moved to center-stack with summary at top.
- Scenarios: switched to `two-col-balanced`.
- Controls: switched to `two-col` with governance/summary-first ordering.
- War Room: summary-first ordering.
- Data: summary-first ordering.

### 4) District Census map lane polish (new architecture only)
- Restored/kept visible map shell + status lane + VTD ZIP intake/status lane in District V2.
- Added map labels/status lane (`#v3DistrictV2CensusMapLabels`) and synchronized label content from selected geography options.
- Added spacing hooks/classes for map action row and VTD row.
- Kept editable controls on in-place sync lifecycle (no old binder/sync/hold restoration).

### 5) Election Data vs Census boundary preservation
- Kept Election Data summary/interpretation on Election Data page.
- District now uses compact Election Data context in District summary, not full Election Data summary module.
- Did not restore legacy Census election advisory/preview UI.

## C9 tests/checks added or updated

### New test file
- `js/app/v3/c9.shellLayout.contract.test.js`
  - shell debug/glossary cleanup checks
  - right rail default/manual trigger contract checks
  - right rail metadata/order checks
  - District/Election Data summary placement checks
  - layout/order checks for Outcome/Turnout/Plan/Scenarios/Controls

### Updated test files
- `js/app/v3/surfaces/district/phase5.integrity.test.js`
  - updated expectation: no standalone District Election Data summary card
  - summary-first expectation for District stack
- `js/app/v3/surfaces/district/renderLifecycle.contract.test.js`
  - C9 map labels lane contract coverage

## Browser/manual parity evidence (C9)

Preview runtime:
- `npm run preview -- --host 127.0.0.1 --port 4178` (Vite auto-bound to `http://127.0.0.1:4179/`)

Stage DOM logs:
- `/tmp/c9_district.log`
- `/tmp/c9_election_data.log`
- `/tmp/c9_outcome.log`
- `/tmp/c9_reach.log`
- `/tmp/c9_turnout.log`
- `/tmp/c9_plan.log`
- `/tmp/c9_scenarios.log`
- `/tmp/c9_controls.log`
- `/tmp/c9_decision_log.log`
- `/tmp/c9_data.log`

Observed confirmations:
- Global:
  - runtime diagnostics node is hidden in live DOM (`#v3RuntimeDiagnostics[hidden]`)
  - right rail toggle defaults to Results active (`aria-pressed=true` on results button)
  - Manual toggle present and switchable control present
  - top-strip glossary cluster absent from live shell DOM
- District:
  - first card title is `District summary`
  - `Turnout baseline` card present
  - map status/shell/VTD ZIP lanes present:
    - `#v3DistrictV2CensusMapStatus`
    - `#v3DistrictV2CensusMapShell`
    - `#v3DistrictV2CensusMapQaVtdZip`
    - `#v3DistrictV2CensusMapLabels`
  - standalone `Election Data summary` card absent on District
- Election Data:
  - first card title is `Election Data summary`
- Outcome:
  - first card title is `Outcome summary`
  - interpretation note class present: `.fpe-outcome-interpretation-note`
- Reach/Turnout/Plan/Scenarios/Controls/War Room/Data:
  - updated frame/layout classes and summary-first ordering present in rendered stage DOM.

## Transitional compatibility paths touched in C9
- Kept (transitional, unchanged):
  - District mirror compatibility layer in runtime/model-input path.
  - District pending-write transitional status for non-replacement legacy binders outside frozen replacement modules.
- No C9 removal of transitional runtime compatibility paths was performed.

## Deferred gaps (C9)
- Dedicated standalone “Manual page” stage is not present in current `V3_STAGE_REGISTRY`; manual UX remains right-rail mode-based.  
- Browser-interaction parity for “click glossary -> open manual -> click back to results” is enforced by contract tests and runtime wiring checks; headless capture evidence is DOM-state based.

## Freeze decision
C9 is frozen for this pass.
