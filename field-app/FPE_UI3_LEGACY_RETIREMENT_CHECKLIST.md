# FPE UI 3.0 Legacy Retirement Checklist

Date: 2026-03-11  
Scope: Phase 12+ retirement planning for legacy stage containers and legacy shell wrappers.

Reference artifact:
- `checkpoints/legacy_dependency_matrix.tsv` (generated 2026-03-11; per-surface legacy ID -> stage location map).

## Non-negotiable guardrails
- Do not touch `js/core/*` math or engine formulas.
- Keep right rail behavior/content frozen until final cutover.
- Remove legacy containers only when bridge dependency count is zero for that container.
- Keep each retirement step reversible (one PR/checkpoint per stage cluster).

## Current blocker inventory (must clear before deleting legacy shell)
- `js/app/composeSetupStage.js` still composes and re-parents legacy setup content using:
  - `#stage-setup`
  - `#stage-ballot .phase-p3`
- `js/appRuntime.js` still executes `composeSetupStageModule()` during boot.
- `js/app/v3/stageMount.js` still mounts legacy right rail (`.results-sidebar-new`) into `#v3RightRailSlot`.
- Most v3 surfaces are still bridge-driven from legacy IDs (by design for B->C migration), so legacy containers remain runtime dependencies.
- Scenarios surface is now runtime-native in v3 (no direct legacy ID bridge targets).
- Legacy scenario manager bindings now short-circuit when scenario DOM is absent, so `stage-scenarios` can be removed without requiring legacy scenario event wiring at boot.
- Legacy decision-session bindings now short-circuit when decision DOM is absent, preventing boot-time coupling to removed Decision Log legacy markup.
- Decision Log controls, summaries, and sensitivity snapshot execution now run through runtime decision API (`window.__FPE_DECISION_API__`) with a DOM-independent sensitivity compute path.

