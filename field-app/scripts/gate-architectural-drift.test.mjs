// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { runArchitecturalDriftGate } from "./gate-architectural-drift.mjs";

test("architectural drift gate: current tree passes all drift checks", () => {
  const report = runArchitecturalDriftGate({ writeReports: false });
  assert.equal(report.pass, true, "drift gate should pass for current tree");
  assert.equal(report.summary.fail, 0, "drift gate should have zero failed checks");
});
