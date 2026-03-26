# V3 Contract Hygiene Sweep

Date: 2026-03-25

## Scope

Focused post-hardening contract alignment sweep for:

- V3 shell/layout/surface structure contracts
- context-row behavior tests
- office/context vocabulary tests

No feature changes and no math/Monte Carlo/optimizer changes were made.

## Stale contracts found and resolved

1. `js/app/v3/c9.shellLayout.contract.test.js` expected Turnout to use `createSurfaceFrame("two-col")`.
   - Why stale:
     - `js/app/v3/surfaces/turnout.js` intentionally uses `createCenterStackFrame()`.
     - Stronger authority already existed in:
       - `js/app/v3/surfaces/turnout.contract.test.js`
       - `js/app/v3/surfaces/layoutContract.test.js`
   - Resolution:
     - Updated c9 assertions to center-stack expectations + current summary-first append order.

2. After fixing Turnout assertion, same c9 block still expected Controls to use `createSurfaceFrame("two-col")`.
   - Why stale:
     - `js/app/v3/surfaces/controls.js` intentionally uses center-stack.
     - Stronger authority already existed in `js/app/v3/surfaces/layoutContract.test.js`.
   - Resolution:
     - Updated c9 assertions to center-stack expectations + current center-column append order.

## True implementation regressions

- None identified in this sweep.
- No implementation rollback was required to satisfy stale contracts.

## Tests run

1. V3 contract/layout/integrity suite:
   - `node --test js/app/v3/c9.shellLayout.contract.test.js js/app/v3/surfaces/layoutContract.test.js js/app/v3/surfaces/spacingContract.test.js js/app/v3/surfaces/moduleSpacingTargets.contract.test.js js/app/v3/surfaces/hardeningSurfaceIntegrity.contract.test.js js/app/v3/surfaces/turnout.contract.test.js js/app/v3/surfaces/district/renderLifecycle.contract.test.js js/app/v3/surfaces/district/phase5.integrity.test.js js/app/v3/surfaces/district/phase7.integrity.test.js js/app/v3/surfaces/district/c8.boundary.test.js js/app/v3/surfaces/electionData/phase6.integrity.test.js js/app/v3/surfaces/data/renderLifecycle.contract.test.js js/app/v3/surfaces/data/reportingGuidance.contract.test.js js/app/v3/surfaces/data/phase9.integrity.test.js js/app/v3/surfaces/outcome/renderLifecycle.contract.test.js js/app/v3/surfaces/outcome/phase10.integrity.test.js js/app/v3/surfaces/plan.eventCalendar.contract.test.js js/app/v3/surfaces/warRoom/renderLifecycle.contract.test.js js/app/v3/surfaces/warRoom/phase8.integrity.test.js`
   - Result: pass (86/86)

2. Context row + office/context canonicalization tests:
   - `node --test js/app/v3/contextScopeDraft.test.js js/app/shellBridgeRuntime.contextRow.test.js js/storage.contextRow.test.js js/core/officeContextLabels.test.js js/core/candidateHistoryBaseline.test.js js/core/dataView.officeLabels.test.js js/core/controlsView.officeLabels.test.js js/app/intelControlsRuntime.officeLabels.test.js js/app/districtOptionRegistry.test.js js/app/templateResolver.test.js`
   - Result: pass (46/46)

3. Final c9 re-run after stale-assertion updates:
   - `node --test js/app/v3/c9.shellLayout.contract.test.js`
   - Result: pass (7/7)
