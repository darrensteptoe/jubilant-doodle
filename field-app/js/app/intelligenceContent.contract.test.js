// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { MODULE_DOCTRINE_REGISTRY } from "./moduleDoctrineRegistry.js";
import { GLOSSARY_REGISTRY, normalizeGlossaryTermId } from "./glossaryRegistry.js";
import { resolveIntelligencePayload } from "./intelligenceResolver.js";

const forecast = MODULE_DOCTRINE_REGISTRY.forecastOutcome?.sections || {};
const governance = MODULE_DOCTRINE_REGISTRY.governanceConfidence?.sections || {};
const warRoom = MODULE_DOCTRINE_REGISTRY.warRoomDecisionSession?.sections || {};
const dataReq = MODULE_DOCTRINE_REGISTRY.campaignDataRequirements?.sections || {};

test("intelligence doctrine: forecast percentile framing matches live rail cuts", () => {
  const ranges = String(forecast.rangesExplained || "");
  assert.match(ranges, /P10, P50, and P90/i);
  assert.match(ranges, /P30 or P70/i);
  assert.doesNotMatch(ranges, /P30\s*\/\s*P50\s*\/\s*P70\s*\/\s*P90/i);
});

test("intelligence doctrine: upgraded decision framing copy is present", () => {
  assert.match(String(forecast.howToThink || ""), /planning off floor, middle, or upside/i);
  assert.match(String(forecast.whatGoodLooksLike || ""), /believable middle/i);

  assert.match(String(governance.rangesExplained || ""), /does not automatically mean the model is broken/i);
  assert.match(String(governance.howToThink || ""), /clean output is not the same as a trustworthy output/i);

  assert.match(String(warRoom.howToThink || ""), /observation, interpretation, and commitment/i);
  assert.match(String(warRoom.whatGoodLooksLike || ""), /safe, balanced, or aggressive/i);

  assert.match(String(dataReq.howToThink || ""), /no owner, source path, or cadence/i);
  assert.match(String(dataReq.rangesExplained || ""), /Cadence discipline narrows uncertainty over time/i);
});

test("intelligence glossary: percentile and planning terms are registered and discoverable", () => {
  const required = ["percentileRange", "median", "planningFloor", "upsideCase", "confidenceBand"];
  for (const id of required) {
    const entry = GLOSSARY_REGISTRY[id];
    assert.ok(entry, `missing glossary entry: ${id}`);
    assert.ok(String(entry.term || "").length > 0, `${id} missing term`);
    assert.ok(String(entry.definition || "").length > 0, `${id} missing definition`);
    assert.ok(String(entry.whyItMatters || "").length > 0, `${id} missing whyItMatters`);
    assert.equal(normalizeGlossaryTermId(id), id);
  }

  assert.equal(normalizeGlossaryTermId("P50"), "median");
  assert.equal(normalizeGlossaryTermId("forecast percentile"), "percentileRange");
  assert.equal(normalizeGlossaryTermId("uncertainty band"), "confidenceBand");
});

test("intelligence doctrine: upgraded modules cross-link to new glossary terms", () => {
  const forecastTerms = MODULE_DOCTRINE_REGISTRY.forecastOutcome?.relatedTerms || [];
  const governanceTerms = MODULE_DOCTRINE_REGISTRY.governanceConfidence?.relatedTerms || [];
  const warRoomTerms = MODULE_DOCTRINE_REGISTRY.warRoomDecisionSession?.relatedTerms || [];

  for (const id of ["percentileRange", "median", "planningFloor", "upsideCase", "confidenceBand"]) {
    assert.ok(forecastTerms.includes(id), `forecastOutcome missing related term ${id}`);
  }
  assert.ok(governanceTerms.includes("confidenceBand"), "governanceConfidence missing confidenceBand link");
  assert.ok(warRoomTerms.includes("planningFloor"), "warRoomDecisionSession missing planningFloor link");
  assert.ok(warRoomTerms.includes("upsideCase"), "warRoomDecisionSession missing upsideCase link");
});

test("intelligence resolver: forecast guide renders editorial section flow with variants", () => {
  const payload = resolveIntelligencePayload({
    mode: "module",
    moduleId: "forecastOutcome",
    context: { stageId: "outcome" },
  });
  const labels = Array.isArray(payload?.sections) ? payload.sections.map((row) => String(row?.label || "")) : [];
  assert.equal(labels[0], "How to read this forecast");
  assert.equal(labels[1], "Operator check");

  const forecastFlowStart = labels.indexOf("How to Read This Tool");
  assert.ok(forecastFlowStart >= 0, "forecast editorial flow missing How to Read This Tool anchor");
  assert.deepEqual(labels.slice(forecastFlowStart, forecastFlowStart + 10), [
    "How to Read This Tool",
    "What the Range Is Showing",
    "What Each Number Means",
    "Which Number Should You Use",
    "What a Good Range Looks Like",
    "Tight vs Wide Ranges",
    "How to Read Change",
    "How Teams Should Use This",
    "One-Minute Explanation",
    "Concrete Example",
  ]);

  const sections = payload.sections || [];
  const helper = sections.find((row) => String(row?.label || "") === "How to read this forecast");
  const numberMeanings = sections.find((row) => String(row?.label || "") === "What Each Number Means");
  const tightVsWide = sections.find((row) => String(row?.label || "") === "Tight vs Wide Ranges");
  const concreteExample = sections.find((row) => String(row?.label || "") === "Concrete Example");
  assert.equal(helper?.variant, "hero");
  assert.equal(numberMeanings?.variant, "mini-row");
  assert.ok(tightVsWide?.expandable, "tight vs wide should be collapsible");
  assert.ok(concreteExample?.expandable, "concrete example should be collapsible");
});

