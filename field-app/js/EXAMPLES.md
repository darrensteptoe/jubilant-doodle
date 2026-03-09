
# Examples

These are patterns for testing whether your scenario behaves reasonably.

## Example 1 — Baseline win math sanity
- Enter a universe and turnout expectation.
- Set candidate shares that sum to 100.
Expected:
- vote totals match turnout
- win threshold updates
- “gap to close” is correct

## Example 2 — Persuasion-only plan
- Keep turnout fixed
- Add persuasion assumptions (contact + conversion)
Expected:
- net votes increase
- cost per net vote appears in ROI comparison
- optimizer prefers high ROI tactics up to capacity limits

## Example 3 — GOTV-only plan
- Add turnout lift assumptions
Expected:
- additional votes come from turnout (not share shifting)
- if lift is small, cost per net vote may be high

## Example 4 — Mixed persuasion + GOTV
- Combine both levers
Expected:
- optimizer splits spend where marginal net votes per $ stays highest

## Example 5 — Timeline constrained plan
- Set aggressive plan
- Turn on timeline feasibility
Expected:
- infeasible tactics get capped
- plan adjusts to feasible maximum attempts

## Example 6 — Import/export integrity
- Export snapshot
- Re-import it
Expected:
- snapshot hash matches
- results identical
