// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexSource = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
const reportingSource = fs.readFileSync(path.join(__dirname, "reporting.js"), "utf8");

test("reporting guidance contract: reporting workflow/help blocks are rendered in data surface", () => {
  assert.match(indexSource, /Reporting Workflow/, "reporting workflow title must render");
  assert.match(
    indexSource,
    /Use reports as operating tools, not just exports\./,
    "reporting workflow intro text must render",
  );
  assert.match(
    indexSource,
    /Select a report type to see what conversation it is built for\./,
    "selector help text must render",
  );
  assert.match(indexSource, /How to choose the right report/, "how-to-choose block must render");
  assert.match(indexSource, /Operating discipline/, "operating discipline note title must render");
  assert.match(
    indexSource,
    /The strongest output in this system comes from disciplined updates, credible comparables, clear ownership, and honest use of uncertainty\. Clean presentation does not replace source quality\./,
    "operating discipline note body must render",
  );
});

test("reporting guidance contract: selector and guidance support all canonical report families", () => {
  const families = [
    "internal_full",
    "client_standard",
    "war_room_brief",
    "weekly_actions",
    "readiness_audit",
    "election_data_benchmark",
    "post_election_learning",
  ];
  for (const family of families) {
    assert.match(indexSource, new RegExp(`<option value="${family}">`), `selector missing ${family}`);
    assert.match(reportingSource, new RegExp(`${family}:\\s*Object\\.freeze\\(`), `guidance map missing ${family}`);
  }
});

test("reporting guidance contract: dynamic guidance text fields are wired by reporting sync", () => {
  const ids = [
    "v3DataReportGuideLabel",
    "v3DataReportGuideAudience",
    "v3DataReportGuidePurpose",
    "v3DataReportGuideWhen",
    "v3DataReportGuideDecision",
    "v3DataReportGuideCadence",
    "v3DataReportGuideOperator",
  ];
  for (const id of ids) {
    assert.match(reportingSource, new RegExp(`"${id}"`), `reporting sync missing ${id}`);
    assert.match(indexSource, new RegExp(`id="${id}"`), `data surface missing ${id}`);
  }
});
