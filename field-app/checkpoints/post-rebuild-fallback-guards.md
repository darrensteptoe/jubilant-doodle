# Post-Rebuild No-Silent-Fallback Guards (H4)

## Scope landed
- Added fallback guard utility module:
  - `js/core/state/fallbackGuards.js`
- Added H4 guard tests:
  - `js/core/state/fallbackGuards.test.js`
- Applied guard wiring in rebuilt bridge modules:
  - `js/app/v3/bridges/districtBridge.js`
  - `js/app/v3/bridges/outcomeBridge.js`
  - `js/app/v3/bridges/weatherRiskBridge.js`
  - `js/app/v3/bridges/eventCalendarBridge.js`
- Applied selector-input guard in rebuilt selector layer:
  - `js/core/selectors/targetingDerived.js`
- Applied field-ownership guard checks in district action lane:
  - `js/core/actions/district.js`

## Guard behaviors added
### Missing canonical/derived readers
- `guardMissingCanonicalReader(...)`
- `guardMissingDerivedReader(...)`
- Used in district/outcome bridge lanes before falling back to compatibility view.

### Deprecated wrapper usage
- `guardDeprecatedCompatibilityWrapperUsage(...)`
- Emits loud warnings when `getView()` compatibility paths are used.

### Missing module contracts
- `guardMissingModuleContract(...)`
- Used for missing bridge API objects or missing required bridge methods.

### Missing required selector inputs
- `guardRequiredSelectorInputs(...)`
- Applied in `selectTargetingDerivedView` to verify required canonical input paths.

### Unknown field ownership
- `guardUnknownFieldOwnership(...)`
- Applied in district form/template update actions for ownership registry checks.

## Environment behavior
- In `runtimeEnv: test` (or strict mode), error-level guard issues throw (`FallbackGuardError`).
- In production/development non-strict mode, error-level issues log loudly via `logger.error` without crashing.
- Warn-level issues always warn loudly and are deduped per guard context.

## Test coverage
`js/core/state/fallbackGuards.test.js` verifies:
1. test-mode missing canonical/derived reader failures throw
2. test-mode missing module contracts throw
3. test-mode missing selector input and unknown ownership throw
4. production-mode deprecated wrapper usage warns without throwing
5. production-mode missing module contract logs loudly without crashing

## Commands and outcomes
- `node --test js/core/state/fallbackGuards.test.js`
  - PASS (`5 passed, 0 failed`)
- `node --test js/app/v3/bridges/phase11.cleanup.test.js`
  - PASS (`5 passed, 0 failed`)
- `node --test js/core/selectors/selectors.test.js`
  - PASS (`4 passed, 0 failed`)
- `npm run build`
  - PASS (`vite build` completed)
