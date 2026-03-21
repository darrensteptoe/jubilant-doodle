# Data Interaction Integrity Report

Generated: 2026-03-21T05:42:54.314Z
Tier: tier1
Surface key: data

## Summary
- Controls audited: 3
- Controls failing A-F: 0
- Surface status: PASS

## A-F Matrix
| control | A Population | B State write | C Recompute | D Render | E Persistence | F Legacy | persistence contract | canonical owner | root cause | defect class |
|---|---|---|---|---|---|---|---|---|---|---|
| data_restore_backup_selector (Restore backup selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId scoped state snapshot | dataBridgeSelectedBackup transient and restored state | none | none |
| data_archive_selector (Archive selection selector) | PASS | PASS | PASS | PASS | PASS | PASS | none | dataBridgeSelectedArchiveHash | none | none |
| data_voter_adapter_selector (Voter adapter selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.voterData.manifest.adapterId | none | none |

## Classification
- No open A-F interaction integrity defects on this surface.
