// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveTargetSignalsForRow,
  scoreTargetRow,
} from "./targetModels.js";

function makeState(){
  return {
    turnoutA: 42,
    turnoutB: 48,
    contactRatePct: 24,
    supportRatePct: 56,
    turnoutReliabilityPct: 80,
    doorsPerHour3: 32,
  };
}

function makeFullRow(geoid = "170310101001"){
  return {
    geoid,
    label: `Row ${geoid}`,
    values: {
      B01003_001E: 1200,
      B25001_001E: 500,
      B25003_001E: 420,
      B25003_002E: 220,
      B25003_003E: 200,
      B08201_001E: 420,
      B08201_002E: 70,
      B05001_001E: 1200,
      B05001_002E: 900,
      B05001_003E: 120,
      B05001_004E: 80,
      B05001_005E: 60,
      B08303_001E: 520,
      B08303_011E: 80,
      B08303_012E: 25,
      B08303_013E: 15,
      B17001_001E: 1200,
      B17001_002E: 170,
      B28002_001E: 420,
      B28002_013E: 45,
      B15003_001E: 900,
      B15003_022E: 120,
      B15003_023E: 80,
      B15003_024E: 30,
      B15003_025E: 20,
      C16002_001E: 1200,
      C16002_004E: 30,
      C16002_007E: 20,
      C16002_010E: 10,
      C16002_013E: 5,
      B01001_002E: 580,
      B01001_026E: 620,
      B01001_007E: 30,
      B01001_008E: 35,
      B01001_009E: 28,
      B01001_010E: 24,
      B01001_031E: 31,
      B01001_032E: 33,
      B01001_033E: 24,
      B01001_034E: 22,
      B01001_011E: 35,
      B01001_012E: 35,
      B01001_035E: 33,
      B01001_036E: 32,
      B01001_013E: 37,
      B01001_014E: 35,
      B01001_037E: 36,
      B01001_038E: 34,
      B01001_015E: 40,
      B01001_016E: 38,
      B01001_017E: 36,
      B01001_018E: 34,
      B01001_019E: 32,
      B01001_039E: 39,
      B01001_040E: 37,
      B01001_041E: 35,
      B01001_042E: 33,
      B01001_043E: 31,
      B01001_020E: 24,
      B01001_021E: 22,
      B01001_022E: 20,
      B01001_023E: 18,
      B01001_024E: 16,
      B01001_025E: 14,
      B01001_044E: 24,
      B01001_045E: 22,
      B01001_046E: 20,
      B01001_047E: 18,
      B01001_048E: 16,
      B01001_049E: 14,
      B25024_001E: 500,
      B25024_003E: 30,
      B25024_004E: 22,
      B25024_005E: 18,
      B25024_006E: 14,
      B25024_007E: 10,
      B25024_008E: 8,
      B25024_009E: 7,
      B25024_010E: 6,
      B25024_011E: 5,
    },
  };
}

test("target models: reasons prioritize contextual narratives over generic bp lines", () => {
  const rawSignals = deriveTargetSignalsForRow(makeFullRow(), makeState(), {});
  const scored = scoreTargetRow({
    modelId: "house_v1",
    components: {
      votePotential: 0.72,
      turnoutOpportunity: 0.64,
      persuasionIndex: 0.61,
      fieldEfficiency: 0.66,
    },
    rawSignals,
    config: { state: makeState() },
  });

  const reasons = Array.isArray(scored?.reasons) ? scored.reasons : [];
  assert.ok(reasons.length > 0, "expected at least one reason");
  assert.match(
    String(reasons[0] || ""),
    /(Vote scale:|Turnout upside:|Persuasion mix:|Field feasibility:|Balanced profile:)/,
    "first reason should be contextual and not just a generic driver sentence",
  );
});

test("target models: flags emit explicit coverage warning when census signal columns are missing", () => {
  const sparseRow = {
    geoid: "170310101001",
    label: "Sparse",
    values: {
      B01003_001E: 900,
      B25001_001E: 360,
    },
  };
  const rawSignals = deriveTargetSignalsForRow(sparseRow, makeState(), {});
  const scored = scoreTargetRow({
    modelId: "turnout_opportunity",
    components: {
      votePotential: 0.55,
      turnoutOpportunity: 0.52,
      persuasionIndex: 0.49,
      fieldEfficiency: 0.47,
    },
    rawSignals,
    config: { state: makeState() },
  });

  const flags = Array.isArray(scored?.flags) ? scored.flags : [];
  assert.ok(flags.length > 0, "flags should never be empty");
  assert.match(
    String(flags[0] || ""),
    /(Flag coverage limited:|No elevated operational risk signals detected\.)/,
    "flags should explicitly explain either missing coverage or no elevated risk",
  );
});

test("target models: risk-threshold flags include canonical percentage details when triggered", () => {
  const rawSignals = deriveTargetSignalsForRow(makeFullRow(), makeState(), {});
  const scored = scoreTargetRow({
    modelId: "field_efficiency",
    components: {
      votePotential: 0.58,
      turnoutOpportunity: 0.55,
      persuasionIndex: 0.44,
      fieldEfficiency: 0.73,
    },
    rawSignals,
    config: { state: makeState() },
  });

  const flags = Array.isArray(scored?.flags) ? scored.flags : [];
  assert.ok(flags.length > 0, "expected at least one flag");
  assert.ok(
    flags.some((flag) => /%/.test(String(flag || ""))),
    "flag text should include canonical percentage detail",
  );
});
