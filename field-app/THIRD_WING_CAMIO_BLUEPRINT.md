# Operations Blueprint (Operations Hub-Based)

Purpose: model the full CRM/ops wing after the existing Operations Hub spreadsheet workflow, not just scheduling.

## Source Workbook Map

- `Operations Hub _ Launchpad.xlsx`
  - Role: entry/navigation + QR lookups
  - App module: `crm/launchpad`

- `Operations Hub _ Recruitment Tracker.xlsx`
  - Role: lead intake, recruiter pipeline, interview scheduling
  - App module: `crm/recruitment`

- `Operations Hub _ Interview Tracker.xlsx`
  - Role: interview outcomes + team-level interview throughput
  - App module: `crm/interviews`

- `Operations Hub _ Onboarding Tracker.xlsx`
  - Role: onboarding completion gates by team
  - App module: `crm/onboarding`

- `Operations Hub _ Training Tracker.xlsx`
  - Role: training completion/readiness by team
  - App module: `crm/training`

- `Operations Hub _ Shift Tracker.xlsx`
  - Role: scheduling + hours/payroll rollups
  - App module: `ops/shifts`

- `Operations Hub _ Turf Tracker.xlsx`
  - Role: turf penetration, attempts/canvassed/VBM progression
  - App module: `ops/turf`

- `Canvasser Aggregate.xlsx`
  - Role: cross-tracker consolidated readout
  - App module: `ops/aggregate`

- `Operations Hub _ Landingpad.xlsx`
  - Role: summary dashboard
  - App module: `ops/landingpad`

## Recommended App Surface (separate from core planning page)

Create a separate top-level page/app for Operations:

- `operations.html` (or `organizer.html` successor)
- Left nav modules:
  - Launchpad
  - Recruitment
  - Interviews
  - Onboarding
  - Training
  - Shift Scheduler
  - Turf Tracker
  - Aggregate
  - Landingpad

Reason: prevents crowding core FPE screens and keeps compute boundaries clean.

## Canonical Data Entities (single source of truth)

- `Person`
  - id, name, contact, office, region, pod, role, status

- `RecruitLead`
  - personId, sourceChannel, recruiter, createdAt, stage, stageDates, dropoffReason

- `Interview`
  - personId, scheduledAt, interviewer, score, outcome, notes

- `Onboarding`
  - personId, docsSubmittedAt, backgroundStatus, onboardingStatus

- `Training`
  - personId, trainingTrack, sessions, completionStatus, completedAt

- `Shift`
  - personId, date, start, end, mode(doors/calls/text), turfId, expectedRate, actuals

- `Turf`
  - turfId, county, precinct, universe, assignedTo, attempts, canvassed, vbms, status

- `DailyAggregate`
  - date, office, attempts, convos, ids, hours, payroll

## Engine Boundary (non-negotiable)

Operations must only publish compiled outputs to FPE via one seam:

- `compileEffectiveInputs(state)`
  - capacity overrides by week
  - scheduled attempts/convos/support projections
  - source metadata (manual vs schedule vs ramp)

No direct mutation of FPE core math.

## Integration Order (safe)

1. Build data model + store for Operations (no FPE integration).
2. Build module pages with CRUD + summary cards.
3. Build aggregate readout page.
4. Add export/import JSON for Operations only.
5. Add adapter that emits effective-capacity payload.
6. Wire adapter into existing `compileEffectiveInputs`.
7. Keep feature flags OFF by default until parity tests pass.

## Immediate Next Build Step

Implement skeleton pages + router for the 9 modules above with placeholder tables/cards, then connect real data store incrementally.
