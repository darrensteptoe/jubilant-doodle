// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveIntelligencePayload } from "./intelligenceResolver.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resolverSource = fs.readFileSync(path.join(__dirname, "intelligenceResolver.js"), "utf8");

function getSectionByLabel(payload, label){
  const sections = Array.isArray(payload?.sections) ? payload.sections : [];
  return sections.find((row) => String(row?.label || "").trim() === label) || null;
}

test("manual deepening: District Reality guide includes evidence interpretation helper block", () => {
  const payload = resolveIntelligencePayload({
    mode: "module",
    moduleId: "districtRaceContext",
    context: { stageId: "district" },
  });
  const panel = getSectionByLabel(payload, "How to read District Reality evidence states");
  assert.ok(panel, "district helper panel missing");
  assert.match(String(panel?.body || ""), /grounded in evidence/i);
  assert.match(String(panel?.body || ""), /assumption-driven/i);
  assert.match(String(panel?.body || ""), /historical calibration/i);
});

test("manual deepening: Target Config and Reach guides include intelligence interpretation helper blocks", () => {
  const targetPayload = resolveIntelligencePayload({
    mode: "module",
    moduleId: "districtTargetConfig",
    context: { stageId: "district" },
  });
  const targetPanel = getSectionByLabel(targetPayload, "How to read Target Config intelligence");
  assert.ok(targetPanel, "target config helper panel missing");
  assert.match(String(targetPanel?.body || ""), /role labels/i);
  assert.match(String(targetPanel?.body || ""), /fragility tags/i);
  assert.match(String(targetPanel?.body || ""), /why-this-target/i);

  const reachPayload = resolveIntelligencePayload({
    mode: "module",
    moduleId: "reachOperationsGuide",
    context: { stageId: "reach" },
  });
  const reachPanel = getSectionByLabel(reachPayload, "How to read Reach benchmark context");
  assert.ok(reachPanel, "reach helper panel missing");
  assert.match(String(reachPanel?.body || ""), /priority overlap/i);
  assert.match(String(reachPanel?.body || ""), /turnout-opportunity overlap/i);
  assert.match(String(reachPanel?.body || ""), /comparable pool/i);
  assert.match(String(reachPanel?.body || ""), /volatility focus/i);
});

test("manual deepening: Outcome and Data guides include deterministic interpretation helper blocks", () => {
  const outcomePayload = resolveIntelligencePayload({
    mode: "module",
    moduleId: "outcomeOperationsGuide",
    context: { stageId: "outcome" },
  });
  const outcomePanel = getSectionByLabel(outcomePayload, "How to read Outcome driver narrative");
  assert.ok(outcomePanel, "outcome helper panel missing");
  assert.match(String(outcomePanel?.body || ""), /binding factor/i);
  assert.match(String(outcomePanel?.body || ""), /dominant factor/i);
  assert.match(String(outcomePanel?.body || ""), /fragility/i);
  assert.match(String(outcomePanel?.body || ""), /benchmark realism tension/i);

  const dataPayload = resolveIntelligencePayload({
    mode: "module",
    moduleId: "dataOperationsGuide",
    context: { stageId: "data" },
  });
  const dataPanel = getSectionByLabel(dataPayload, "How to read Election Data benchmark quality");
  assert.ok(dataPanel, "election data helper panel missing");
  assert.match(String(dataPanel?.body || ""), /benchmark quality/i);
  assert.match(String(dataPanel?.body || ""), /confidence/i);
  assert.match(String(dataPanel?.body || ""), /comparable coverage/i);
  assert.match(String(dataPanel?.body || ""), /second engine/i);
});

test("manual deepening: campaign data guide includes Decision Narrative interpretation helper block", () => {
  const payload = resolveIntelligencePayload({
    mode: "module",
    moduleId: "campaignDataRequirements",
    context: { stageId: "data" },
  });
  const panel = getSectionByLabel(payload, "How to read Decision Narrative reporting");
  assert.ok(panel, "reporting interpretation helper panel missing");
  assert.match(String(panel?.body || ""), /what is binding/i);
  assert.match(String(panel?.body || ""), /what is improving/i);
  assert.match(String(panel?.body || ""), /what is fragile/i);
  assert.match(String(panel?.body || ""), /benchmark divergence/i);
  assert.match(String(panel?.body || ""), /what to do next/i);
});

test("manual deepening: section shape remains canonical and helper layer is read-only", () => {
  const payload = resolveIntelligencePayload({
    mode: "module",
    moduleId: "districtRaceContext",
    context: { stageId: "district" },
  });
  const panel = getSectionByLabel(payload, "How to read District Reality evidence states");
  assert.ok(panel);
  assert.deepEqual(
    Object.keys(panel || {}).sort(),
    ["body", "expandable", "id", "items", "label", "variant"],
  );

  assert.doesNotMatch(
    resolverSource,
    /setDistrictFormField|updateDistrictCandidate|setDistrictTargetingField|setReachField|setTurnoutField|updateOutcomeControlField|runOutcomeMc|setContextPatch/,
  );
});

