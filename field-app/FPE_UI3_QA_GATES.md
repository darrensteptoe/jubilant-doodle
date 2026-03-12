# FPE UI 3.0 QA Gates

Date: 2026-03-10
Scope: UI architecture migration only (engine and right rail frozen)

## Gate Template (Required Per Surface)

### 1) Functional
- Controls respond to input changes.
- Outputs update after each control change.
- Stage navigation works and preserves state.
- No broken element IDs required by runtime bindings.
- No JS errors in browser console.

### 2) Visual
- Uses v3 spacing tokens (no arbitrary margins).
- No legacy shell styling leaks into v3 cards.
- No overlaps or clipped controls.
- Right rail fits and scrolls in slot.
- Mobile/compact layout remains usable.

### 3) Structural
- Surface answers one clear operator question.
- Primary controls are immediately visible.
- Advanced/secondary controls are clearly separated.
- Summary section reflects current assumptions.

### 4) Regression
- Same inputs produce same key outputs as legacy shell.
- KPI strip values match right-rail/source values.
- Scenario name edits sync between v3 and legacy model input.

## Current Surface Status

### District
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native card structure with legacy field-level mounts.
- Remaining checks:
  - Manual browser regression against legacy values.
  - Console error sweep after stage switching loops.

### Reach
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native card layout with targeted field/block mounts.
- Remaining checks:
  - Manual browser regression against legacy values for weekly outputs.
  - Console error sweep after repeated stage switching.
  - Visual pass for 3-column scanability at 1280 and 1024 widths.
  - Confirm `window.__FPE_REACH_API__` availability on first paint (v3 no longer falls back to legacy stage-capacity DOM mirrors).

### Outcome
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native outcome cards with targeted simulation/output mounts.
- Remaining checks:
  - Monte Carlo run/re-run interactions from v3 shell.
  - Risk framing consistency with right rail.
  - Regression check for confidence-envelope and sensitivity values.

### Turnout
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native turnout layout with targeted ROI/turnout mounts.
- Remaining checks:
  - ROI table refresh behavior under control changes.
  - Turnout summary consistency across mode toggles.
  - Regression check for turnout banner and realized-vote readouts.

### Plan
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native plan layout with targeted workload/optimization/timeline mounts.
- Remaining checks:
  - Timeline-constrained optimization flow.
  - Workload translator regression against legacy values.
  - Decision-intelligence panel behavior and constraint summaries.

### Controls
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native controls layout; workflow, benchmark, evidence, calibration, and feedback cards are native-bridged to legacy `intel*` handlers. Status stack is now native v3, and census now uses a native bridge shell with legacy sub-block mounts for dense map/table workflows.
- Remaining checks:
  - Census flow parity (load GEOs, fetch rows, aggregate, map rendering) in v3 bridge-shell context.
  - Calibration interactions and export/copy behavior under repeated edits.
  - Feedback-loop interactions and console-error sweep.

### Scenarios
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native scenario workspace and comparison panel now run through the runtime scenario API bridge (`window.__FPE_SCENARIO_API__`) with no legacy ID-bound controls in the v3 pane.
- Remaining checks:
  - Save/load/clone/delete scenario actions from v3 workspace.
  - Comparison grid visibility and diff counts under baseline/non-baseline states.
  - Summary panel refresh during rapid scenario switching.

### Decision Log
- Status: In progress (B -> C native structure pass started)
- Current implementation: v3-native session/assumptions/options/recommendation/diagnostics cards now run through the runtime decision API bridge (`window.__FPE_DECISION_API__`) without legacy ID-bound controls in the v3 pane; `Run snapshot` now uses the shared DOM-independent sensitivity compute path.
- Remaining checks:
  - Session/objective/options actions under repeated edits.
  - Diagnostics panel updates (drift/risk/bottleneck/sensitivity/confidence) after reruns.
  - Recommendation export buttons and summary preview behavior.

### Data
- Status: In progress (B -> C native bridge pass started)
- Current implementation: v3-native data controls rendered in v3 markup with event/state bridge to legacy data IDs (no mounted legacy cards).
- Remaining checks:
  - Strict import toggle and restore-backup behavior.
  - Import/export button flows (JSON/CSV/copy summary) and banner visibility.
  - USB folder connect/load/save/disconnect behavior in v3 context.

