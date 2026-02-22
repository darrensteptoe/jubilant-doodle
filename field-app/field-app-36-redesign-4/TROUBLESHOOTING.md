
# Troubleshooting

## “Nothing changes when I type”
- Confirm you are editing numeric inputs (not text notes).
- If you pasted commas, ensure parsing rules accept them.
- Try Reset All, then re-enter in order:
  Scenario setup → Universe → Candidates

## “SelfTest says UNVERIFIED / FAIL”
- Run the self-test in diagnostics/dev mode.
- If it fails, do not trust results until fixed.
- Revert last change and re-run.

## “Import fails in strict mode”
- Strict mode rejects:
  - unknown fields
  - wrong schema versions (unmigratable)
  - hash mismatches
- Turn strict mode off only to salvage data, then re-export from a clean run.

## “Snapshot hash mismatch”
Causes:
- manual edit to exported JSON
- copy/paste tool altered whitespace or encoding
- corrupted transfer
Fix:
- re-export from the source instance
- don’t hand-edit exported snapshots

## “Optimizer returns zero / empty plan”
- Check:
  - budget is non-zero
  - tactics enabled
  - capacity ceilings are > 0
  - timeline feasibility isn’t forcing everything to 0

## “Theme looks wrong”
Theme is system-driven. Change OS light/dark and refresh.
