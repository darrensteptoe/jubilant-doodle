# Post-Rebuild Architectural Drift Gate (H10)

## Scope landed
- Added dedicated architectural drift gate:
  - `scripts/gate-architectural-drift.mjs`
- Added gate test:
  - `scripts/gate-architectural-drift.test.mjs`
- Added npm command:
  - `npm run gate:drift`

## Gate checks (rebuilt strict scope)
1. duplicate canonical field ownership
2. deprecated wrapper usage past retirement deadline
3. mixed bridge dependency regression in strict rebuilt modules
4. control hydration lane drift (canonical vs derived)
5. write-path bypass drift outside actions/bridge mutation paths
6. selector bypass/raw cache truth drift
7. center-module full-width layout contract drift

## Artifacts
- `audit/architectural-drift-gate.json`
- `audit/architectural-drift-gate.md`

## Verification commands
- `node --test scripts/gate-architectural-drift.test.mjs`
- `npm run gate:drift`
- `npm run gate:rebuild`
- `npm run build`

## Results
- `node --test scripts/gate-architectural-drift.test.mjs`
  - PASS (`tests=1, pass=1, fail=0`)
- `npm run gate:drift`
  - PASS (`total=7 pass=7 fail=0`)
- `npm run gate:rebuild`
  - PASS (`strict-gate: PASS`)
- `npm run build`
  - PASS (`vite build`; 321 modules transformed)

## Time-bounded exception tracked by gate
- Allowed mixed-bridge exception:
  - file: `js/app/v3/surfaces/warRoom/index.js`
  - token: `api.getView()`
  - expiry: `2026-06-30`
  - reason: staged weather/event bridge split migration