## Execution Notes
- `js/core/*` remains unchanged for this phase.
- Right rail remains legacy and is slotted into v3 shell.
- Shared v3 utility helpers now centralize surface text/grid helper logic (`js/app/v3/surfaceUtils.js`) to reduce duplication before final native hardening.
- Bridge helper primitives (`bindClickProxy`, `syncButtonDisabled`, `syncSelectOptions`) are centralized in `js/app/v3/surfaceUtils.js` and reused by native-bridge surfaces.
- Bridge helper API expanded in `js/app/v3/surfaceUtils.js` with shared field/select/checkbox bind+sync utilities (`bindFieldProxy`, `bindSelectProxy`, `bindCheckboxProxy`, `syncFieldValue`, `syncSelectValue`, `syncCheckboxValue`).
- Added v3 QA smoke harness (`js/app/v3/qaGates.js`):
  - Runs automatically when clicking the v3 Diagnostics button (logs pass/fail table to console, then opens legacy diagnostics modal).
  - Can be run manually in-browser with `window.runV3QaSmoke()`.
  - Stage selector checks are now scoped to the active v3 pane (not global DOM), so hidden legacy IDs can no longer produce false passes.
- Bridge hardening: removed fragile structural legacy selectors in migrated surfaces (`> .note`, `:last-of-type`, descendant class lookups) and switched to explicit legacy IDs for Reach/Outcome status-note sync paths.
- Bridge hardening: v3 proxy bindings now stamp bridge metadata (`data-v3-legacy-id`, `data-v3-bridge-kind`) on bridged controls, and QA smoke now verifies per-stage bridge target existence (`bridge-control-count`, `bridge-targets-exist`) while allowing explicitly native stages (currently `scenarios` and `decision-log`) to run with zero legacy bridges.
- Reach bridge fix: `Finish date` now correctly reads legacy `#wkFinishAttempts` (previous stale `#wkFinishDoors` reference removed), and label text now matches the underlying attempts metric.
- Reach bridge hardening: removed v3 legacy DOM fallback reads for weekly/outlook/levers/actions; Reach v3 now uses runtime API bridge only (`window.__FPE_REACH_API__`), reducing dependency on `stage-capacity`.
- Turnout bridge reduction: removed direct `#mcP50` read from v3 Turnout impact context; margin context now resolves from right-rail `#mcP50-sidebar`, eliminating Turnout's direct dependency on `stage-results`.
- Outcome bridge reduction: v3 Outcome now sources core MC/risk display metrics directly from right-rail IDs (`#mcP10-sidebar/#mcP50-sidebar/#mcP90-sidebar`, freshness tags, risk band) instead of legacy `stage-results` IDs for those fields.
- Outcome bridge reduction: v3 Outcome risk-grade/fragility/cliff readouts now resolve from right-rail risk context (`#riskBandTag-sidebar`, `#riskVolatility-sidebar`, `#riskPlainBanner-sidebar`) instead of legacy `#mcRiskGrade/#mcFragility/#mcCliff`.
- Outcome bridge reduction: v3 Outcome forecast median/upside/downside now resolves from sidebar percentiles (`#mcP50-sidebar/#mcP90-sidebar/#mcP10-sidebar`) instead of legacy `#mcMedian/#mcP95/#mcP5`.
- Outcome bridge reduction: v3 Outcome weekly capacity/gap context now resolves from weekly-ops IDs (`#wkCapacityPerWeek/#wkGapPerWeek/#wkConstraintNote` + `#timelineWeeksAuto/#weeksRemaining`) instead of legacy `#p3*` result IDs.
- Outcome bridge reduction: v3 Outcome surface-status/summary/impact-note helper copy is now native in the v3 card body, removing direct reads from legacy `#surfaceStatus/#surfaceSummary/#impactTraceNote`.
- Outcome bridge reduction: v3 Outcome confidence miss-risk label is now derived from `#opsMissProb` in v3 logic, removing direct dependency on legacy `#opsMissTag`.
- Outcome bridge reduction: v3 Outcome shift-needed (P50/P10) values are now derived from sidebar margins, removing direct reads from legacy `#mcShiftP50/#mcShiftP10`.
- Plan bridge reduction: v3 Plan workload/optimizer/timeline banners and decision-intel text summaries are now derived in v3 logic, removing direct reads from legacy banner/recommendation IDs (`#convFeasBanner/#optBanner/#tlBanner/#di*`).
- Outcome bridge reduction: v3 Outcome now reads win probability from v3 KPI (`#v3KpiWinProb`) and derives weekly gap from note context, removing direct reads from `#mcWinProb-sidebar` and `#wkGapPerWeek`.
- Turnout bridge reduction: v3 Turnout impact/status now uses turnout snapshot + v3 KPI, removing direct reads from sidebar/status IDs (`#kpiTurnoutVotes-sidebar/#kpiPersuasionNeed-sidebar/#mcWinProb-sidebar/#turnoutSummary/#roiBanner`).
- Data bridge reduction: v3 Data status summary now derives from v3 bridge-state controls, removing direct reads from `#importHashBanner/#importWarnBanner/#usbStorageStatus`.
- Controls bridge reduction: v3 Controls now derives governance/evidence/calibration/feedback status text from v3 bridge state (no direct `#intel*Status/#intel*Count` text reads).
- Outcome bridge reduction: v3 Outcome confidence adjunct copy is now v3-derived (no direct reads from legacy `#opsAtt*`, `#opsCon*`, `#opsFinish*`, `#mcMoS/#mcDownside/#mcES10`, `#mcShift60/#mcShift70/#mcShift80`, `#mcShock10/#mcShock25/#mcShock50`, or `#impactTraceList`), and outcome capacity context no longer falls back to legacy `stage-capacity`/`stage-setup` IDs.
- Turnout bridge reduction: v3 Turnout projected-margin context now reads from v3 KPI (`#v3KpiMargin`) rather than right-rail `#mcP50-sidebar`.
- Plan bridge reduction: v3 Plan optimizer/timeline adjunct cards now derive totals and timeline diagnostics from v3-rendered state (`v3PlanOptAllocTbody` + synced timeline fields), removing direct reads of legacy `#optTotal*`, `#tlOpt*`, `#tlCompletionWeek`, and `#tlWeekList`.
- Outcome bridge reduction: v3 Outcome risk/freshness/cliff status stack now derives from v3 confidence context (no direct reads from right-rail `#riskBandTag-sidebar/#riskVolatility-sidebar/#riskPlainBanner-sidebar/#mcFreshTag-sidebar/#mcLastRun-sidebar/#mcStale-sidebar`), and no longer reads `#timelineWeeksAuto` from legacy ROI stage.
- Plan bridge reduction: v3 Plan Decision-Intel levers table no longer mirrors legacy `#diVolTbody/#diCostTbody/#diProbTbody`; rows now render natively from current v3 plan context.
- Outcome bridge reduction: v3 Outcome percentile context now reads from legacy confidence-envelope IDs (`#mcP10/#mcP50/#mcP90`) instead of right-rail percentile tags, removing Outcome dependency on `stage-integrity` and consolidating Outcome legacy reads under `stage-results`.
- Plan bridge reduction: v3 Plan now derives optimizer/timeline binding + shortfall status copy from v3 context (capacity/workload controls + v3 summaries), removing direct reads of legacy ROI status IDs (`#optBinding/#optGapContext/#tlPercent/#tlConstraint/#tlShortfallAttempts/#tlShortfallVotes`).
- Plan bridge reduction: v3 Plan workload row (`doors/shift`, `total shifts`, `shifts/week`, `volunteers needed`) now derives from v3 workload/timeline inputs, removing direct reads of legacy GOTV output IDs (`#outDoorsPerShift/#outTotalShifts/#outShiftsPerWeek/#outVolunteersNeeded`).
- Legacy `stage-capacity` visual surface has been retired from `index.html` user flow (hidden retired stub retained during transition); preflight no longer requires legacy Reach assumption IDs.
- Added v3 stage persistence/cutover behavior (`js/app/v3/index.js`):
  - Active stage persists to local storage.
  - URL deep-link query (`?stage=<id>`) restores stage on reload.
  - v3 is default; legacy shell opens only via explicit URL mode flag (`?ui=legacy`).
