# Stage-Results Runtime Decoupling Audit (2026-03-13)

Scope: `js/app/*` runtime/write paths only.  
Goal: reduce hard coupling to legacy `stage-results` DOM without deleting markup yet.

## Changes applied in this pass

- `js/app/renderMcResults.js`
  - removed hard gate on `els.mcWinProb` primary node.
  - now renders win probability and P10/P50/P90 to sidebar targets when primary nodes are absent.
  - guarded writes to `mcMedian`, `mcP5`, `mcP95`.

- `js/app/render/monteCarlo.js`
  - same sidebar-capable safety changes as above for the panel path.

- `js/app/renderAssumptions.js`
  - removed hard gate on `els.assumptionsSnapshot`.
  - assumptions block render now uses guarded writes, preserving compute/update flow when snapshot mount target is absent.

- `js/app/renderGuardrails.js`
  - removed hard gate on `els.guardrails`.
  - guardrails panel render now uses guarded writes and resilient guardrail list extraction.

- `js/app/renderMcVisuals.js`
  - removed hard all-node gate on `svgMargin*` chart IDs.
  - margin-chart render path now uses guarded writes for partial/missing chart targets.

- `js/app/backupRecovery.js`
  - removed hard gate on `els.restoreBackup` in backup dropdown refresh path.
  - backup list refresh now uses guarded writes and no-op safety when restore-select target is absent.

- `js/app/decisionSessionApp.js`
  - removed hard gates on `decisionOptionSelect` and `decisionSessionSelect/decisionActiveLabel` panel entry points.
  - decision session/options panels now continue guarded updates for other available nodes even when select nodes are absent.

- `js/app/sensitivitySurfaceUi.js`
  - sensitivity default-application path now uses guarded lever/range refs (`surfaceLever/surfaceMin/surfaceMax`) via local refs.

- `js/appRuntime.js`
  - weekly undo helper (`syncWeeklyUndoUI`) now uses guarded button ref instead of direct hard return on `wkUndoActionBtn`.
  - MC/GOTV mode sync helpers now use guarded refs for mode toggles and pill classes (no direct `els.*` hard-return gates on `mc*` / `gotv*` mode targets).

- `js/app/preflightEls.js`
  - preflight required-ID enforcement is now feature-aware for Census and Targeting groups.
  - Census/Targeting IDs are only required when their anchor nodes are present, reducing false missing-ID diagnostics during staged legacy retirement.

- `js/app/render/executionAnalysis.js`
  - conversion panel now caches derived workload + feasibility outputs into `state.ui.lastConversion`.
  - runtime conversion model remains readable even when legacy `out*` or banner nodes are not mounted.

- `js/app/weeklyOpsPanels.js`
  - weekly ops summary panel now caches derived weekly context into `state.ui.lastWeeklyOps`.
  - this provides a non-DOM source for weekly gap/constraint/banner context during staged legacy panel retirement.

- `js/app/v3/kpiBridge.js`
  - KPI bottleneck inference now reads weekly gap from Reach runtime bridge view first.
  - legacy `#wkGapPerWeek` remains compatibility fallback only.

- `js/app/monteCarloApp.js`
  - freshness renderer now runs with sidebar-only tags (`mcFreshTag-sidebar`, `mcLastRun-sidebar`, `mcStale-sidebar`).
  - removed assumptions that primary freshness tags always exist.
  - D2/D3 envelope renderers (`renderOpsEnvelopeD2`, `renderFinishEnvelopeD3`) now compute/cache-update without requiring primary `opsAtt*` / `opsFinish*` DOM nodes.

- `js/app/mcState.js`
  - stale-state controller now handles sidebar-only stale tag nodes.

- `js/app/render/riskFraming.js`
  - risk panel now supports sidebar-only targets (`riskBandTag-sidebar`, `riskWinProb-sidebar`, `riskMarginBand-sidebar`, `riskVolatility-sidebar`, `riskPlainBanner-sidebar`).

- `js/app/monteCarloApp.js` (`renderMissRiskD4`)
  - removed DOM-presence gate on `opsMissProb/opsMissTag`.
  - D4 miss-risk now computes and updates `state.ui.missRiskD4` cache even when legacy miss-risk nodes are absent.
  - D4 miss-risk now mirrors probability + severity tag to right-rail IDs (`opsMissProb-sidebar`, `opsMissTag-sidebar`).

- `js/app/render/monteCarlo.js`
  - median/upside/downside KPI fields (`mcMedian`, `mcP95`, `mcP5`) now dual-write to sidebar mirror IDs.
  - confidence adjunct outputs (`mcMoS`, downside/ES10, shift targets, shocks, risk grade/label, fragility/cliff) now dual-write to sidebar mirror IDs.

- `js/app/renderMcResults.js`
  - same confidence adjunct dual-write behavior for runtime module path.
  - sensitivity rows now dual-render to hidden sidebar mirror target (`mcSensitivity-sidebar`).