## Completed retirements
- `stage-scenarios` removed from `index.html` (legacy nav item removed as part of the same pass).
- `stage-decisions` removed from `index.html` (legacy nav item removed; Decision Log runs from runtime API bridge in v3).
- Reach v3 surface no longer reads legacy stage-capacity DOM IDs; it now hard-fails to runtime API bridge (`window.__FPE_REACH_API__`) instead of mirroring legacy DOM.
- Legacy `stage-capacity` visual markup retired from `index.html` (kept as hidden retired stub); legacy nav item for capacity removed.
- Turnout v3 surface no longer reads legacy `#mcP50` from `stage-results` for impact margin context; it now uses right-rail `#mcP50-sidebar`.
- Outcome v3 surface now sources core MC/risk display values (P10/P50/P90 + freshness + risk band) from right-rail sidebar IDs, reducing direct reads from `stage-results`.
- Outcome v3 surface now sources risk-grade/fragility/cliff context from right-rail risk IDs (`#riskBandTag-sidebar`, `#riskVolatility-sidebar`, `#riskPlainBanner-sidebar`) instead of legacy `#mcRiskGrade/#mcFragility/#mcCliff`.
- Outcome v3 surface now sources forecast median/upside/downside display from sidebar percentiles (`#mcP50-sidebar/#mcP90-sidebar/#mcP10-sidebar`) instead of legacy `#mcMedian/#mcP95/#mcP5`.
- Outcome v3 surface now uses native v3 copy for surface/impact helper text, removing direct reads from legacy `#surfaceStatus/#surfaceSummary/#impactTraceNote`.
- Outcome v3 confidence envelope now derives miss-risk label in v3 from `#opsMissProb`, removing direct read of legacy `#opsMissTag`.
- Outcome v3 now derives `Shift needed (P50/P10)` directly from sidebar margin values (`#mcP50-sidebar/#mcP10-sidebar`), removing direct reads from legacy `#mcShiftP50/#mcShiftP10`.
- Plan v3 surface now derives workload/optimizer/timeline status copy and decision-intel summary text in v3 logic, removing direct reads from legacy banner/recommendation IDs (`#convFeasBanner/#optBanner/#tlBanner/#di*`).
- Outcome v3 now reads win probability from v3 KPI (`#v3KpiWinProb`) and derives weekly gap from v3 note context, removing direct reads of `#mcWinProb-sidebar` and `#wkGapPerWeek`.
- Turnout v3 now uses turnout snapshot + v3 KPI for impact/status copy, removing direct reads of `#kpiTurnoutVotes-sidebar/#kpiPersuasionNeed-sidebar/#mcWinProb-sidebar/#turnoutSummary/#roiBanner`.
- Data v3 summary/status now derives from v3 controls/bridge UI state, removing direct reads of `#importHashBanner/#importWarnBanner/#usbStorageStatus`.
- Controls v3 now derives workflow/evidence/calibration/feedback status copy from v3 bridge state, removing direct reads from legacy `#intel*Status/#intel*Count` text nodes.
- Outcome v3 confidence adjunct text now derives in v3 (no direct reads of legacy `#opsAtt*`, `#opsCon*`, `#opsFinish*`, `#mcMoS/#mcDownside/#mcES10`, `#mcShift60/#mcShift70/#mcShift80`, `#mcShock10/#mcShock25/#mcShock50`, or `#impactTraceList`), and outcome capacity note no longer falls back to `stage-capacity` / `stage-setup` IDs.
- Turnout v3 margin context now resolves from v3 KPI (`#v3KpiMargin`) instead of `#mcP50-sidebar`, removing Turnout’s last `stage-integrity` dependency.
- Plan v3 timeline/optimizer adjunct copy now derives in v3 (no direct reads of legacy `#optTotalAttempts/#optTotalCost/#optTotalVotes`, `#tlOptGoalFeasible/#tlOptMaxNetVotes/#tlOptRemainingGap/#tlOptBinding`, `#tlCompletionWeek`, or `#tlWeekList`).
- Outcome v3 now derives risk-grade/freshness/fragility/cliff status copy in v3 logic (no direct reads from `#riskBandTag-sidebar/#riskVolatility-sidebar/#riskPlainBanner-sidebar/#mcFreshTag-sidebar/#mcLastRun-sidebar/#mcStale-sidebar`), and no longer reads legacy timeline weeks from ROI stage.
- Plan v3 decision-intel lever tables are now native v3 rows derived from current plan context (no legacy mirrors from `#diVolTbody/#diCostTbody/#diProbTbody`).
- Outcome v3 percentile context now reads directly from confidence-envelope IDs (`#mcP10/#mcP50/#mcP90`) rather than sidebar percentile tags, fully removing Outcome’s direct `stage-integrity` dependency.
- Plan v3 now derives optimizer/timeline binding and shortfall status (`optBinding/optGapContext/tlPercent/tlConstraint/tlShortfall*`) from v3 plan context instead of direct legacy ROI status IDs.
- Plan v3 workload row now derives `doors/shift`, `total shifts`, `shifts/week`, and `volunteers needed` from v3 workload/timeline inputs (no direct reads of legacy `#outDoorsPerShift/#outTotalShifts/#outShiftsPerWeek/#outVolunteersNeeded`).
- Plan v3 now reads `required conversations` and `required doors` from Reach runtime bridge view (`window.__FPE_REACH_API__.getView().weekly`) instead of direct legacy `#outConversationsNeeded/#outDoorsNeeded` reads.
- Plan v3 workload `Doors per hour (source)` field now mirrors from v3 timeline `Doors attempts / hour` (already synced to `timelineDoorsPerHour`), removing direct legacy `#doorsPerHour` read from `stage-gotv`.
- Plan v3 workload input controls (`goalSupportIds`, `hoursPerShift`, `shiftsPerVolunteerPerWeek`) now bind through Reach runtime bridge set/get (`window.__FPE_REACH_API__.setField/getView`) instead of direct legacy `stage-gotv` DOM IDs.
- Plan v3 optimizer/timeline controls now bind through runtime Plan API bridge (`window.__FPE_PLAN_API__.setField/runOptimize/getView`) instead of direct legacy `stage-roi` control IDs.
- Turnout v3 assumptions/lift/ROI controls now bind through runtime Turnout API bridge (`window.__FPE_TURNOUT_API__.setField/refreshRoi/getView`) instead of direct legacy `stage-roi` control IDs.
- Plan and Turnout v3 allocation/ROI tables now render from runtime bridge view caches (`state.ui.lastPlanRows`, `state.ui.lastRoiRows`) instead of mirroring legacy `#optTbody/#roiTbody`.
- Outcome v3 now reads percentile margins from v3 KPI + right-rail percentile tags (`#v3KpiMargin`, `#mcP10-sidebar/#mcP50-sidebar/#mcP90-sidebar`) instead of legacy confidence-envelope IDs (`#mcP10/#mcP50/#mcP90`), reducing direct `stage-results` dependency.
- Outcome v3 Monte Carlo run-count display (`v3OutcomeMcRuns`) is now native fixed UI state (`10000`) and no longer mirrors legacy `#mcRuns`.
- Outcome v3 sensitivity and surface tables now render directly from runtime outcome bridge cache (`window.__FPE_OUTCOME_API__`) with no legacy table mirror fallback.
- Outcome v3 forecast/confidence freshness values now source from runtime MC state via outcome bridge (`window.__FPE_OUTCOME_API__.getView().mc`) with sidebar/KPI fallback retained only as non-stage compatibility context.
- Outcome v3 controls/actions now bind exclusively through runtime Outcome API (`window.__FPE_OUTCOME_API__.setField/runMc/rerunMc/computeSurface/getView`) with no legacy proxy fallback path.
- KPI strip sync now uses runtime Outcome/Reach bridge views (`window.__FPE_OUTCOME_API__`, `window.__FPE_REACH_API__`) plus right-rail context for win probability, P50 margin, and bottleneck labels, removing `stage-results` selector fallback for those KPI fields.
- MC runtime renderers now support sidebar-only targets (`mcWinProb-sidebar`, `mcP10/50/90-sidebar`) and no longer hard-require legacy primary result nodes (`#mcWinProb/#mcP10/#mcP50/#mcP90`) to render confidence outputs.
- MC freshness/staleness runtime paths now support sidebar-only targets (`mcFreshTag-sidebar`, `mcLastRun-sidebar`, `mcStale-sidebar`) and no longer depend on legacy primary freshness nodes to update status.
- Risk framing runtime now supports sidebar-only targets (`riskBandTag-sidebar`, `riskWinProb-sidebar`, `riskMarginBand-sidebar`, `riskVolatility-sidebar`, `riskPlainBanner-sidebar`) and no longer hard-requires legacy primary risk nodes.
- Miss-risk runtime (`renderMissRiskD4`) now computes/cache-updates even when legacy `opsMiss*` DOM nodes are absent, removing DOM-presence gating for D4 risk state.
- Miss-risk runtime now dual-writes to right-rail mirror IDs (`#opsMissProb-sidebar`, `#opsMissTag-sidebar`) so active miss-risk readouts persist without `stage-results` table nodes.
- Ops/finish envelope runtime paths (`renderOpsEnvelopeD2`, `renderFinishEnvelopeD3`) now compute/cache-update without requiring legacy `opsAtt*` / `opsFinish*` DOM nodes.
- MC confidence adjunct outputs (`mcMoS`, downside/ES10, shift targets, shocks, risk grade/label, fragility/cliff) now dual-write to sidebar mirror IDs (`*-sidebar`) via runtime MC render paths.
- MC summary KPI outputs (`mcMedian`, `mcP95`, `mcP5`) now dual-write to sidebar mirror IDs (`#mcMedian-sidebar/#mcP95-sidebar/#mcP5-sidebar`) via runtime MC render paths.
- MC sensitivity rows now dual-render to hidden sidebar mirror target (`#mcSensitivity-sidebar`) to preserve runtime updates without primary sensitivity table nodes.
- Legacy `results` nav entry has been removed from legacy left-rail user flow; `stage-results` DOM remains in place for controlled retirement.
- Legacy `stage-results` section is now hidden in legacy flow (retired stub), while DOM IDs remain mounted for parity and rollback safety.
- Legacy `roi` and `gotv` nav entries have been removed from legacy left-rail user flow; `stage-roi` and `stage-gotv` DOM remain mounted for controlled retirement.
- Legacy `stage-roi` and `stage-gotv` sections are now hidden in legacy flow (retired stubs), while DOM IDs remain mounted for parity and rollback safety.
- Timeline runtime (`renderTimelineModule`) now computes and cache-updates without requiring legacy timeline DOM gates (`timelineEnabled`, `tlPercent`, `tl*` fields), reducing `stage-gotv` deletion risk.
- Phase3 runtime (`renderPhase3Module`) now computes and refreshes MC freshness/results without requiring legacy `p3*` DOM gates, reducing `stage-results` deletion risk.
- Compatibility MC phase3 panels (`js/app/render/monteCarlo.js`, `js/render/monteCarlo.js`) now run without hard `p3*` DOM gates, preserving freshness/results update paths if legacy result nodes are absent.
- Conversion runtime panel (`renderConversionPanel`) now computes and continues phase3 refresh without hard requiring legacy `out*`/`convFeasBanner` nodes, reducing `stage-gotv` deletion risk.
- ROI runtime panel (`renderRoiModule`) no longer hard-returns when `roiTbody` is absent; ROI caches/banner/summary updates now remain live without legacy table nodes.
- Sensitivity snapshot render/run paths now tolerate missing legacy E4 DOM (`sens*` nodes, run button), keeping snapshot-cache behavior usable during/after legacy stage retirement.
- Decision confidence/intelligence runtime panels now compute/cache-update without hard requiring legacy `conf*` / `di*` DOM nodes, reducing coupling to legacy ROI/GOTV panel blocks.
- Weekly ops insights/freshness runtime panels now render with guarded writes when legacy `wk*` nodes are partially absent, reducing coupling to legacy execution sub-panels.
- Weekly ops summary runtime module (`renderWeeklyOpsModule`) no longer hard-returns on missing `wkGoal`; summary and execution status now continue with guarded writes when weekly legacy nodes are absent.
- Assumption drift runtime panel now renders with guarded writes when `drift*` nodes are partially absent, keeping drift compute path active during legacy sub-panel retirement.
- Scenario comparison runtime panel now renders with guarded writes when `scm*` nodes are partially absent, reducing hard coupling to legacy compare card wrappers.
- Scenario comparison runtime panel now guards `state.ui` access and scenario-registry initialization calls, preventing early-boot null dereference.
- Stress summary runtime panel now uses guarded writes and resilient summary input handling (`res?.stressSummary`), preventing avoidable render short-circuits.
- Assumptions snapshot runtime panel now renders with guarded writes when `assumptionsSnapshot` is absent, preserving assumption-block compute flow during legacy panel retirement.
- Guardrails runtime panel now renders with guarded writes when `guardrails` target is absent, preserving guardrail compute flow during partial DOM retirement.
- MC margin-chart runtime renderers now render with guarded writes when `svgMargin*` targets are partially absent (app + compat panel paths), preventing avoidable short-circuit during staged results-panel retirement.
- Legacy `integrity` nav entry has been removed from legacy left-rail user flow; `stage-integrity` DOM remains mounted for controlled retirement.
- Legacy `stage-integrity` section is now hidden in legacy flow (retired stub), while IDs remain mounted for parity and rollback safety.
- Controls v3 evidence table now renders from scenario-bridge intel state (`window.__FPE_SCENARIO_API__`) instead of mirroring legacy `#intelEvidenceTbody`.
- Controls v3 benchmark table now renders from scenario-bridge intel state (`window.__FPE_SCENARIO_API__`) and remove actions route by benchmark id, instead of mirroring legacy `#intelBenchmarkTbody`.
- Controls v3 feedback previews (what-if + recommendations) now render from scenario-bridge intel state and no longer mirror legacy preview textareas (`#intelWhatIfPreview/#intelRecommendationPreview`).
- Data v3 controls now execute through runtime data API bridge (`window.__FPE_DATA_API__`) with zero direct legacy selector bindings in the Data surface.