- Phase 11 native bridge started on Data (`js/app/v3/surfaces/data.js`), replacing compatibility card mounts with native v3 controls wired to existing legacy handlers.
- Phase 11 native bridge expanded on Scenarios workspace (`js/app/v3/surfaces/scenarios.js`) and now runs fully through the runtime scenario API bridge (no v3 legacy-control proxies required).
- Phase 11 native bridge expanded on Decision Log (`js/app/v3/surfaces/decisionLog.js`) and now runs fully through the runtime decision API bridge (no v3 legacy-control proxies required).
- Legacy scenario manager wiring now short-circuits when scenario DOM controls are absent (`js/app/scenarioManagerBindings.js`), enabling safe `stage-scenarios` retirement sequencing.
- Legacy decision-session wiring now short-circuits when decision DOM controls are absent (`js/app/decisionSessionApp.js`), reducing hard boot coupling before `stage-decisions` retirement.
- Legacy `stage-scenarios` container and nav entry have been retired from `index.html`; Scenarios now operates exclusively through v3 surface + runtime scenario API bridge.
- Legacy `stage-decisions` container and nav entry have been retired from `index.html`; Decision Log now operates through v3 surface + runtime decision API bridge.
- Phase 11 native bridge expanded on Controls (`js/app/v3/surfaces/controls.js`) for workflow, benchmark, evidence, and calibration cards.
- Hardening refactor: Controls and Data use the shared bridge helper API (reducing per-surface custom wiring code and keeping bridge behavior consistent), while Scenarios and Decision Log now use dedicated runtime API bridges.
- Legacy header actions migrated into native v3 card-body actions on primary modeling surfaces:
  - District: `Add candidate`
  - Outcome: `Compute Surface`
  - Turnout: `Refresh` (ROI comparison)
  - Plan: `Optimize`
