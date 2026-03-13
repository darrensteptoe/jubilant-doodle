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
- Legacy `results` nav entry is retired from legacy user flow; `stage-results` remains mounted for controlled runtime retirement.
- Legacy `stage-results` section is now hidden as a retired stub (IDs retained in DOM).
- Legacy `roi` and `gotv` nav entries are retired from legacy user flow; `stage-roi` and `stage-gotv` remain mounted for controlled runtime retirement.
- Legacy `stage-roi` and `stage-gotv` sections are now hidden as retired stubs (IDs retained in DOM).
- Timeline runtime (`renderTimelineModule`) now cache-updates timeline outputs even when legacy `timelineEnabled`/`tl*` DOM targets are absent, reducing hard gate coupling ahead of `stage-gotv` retirement.

## Remaining runtime coupling (intentional for now)

- None in the audited MC/risk render paths for `stage-results`.
- `stage-results` is still retained as a hidden legacy stub for reversible cutover and parity checks.

## Next safe step

1. Keep `stage-results`, `stage-roi`, and `stage-gotv` as hidden stubs through final cutover for reversibility.
2. Start equivalent runtime decoupling audit for `stage-roi` and `stage-gotv` render/write paths.
3. Retire legacy `stage-results` markup only after `stage-roi` and `stage-gotv` runtime audits pass.
