// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { buildDecisionTrustSurface, listDecisionTrustFigures } from "./decisionTrustLayer.js";

function baseShell(overrides = {}){
  return {
    campaignId: "demo-campaign",
    officeId: "us-house-01",
    scenarioId: "baseline",
    contextMissing: [],
    ...overrides,
  };
}

test("decision trust layer: district stage exposes tier-1 trust cards with canonical paths", () => {
  const payload = buildDecisionTrustSurface({
    stageId: "district",
    shellView: baseShell(),
    stageViews: {
      district: {
        form: {
          universeSize: 42000,
          universeBasis: "registered_voters",
          turnoutA: 58,
          turnoutB: 66,
          bandWidth: 8,
        },
        summary: {
          universeText: "42,000",
          baselineSupportText: "51.2%",
          turnoutExpectedText: "63.0%",
          turnoutBandText: "66.0% / 58.0%",
          votesPer1pctText: "420",
        },
        ballot: {
          undecidedMode: "proportional",
          undecidedPct: 8,
          yourCandidateId: "cand_a",
        },
      },
    },
  });

  assert.equal(payload.title, "Decision Trust Layer");
  assert.equal(payload.tiers.tier1.length, 8);
  const ids = payload.figures.map((row) => row.id);
  assert.ok(ids.includes("targetUniverse"));
  assert.ok(ids.includes("expectedSupport"));
  assert.ok(ids.includes("turnoutProjection"));

  const universe = payload.figures.find((row) => row.id === "targetUniverse");
  assert.equal(universe?.canonicalPath, "__FPE_DISTRICT_API__.getView().form.universeSize");
  assert.equal(universe?.displayValue, universe?.tracedValue);
  assert.equal(universe?.trustState?.code, "ready");
  assert.ok((universe?.assumptions || []).length > 0);
  const expectedSupport = payload.figures.find((row) => row.id === "expectedSupport");
  const turnoutProjection = payload.figures.find((row) => row.id === "turnoutProjection");
  assert.ok((expectedSupport?.reportParityMappings || []).length >= 2);
  assert.ok((turnoutProjection?.reportParityMappings || []).length >= 2);
});

test("decision trust layer: missing context enforces missing trust state", () => {
  const payload = buildDecisionTrustSurface({
    stageId: "plan",
    shellView: baseShell({ officeId: "", contextMissing: ["officeId"] }),
    stageViews: {
      plan: {
        summary: {
          workload: { volunteersNeeded: "120" },
          optimizer: { totalCost: "$62,000" },
          timeline: { remainingGapValue: "1,400" },
        },
        inputs: {
          timelineStaffCount: 12,
          timelineStaffHours: 35,
          timelineVolCount: 120,
          timelineVolHours: 4,
          optMode: "budget",
          optObjective: "net",
          optBudget: 62000,
        },
      },
    },
  });

  assert.ok(payload.figures.length >= 2);
  for (const figure of payload.figures){
    assert.equal(figure.trustState?.code, "missing");
  }
});

test("decision trust layer: fallback and review states classify deterministic runtime conditions", () => {
  const payload = buildDecisionTrustSurface({
    stageId: "reach",
    shellView: baseShell(),
    stageViews: {
      reach: {
        summary: {
          capacity: "9,000",
          gap: "+1,200",
        },
        inputs: {
          supportRatePct: 47,
          contactRatePct: 21,
          hoursPerShift: 3,
          shiftsPerVolunteerPerWeek: 2,
        },
        weekly: {
          requiredAttempts: "10,200",
          capacity: "9,000",
          constraint: "capacity",
        },
        outlook: {
          activeSource: "override fallback baseline",
        },
      },
    },
  });

  const reachCapacity = payload.figures.find((row) => row.id === "reachCapacity");
  const gap = payload.figures.find((row) => row.id === "gapToGoal");

  assert.equal(reachCapacity?.trustState?.code, "fallback");
  assert.equal(gap?.trustState?.code, "review");
});

test("decision trust layer: outcome fragility reflects MC staleness and parity", () => {
  const payload = buildDecisionTrustSurface({
    stageId: "outcome",
    shellView: baseShell(),
    stageViews: {
      outcome: {
        inputs: {
          mcMode: "advanced",
          mcVolatility: "high",
          turnoutReliabilityPct: 72,
        },
        mc: {
          fragilityIndex: 0.62,
          freshTag: "MC pending",
          staleTag: "No run yet",
        },
      },
    },
  });

  const fragility = payload.figures.find((row) => row.id === "planFragility");
  assert.ok(fragility);
  assert.equal(fragility?.displayValue, fragility?.tracedValue);
  assert.equal(fragility?.trustState?.code, "fallback");
  assert.equal(fragility?.canonicalPath, "__FPE_OUTCOME_API__.getView().mc.fragilityIndex");
});

test("decision trust layer: figure index exposes tier and surface mappings", () => {
  const list = listDecisionTrustFigures();
  assert.ok(list.length >= 8);
  const byId = new Map(list.map((row) => [row.id, row]));
  assert.equal(byId.get("budgetRequirement")?.tier, "tier1");
  assert.ok((byId.get("budgetRequirement")?.displaySurfaces || []).length > 0);
  assert.ok((byId.get("budgetRequirement")?.reportSurfaces || []).length > 0);
});
