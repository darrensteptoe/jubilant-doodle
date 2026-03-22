# C9.5 Freeze — Page-by-Page Layout / Order Pass

Date: 2026-03-21  
Scope: C9.5 only (Reach/Turnout/Plan/Scenarios/Controls/War Room/Data/Outcome ordering + density-layout contract checks)

## Scope completed
- Updated Reach module order so **Weekly production** now renders above **Constraints & levers** in page flow.
- Expanded C9 shell/layout contract coverage to assert page ordering and density layout decisions across C9.5 target pages:
  - Reach summary-first + weekly-before-levers flow
  - Turnout inputs-before-comparison flow
  - Plan summary-first
  - Scenarios balanced 50/50 layout
  - Controls summary-first governance column ordering
  - War Room summary-first ordering
  - Data summary-first ordering and archive snapshot containment style hook
- Kept scope contained (no C9.6 CSS standardization pass yet).

## Files changed
- `js/app/v3/surfaces/reach.js`
- `js/app/v3/c9.shellLayout.contract.test.js`

## Tests/checks run
- `node --test js/app/v3/c9.shellLayout.contract.test.js` -> pass (6/6)
- `node --test js/app/v3/surfaces/district/renderLifecycle.contract.test.js js/app/v3/surfaces/outcome/renderLifecycle.contract.test.js js/app/v3/surfaces/warRoom/renderLifecycle.contract.test.js js/app/v3/surfaces/data/renderLifecycle.contract.test.js` -> pass (24/24)
- `npm run check:interaction-integrity` -> pass (`total=113 pass=113 fail=0`)
- `npm run check:interaction-pages` -> pass (`tier1_stable=yes tier1_available=9 surfaces=15`)
- `npm run build` -> pass

## Browser/manual parity evidence
- Preview runtime: `http://127.0.0.1:4183/`
- Stage DOM captures:
  - `/tmp/c95_reach.log`
  - `/tmp/c95_turnout.log`
  - `/tmp/c95_plan.log`
  - `/tmp/c95_scenarios.log`
  - `/tmp/c95_controls.log`
  - `/tmp/c95_decision-log.log`
  - `/tmp/c95_data.log`
  - `/tmp/c95_outcome.log`
- All captured pages resolved to latest built bundle in session:
  - `/assets/index-ChL6Rz1b.js`
- Verified via DOM captures:
  - Reach: `Reach summary` present in top flow; `Weekly production` now appears ahead of constraints/levers flow.
  - Turnout: assumptions/lift/efficiency-inputs render before comparison output module.
  - Plan: `Plan summary` appears before workload/optimization blocks.
  - Scenarios: `fpe-surface-frame--two-col-balanced` present (50/50 class).
  - Controls: `Current warnings` renders before guardrail workflow module.
  - War Room: `Decision summary` renders before decision session module.
  - Data: `Data summary` renders before policy/import/storage/archive modules.
  - Outcome: `Outcome summary` remains top of stack.

## Transitional helpers / deferred items
- No render-lifecycle transitional helper changes in this pass.
- C9.6 CSS standardization remains deferred and not started.

## Freeze decision
C9.5 frozen.
