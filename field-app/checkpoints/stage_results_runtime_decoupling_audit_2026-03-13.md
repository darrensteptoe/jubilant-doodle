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

- `js/app/mcState.js`
  - stale-state controller now handles sidebar-only stale tag nodes.

- `js/app/render/riskFraming.js`
  - risk panel now supports sidebar-only targets (`riskBandTag-sidebar`, `riskWinProb-sidebar`, `riskMarginBand-sidebar`, `riskVolatility-sidebar`, `riskPlainBanner-sidebar`).

- `js/app/monteCarloApp.js` (`renderMissRiskD4`)
  - removed DOM-presence gate on `opsMissProb/opsMissTag`.
  - D4 miss-risk now computes and updates `state.ui.missRiskD4` cache even when legacy miss-risk nodes are absent.

Compatibility mirror updated:
- `js/render/monteCarlo.js`
- `js/render/riskFraming.js`

## Current outcome

- V3 KPI + Outcome/Reach surfaces no longer require primary `stage-results` nodes for core probability/margin/risk display.
- Runtime MC/risk freshness and framing can continue updating right-rail/sidebar outputs if primary results-stage elements are removed.

## Remaining runtime coupling (intentional for now)

- Primary-only legacy readouts that have no sidebar equivalent remain optional writes:
  - `mcMedian`, `mcP5`, `mcP95`
  - confidence adjunct table fields (`mcMoS`, `mcDownside`, `mcES10`, `mcShift*`, `mcShock*`, `mcRiskLabel`)
  - `mcSensitivity` table
  - `opsMissProb` / `opsMissTag`

These no longer block boot if missing, but legacy pane parity would degrade if removed before native replacements are completed.

## Next safe step

1. Add native v3/bridge equivalents for `opsMissProb`/`opsMissTag` and confidence adjunct readouts.
2. Move any remaining consumers from primary-only IDs to bridge cache or right-rail IDs.
3. Only then retire `stage-results` markup behind a hidden stub.
