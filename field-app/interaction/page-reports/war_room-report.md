# War Room Interaction Integrity Report

Generated: 2026-03-21T08:04:07.216Z
Tier: tier1
Surface key: war_room

## Summary
- Controls audited: 11
- Controls failing A-F: 0
- Surface status: PASS

## A-F Matrix
| control | A Population | B State write | C Recompute | D Render | E Persistence | F Legacy | persistence contract | canonical owner | root cause | defect class |
|---|---|---|---|---|---|---|---|---|---|---|
| weather_zip_selector (Weather ZIP selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.warRoom.weather.officeZip\|state.warRoom.weather.overrideZip\|state.warRoom.weather.useOverrideZip | none | none |
| weather_mode_toggle (Weather mode toggle) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.warRoom.weatherAdjustment.mode | none | none |
| decision_session_selector (Decision session selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.ui.decision.activeSessionId | none | none |
| decision_option_selector (Decision option selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.ui.decision.sessions[].activeOptionId | none | none |
| decision_recommend_selector (Decision recommend selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.ui.decision.sessions[].recommendedOptionId | none | none |
| war_room_watch_items_input (War room watch items) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.ui.decision.sessions[].warRoom.watchItems | none | none |
| war_room_decision_items_input (War room decision items) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.ui.decision.sessions[].warRoom.decisionItems | none | none |
| war_room_owner_input (War room owner input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.ui.decision.sessions[].warRoom.owner | none | none |
| war_room_follow_up_date (War room follow-up date) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.ui.decision.sessions[].warRoom.followUpDate | none | none |
| war_room_capture_review_button (War room capture review baseline) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.ui.decision.sessions[].warRoom.lastReview | none | none |
| war_room_log_decision_button (War room log decision) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.ui.decision.sessions[].warRoom.decisionLog | none | none |

## Classification
- No open A-F interaction integrity defects on this surface.
