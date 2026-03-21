# H11 — Golden Full-State Fixtures

## Scope
Established a dedicated golden full-state regression suite that locks selector and metric outputs across representative end-to-end canonical states.

## Fixture set
The suite now includes seven required fixtures:

1. `municipal_race`
2. `county_race`
3. `multi_candidate_primary`
4. `low_data_race`
5. `election_data_imported`
6. `war_room_active`
7. `archive_recovery_reporting_history`

## Files
- Fixture definitions: `js/core/state/goldenFullStateFixtures.js`
- Signature harness: `js/core/state/goldenFullStateHarness.js`
- Locked expected signatures: `js/core/state/goldenFullStateExpected.json`
- Regression tests: `js/core/state/goldenFullStateRegression.test.js`
- Golden refresh utility: `scripts/update-golden-full-state-fixtures.mjs`
- Package script: `npm run check:golden-fixtures`

## Assertions covered
For each fixture, the suite snapshots and verifies:

- District canonical + derived selectors
- Election Data canonical + derived selectors
- Targeting canonical + derived selectors
- Census canonical + derived selectors
- Weather Risk canonical + derived selectors
- Event Calendar canonical + derived selectors
- Outcome canonical + derived selectors
- Metric provenance signatures for key strategic metrics
- Archive/recovery/governance/audit/scenario domain summaries

## Determinism checks
- Repeated signature builds over fixed fixture state produce identical output.
- Fixture-id inventory must exactly match required scenario set.

## Update workflow
When intentional model changes alter expected outputs:

1. Run `node scripts/update-golden-full-state-fixtures.mjs`
2. Run `npm run check:golden-fixtures`
3. Review `js/core/state/goldenFullStateExpected.json` diff before merge.
