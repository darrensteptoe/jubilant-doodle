# Manual Parity + Sign-Off Checklist

Date: 2026-03-19  
Purpose: close remaining non-automated release work

## Run Context

- Use a clean browser session.
- Use at least one campaign-scoped URL:
  - `?campaign=il-hd-21&office=west`
- Verify both:
  - default V3 shell flow
  - operations pages (`operations*.html`, `organizer.html`)
- Optional setup helper:
  - `npm run qa:new-parity-log` to generate today’s sign-off file
  - `npm run status:manual-parity` to view current manual parity completion state

## District Stage

- Change race/template dimensions and confirm non-destructive template behavior.
- Verify `templateMeta`-driven state is preserved after edits and reload.
- Run targeting and confirm rank rows + metadata update in V3.
- Confirm Census status/rows/maps render without legacy control dependence.

Pass criteria:
- No console errors.
- V3 values update coherently with no stale legacy mirror behavior.

## Reach Stage

- Adjust staffing/capacity fields and confirm weekly requirement/capacity/gap updates.
- Confirm pace/freshness panels update with recent daily log inputs.
- Validate lever/action messages reflect current context and not stale cache.

Pass criteria:
- Gap/pace/finish outputs remain consistent after multiple edits.

## Outcome Stage

- Run MC, rerun MC, and compute sensitivity surface.
- Verify confidence/risk tags and histogram/summary updates.
- Confirm surface controls persist and restore correctly.

Pass criteria:
- No stale status tags or frozen output blocks after reruns.

## Turnout + Plan Stages

- Edit turnout assumptions, refresh ROI, and verify table refresh.
- Run optimizer with at least two objective modes.
- Confirm uplift/budget/cost outputs are internally consistent.

Pass criteria:
- Optimizer summaries and table rows align with selected objective and assumptions.

## Scenarios + Decision Log

- Save new scenario, load, compare, clone baseline, and delete test scenario.
- Validate decision session updates, recommendation apply flow, and snapshot rendering.

Pass criteria:
- Scenario transitions preserve context and do not bleed cross-scenario state.

## Controls + Data

- Run benchmark/evidence/calibration actions.
- Import voter sample (lean canonical fields), verify status + summaries.
- Export/import scenario and verify deterministic roundtrip.
- Validate archive rows show governance + uplift + voter linkage fields.

Pass criteria:
- Data actions are deterministic and context-scoped.
- Voter layer outputs appear in governance/learning views.

## Operations Pages

- Add/edit/delete records in pipeline/interview/onboarding/training/shifts/turf.
- Verify campaign/office scoping in reads/writes.
- Confirm workforce role mix appears in rollups and outlook outputs.

Pass criteria:
- No cross-campaign or cross-office bleed.
- Role/compensation distinctions affect rollups.

## Final Sign-Off Record

- Capture:
  - tester name
  - date/time
  - campaign/office scope used
  - pass/fail by stage
  - regressions (if any)

Recommended log file:
- `checkpoints/manual_parity_results_YYYY-MM-DD.md`
- Starter template: `checkpoints/manual_parity_results_TEMPLATE.md`
- Final strict readiness check: `npm run gate:manual-parity`
