# Phase 10 - Outcome Rewire and Decomposition

## Scope landed
- Split Outcome into a dedicated `outcome/` module directory.
- Converted `outcome.js` into a compatibility wrapper to `./outcome/index.js`.
- Decomposed Outcome orchestration into focused modules:
  - `forecast` (canonical control wiring + MC run control sync)
  - `governance` (governance/risk flag synchronization)
  - `sensitivity` (sensitivity table rendering)
  - `surface` (surface/stress table rendering + impact trace fallback)
- Preserved canonical/derived bridge lane split in `outcome/index.js`:
  - control hydration via `readOutcomeCanonicalBridgeView()`
  - output hydration via `readOutcomeDerivedBridgeView()`
  - compatibility fallback via combined bridge view only when canonical/derived snapshots are unavailable.
- Kept full-width center-stack layout contract for all Outcome modules.

## Files
- `js/app/v3/surfaces/outcome/index.js`
- `js/app/v3/surfaces/outcome/forecast.js`
- `js/app/v3/surfaces/outcome/governance.js`
- `js/app/v3/surfaces/outcome/sensitivity.js`
- `js/app/v3/surfaces/outcome/surface.js`
- `js/app/v3/surfaces/outcome/phase10.integrity.test.js`
- `js/app/v3/surfaces/outcome.js`
- `js/app/v3/surfaces/layoutContract.test.js`

## Test intent
- Outcome decomposition is enforced at import/orchestration level.
- Canonical controls and derived outputs remain lane-split.
- MC run/rerun/surface actions remain bound through forecast module orchestration.
- Governance/sensitivity/surface panels refresh through dedicated modules.
- Active-field guard remains in place to prevent control reversion while editing.
- Outcome center layout remains full-width center-stack only.
