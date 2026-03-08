# Operations Store Skeleton

This folder contains the isolated data layer for Operations (pipeline + shifts + turf + forecasting config).

Files:
- `schema.js`: schema and store constants
- `store.js`: IndexedDB CRUD + merge/replace helpers
- `io.js`: JSON snapshot import/export + CSV store import/export
- `rollups.js`: overlap-safe production/coverage rollups + dedupe counters

Current canonical stores:
- `persons`
- `pipelineRecords`
- `interviews`
- `onboardingRecords`
- `trainingRecords`
- `shiftRecords`
- `turfEvents`
- `forecastConfigs`
- `meta`

Design goals:
- Local-first storage on static hosting
- No dependency on engine compute paths
- Explicit import/export portability
- Display-only diagnostics for ramp/readiness (no engine mutation)

Current status:
- Hub page:
  - `/operations.html`
  - Includes CRUD for `interviews`, `onboardingRecords`, and `trainingRecords`
  - Includes CSV import/export controls for those stores
- Wired to standalone input pages:
  - `/operations-pipeline.html`
  - `/operations-shifts.html`
  - `/operations-turf.html`
  - `/operations-ramp.html`
- Engine integration limited to capacity compiler seam only (`compileEffectiveInputs` in app runtime)
- Safe to build page modules on top of this store

Source-of-truth policy:
- Production totals come from shifts.
- Turf attempts are coverage metrics and excluded from production totals by default.
- See `/THIRD_WING_SOURCE_OF_TRUTH.md`.
