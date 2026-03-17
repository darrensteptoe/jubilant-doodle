# FPE UI 3.0 Closure Status

Date: 2026-03-16

## Purpose
- Freeze the migration stopping point so the project can move on to client-facing work.
- Prevent more shell/cutover micro-edits unless a real blocker appears.

## Stable Enough To Move On
- v3 shell loads by default.
- Refresh boot works.
- Stage switching works.
- Right rail renders in v3.
- Diagnostics opens.
- Reset scenario works.
- Explicit legacy mode still loads with `?ui=legacy`.
- Legacy wrapper is hidden by default and only used for explicit legacy mode or fallback recovery.
- Local production build passes with `npm run build` on this checkpoint.

## Migration Rule From Here
- Do not continue shell/cutover seam work unless it fixes a named blocker.
- If a change causes a boot failure, revert immediately to the last known-good state.
- Do not spend time polishing compatibility islands that are already planned for overhaul.

## Current Build Checkpoint
- `node --check` passes for the active v3 shell/surface files and core runtime entry files touched in this phase.
- `npm run build` passes locally.
- Known non-blocking build warnings at this checkpoint:
  - `js/core/selfTest.js` is both dynamically and statically imported, so Vite keeps it in the main chunk.
  - Main `index` bundle remains large and would need later code-splitting if performance becomes a priority.
- `npm run typecheck` is still not a release gate for this repo because of a large pre-existing legacy TypeScript error baseline outside the current migration sweep.

## Deferred Holdouts
- Training toggle does not work correctly end-to-end in v3.
- District ballot editor remains a compatibility island.
- District Targeting Lab behavior still needs product cleanup.
- District Targeting Lab remains a deferred overhaul item; current model preset sync and run/export behavior should not be polished further in compatibility mode.
- Full physical deletion of the legacy wrapper and all fallback code is deferred.

## Do Not Touch Unless Broken
- Shell/cutover plumbing
- Census map path
- District ballot compatibility internals
- Targeting execution internals

## Safe Priorities Next
1. Stabilize only user-visible blockers.
2. Move to the next client-facing module overhaul.
3. Return to deferred holdouts only when they are the active product priority.

## Definition Of Done For This Phase
- Shell migration is considered complete enough when v3 is the default usable shell and legacy remains a working fallback.
- This repo has reached that threshold.
