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
| Outcome | `stage-results` | 43 |
| Turnout | `stage-roi` | 30 |
| Plan | `stage-roi` | 22 |
| Plan | `stage-gotv` | 4 |
| Controls | `stage-checks` | 50 |
| Scenarios | retired (`stage-scenarios`) | 0 |
| Decision Log | retired (`stage-decisions`) | 0 |
| Data | `stage-integrity` | 10 |

## Safe delete order (enforced)
Delete only when the referenced surface(s) show zero bridge targets for that legacy container.

1. `stage-capacity`
Reason: isolated to Reach surface.

2. `stage-results`
Reason: shared by Outcome and Turnout; remove only after both are native C-state.

3. `stage-roi`
Reason: shared by Turnout and Plan.

4. `stage-gotv`
Reason: shared by District (electorate controls) and Plan (workload outputs).

5. `stage-checks`
Reason: shared by Controls and District Census/Targeting bridge.

6. `stage-integrity`
Reason: shared by Data plus sidebar KPI fallbacks used by Outcome/Turnout.

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
Recommended next retirement target: `stage-results` bridge-reduction pass (Outcome focus).  
`stage-capacity` and Turnout's direct `stage-results` dependency have been retired from user flow; next shared blocker is `stage-results` reads in Outcome.
