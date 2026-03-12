# FPE UI 3.0 Legacy Retirement Checklist

Date: 2026-03-11  
Scope: Phase 12+ retirement planning for legacy stage containers and legacy shell wrappers.

Reference artifact:
- `checkpoints/legacy_dependency_matrix.tsv` (generated 2026-03-11; per-surface legacy ID -> stage location map).

## Non-negotiable guardrails
- Do not touch `js/core/*` math or engine formulas.
- Keep right rail behavior/content frozen until final cutover.
- Remove legacy containers only when bridge dependency count is zero for that container.
- Keep each retirement step reversible (one PR/checkpoint per stage cluster).

## Current blocker inventory (must clear before deleting legacy shell)
- `js/app/composeSetupStage.js` still composes and re-parents legacy setup content using:
  - `#stage-setup`
  - `#stage-ballot .phase-p3`
- `js/appRuntime.js` still executes `composeSetupStageModule()` during boot.
- `js/app/v3/stageMount.js` still mounts legacy right rail (`.results-sidebar-new`) into `#v3RightRailSlot`.
- Most v3 surfaces are still bridge-driven from legacy IDs (by design for B->C migration), so legacy containers remain runtime dependencies.
- Scenarios surface is now runtime-native in v3 (no direct legacy ID bridge targets).
- Legacy scenario manager bindings now short-circuit when scenario DOM is absent, so `stage-scenarios` can be removed without requiring legacy scenario event wiring at boot.
- Legacy decision-session bindings now short-circuit when decision DOM is absent, preventing boot-time coupling to removed Decision Log legacy markup.
- Decision Log controls, summaries, and sensitivity snapshot execution now run through runtime decision API (`window.__FPE_DECISION_API__`) with a DOM-independent sensitivity compute path.

## Completed retirements
- `stage-scenarios` removed from `index.html` (legacy nav item removed as part of the same pass).
- `stage-decisions` removed from `index.html` (legacy nav item removed; Decision Log runs from runtime API bridge in v3).
- Reach v3 surface no longer reads legacy stage-capacity DOM IDs; it now hard-fails to runtime API bridge (`window.__FPE_REACH_API__`) instead of mirroring legacy DOM.
- Legacy `stage-capacity` visual markup retired from `index.html` (kept as hidden retired stub); legacy nav item for capacity removed.

## Stage dependency map (current)
Counts below are unique legacy IDs referenced by each v3 surface.

| V3 Surface | Legacy Container(s) | Legacy ID Count |
| --- | --- | --- |
| District | `stage-setup` | 22 |
| District | `stage-checks` | 65 |
| District | `stage-gotv` | 8 |
| Reach | `stage-capacity` | 0 |
| Outcome | `stage-results` | 83 |
| Outcome | `stage-integrity` | 1 |
| Turnout | `stage-roi` | 32 |
| Turnout | `stage-results` | 1 |
| Turnout | `stage-integrity` | 3 |
| Plan | `stage-roi` | 49 |
| Plan | `stage-gotv` | 11 |
| Controls | `stage-checks` | 69 |
| Scenarios | retired (`stage-scenarios`) | 0 |
| Decision Log | retired (`stage-decisions`) | 0 |
| Data | `stage-integrity` | 13 |

## Safe delete order (enforced)
Delete only when the referenced surface(s) show zero bridge targets for that legacy container.

1. `stage-capacity`
Reason: isolated to Reach surface.

2. `stage-results`
Reason: shared by Outcome and Turnout; remove only after both are native C-state.

3. `stage-roi`
Reason: shared by Turnout and Plan.

4. `stage-gotv`
Reason: shared by District (electorate controls) and Plan (workload outputs).

5. `stage-checks`
Reason: shared by Controls and District Census/Targeting bridge.

6. `stage-integrity`
Reason: shared by Data plus sidebar KPI fallbacks used by Outcome/Turnout.

7. `stage-ballot`, `stage-universe`, `stage-structure`, `stage-setup`
Reason: setup compose path and District bridge still rely on setup-era DOM.

8. `#app-shell-legacy` wrapper and legacy nav/stage switching
Reason: final removal only after all stage containers above are retired and right rail is migrated or intentionally preserved.

## Per-stage retirement gate (must pass)
For each container before deletion:

1. Bridge targets for that container are zero in v3 surface code.
2. QA smoke passes:
   - `bridge-control-count`
   - `bridge-targets-exist`
   - stage selector checks in active pane
3. No console errors on:
   - stage switch loop (`district -> ... -> data -> district`)
   - control change loop (10+ edits)
4. Output parity:
   - same inputs -> same outputs as pre-delete checkpoint.
5. Rollback artifact created:
   - one zip/tag before deletion.

## Execution checklist (copy/paste sequence)
- [ ] Replace bridge reads/writes for one target container with native v3 state bindings.
- [ ] Run selector/bridge audits.
- [ ] Run v3 QA smoke from Diagnostics (`window.runV3QaSmoke()`).
- [ ] Manual parity sweep for affected surfaces.
- [ ] Delete target legacy container markup.
- [ ] Delete dead selectors/hooks tied to removed container.
- [ ] Re-run QA smoke and stage switching regression.
- [ ] Create checkpoint note and proceed to next container.

## Immediate next target
Recommended next retirement target: `stage-results` bridge-reduction pass.  
`stage-capacity` has been retired from user flow; next shared blocker is `stage-results` used by Outcome + Turnout.
