// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { buildControlsBenchmarkTableRowView } from "./controlsView.js";

test("controls benchmark row view: legacy race token subtext uses human label", () => {
  const view = buildControlsBenchmarkTableRowView({
    benchmarkKey: "federal_general",
    raceType: "state_leg",
    range: { min: 10, max: 20 },
    severityBands: { warnAbove: 2, hardAbove: 4 },
  });
  assert.equal(view.scopeSubText, "race: State Legislative");
});
