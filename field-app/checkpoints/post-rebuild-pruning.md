# Post-Rebuild Pruning (H6)

## Batch 1 (small/reversible)

### Scope
- Removed dead compatibility alias:
  - `readDistrictSnapshot()` from `js/app/v3/stateBridge.js`
- Verified no remaining references to removed alias.

### Why this was safe
- Alias had no callers in the repository (`rg` search returned no matches).
- Canonical replacement remains: `readDistrictSummarySnapshot()`.
- No behavior logic changed beyond dead export removal.

### Verification commands
- `rg -n "readDistrictSnapshot\\(" js -g '*.js'`
  - result: no matches
- `npm run check:interaction-integrity`
  - PASS (`total=113 pass=113 fail=0 high_priority_missing=0`)
- `npm run build`
  - PASS (`vite build` completed)

### Drift/golden note
- No dedicated golden full-state fixture suite is present yet in this phase scope.
- Used interaction integrity + build as no-drift guardrails for this batch.

## Batch 2 (small/reversible)

### Scope
- Removed surface compatibility wrapper files:
  - `js/app/v3/surfaces/district.js`
  - `js/app/v3/surfaces/data.js`
  - `js/app/v3/surfaces/outcome.js`
  - `js/app/v3/surfaces/electionData.js`
  - `js/app/v3/surfaces/decisionLog.js`
- Migrated `js/app/v3/stageMount.js` imports to direct module entries:
  - `./surfaces/district/index.js`
  - `./surfaces/data/index.js`
  - `./surfaces/outcome/index.js`
  - `./surfaces/electionData/index.js`
  - `./surfaces/warRoom/index.js` (`renderWarRoomSurface as renderDecisionLogSurface`)
- Updated integrity tests to verify direct stage-mount imports instead of wrapper-file exports:
  - `js/app/v3/surfaces/data/phase9.integrity.test.js`
  - `js/app/v3/surfaces/outcome/phase10.integrity.test.js`

### Why this was safe
- Runtime had a single caller (`stageMount`) for these wrappers.
- Call sites now import decomposed surface directories directly.
- Tree scans confirm no remaining imports or test references to removed wrapper files.

### Verification commands
- `rg -n "\\./surfaces/(district|data|outcome|electionData|decisionLog)\\.js|js/app/v3/surfaces/(district|data|outcome|electionData|decisionLog)\\.js" js -g '*.js'`
  - result: no matches
- `rg -n "\\../(district|data|outcome|electionData|decisionLog)\\.js" js/app/v3 -g '*.test.js'`
  - result: no matches
- `node --test js/app/v3/surfaces/data/phase9.integrity.test.js`
- `node --test js/app/v3/surfaces/outcome/phase10.integrity.test.js`
- `npm run check:interaction-integrity`
- `npm run build`

### Drift/golden note
- No dedicated golden full-state fixture suite is present yet in this phase scope.
- Used phase integrity tests + interaction integrity + build as no-drift guardrails for this batch.
