# Phase 23 — Pre-Audit Prune / Relevance Pass

Date: 2026-03-20

## Required Outputs
- `prune/relevance-matrix.csv`
- `prune/prune-decisions.md`

## Relevance Matrix Results
- Total artifacts classified: 141
- Classification counts:
  - `KEEP`: 137
  - `KEEP_BUT_SIMPLIFY`: 0
  - `KEEP_BUT_REHOME`: 0
  - `REPLACE`: 0
  - `REMOVE`: 4

Coverage includes:
- all inventoried interactive inputs (from interaction inventory)
- helper/runtime paths
- formula owners
- warning/render/export surfaces
- model/doctrine/glossary/playbook registries

## Prune Actions Executed
Deleted low-risk compatibility facades:
- `js/renderIntelChecks.js`
- `js/wireEventsRuntime.js`
- `js/app/wireEvents.js`

Canonicalized USB status ownership in Data bridge:
- `js/appRuntime.js`
  - removed legacy `els.usbStorageStatus` fallback read in bridge status application
  - removed legacy `els.usbStorageStatus` fallback read in data bridge view state

Replaced legacy right-rail attachment path with native owner path:
- `js/app/v3/stageMount.js`
  - `syncRightRail()` now parks legacy rail in `legacyDomPool`.
  - live right rail is mounted via intelligence panel only.
- `index.html`
  - boot hook no longer appends `#legacyResultsSidebar` into `#v3RightRailSlot`.

## Validation
- `npm run check:canonical-math` ✅
- `npm run check:interaction-integrity` ✅
- `npm run check:interaction-pages` ✅ (`tier1_stable=yes`)
- `npm run build` ✅ (under explicit chunk warning budget policy)
- `npm run gate:rebuild` ✅ after explicit chunk warning budget (`chunkSizeWarningLimit: 2100`)

## Open Items Carried Forward
- `REMOVE` (planned): inline render-file warning meaning text where present

## Phase Boundary
- Phase 23 completed as prune/relevance pass.
- Phase 24 canonicalization is next.
- Contracts/diagnostics (Phase 25) remain deferred.
