# Third Wing Store Skeleton

This folder contains the isolated data layer for Third Wing (pipeline + shifts + turf + forecasting config).

Files:
- `schema.js`: schema and store constants
- `store.js`: IndexedDB CRUD + merge/replace helpers
- `io.js`: JSON snapshot import/export + CSV store import/export
- `rollups.js`: overlap-safe production/coverage rollups + dedupe counters

Design goals:
- Local-first storage on static hosting
- No dependency on engine compute paths
- Explicit import/export portability

Current status:
- Hub page:
  - `/Users/anakinskywalker/Downloads/field-app-40/camio.html`
- Wired to standalone input pages:
  - `/Users/anakinskywalker/Downloads/field-app-40/third-wing-pipeline.html`
  - `/Users/anakinskywalker/Downloads/field-app-40/third-wing-shifts.html`
  - `/Users/anakinskywalker/Downloads/field-app-40/third-wing-turf.html`
  - `/Users/anakinskywalker/Downloads/field-app-40/third-wing-ramp.html`
- Engine integration limited to capacity compiler seam only (`compileEffectiveInputs` in app runtime)
- Safe to build page modules on top of this store

Source-of-truth policy:
- Production totals come from shifts.
- Turf attempts are coverage metrics and excluded from production totals by default.
- See `/Users/anakinskywalker/Downloads/field-app-40/THIRD_WING_SOURCE_OF_TRUTH.md`.
