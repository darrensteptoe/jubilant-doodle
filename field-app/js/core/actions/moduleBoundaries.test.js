// @ts-check

import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { composeReportPayload } from "../../app/reportComposer.js";
import { CANONICAL_DOMAINS, makeCanonicalState } from "../state/schema.js";
import { assertActionMutationOwnership } from "../state/ownershipAssertions.js";
import { importElectionDataFile } from "./electionData.js";
import { saveEventCalendarEvent } from "./eventCalendar.js";
import { saveForecastArchiveActual } from "./forecastArchive.js";
import { mutateDomain } from "./_core.js";
import { updateWeatherRiskConfig } from "./weatherRisk.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function seededState() {
  return makeCanonicalState({ nowDate: new Date("2026-03-20T12:00:00.000Z") });
}

test("module boundaries: weatherRisk action cannot mutate eventCalendar state", () => {
  const before = seededState();
  const beforeEvent = structuredClone(before.domains.eventCalendar);
  const result = updateWeatherRiskConfig(
    before,
    { field: "overrideZip", value: "60614" },
    { enforceBoundary: true, actionName: "updateWeatherRiskConfig" },
  );

  assert.equal(result.changed, true);
  assert.equal(result.state.domains.weatherRisk.overrideZip, "60614");
  assert.deepEqual(result.state.domains.eventCalendar, beforeEvent);
  assertActionMutationOwnership({
    beforeState: before,
    afterState: result.state,
    allowedDomains: ["weatherRisk"],
    actionName: "updateWeatherRiskConfig",
    canonicalDomains: CANONICAL_DOMAINS,
    allowNoop: false,
  });
});

test("module boundaries: eventCalendar action cannot mutate weatherRisk state", () => {
  const before = seededState();
  const beforeWeather = structuredClone(before.domains.weatherRisk);
  const result = saveEventCalendarEvent(
    before,
    { event: { title: "Weekend Canvass", date: "2026-04-04", applyToModel: true } },
    { enforceBoundary: true, actionName: "saveEventCalendarEvent" },
  );

  assert.equal(result.changed, true);
  assert.equal(result.state.domains.eventCalendar.statusSummary.totalEvents, 1);
  assert.deepEqual(result.state.domains.weatherRisk, beforeWeather);
  assertActionMutationOwnership({
    beforeState: before,
    afterState: result.state,
    allowedDomains: ["eventCalendar"],
    actionName: "saveEventCalendarEvent",
    canonicalDomains: CANONICAL_DOMAINS,
    allowNoop: false,
  });
});

test("module boundaries: electionData import does not write district domain directly", () => {
  const before = seededState();
  const beforeDistrict = structuredClone(before.domains.district);
  const csvText = [
    "state_fips,county_fips,election_date,office,district_id,precinct_id,candidate,votes,total_votes_precinct,registered_voters",
    "17,031,2024-11-05,US House,IL-07,17-031-001A,Alex Alpha,1245,2100,3000",
  ].join("\n");

  const result = importElectionDataFile(
    before,
    { fileName: "election.csv", fileSize: csvText.length, fileHash: "hash_01", csvText },
    { enforceBoundary: true, actionName: "importElectionDataFile" },
  );

  assert.equal(result.changed, true);
  assert.deepEqual(result.state.domains.district, beforeDistrict);
  assertActionMutationOwnership({
    beforeState: before,
    afterState: result.state,
    allowedDomains: ["electionData"],
    actionName: "importElectionDataFile",
    canonicalDomains: CANONICAL_DOMAINS,
    allowNoop: false,
  });
});

test("module boundaries: forecastArchive save does not own recovery/import state", () => {
  const before = seededState();
  const beforeRecovery = structuredClone(before.domains.recovery);
  const result = saveForecastArchiveActual(
    before,
    {
      entry: {
        hash: "mc_hash_1",
        margin: 1.4,
        status: "fresh",
      },
    },
    { enforceBoundary: true, actionName: "saveForecastArchiveActual" },
  );

  assert.equal(result.changed, true);
  assert.equal(result.state.domains.forecastArchive.summary.total, 1);
  assert.deepEqual(result.state.domains.recovery, beforeRecovery);
  assertActionMutationOwnership({
    beforeState: before,
    afterState: result.state,
    allowedDomains: ["forecastArchive"],
    actionName: "saveForecastArchiveActual",
    canonicalDomains: CANONICAL_DOMAINS,
    allowNoop: false,
  });
});

test("module boundaries: reporting composition does not mutate recovery state directly", () => {
  const state = seededState();
  const before = structuredClone(state);

  const report = composeReportPayload({
    reportType: "internal",
    state,
    renderCtx: null,
    resultsSnapshot: null,
    nowDate: new Date("2026-03-20T12:00:00.000Z"),
  });

  assert.ok(report && typeof report === "object");
  assert.ok(Array.isArray(report.sections));
  assert.deepEqual(state, before);
  assert.deepEqual(state.domains.recovery, before.domains.recovery);
});

test("module boundaries: district summary reader uses selector-driven bridge snapshots (no raw cache truth)", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../app/v3/stateBridge.js"), "utf8");
  assert.match(source, /readDistrictCanonicalBridgeView\(/, "district summary pipeline must read canonical bridge lane");
  assert.match(source, /readDistrictDerivedBridgeView\(/, "district summary pipeline must read derived bridge lane");
  assert.doesNotMatch(source, /lastRenderCtx/, "district summary must not read legacy render context");
  assert.doesNotMatch(source, /__FPE_DISTRICT_CACHE__/, "district summary must not read raw district cache globals");
});

test("module boundaries: reporting module does not own recovery controls", () => {
  const reportingSource = fs.readFileSync(path.join(__dirname, "../../app/v3/surfaces/data/reporting.js"), "utf8");
  assert.doesNotMatch(reportingSource, /v3DataStrictToggle/, "reporting module must not own strict-import toggle");
  assert.doesNotMatch(reportingSource, /v3DataRestoreBackup/, "reporting module must not own restore-backup control");
});

test("module boundaries: runtime boundary assertion fails loud on cross-domain mutation", () => {
  const before = seededState();
  assert.throws(
    () => mutateDomain(
      before,
      "weatherRisk",
      (draft, canonical) => {
        draft.overrideZip = "60614";
        canonical.domains.eventCalendar.filters.category = "campaign";
        return true;
      },
      {
        enforceBoundary: true,
        actionName: "intentionalBoundaryViolation",
      },
    ),
    /unauthorized domain writes -> eventCalendar/,
  );
});

