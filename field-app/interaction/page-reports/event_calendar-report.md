# Event Calendar Interaction Integrity Report

Generated: 2026-03-21T05:42:54.314Z
Tier: tier2
Surface key: event_calendar

## Summary
- Controls audited: 5
- Controls failing A-F: 0
- Surface status: PASS

## A-F Matrix
| control | A Population | B State write | C Recompute | D Render | E Persistence | F Legacy | persistence contract | canonical owner | root cause | defect class |
|---|---|---|---|---|---|---|---|---|---|---|
| event_category_selector (Event category selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.warRoom.eventCalendar.draft.category | none | none |
| event_apply_to_model_toggle (Event apply to model toggle) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.warRoom.eventCalendar.events[].applyToModel | none | none |
| event_date_filter_selector (Event date filter selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.warRoom.eventCalendar.filters.date | none | none |
| event_status_selector (Event status selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.warRoom.eventCalendar.events[].status | none | none |
| event_type_selector (Event type selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.warRoom.eventCalendar.draft.eventType | none | none |

## Classification
- No open A-F interaction integrity defects on this surface.