- `js/render/monteCarlo.js`
  - compatibility mirror kept in sync for confidence adjunct dual-write behavior.
  - compatibility mirror kept in sync for sensitivity mirror target writes.
  - compatibility mirror kept in sync for guarded `svgMargin*` chart rendering.

- `index.html` + `js/ui/els.js`
  - added right-rail mirror nodes/selectors for adjunct metrics (`* -sidebar` IDs), implemented as hidden mirror targets to avoid visual redesign in this pass.

Compatibility mirror updated:
- `js/render/monteCarlo.js`
- `js/render/riskFraming.js`

## Current outcome

- V3 KPI + Outcome/Reach surfaces no longer require primary `stage-results` nodes for core probability/margin/risk display.
- Runtime MC/risk freshness and framing can continue updating right-rail/sidebar outputs if primary results-stage elements are removed.
- Runtime D2/D3/D4 envelope caches now remain live even when primary results-stage envelope tables are absent.
- Runtime MC confidence adjunct values now continue updating through sidebar mirror IDs even if primary adjunct table nodes are removed.
- Runtime sensitivity rows now continue updating through sidebar mirror target (`mcSensitivity-sidebar`) even if primary sensitivity table is absent.
- Runtime assumptions snapshot + guardrails panels now continue compute/update flow even when corresponding legacy mount targets are absent.
- Runtime MC margin-chart renderers now tolerate partial/missing `svgMargin*` nodes without hard short-circuit.
- Runtime backup dropdown refresh now tolerates missing restore-select target without hard short-circuit.
- Runtime decision session/options panels now tolerate missing select/label targets while preserving guarded updates to other panel nodes.
- Runtime shell helpers now tolerate missing weekly-undo/mode-toggle nodes without direct `els.*` hard-return gating.
- Runtime preflight now tolerates missing Census/Targeting groups when those feature anchors are absent, reducing non-actionable `dom-preflight` noise.
- Legacy `results` nav entry is retired from legacy user flow; `stage-results` remains mounted for controlled runtime retirement.
- Legacy `stage-results` section is now hidden as a retired stub (IDs retained in DOM).
- Legacy `roi` and `gotv` nav entries are retired from legacy user flow; `stage-roi` and `stage-gotv` remain mounted for controlled runtime retirement.
- Legacy `stage-roi` and `stage-gotv` sections are now hidden as retired stubs (IDs retained in DOM).
- Timeline runtime (`renderTimelineModule`) now cache-updates timeline outputs even when legacy `timelineEnabled`/`tl*` DOM targets are absent, reducing hard gate coupling ahead of `stage-gotv` retirement.
- Phase3 runtime (`renderPhase3Module`) now cache-updates and still runs MC freshness/results even when legacy `p3*` output nodes are absent, reducing hard gate coupling ahead of `stage-results` retirement.
- Compatibility phase3 MC renderers (`js/app/render/monteCarlo.js`, `js/render/monteCarlo.js`) now run without hard `p3*` DOM gates.
- Conversion runtime panel now computes and still invokes phase3 refresh without hard requiring legacy `out*` / `convFeasBanner` nodes.
- ROI runtime panel now keeps cache/banner/summary updates active without hard requiring `roiTbody` (legacy table render path is conditional).
- Sensitivity snapshot render/run paths now tolerate missing legacy E4 DOM targets (`sens*` nodes), preserving cache compute/persist behavior.
- Decision confidence/intelligence runtime panels now tolerate missing legacy `conf*` / `di*` nodes via guarded writes, preserving compute paths as legacy ROI/GOTV blocks are retired.
- Weekly ops insights/freshness runtime panels now tolerate missing legacy `wk*` nodes via guarded writes, preserving compute/update behavior during retired-stub cleanup.
- Weekly ops summary runtime module (`renderWeeklyOpsModule`) now tolerates missing `wkGoal` and continues summary/execution refresh with guarded writes.
- Assumption drift runtime panel now tolerates missing `drift*` nodes with guarded writes while preserving drift compute/update behavior.
- Scenario comparison runtime panel now tolerates missing `scm*` nodes with guarded writes while preserving diff computation/render flow.
- Scenario comparison runtime panel now guards `state.ui`/registry access for early-boot safety (no null dereference on missing scenario UI state).
- Stress summary runtime panel now tolerates missing/invalid stress summaries with guarded writes (`res?.stressSummary` array guard).
- Legacy `integrity` nav entry is retired from legacy user flow; `stage-integrity` remains mounted for controlled runtime retirement.
- Legacy `stage-integrity` section is now hidden as a retired stub (IDs retained in DOM).

## Remaining runtime coupling (intentional for now)

- None in the audited MC/risk render paths for `stage-results`.
- `stage-results` is still retained as a hidden legacy stub for reversible cutover and parity checks.

## Next safe step

1. Keep `stage-results`, `stage-roi`, and `stage-gotv` as hidden stubs through final cutover for reversibility.
2. Start equivalent runtime decoupling audit for `stage-roi` and `stage-gotv` render/write paths.
3. Retire legacy `stage-results` markup only after `stage-roi` and `stage-gotv` runtime audits pass.
