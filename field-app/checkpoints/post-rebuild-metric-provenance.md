# Post-Rebuild Metric Provenance (H8)

## Scope landed
- Added metric provenance diagnostics builder and tracker:
  - `js/core/state/metricProvenance.js`
- Added provenance tests:
  - `js/core/state/metricProvenance.test.js`
- Exposed a developer/debug bridge (no user-facing UI impact):
  - `window.__FPE_METRIC_PROVENANCE_API__` from `js/appRuntime.js`
  - methods:
    - `getView()`
    - `getMetrics()`
    - `reset()`

## Key metrics covered
- baseline support
- turnout expected
- persuasion need
- targeting score
- outcome confidence
- election benchmark quality

Each metric includes:
- canonical slice path list
- selector origin
- electionData/census/candidateHistory influence flags
- revision token
- `lastRecomputedAt` timestamp

## Recompute behavior
- `createMetricProvenanceTracker()` maintains per-metric `lastRecomputedAt`.
- Timestamp updates only when that metric's domain revision token changes.

## Verification commands
- `node --test js/core/state/metricProvenance.test.js`
- `npm run build`

## Results
- `node --test js/core/state/metricProvenance.test.js`
  - PASS (`tests=3, pass=3, fail=0`)
- `npm run check:interaction-integrity`
  - PASS (`total=113 pass=113 fail=0 high_priority_missing=0`)
- `npm run build`
  - PASS (`vite build` completed; 321 modules transformed)
