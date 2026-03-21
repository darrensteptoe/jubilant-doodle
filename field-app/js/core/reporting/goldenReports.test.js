// @ts-check

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildGoldenStateFromFixture } from "../state/goldenFullStateHarness.js";
import { GOLDEN_FULL_STATE_FIXTURES } from "../state/goldenFullStateFixtures.js";
import { composeReportDocument } from "./composeReport.js";
import { REPORT_FAMILY_ORDER } from "./reportTypes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPECTED_PATH = resolve(__dirname, "reportGoldenExpected.json");
const REQUIRED_FIXTURE_IDS = [
  "municipal_race",
  "multi_candidate_primary",
  "low_data_race",
  "election_data_imported",
  "war_room_active",
];

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (!value || typeof value !== "object") {
    return JSON.stringify(value);
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function buildSectionSummary(section = {}) {
  const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
  return {
    id: String(section?.id || ""),
    title: String(section?.title || ""),
    blockTypes: blocks.map((block) => String(block?.type || "")),
    headline: String(
      blocks.find((block) => String(block?.type || "") === "headline")?.headline
      || "",
    ),
  };
}

function buildReportSnapshot(report) {
  const blocks = Array.isArray(report?.blocks) ? report.blocks : [];
  const sections = Array.isArray(report?.sections) ? report.sections : [];
  /** @type {Record<string, number>} */
  const blockTypeCounts = {};
  blocks.forEach((block) => {
    const type = String(block?.type || "").trim() || "unknown";
    blockTypeCounts[type] = (blockTypeCounts[type] || 0) + 1;
  });
  const sectionSummary = sections.map((section) => buildSectionSummary(section));

  const digestPayload = {
    reportType: String(report?.reportType || ""),
    title: String(report?.title || ""),
    reportLabel: String(report?.reportLabel || ""),
    context: report?.context || {},
    metadata: report?.metadata || {},
    metrics: report?.metrics || {},
    sectionSummary,
  };

  return {
    title: String(report?.title || ""),
    reportLabel: String(report?.reportLabel || ""),
    sectionIds: sectionSummary.map((row) => row.id),
    blockTypeCounts,
    digest: sha256(stableStringify(digestPayload)),
  };
}

function buildGoldenReportSnapshots() {
  /** @type {Record<string, any>} */
  const out = {};
  const fixtures = GOLDEN_FULL_STATE_FIXTURES.filter((fixture) => REQUIRED_FIXTURE_IDS.includes(fixture.id));
  fixtures.forEach((fixture) => {
    const state = buildGoldenStateFromFixture(fixture);
    const nowDate = new Date(String(fixture?.nowIso || "2026-03-20T12:00:00.000Z"));
    REPORT_FAMILY_ORDER.forEach((reportType) => {
      const report = composeReportDocument({
        reportType,
        state,
        nowDate,
      });
      out[`${fixture.id}::${reportType}`] = buildReportSnapshot(report);
    });
  });
  return out;
}

function readExpected() {
  return JSON.parse(readFileSync(EXPECTED_PATH, "utf8"));
}

test("report golden snapshots: required fixture subset coverage is present", () => {
  const ids = GOLDEN_FULL_STATE_FIXTURES.map((fixture) => fixture.id).filter((id) => REQUIRED_FIXTURE_IDS.includes(id));
  assert.deepEqual(ids, REQUIRED_FIXTURE_IDS);
});

test("report golden snapshots: families and fixture snapshots match locked digest set", () => {
  const expected = readExpected();
  const computed = buildGoldenReportSnapshots();

  assert.deepEqual(Object.keys(computed), Object.keys(expected));
  assert.deepEqual(computed, expected);
});

test("report golden snapshots: deterministic across repeated runs", () => {
  const first = buildGoldenReportSnapshots();
  const second = buildGoldenReportSnapshots();
  assert.deepEqual(second, first);
});
