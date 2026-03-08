# Operations Source-Of-Truth Rules

Purpose: prevent overlap/double counting across Pipeline, Shifts, Turf, and FPE compiler inputs.

## Canonical Totals

1. Production totals (attempts/convos/support IDs/hours)
- Canonical source: `ShiftRecord`
- Why: check-in/check-out + payroll integrity + direct operator accountability

2. Coverage totals (touches/penetration/recency by precinct/turf)
- Canonical source: `TurfEvent`
- Why: operational geography + route planning + revisit strategy

3. Pipeline capacity and activation forecast
- Canonical source: `PipelineRecord` + `ForecastConfig`
- Why: ramp forecasting before capacity exists

## Overlap Policy

If both shift and turf records contain attempts for same work:
- Keep shift attempts in production totals.
- Exclude overlapping turf attempts from production totals.
- Keep turf records for coverage analytics.

Overlap signals:
- direct `turfEvent.shiftId` link to an existing shift
- or deterministic fingerprint match by day/person-or-assignee/turf/mode

## Compiler Boundary

Only compiled aggregates enter FPE through `compileEffectiveInputs(state)`.

Never pass raw operations records into core engine math.

## Debug Counters (must be visible in diagnostics)

- `productionSource`
- `shiftAttempts`
- `turfAttemptsExcluded`
- `turfRecordsExcluded`
- `turfFallbackAttemptsIncluded`
- `capacitySource` (`manual|ramp|schedule`)

## Determinism Requirement

With `crmEnabled=false` and `scheduleEnabled=false`:
- outputs must match baseline exactly
- scenario and MC behavior must be unchanged

