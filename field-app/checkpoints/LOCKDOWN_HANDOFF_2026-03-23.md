# LOCKDOWN HANDOFF — 2026-03-23

## Release
- Release date: 2026-03-23
- Source path: `/Users/anakinskywalker/Downloads/field-app-40`
- Active runtime bundle: `/Users/anakinskywalker/Downloads/field-app-40/dist/assets/index-f_WHchW6.js`
- Build marker: `/Users/anakinskywalker/Downloads/field-app-40/dist/assets/build-D8U74VRh.js` (`BUILD_ID=c9a1d67`)

## Passing Checks / Gates
- `npm run build` — PASS
- `npm run check:interaction-integrity:strict` — PASS
- `npm run check:golden-fixtures` — PASS
- `npm run status:rebuild` — PASS (`8/8 complete`)
- `npm run debug:runtime-parity` — PASS
- `npm run gate:rebuild` — PASS
- `npm run gate:manual-parity` — PASS

## Access Surfaces
- Admin access surface:
  - `operations.html`
  - `operations-pipeline.html`
  - `operations-shifts.html`
  - `operations-turf.html`
  - `operations-ramp.html`
  - `organizer.html`
- Campaign access surface:
  - `index.html` (District, Reach, Outcome, Turnout, Plan, Scenarios, Decision Log, Controls, Data)

## Cloudflare Access Recommendation
- Split access policies by surface:
  - Admin policy (operations/organizer): strict allowlist group, enforced MFA, device posture checks.
  - Campaign policy (`index.html`): campaign-team allowlist with MFA.
- Keep admin and campaign sessions isolated (separate Access applications/policies).

## Freeze Rule
- This release is frozen.
- No further code changes without a new explicitly scoped mini phase and gate re-run.