## Stage dependency map (current)
Counts below are unique legacy IDs referenced by each v3 surface.

| V3 Surface | Legacy Container(s) | Legacy ID Count |
| --- | --- | --- |
| District | `stage-ballot` | 7 |
| District | `stage-checks` | 60 |
| District | `stage-setup` | 4 |
| District | `stage-structure` | 6 |
| District | `stage-universe` | 3 |
| Reach | `stage-capacity` | 0 |
| Outcome | `stage-results` | 0 |
| Turnout | `stage-roi` | 0 |
| Plan | `stage-roi` | 0 |
| Plan | `stage-gotv` | 0 |
| Controls | `stage-checks` | 46 |
| Scenarios | retired (`stage-scenarios`) | 0 |
| Decision Log | retired (`stage-decisions`) | 0 |
| Data | runtime data API bridge (`window.__FPE_DATA_API__`) | 0 |

## Safe delete order (enforced)
Delete only when the referenced surface(s) show zero bridge targets for that legacy container.

1. `stage-capacity`
Reason: isolated to Reach surface.

2. `stage-results`
Reason: v3 Outcome bridge targets are zero; remaining blocker is runtime result/rail render paths that still write/read legacy results-stage DOM.

3. `stage-roi`
Reason: v3 bridge dependencies are zero; remaining blocker is runtime ROI/optimization render paths still writing legacy stage-roi DOM.