test("intelligence resolver: key utilization helper panels are present for governance, war room, and benchmark guidance", () => {
  const governancePayload = resolveIntelligencePayload({
    mode: "module",
    moduleId: "governanceConfidence",
    context: { stageId: "outcome" },
  });
  const governanceLabels = Array.isArray(governancePayload?.sections)
    ? governancePayload.sections.map((row) => String(row?.label || ""))
    : [];
  assert.ok(governanceLabels.includes("How to use trust correctly"));

  const warRoomPayload = resolveIntelligencePayload({
    mode: "module",
    moduleId: "warRoomDecisionSession",
    context: { stageId: "war-room" },
  });
  const warRoomLabels = Array.isArray(warRoomPayload?.sections)
    ? warRoomPayload.sections.map((row) => String(row?.label || ""))
    : [];
  assert.ok(warRoomLabels.includes("How to use this in the war room"));

  const dataPayload = resolveIntelligencePayload({
    mode: "module",
    moduleId: "campaignDataRequirements",
    context: { stageId: "data" },
  });
  const dataLabels = Array.isArray(dataPayload?.sections)
    ? dataPayload.sections.map((row) => String(row?.label || ""))
    : [];
  assert.ok(dataLabels.includes("How to use benchmark data without fooling yourself"));
  assert.ok(dataLabels.includes("How to turn this into action"));
});

test("intelligence resolver: weather/event warnings render only when playbook signals indicate short-horizon pressure", () => {
  const activePayload = resolveIntelligencePayload({
    mode: "module",
    moduleId: "warRoomDecisionSession",
    context: {
      stageId: "war-room",
      playbookSignals: {
        decisionPressureLevel: "high",
        weatherFieldExecutionRisk: "high",
        weatherElectionDayTurnoutRisk: "medium",
        todayCampaignEvents: 2,
      },
    },
  });
  const activeLabels = Array.isArray(activePayload?.sections)
    ? activePayload.sections.map((row) => String(row?.label || ""))
    : [];
  assert.ok(activeLabels.includes("Operating posture warning"));
  assert.ok(activeLabels.includes("Temporary capacity note"));

  const quietPayload = resolveIntelligencePayload({
    mode: "module",
    moduleId: "warRoomDecisionSession",
    context: {
      stageId: "war-room",
      playbookSignals: {
        decisionPressureLevel: "low",
        weatherFieldExecutionRisk: "low",
        weatherElectionDayTurnoutRisk: "low",
        todayCampaignEvents: 0,
      },
    },
  });
  const quietLabels = Array.isArray(quietPayload?.sections)
    ? quietPayload.sections.map((row) => String(row?.label || ""))
    : [];
  assert.equal(quietLabels.includes("Operating posture warning"), false);
  assert.equal(quietLabels.includes("Temporary capacity note"), false);
});

test("intelligence resolver: glossary links are always available across primary modes", () => {
  const stages = ["district", "reach", "turnout", "outcome", "plan", "scenarios", "decision-log", "controls", "data"];
  for (const stageId of stages){
    const modulePayload = resolveIntelligencePayload({ mode: "module", context: { stageId } });
    const modelPayload = resolveIntelligencePayload({ mode: "model", context: { stageId } });
    const playbookPayload = resolveIntelligencePayload({ mode: "playbook", context: { stageId } });
    const termPayload = resolveIntelligencePayload({ mode: "glossary", termId: "confidenceBand", context: { stageId } });
    const payloads = [
      ["module", modulePayload],
      ["model", modelPayload],
      ["playbook", playbookPayload],
      ["glossary", termPayload],
    ];
    for (const [mode, payload] of payloads){
      const glossaryLinks = Array.isArray(payload?.links)
        ? payload.links.filter((row) => String(row?.type || "").toLowerCase() === "glossary")
        : [];
      assert.ok(
        glossaryLinks.length > 0,
        `stage ${stageId} mode ${mode} missing glossary links`,
      );
    }
  }
});

test("intelligence resolver: module payload includes decision trust layer with tier map and traced parity", () => {
  const payload = resolveIntelligencePayload({
    mode: "module",
    context: {
      stageId: "reach",
      shellView: {
        campaignId: "campaign-demo",
        officeId: "office-1",
        scenarioId: "baseline",
        contextMissing: [],
      },
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
            activeSource: "baseline",
          },
        },
      },
    },
  });

  assert.ok(payload?.trust && typeof payload.trust === "object");
  assert.equal(Array.isArray(payload?.trust?.tiers?.tier1), true);
  assert.ok((payload?.trust?.tiers?.tier1 || []).length >= 8);

  const figures = Array.isArray(payload?.trust?.figures) ? payload.trust.figures : [];
  assert.ok(figures.length >= 2);
  const reachCapacity = figures.find((row) => row.id === "reachCapacity");
  assert.ok(reachCapacity, "reachCapacity trust figure missing");
  assert.equal(reachCapacity?.displayValue, "9,000");
  assert.equal(reachCapacity?.displayValue, reachCapacity?.tracedValue);
  assert.equal(reachCapacity?.canonicalPath, "__FPE_REACH_API__.getView().summary.capacity");
});
