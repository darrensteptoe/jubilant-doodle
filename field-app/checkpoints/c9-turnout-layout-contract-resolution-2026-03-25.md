# C9 Turnout Layout Contract Resolution

Date: 2026-03-25

## Decision

Authoritative side: **implementation + surface contract**.

- `js/app/v3/surfaces/turnout.js` intentionally uses `createCenterStackFrame()` and `createCenterStackColumn()`.
- `js/app/v3/surfaces/turnout.contract.test.js` already enforces that center-stack shape and explicitly rejects `two-col`.

The failing `js/app/v3/c9.shellLayout.contract.test.js` assertion expecting
`createSurfaceFrame("two-col")` was stale and inconsistent with the current intentional Turnout architecture.
After that stale assertion was corrected, a second stale `controls` two-col expectation surfaced in the same contract block; it was also updated to match the current center-stack implementation.

## Change made

Updated `c9.shellLayout.contract.test.js` to align Turnout checks with intended layout:

- require center-stack frame/column
- reject `two-col` for Turnout
- assert summary-first center stack append order
- align Controls checks to center-stack with summary-first append ordering

No Turnout surface implementation changes were made in this pass.