4. `stage-gotv`
Reason: currently retained for District coupling during migration; Plan bridge dependencies have been removed.

5. `stage-checks`
Reason: shared by Controls and District Census/Targeting bridge.

6. `stage-integrity`
Reason: runtime data handlers are still legacy control-backed (event source IDs), so `stage-integrity` cannot be removed until Data handlers are fully native in runtime.

7. `stage-ballot`, `stage-universe`, `stage-structure`, `stage-setup`
Reason: setup compose path and District bridge still rely on setup-era DOM.

8. `#app-shell-legacy` wrapper and legacy nav/stage switching
Reason: final removal only after all stage containers above are retired and right rail is migrated or intentionally preserved.

## Per-stage retirement gate (must pass)
For each container before deletion:

1. Bridge targets for that container are zero in v3 surface code.
2. QA smoke passes:
   - `bridge-control-count`
   - `bridge-targets-exist`
   - stage selector checks in active pane
3. No console errors on:
   - stage switch loop (`district -> ... -> data -> district`)
   - control change loop (10+ edits)
4. Output parity:
   - same inputs -> same outputs as pre-delete checkpoint.
5. Rollback artifact created:
   - one zip/tag before deletion.

## Execution checklist (copy/paste sequence)
- [ ] Replace bridge reads/writes for one target container with native v3 state bindings.
- [ ] Run selector/bridge audits.
- [ ] Run v3 QA smoke from Diagnostics (`window.runV3QaSmoke()`).
- [ ] Manual parity sweep for affected surfaces.
- [ ] Delete target legacy container markup.
- [ ] Delete dead selectors/hooks tied to removed container.
- [ ] Re-run QA smoke and stage switching regression.
- [ ] Create checkpoint note and proceed to next container.

## Immediate next target
Recommended next retirement target: `stage-results` runtime decoupling pass (post-Outcome).  
Outcome v3 bridge targets are now zero; next shared blocker is runtime result/rail write-path coupling to legacy results-stage DOM.
