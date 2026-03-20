# Addendum Phase Sequence (Feature Work In Progress)

## Current Guardrail
- We are still in active feature development (currently around Phase 15).
- Final hardening/freeze work is explicitly deferred.

## Ordered Sequence (Do Not Reorder)
1. Phase 9 — Campaign Context & Multi-Campaign Isolation
2. Phase 10 — System Intelligence Layer (Registry Architecture)
3. Phase 11 — Full Internal Manual / Doctrine Layer
4. Phase 12 — Glossary + Message Interpretation Layer
5. Phase 12.25 — Interaction Integrity Layer
6. Phase 12.25.A — Interaction Integrity Test Harness
7. Phase 12.5 — Realism & Plausibility Layer
8. Phase 13 — Validation Framework + Model Readiness
9. Phase 14 — Workforce Role Typing
10. Phase 15 — Budget Realism Bands
11. Phase 16 — Manual-Guided Intake & Operating Discipline
12. Phase 17 — Durability & Trust Layer
13. Phase 18 — War Room / Decision Session Layer
14. Phase 18.5 — War Room Weather & Field Risk Layer
15. Phase 18.75 — Calendar / Events Layer
16. Phase 19 — Playbook Layer
17. Phase 20 — Model Registry / Canonical Model Map
18. Phase 21 — Canonical Targeting Law Lock
19. Phase 21.25 — Ballot Baseline with Past Candidate Results
20. Phase 21.4 — Aggregate Voter-History Intelligence & Age Segmentation
21. Phase 21.5 — Client Intelligence Report / PDF Export Layer
22. Phase 22 — Model Coverage Verification
23. Phase 22.5 — Pre-Hardening Major Audit
24. Phase 23 — Pre-Audit Prune / Relevance Pass
25. Phase 24 — Canonicalization
26. Phase 25 — Contracts + Diagnostics
27. Phase 26 — Audit Layer + Release Gauntlet
28. Phase 27 — Release Gate / Freeze

## Phase 22.5 — Pre-Hardening Major Audit (Required Checkpoint)
This checkpoint must complete after feature implementation is substantially in place and before Phases 23–27 begin.

### Goals
1. Identify remaining broken interactions.
2. Identify remaining legacy shell dependencies.
3. Identify duplicate truth paths.
4. Identify stale render/recompute issues.
5. Identify missing canonical owners.
6. Identify weak or missing validation/realism/reporting links.
7. Identify temporary bridge logic that must not survive freeze.
8. Identify behavior that would be dangerous to harden as-is.

### Required Outputs
- `major-audit-report.md`
- Issue inventory grouped by:
  - active defect to fix now
  - expected future-phase item
  - legacy dependency
  - duplicate truth path
  - risky hardening candidate
  - unknown root cause

### Gate Rule
- Do not begin final hardening until the Phase 22.5 pre-hardening major audit is complete and reviewed.

## Hardening Safety Rule (For Later Phases 23–27)
For every final-hardening change, classify the change as one of:
- observability
- enforcement
- prune
- canonicalization
- behavior change

If any change is a `behavior change`, it must be explicitly justified and listed in the hardening summary.

Diagnostics/contracts must observe and elevate; they must not silently mutate business logic.

Harden only the canonical machine, not accidental behavior.
