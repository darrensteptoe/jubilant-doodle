# Third Wing Engineering Contract (Static GitHub)

## Objective
Add a third operational wing (Pipeline + Shifts + Turf + Capacity Forecast) without changing core engine math, degrading performance, or introducing logic drift.

## Hard Constraints
- Hosting: static GitHub pages (no server-side database).
- Core rule: FPE engine remains sacred; new wing is upstream wrappers + compiled inputs.
- Regression rule: flags OFF must preserve baseline outputs.

## Product Shape
Use organizer-style input pages (form-first), plus analysis views.

Primary pages:
1. Talent Pipeline Input
2. Shift & Payroll Input
3. Turf Coverage Input
4. Capacity Forecast View
5. Data Import/Export + Diagnostics

No Launchpad page.

## Data Model (Canonical)
- `Person`: id, name, office, region, role, active
- `PipelineRecord`: personId, recruiter, sourceChannel, stage, stageDates, dropoffReason
- `ShiftRecord`: personId, date, mode, startAt, endAt, checkInAt, checkOutAt, turfId, attempts, convos, supportIds
- `TurfEvent`: turfId, precinct, county, date, assignedTo, attempts, canvassed, vbms
- `ForecastConfig`: stageConversionDefaults, stageDurationDefaults, productivityDefaults

## Stage Taxonomy (Required)
- Sourced
- Contacted
- Phone Screen
- Interviewed
- Offer Extended
- Offer Accepted
- Docs Submitted
- Background Passed
- Training Complete
- Active

## Storage Contract (Static-Safe)
- Large operational datasets MUST use IndexedDB.
- `localStorage` limited to UI prefs, feature flags, and small caches/hashes.
- Every dataset supports JSON export/import.
- CSV import/export supported for operational interoperability.

## Engine Boundary Contract
Only one bridge into FPE:
- `compileEffectiveInputs(state)`

Third wing must publish only compiled aggregates:
- `effectiveHeadcountByWeek`
- `projectedAttemptsThisWeek`
- `projectedConvosThisWeek`
- `projectedSupportThisWeek`
- `capacitySource` (`manual|ramp|schedule`)

Precedence rule:
1. schedule
2. ramp forecast
3. manual baseline

## Performance Contract
- Form pages write append/update records only; no heavy recompute on every keystroke.
- Derived rollups computed on explicit actions or debounced intervals.
- Monte Carlo never auto-runs from third-wing edits; only mark stale.

## Safety & Privacy Contract
- Keep PII minimal (only what operations require).
- Support redacted exports (drop contact fields).
- No hidden data mutation; all transforms deterministic and inspectable.

## Regression Gates (Must Pass Before Integration)
1. Flags OFF parity:
   - deterministic outputs unchanged
   - scenario compare unchanged
2. Import/export roundtrip parity:
   - snapshot hash stability for baseline scope
3. MC cache behavior parity:
   - stale badge behavior unchanged under identical inputs

## Feature Flags
- `crmEnabled` default `false`
- `scheduleEnabled` default `false`
- Later optional:
  - `turfEnabled` default `false`
  - `payrollEnabled` default `false`

## Build Sequence (Mandatory)
1. Data store + schemas + import/export (no FPE integration)
2. Organizer-style input pages (pipeline, shifts, turf)
3. Capacity forecast derivation
4. Adapter into `compileEffectiveInputs`
5. Dashboard overlays (Required vs Scheduled vs Actual)
6. Keep flags OFF until gates pass
7. Enable per feature incrementally

## Non-Goals (v1)
- Real-time multi-user collaboration (requires backend)
- Auto-sync across devices
- Probabilistic per-person productivity learning

## V1 Success Criteria
- Can track where each recruit is in pipeline and time-in-stage.
- Can track shift check-in/check-out and produce payroll-ready summaries.
- Can track turf touch frequency and recency.
- Can produce weekly capacity forecast and feed FPE through compiler seam.
- Baseline FPE behavior unchanged with flags OFF.
