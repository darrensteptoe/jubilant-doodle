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

## CAM.IO Top Sheet 2.0 (Low-Tooling)

Goal: keep the original CAM.IO "single update pane" behavior, but make it configurable and fast to maintain.

### What the top sheet should show

- `Feed Monitor`
  - one dropdown to pick a source (`Local News`, `State Politics`, `Election Admin`, etc.)
  - list of most recent items for that selected source
- `Opponent Watch`
  - embed cards for opponent social links and owned channels
  - links to opposition filings, press pages, and public calendars
- `Critical Countdown`
  - candidate deadlines (filing, finance reports, ballot access, debate)
  - election deadlines (registration, vote-by-mail, early vote, Election Day)

### Minimal architecture (no heavy tooling)

Use static config files + lightweight browser JS:

- `data/topSheet.feeds.json`
  - curated feed sources and labels
- `data/topSheet.watch.json`
  - opponent/social/watch links
- `data/topSheet.dates.json`
  - important dates with category and owner

No database required. Config can be versioned in git and edited by staff.

### RSS without heavy backend

Two low-lift options:

1. Proxy service (fastest)
- Browser fetches `GET /api/feed?source=<id>`
- API endpoint can be a tiny serverless function that pulls/parses the real RSS and returns normalized JSON
- Handles CORS once, keeps client clean

2. Third-party RSS-to-JSON endpoint (lowest setup, higher vendor risk)
- Browser calls a managed RSS-to-JSON service
- Good for prototype, less ideal for long-term reliability

### Suggested JSON shapes

```json
// data/topSheet.feeds.json
{
  "feeds": [
    { "id": "local-news", "label": "Local News", "url": "https://example.com/rss" },
    { "id": "state-politics", "label": "State Politics", "url": "https://example.com/politics.xml" }
  ]
}
```

```json
// data/topSheet.dates.json
{
  "dates": [
    { "id": "filing-open", "label": "Candidate filing opens", "date": "2026-11-02", "type": "candidate" },
    { "id": "finance-q4", "label": "Q4 finance report due", "date": "2027-01-15", "type": "candidate" },
    { "id": "early-vote-start", "label": "Early voting starts", "date": "2026-10-15", "type": "election" },
    { "id": "election-day", "label": "Election Day", "date": "2026-11-03", "type": "election" }
  ]
}
```

### UX behavior to keep it useful

- Persist last selected feed in `localStorage`
- Default sort: soonest upcoming deadline first
- Countdown labels:
  - `DUE TODAY`
  - `N days left`
  - `OVERDUE by N days`
- Optional chips:
  - `Candidate`
  - `Election`
  - `Compliance`

### Implementation sequence (small steps)

1. Add static config files for feeds/watch/dates.
2. Add top-sheet panel to `operations.html`.
3. Implement feed selector + render list from normalized JSON.
4. Implement countdown cards from `topSheet.dates.json`.
5. Add opponent watch embeds/links.
6. Add daily refresh timestamp + manual refresh button.
