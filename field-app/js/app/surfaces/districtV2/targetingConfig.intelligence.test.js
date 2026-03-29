// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { deriveTargetingIntelligenceView } from "./targetingConfig.js";

test("targeting intelligence derives deterministic role/reason/fragility tags", () => {
  const rows = [
    {
      rank: "1",
      geoid: "17031",
      scoreValue: 0.82,
      votesPerHourValue: 18,
      topTarget: true,
      turnoutPriority: true,
      persuasionPriority: false,
      efficiencyPriority: true,
      flags: "",
    },
    {
      rank: "2",
      geoid: "17043020100",
      scoreValue: 0.64,
      votesPerHourValue: 9,
      topTarget: true,
      turnoutPriority: false,
      persuasionPriority: true,
      efficiencyPriority: false,
      flags: "",
    },
    {
      rank: "3",
      geoid: "99999",
      scoreValue: 0.41,
      votesPerHourValue: 5,
      topTarget: false,
      turnoutPriority: false,
      persuasionPriority: false,
      efficiencyPriority: false,
      flags: "",
    },
  ];
  const advisory = {
    priorityGeographyIds: ["17031"],
    turnoutBoostGeoids: ["17043020100"],
    confidenceBand: "low",
    volatilityFocus: "suburban_ring",
    insightLines: [],
  };

  const intelligence = deriveTargetingIntelligenceView(rows, advisory);
  assert.equal(intelligence.rows.length, 3);
  assert.equal(intelligence.rows[0].roleLabel, "Turnout Lift");
  assert.match(intelligence.rows[0].whyText, /benchmark priority overlap/i);
  assert.equal(intelligence.rows[1].roleLabel, "Persuasion Opportunity");
  assert.match(intelligence.rows[1].whyText, /turnout-opportunity overlap/i);
  assert.equal(intelligence.rows[2].roleLabel, "Low Efficiency");
  assert.ok(["Stable", "Moderate", "Fragile"].includes(intelligence.rows[0].fragilityTag));
});

test("targeting intelligence emits saturation insights only when supported by evidence", () => {
  const rows = [
    { geoid: "100", scoreValue: 0.9, votesPerHourValue: 10, topTarget: true, turnoutPriority: true },
    { geoid: "101", scoreValue: 0.8, votesPerHourValue: 9, topTarget: true, turnoutPriority: false },
    { geoid: "102", scoreValue: 0.75, votesPerHourValue: 8, topTarget: true, turnoutPriority: false },
    { geoid: "103", scoreValue: 0.05, votesPerHourValue: 4, topTarget: false, turnoutPriority: false },
    { geoid: "104", scoreValue: 0.04, votesPerHourValue: 3, topTarget: false, turnoutPriority: false },
  ];
  const advisory = {
    priorityGeographyIds: ["777", "778", "779"],
    turnoutBoostGeoids: ["888", "889"],
    confidenceBand: "critical",
    insightLines: [
      "Benchmark priority geographies are underrepresented in the current targeting slate.",
    ],
  };

  const intelligence = deriveTargetingIntelligenceView(rows, advisory);
  assert.ok(Array.isArray(intelligence.insightLines));
  assert.ok(intelligence.insightLines.length > 0);
  assert.match(intelligence.insightLines.join(" "), /underrepresented|fragile|concentrated|broad but shallow/i);
});

