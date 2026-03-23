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
  assert.deepEqual(labels.slice(0, 10), [
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
  assert.equal(sections[0]?.variant, "hero");
  assert.equal(sections[2]?.variant, "mini-row");
  assert.ok(sections[5]?.expandable, "tight vs wide should be collapsible");
  assert.ok(sections[9]?.expandable, "concrete example should be collapsible");
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
