# Workforce / Operations Interaction Integrity Report

Generated: 2026-03-21T08:04:07.216Z
Tier: tier2
Surface key: operations_workforce

## Summary
- Controls audited: 1
- Controls failing A-F: 0
- Surface status: PASS

## A-F Matrix
| control | A Population | B State write | C Recompute | D Render | E Persistence | F Legacy | persistence contract | canonical owner | root cause | defect class |
|---|---|---|---|---|---|---|---|---|---|---|
| workforce_role_selector (Workforce role selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId scoped indexeddb persons store | indexeddb:operations.persons[].workforceRole | none | none |

## Classification
- No open A-F interaction integrity defects on this surface.