- Decision Log diagnostics now includes a native v3 `Run snapshot` action proxy, replacing reliance on the legacy inline sensitivity button in mounted diagnostics rows.
- Sensitivity snapshot computation now has a DOM-independent runtime path (`computeSensitivitySnapshotCache`), so Decision Log snapshot runs no longer require legacy E4 DOM.
- Module-level ON/OFF toggles now follow header placement convention (label-left, switch-right) on migrated cards: District electorate weighting, Turnout module, Plan timeline module, Controls census apply-adjustments, and Data strict import policy.
- Surface action styling is normalized to compact neutral controls (`Add candidate` style) for all non-topbar buttons, including legacy `.btn` elements mounted inside v3 cards.
- District surface is now a single-column wide workspace (`fpe-surface-frame--single`) and now hosts the Census assumptions surface (`#censusPhase1Card`) for maximum working room.
- Controls surface no longer mounts Census assumptions UI blocks; governance cards remain scoped to workflow/evidence/benchmark/calibration/feedback.
- Reach surface moved from strict 3-column to adaptive 2-row arrangement (two columns plus full-width results row) to reduce module scroll pressure.
- Controls feedback-loop action set (`Capture observed metrics`, `Generate drift recommendations`, `Apply top recommendation`, `Parse what-if request`) is now rendered as native v3 body actions instead of mounted legacy card header actions.
- Controls census card no longer mounts the full legacy card wrapper; it now renders a v3 bridge shell with native top actions (`Load GEO list`, `Fetch ACS rows`) and targeted legacy sub-block mounts.
- Controls census bridge now exposes native v3 body actions for GEO selection (`Apply GEOIDs`, `Select all`, `Clear selection`), aggregate exports (`Export CSV/JSON`), and election CSV workflow (`template downloads`, `dry-run`, `clear preview`) with proxy wiring to legacy handlers.
- Resolved duplicate ID conflict in Decision Log (`v3DecisionObjective`) and added focused-field sync guards in Controls/Decision Log bridge loops to prevent input jitter during periodic refresh.
- Static selector audits currently pass:
  - All legacy IDs referenced by v3 surface bridges are present in `index.html`.
  - No duplicate v3 `id=` attributes detected across `js/app/v3/surfaces/*.js`.
- Local environment currently lacks `node`, so automated JS build/typecheck was not executed here.
