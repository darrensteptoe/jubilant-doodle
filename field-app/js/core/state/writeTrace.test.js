// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { updateDistrictFormField } from "../actions/district.js";
import { importElectionDataFile } from "../actions/electionData.js";
import { saveEventCalendarEvent } from "../actions/eventCalendar.js";
import { makeCanonicalState } from "./schema.js";
import { createWriteTraceLayer } from "./writeTrace.js";

function seededState() {
  return makeCanonicalState({ nowDate: new Date("2026-03-20T12:00:00.000Z") });
}

test("write trace: district mutation emits structured trace with expected invalidations", () => {
  const traceLayer = createWriteTraceLayer({ enabled: true, maxEntries: 10 });
  const before = seededState();
  const outcome = updateDistrictFormField(
    before,
    { field: "mode", value: "turnout" },
    {
      traceLayer,
      sourceModule: "districtSurface",
      sourceSurface: "district",
      actionName: "updateDistrictFormField",
    },
  );

  assert.equal(outcome.changed, true);
  assert.ok(outcome.trace);
  assert.equal(outcome.trace.actionName, "updateDistrictFormField");
  assert.equal(outcome.trace.source.module, "districtSurface");
  assert.equal(outcome.trace.touchedDomain, "district");
  assert.equal(outcome.trace.revision.before, 0);
  assert.equal(outcome.trace.revision.after, 1);
  assert.equal(outcome.trace.domainRevision.before, 0);
  assert.equal(outcome.trace.domainRevision.after, 1);
  assert.deepEqual(outcome.trace.dirtyDomains, ["district"]);
  assert.equal(outcome.trace.invalidation.selectors.includes("districtDerived"), true);
  assert.equal(outcome.trace.invalidation.selectors.includes("targetingCanonical"), true);
  assert.equal(outcome.trace.invalidation.bridges.includes("districtBridge"), true);
  assert.equal(outcome.trace.invalidation.modules.includes("weatherRisk"), false);
});

test("write trace: election import records downstream invalidation for district/targeting/outcome/reporting", () => {
  const traceLayer = createWriteTraceLayer({ enabled: true, maxEntries: 10 });
  const before = seededState();
  const csvText = [
    "state_fips,county_fips,election_date,office,district_id,precinct_id,candidate,votes,total_votes_precinct,registered_voters",
    "17,031,2024-11-05,US House,IL-07,17-031-001A,Alex Alpha,1245,2100,3000",
    "17,031,2024-11-05,US House,IL-07,17-031-001A,Blair Beta,855,2100,3000",
  ].join("\n");

  const outcome = importElectionDataFile(
    before,
    {
      fileName: "election.csv",
      fileSize: csvText.length,
      fileHash: "hash_001",
      csvText,
    },
    {
      traceLayer,
      sourceModule: "electionDataSurface",
      sourceSurface: "electionData",
      actionName: "importElectionDataFile",
    },
  );

  assert.equal(outcome.changed, true);
  assert.ok(outcome.trace);
  assert.equal(outcome.trace.touchedDomain, "electionData");
  assert.deepEqual(outcome.trace.dirtyDomains, ["electionData"]);
  assert.equal(outcome.trace.invalidation.modules.includes("district"), true);
  assert.equal(outcome.trace.invalidation.modules.includes("targeting"), true);
  assert.equal(outcome.trace.invalidation.modules.includes("outcome"), true);
  assert.equal(outcome.trace.invalidation.modules.includes("reporting"), true);
  assert.equal(outcome.trace.invalidation.bridges.includes("electionDataBridge"), true);
  assert.equal(outcome.trace.invalidation.modules.includes("weatherRisk"), false);
});

test("write trace: event-calendar mutation does not mark unrelated weather module dirty", () => {
  const traceLayer = createWriteTraceLayer({ enabled: true, maxEntries: 10 });
  const before = seededState();
  const outcome = saveEventCalendarEvent(
    before,
    {
      event: {
        title: "Weekend Canvass",
        date: "2026-04-04",
        applyToModel: true,
      },
    },
    {
      traceLayer,
      sourceModule: "warRoomEventModule",
      sourceSurface: "warRoom",
      actionName: "saveEventCalendarEvent",
    },
  );

  assert.equal(outcome.changed, true);
  assert.ok(outcome.trace);
  assert.equal(outcome.trace.touchedDomain, "eventCalendar");
  assert.deepEqual(outcome.trace.dirtyDomains, ["eventCalendar"]);
  assert.equal(outcome.trace.invalidation.modules.includes("warRoom"), true);
  assert.equal(outcome.trace.invalidation.modules.includes("weatherRisk"), false);
});

test("write trace: disabled mode records no entries", () => {
  const traceLayer = createWriteTraceLayer({ enabled: false, maxEntries: 5 });
  const before = seededState();
  const outcome = updateDistrictFormField(
    before,
    { field: "mode", value: "turnout" },
    {
      traceLayer,
      sourceModule: "districtSurface",
      sourceSurface: "district",
      actionName: "updateDistrictFormField",
    },
  );
  assert.equal(outcome.changed, true);
  assert.equal(Object.prototype.hasOwnProperty.call(outcome, "trace"), false);
  assert.deepEqual(traceLayer.list(), []);
});

