# C9.4A Freeze — Census Narrowing + Targeting Lab Run-State Hardening

Date: 2026-03-22  
Scope: C9.4A only (District Census narrowing contract + Targeting Lab readiness/silent-failure hardening)

## Scope completed
- Restored explicit Targeting Lab readiness gating for `Run targeting` in District V2.
- Added non-silent Targeting action failure handling for:
  - null bridge result
  - `no_rows`
  - lock state / rejected action codes
- Tightened Census hierarchy behavior to keep county available for place-level narrowing and to filter place options by selected county.
- Ensured bridge-published place options are county-filtered in District V2 canonical census config path.

## Root causes addressed
1. Targeting actions could fail silently (`null` bridge result path) while UI simply refreshed.
2. `Run targeting` in District V2 was only disabled on lock, not on readiness (`canRun=false`).
3. Census place options were not consistently narrowed by selected county in runtime-rendered option rows.

## Files changed
- `js/app/v3/surfaces/districtV2/index.js`
- `js/app/censusPhase1.js`
- `js/appRuntime.js`
- `js/app/v3/surfaces/district/renderLifecycle.contract.test.js`
- `js/core/selectors/districtMirrorCompatibilityLayer.test.js`

## Tests/checks run
- `node --test js/app/v3/surfaces/district/renderLifecycle.contract.test.js js/core/selectors/districtMirrorCompatibilityLayer.test.js` -> pass (26/26)
- `npm run check:interaction-integrity` -> pass (`total=113 pass=113 fail=0`)
- `npm run build` -> pass

## Browser parity evidence
- Built bundle verified in headless browser DOM: `/assets/index-CFZzYqL0.js`
- District V2 targeting run control observed disabled when not ready:
  - `#v3BtnDistrictV2RunTargeting` includes `disabled`
- District V2 targeting status shows explicit readiness guidance:
  - `#v3DistrictV2TargetingStatus` = `Load ACS rows before running targeting.`
- District V2 census county selector remains present/enabled by state context in V2 surface path (not forced off by non-county resolutions).

## Freeze decision
C9.4A frozen.

---

## Follow-up — Hard Rebuild of District V2 Targeting Module (Contained)

Date: 2026-03-22  
Scope: District V2 Targeting Config module only (no broadened District rewrite)

### Additional root cause found
- District V2 still had split targeting wiring:
  - New module file existed, but active runtime still executed legacy targeting sync/bind/mutation handlers in `districtV2/index.js`.
  - This left legacy paths active and allowed runtime failures to look like dead-button behavior.
- Runtime targeting execution needed a stronger fallback resolution for `runTargetRanking` symbol lookup.

### Additional fixes landed
1. `districtV2/index.js` targeting lane hard-cut to module:
   - `syncDistrictV2Targeting(...)` now delegates to `districtV2TargetingModule.sync(...)` with Census context.
   - `bindDistrictV2TargetingHandlers()` now delegates to `districtV2TargetingModule.bind(...)`.
   - `handleDistrictV2MutationResult(...)` now delegates targeting failure/status handling to module `handleMutationResult(...)`.
2. Removed active usage of legacy in-index targeting bind/sync helpers from the live path.
3. Added runtime fallback import in `appRuntime.js`:
   - `runTargetRanking as runTargetRankingRuntime`
   - `districtBridgeRunTargeting()` now resolves runtime function from module namespace first, then named import fallback, then global fallback.
4. Updated contract tests to assert targeting behavior against the new module file, not retired in-index helpers.

### Additional files changed
- `js/app/v3/surfaces/districtV2/index.js`
- `js/app/v3/surfaces/district/renderLifecycle.contract.test.js`
- `js/core/selectors/districtMirrorCompatibilityLayer.test.js`
- `js/appRuntime.js`

### Additional checks run
- `node --test js/app/v3/surfaces/district/renderLifecycle.contract.test.js` -> pass (15/15)
- `node --test js/core/selectors/districtMirrorCompatibilityLayer.test.js` -> pass (13/13)
- `node --test js/core/selectors/districtV2.persistence.test.js` -> pass (11/11)
- `npm run check:contracts` -> pass
- `npm run check:district-integrity` -> pass
- `npm run check:interaction-integrity` -> pass (`total=113 pass=113 fail=0`)
- `npm run check:interaction-pages` -> pass (`tier1_stable=yes tier1_available=9 surfaces=15`)
- `npm run build` -> pass

### Browser parity note
- Headless browser parity could not be executed in this sandbox session due local preview networking isolation (`ERR_CONNECTION_REFUSED` from separate exec session).
- Built bundle inspection confirms:
  - Targeting module code is present in runtime bundle.
  - `runTargetRanking is not defined` string is absent.
