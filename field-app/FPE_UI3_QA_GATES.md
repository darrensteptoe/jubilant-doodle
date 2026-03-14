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
- Current implementation: v3-native data controls rendered in v3 markup and driven via runtime data API bridge (`window.__FPE_DATA_API__`) with no direct legacy selector proxies in the Data surface.
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
- Plan bridge reduction: v3 Plan now derives optimizer/timeline binding + shortfall status copy from v3 context (capacity/workload controls + v3 summaries), removing direct reads of legacy ROI status IDs (`#optBinding/#optGapContext/#tlPercent/#tlConstraint/#tlShortfallAttempts/#tlShortfallVotes`).
- Controls bridge reduction: v3 Controls evidence table now renders directly from scenario-bridge intel state (`window.__FPE_SCENARIO_API__`) and no longer mirrors legacy `#intelEvidenceTbody`.
- Controls bridge reduction: v3 Controls benchmark table now renders directly from scenario-bridge intel state and no longer mirrors legacy `#intelBenchmarkTbody`; remove actions dispatch by benchmark id to legacy handlers.
- Controls bridge reduction: v3 Feedback what-if/recommendation preview panes now render directly from scenario-bridge intel state and no longer mirror legacy `#intelWhatIfPreview/#intelRecommendationPreview`.
- Controls bridge reduction: v3 Review workflow actions now run API-first through `window.__FPE_SCENARIO_API__` with no fallback proxy bindings to legacy `btnIntel*` actions or `intelWhatIfInput`.
- Controls bridge reduction: v3 Benchmark and Evidence form/actions now run API-first through `window.__FPE_SCENARIO_API__` (no fallback proxy bindings to legacy `intelBenchmark*`, `intelAuditSelect`, `intelEvidence*`, `btnIntelBenchmark*`, or `btnIntelEvidenceAttach`).
- Data bridge reduction: v3 Data action + state wiring now runs through runtime data API bridge (`window.__FPE_DATA_API__`) with zero direct legacy ID proxies in `surfaces/data.js`.
- Plan bridge reduction: v3 Plan workload row (`doors/shift`, `total shifts`, `shifts/week`, `volunteers needed`) now derives from v3 workload/timeline inputs, removing direct reads of legacy GOTV output IDs (`#outDoorsPerShift/#outTotalShifts/#outShiftsPerWeek/#outVolunteersNeeded`).
- Plan bridge reduction: v3 Plan now resolves required conversations/doors via Reach runtime bridge (`__FPE_REACH_API__.getView().weekly`) instead of direct reads of legacy `#outConversationsNeeded/#outDoorsNeeded`.
- Plan bridge reduction: v3 Plan workload `Doors per hour (source)` now mirrors from v3 timeline `timelineDoorsPerHour` control, removing direct legacy `#doorsPerHour` dependency.
- Plan bridge reduction: v3 Plan workload input controls (`goalSupportIds`, `hoursPerShift`, `shiftsPerVolunteerPerWeek`) now bind via Reach runtime bridge (`__FPE_REACH_API__.setField/getView`) instead of direct legacy `stage-gotv` DOM proxies.
- Plan bridge reduction: v3 Plan optimizer/timeline controls now bind via runtime Plan API bridge (`__FPE_PLAN_API__.setField/runOptimize/getView`) instead of direct legacy `stage-roi` control proxies.
- Turnout bridge reduction: v3 Turnout assumptions/lift/ROI controls now bind via runtime Turnout API bridge (`__FPE_TURNOUT_API__.setField/refreshRoi/getView`) instead of direct legacy `stage-roi` control proxies.
- Plan/Turnout bridge reduction: v3 allocation/ROI tables now render from runtime bridge view caches instead of mirroring legacy `#optTbody/#roiTbody`.
- Outcome bridge reduction: v3 Outcome percentile context now resolves from v3 KPI + right-rail percentiles (`#v3KpiMargin`, `#mcP10-sidebar/#mcP50-sidebar/#mcP90-sidebar`) instead of direct reads of legacy confidence-envelope IDs (`#mcP10/#mcP50/#mcP90`).
- Outcome bridge reduction: v3 Outcome MC run-count display (`v3OutcomeMcRuns`) is now native fixed UI state and no longer mirrors legacy `#mcRuns`.
- Outcome bridge reduction: v3 Outcome sensitivity + surface tables now render directly from runtime outcome bridge cache (`window.__FPE_OUTCOME_API__`) with no legacy table mirror fallback path.
- Outcome bridge reduction: v3 Outcome forecast/confidence freshness values now read from runtime MC state via outcome bridge (`window.__FPE_OUTCOME_API__.getView().mc`), with sidebar/KPI fallback retained only as non-stage compatibility context.
- Outcome bridge reduction: v3 Outcome controls/actions now bind exclusively via runtime Outcome API (`setField/runMc/rerunMc/computeSurface/getView`) with no legacy proxy fallback path.
- Outcome bridge reduction: sensitivity-surface controls now resolve from runtime bridge state cache (`state.ui.outcomeSurfaceInputs`) and `computeSurface` executes from runtime engine path without requiring legacy `#surface*` nodes or `#btnComputeSurface`.
- QA gate update: v3 smoke now treats Reach, Outcome, Turnout, Plan, Scenarios, Decision Log, and Data as no-legacy-bridge stages (`bridge-control-count` expects zero `data-v3-legacy-id` controls); District and Controls remain bridged during migration.
- KPI bridge reduction: v3 KPI strip now uses runtime Outcome/Reach bridge views plus right-rail context for win probability, margin, and bottleneck status (no `stage-results` selector fallback on KPI win/margin fields).
- Runtime hardening: MC render paths now render sidebar confidence/win metrics even when legacy primary result IDs are absent (no early return on missing `#mcWinProb`).
- Runtime hardening: MC freshness/stale tags now update via sidebar-only targets even when legacy primary freshness nodes are absent.
- Runtime hardening: risk-framing panel now updates via sidebar-only targets and no longer hard-requires legacy primary risk nodes.
- Runtime hardening: D4 miss-risk computation/cache now runs without requiring legacy `opsMissProb/opsMissTag` DOM nodes.
- Runtime hardening: D4 miss-risk UI now mirrors to right-rail IDs (`#opsMissProb-sidebar`, `#opsMissTag-sidebar`) so miss-risk status remains visible when legacy results-table nodes are absent.
- Runtime hardening: D2/D3 envelope renderers now compute/cache-update even when legacy `opsAtt*` / `opsFinish*` table nodes are absent.
- Runtime hardening: MC confidence adjunct metrics now mirror to right-rail `*-sidebar` IDs (hidden mirror targets), preserving updates when legacy adjunct table nodes are absent.
- Runtime hardening: MC summary KPI metrics (`mcMedian`, `mcP95`, `mcP5`) now mirror to right-rail `*-sidebar` IDs (hidden mirror targets), preserving updates when legacy summary KPI nodes are absent.
- Runtime hardening: MC sensitivity rows now mirror to hidden right-rail target (`#mcSensitivity-sidebar`), preserving updates when legacy sensitivity table node is absent.
- Legacy flow retirement: removed legacy left-nav `results` entry while retaining `stage-results` DOM for runtime parity checks.
- Legacy flow retirement: `stage-results` section is hidden as a retired stub (DOM retained).
- Legacy flow retirement: `stage-results` is now an empty retired stub anchor (no internal legacy controls mounted).
- Legacy flow retirement: removed legacy left-nav `roi` and `gotv` entries while retaining `stage-roi`/`stage-gotv` DOM for runtime parity checks.
- Legacy flow retirement: `stage-roi` and `stage-gotv` sections are hidden as retired stubs (DOM retained).
- Legacy flow retirement: `stage-roi` is now an empty retired stub anchor (no internal legacy ROI/optimizer/timeline controls mounted).
- Legacy flow retirement: `stage-gotv` is now an empty retired stub anchor (no internal legacy controls mounted).
- Runtime hardening: timeline renderer now computes/cache-updates without hard requiring legacy timeline DOM gates (`timelineEnabled`, `tlPercent`, `tl*`), reducing coupling to `stage-gotv` markup.
- Runtime hardening: phase3 renderer now computes/cache-updates and continues MC refresh/render even when legacy `p3*` output nodes are absent, reducing coupling to `stage-results` markup.
- Runtime hardening: compatibility MC phase3 renderers (`js/app/render/monteCarlo.js`, `js/render/monteCarlo.js`) now compute/cache-update without hard requiring legacy `p3*` nodes.
- Runtime hardening: conversion panel now computes and triggers phase3 refresh without hard requiring legacy `out*` output nodes or `convFeasBanner`.
- Runtime hardening: ROI renderer now keeps cache/banner/summary updates active even when legacy `roiTbody` is absent (table render is conditional).
- Runtime hardening: sensitivity snapshot render/run paths now no-op safely when legacy `sens*` DOM nodes are absent, while preserving cache compute/persist flow.
- Runtime hardening: decision confidence/intelligence panels now render with guarded writes when legacy `conf*` / `di*` nodes are absent (no early-return hard gate on those legacy blocks).
- Runtime hardening: weekly ops insights/freshness panels now render with guarded writes when legacy `wk*` nodes are partially absent (no hard all-node gate).
- Runtime hardening: weekly ops summary module now continues rendering with guarded writes when `wkGoal` is absent (no hard return on that legacy summary node).
- Runtime hardening: assumption drift panel now renders with guarded writes when `drift*` nodes are partially absent (no hard return on `driftStatusTag`).
- Runtime hardening: scenario comparison panel now renders with guarded writes when `scm*` nodes are partially absent (no hard return on compare-wrap/tag IDs).
- Runtime hardening: scenario comparison panel now guards `state.ui`/registry access for early-boot safety (no throw on missing `state.ui`).
- Runtime hardening: stress summary panel now uses guarded target + resilient summary array handling (`res?.stressSummary`).
- Runtime hardening: assumptions snapshot panel now renders with guarded writes when `assumptionsSnapshot` is absent (no hard return on assumption snapshot mount target).
- Runtime hardening: guardrails panel now renders with guarded writes when `guardrails` target is absent (no hard return on guardrails mount target).
- Runtime hardening: MC margin-chart renderers now use guarded writes for `svgMargin*` targets (app + compat panel paths), avoiding render short-circuit when partial chart nodes are absent.
- Runtime hardening: backup-recovery dropdown refresh now uses guarded writes when `restoreBackup` is absent (no hard return on restore select target).
- Runtime hardening: decision session/options renderers now avoid hard returns on select/label targets and continue guarded panel updates when those specific nodes are absent.
- Runtime hardening: sensitivity surface defaults now use guarded lever/range refs for `surfaceLever/surfaceMin/surfaceMax`.
- Runtime hardening: appRuntime weekly undo and MC/GOTV mode sync helpers now use guarded refs (no direct `els.*` hard-return gates on `wkUndoActionBtn`, `mc*`, `gotv*` mode nodes).
- Runtime hardening: DOM preflight now enforces Census/Targeting required IDs only when those feature anchors are present, reducing false missing-ID noise during staged retirement.
- Runtime hardening: DOM preflight now accepts legacy-or-v3 shell IDs for scenario/build/diagnostics/reset controls to prevent false `dom-preflight` failures during shell cutover.
- Runtime hardening: DOM preflight now accepts legacy-or-v3 District core controls (race/election/weeks/mode/universe/candidate/turnout fields) to prevent false boot failures while setup-era legacy markup is retired.
- Runtime hardening: DOM preflight District/Reach core controls are now stage-aware (only enforced when District/Reach anchors are present), preventing false boot failures when those surfaces are not mounted.
- Runtime hardening: DOM preflight now accepts legacy-or-v3 Census and Targeting IDs (card/control/table/status/map) so staged retirement does not trigger false missing-ID boot failures.
- Runtime hardening: apply-state/UI binding paths now guard Reach assumption control writes (`persuasionPct`, `earlyVoteExp`) so app boot/render remains stable after `stage-capacity` container removal.
- Runtime hardening: apply-state/UI binding paths now guard baseline legacy-shell controls (`scenarioName`, race/setup controls, turnout band controls, undecided controls) so staged container retirement cannot trigger boot-time null writes.
- QA hardening: UI smoke required-ID test now accepts v3 fallbacks for legacy-only capacity/results/scenario-compare cards (`operationsCapacityOutlookCard|v3ReachOutlookTbody`, `phase3Card|v3OutcomeForecastWinProb`, `scenarioCompareCard|v3ScenarioDiffOutputs`) to prevent false failures during staged legacy container retirement.
- QA hardening: UI smoke now accepts v3 shell fallbacks for scenario/build/diagnostics/reset IDs and supports v3 scenario-save action ID (`v3BtnScenarioSaveNew`) as a valid control target.
- QA hardening: UI smoke required-ID test now treats District/Reach core control IDs as optional stage-scoped checks (uniqueness enforced only when present), avoiding false failures when those surfaces are not mounted.
- QA hardening: UI smoke Reach/Outcome/Scenario stage-card IDs (`operationsCapacityOutlookCard|v3ReachOutlookTbody`, `phase3Card|v3OutcomeForecastWinProb`, `scenarioCompareCard|v3ScenarioDiffOutputs`) are now optional stage-scoped checks (uniqueness enforced only when present).
- QA hardening: UI smoke census + USB control checks now accept v3 fallback IDs (`v3DistrictCensusShell`, `v3Census*`, `v3DataBtnUsb*`, `v3DataUsbStatus`) to avoid false failures during stage-checks and stage-integrity retirement.
- QA hardening: UI smoke census + USB checks are now stage-aware (run only when Census/Data anchors are present), avoiding false failures when those surfaces are not mounted.
- District bridge reduction: electorate-structure derived text + normalization warning now render natively in v3 using core universe-layer math instead of legacy `#universe16Derived/#universe16Warn` mirrors.
- Runtime hardening: weekly ops renderer now caches derived execution context in `state.ui.lastWeeklyOps`, so consumers can read the model without legacy `wk*` DOM nodes.
- Runtime hardening: conversion renderer now caches workload/feasibility outputs in `state.ui.lastConversion` instead of relying only on legacy `out*` + banner nodes.
- Runtime hardening: ROI renderer now updates turnout summary cache (`state.ui.lastTurnout`) even when legacy `turnoutSummary` DOM is absent; Plan optimizer early-return paths now clear/normalize plan caches (`state.ui.lastPlanRows/lastPlanMeta/lastSummary`) to avoid stale v3 summaries when legacy ROI markup is missing.
- KPI bridge reduction: bottleneck inference now reads weekly gap from Reach runtime bridge (`__FPE_REACH_API__.getView()`); legacy `#wkGapPerWeek` fallback removed.
- KPI bridge reduction: bottleneck label no longer falls back to legacy `#wkConstraint/#optBinding` text mirrors.
- Turnout bridge reduction: Turnout helper copy no longer mounts from `#stage-roi .phase-p6 > .note`; v3 Turnout now uses native helper text.
- Turnout bridge reduction: Turnout summary readout resolves from sidebar/bridge context (`#kpiTurnoutBand-sidebar`) instead of legacy ROI summary text nodes.
- Turnout bridge reduction: v3 turnout snapshot now resolves summary text from bridge/sidebar only (`#kpiTurnoutBand-sidebar`), removing the last `#turnoutSummary` fallback dependency.
- Turnout bridge reduction: v3 turnout snapshot votes/need now resolve from bridge/sidebar only (`#kpiTurnoutVotes-sidebar`, `#kpiPersuasionNeed-sidebar`) with no non-sidebar fallback selectors.
- District bridge hardening: District summary expected-turnout readout now uses turnout baseline value or v3-derived average (`turnoutA/turnoutB`) instead of falling back to turnout-votes KPI text.
- KPI bridge reduction: persuasion-need KPI now resolves from sidebar target only (`#kpiPersuasionNeed-sidebar`) with no legacy primary fallback selector.
- Turnout bridge reduction: Turnout efficiency banner now reads from runtime Turnout bridge (`roiBannerText`) and no longer mirrors legacy `#roiBanner` note text nodes.
- Turnout bridge reduction: Turnout summary/votes/need readouts now resolve from Turnout runtime bridge summary (`view.summary`) backed by runtime cache (`state.ui.lastTurnout`) before any selector fallback.
- Legacy flow retirement: removed legacy left-nav `integrity` entry.
- Legacy flow retirement: `stage-integrity` is now an empty retired stub.
- Data bridge hardening: Data actions (`save/load/copy/export/USB/strict/restore`) now execute through runtime-native `__FPE_DATA_API__` handlers without legacy integrity control IDs.
- Legacy flow retirement: legacy nav entries for `capacity`, `results`, `roi`, `gotv`, and `integrity` are removed from legacy shell user flow while DOM stubs remain for rollback.
- Legacy shell hardening: fixed missing `</section>` closure after structure stage to keep section tree balanced during further staged deletions.
- Legacy `stage-capacity` container has been removed from `index.html`; preflight no longer requires legacy Reach assumption IDs.
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
