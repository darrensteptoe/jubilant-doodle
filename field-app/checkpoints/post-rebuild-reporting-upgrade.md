# H13 — World-Class Reporting Rebuild

## Scope Landed

The reporting stack was rebuilt into explicit core modules and integrated back into app-facing compatibility facades.

### New core reporting modules

- `js/core/reporting/reportTypes.js`
- `js/core/reporting/reportContext.js`
- `js/core/reporting/blocks/index.js`
- `js/core/reporting/sectionBuilders/common.js`
- `js/core/reporting/sectionBuilders/internalFull.js`
- `js/core/reporting/sectionBuilders/clientStandard.js`
- `js/core/reporting/sectionBuilders/warRoomBrief.js`
- `js/core/reporting/sectionBuilders/weeklyActions.js`
- `js/core/reporting/sectionBuilders/readinessAudit.js`
- `js/core/reporting/sectionBuilders/electionDataBenchmark.js`
- `js/core/reporting/sectionBuilders/postElectionLearning.js`
- `js/core/reporting/sectionBuilders/index.js`
- `js/core/reporting/composeReport.js`
- `js/core/reporting/renderers/html.js`
- `js/core/reporting/renderers/pdf.js`

### Report families implemented

- `internal_full`
- `client_standard`
- `war_room_brief`
- `weekly_actions`
- `readiness_audit`
- `election_data_benchmark`
- `post_election_learning`

Legacy aliases preserved for compatibility:

- `internal -> internal_full`
- `client -> client_standard`

### Typed block architecture

Typed report blocks now drive composition/rendering:

- `headline`
- `status`
- `metric_grid`
- `trend`
- `benchmark`
- `risk`
- `recommendation`
- `action_owner`
- `confidence_methodology`
- `appendix`

### Canonical report context

`buildReportContext(...)` now assembles report inputs from canonical/derived selectors and metric provenance diagnostics.

Context includes:

- canonical selector outputs for district/electionData/targeting/census/weatherRisk/eventCalendar/outcome
- metric provenance map and comparison deltas
- electionData influence summary
- governance/audit/recovery context
- archive/source snapshot references

### Rendering

- HTML renderer consumes typed blocks and emits structured report HTML.
- PDF export path now consumes the new print-ready HTML renderer.

### App compatibility wiring

Updated app-facing facades to route through core reporting modules while preserving legacy contract behavior where needed:

- `js/app/reportComposer.js`
- `js/app/reportRegistry.js`
- `js/app/pdfExport.js`

`composeReportPayload(...)` now exposes:

- `reportType` (legacy alias preserved when requested)
- `reportTypeCanonical`
- `legacyReportType`
- typed sections/blocks
- compatibility line-based `sections`
- selector snapshot/metadata from core context

### Data reporting surface updates

- `js/app/v3/surfaces/data/index.js`
- `js/app/v3/surfaces/data/reporting.js`

Updated report selector defaults/text to match new report families.

## Tests Added

- `js/core/reporting/composeReport.test.js`
- `js/core/reporting/renderers.test.js`
- `js/core/reporting/goldenReports.test.js`
- `js/core/reporting/reportGoldenExpected.json`

Coverage includes:

- report-family composition
- internal vs client structural divergence
- trend/delta block generation
- election data benchmark block correctness
- canonical context/provenance inclusion
- HTML/PDF renderer output shape
- empty/partial rendering stability
- golden snapshots over required fixtures and report families

## Commands Run

- `node --test js/core/reporting/composeReport.test.js js/core/reporting/renderers.test.js js/core/reporting/goldenReports.test.js`
- `node --test js/core/actions/moduleBoundaries.test.js js/app/v3/surfaces/data/phase9.integrity.test.js`
- `npm run check:contracts`
- `npm run build`
- `npm run check:golden-fixtures`
- `npm run gate:drift`
- `npm run gate:rebuild`
- `npm run gate:gauntlet`

## Current Status

All H13 reporting tests and acceptance commands listed above are passing in this workspace.

## Retention / Retirement Notes

Retired in this phase:

- `js/app/internalReportComposer.js`
- `js/app/clientReportComposer.js`
- `js/app/reportSelectors.js`

All report composition/render paths now route through:

- `js/core/reporting/*` modules
- `js/app/reportComposer.js` compatibility facade
- `js/app/pdfExport.js` compatibility facade
