// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { composeReportDocument } from "./composeReport.js";
import { buildReportContext } from "./reportContext.js";
import { fmtMetric } from "./sectionBuilders/common.js";
import { buildDecisionTrustSurface } from "../../app/decisionTrustLayer.js";
import { buildGoldenStateFromFixture } from "../state/goldenFullStateHarness.js";
import { GOLDEN_FULL_STATE_FIXTURES, DEFAULT_GOLDEN_NOW_ISO } from "../state/goldenFullStateFixtures.js";

function clean(value){
  return String(value == null ? "" : value).trim();
}

function getFixture(id){
  return GOLDEN_FULL_STATE_FIXTURES.find((row) => String(row?.id || "") === String(id || "")) || null;
}

function findMetricGridValue(report, { sectionId, metricLabel }){
  const sections = Array.isArray(report?.sections) ? report.sections : [];
  const section = sections.find((row) => clean(row?.id) === clean(sectionId));
  if (!section) return "";
  const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
  for (const block of blocks){
    if (clean(block?.type) !== "metric_grid") continue;
    const metrics = Array.isArray(block?.metrics) ? block.metrics : [];
    const hit = metrics.find((row) => clean(row?.label) === clean(metricLabel));
    if (hit) return clean(hit?.value);
  }
  return "";
}

test("decision trust parity: canonical district metrics match trust values and report payload values", () => {
  const fixture = getFixture("municipal_race");
  assert.ok(fixture, "municipal_race fixture missing");

  const state = buildGoldenStateFromFixture(fixture);
  const nowDate = new Date(fixture?.nowIso || DEFAULT_GOLDEN_NOW_ISO);

  const internalReport = composeReportDocument({
    reportType: "internal_full",
    state,
    nowDate,
  });
  const clientReport = composeReportDocument({
    reportType: "client_standard",
    state,
    nowDate,
  });

  const reportContext = buildReportContext({
    reportType: "internal_full",
    state,
    nowDate,
  });

  const baselineSupport = reportContext?.metrics?.metrics?.baselineSupport?.value;
  const turnoutExpected = reportContext?.metrics?.metrics?.turnoutExpected?.value;
  const campaignContext = reportContext?.context && typeof reportContext.context === "object" ? reportContext.context : {};

  const trust = buildDecisionTrustSurface({
    stageId: "district",
    shellView: {
      campaignId: clean(campaignContext?.campaignId),
      officeId: clean(campaignContext?.officeId),
      scenarioId: clean(campaignContext?.scenarioId),
      contextMissing: [],
    },
    stageViews: {
      district: {
        form: {
          universeSize: state?.domains?.district?.form?.universeSize,
          universeBasis: state?.domains?.district?.form?.universeBasis,
          turnoutA: state?.domains?.district?.form?.turnoutA,
          turnoutB: state?.domains?.district?.form?.turnoutB,
          bandWidth: state?.domains?.district?.form?.bandWidth,
        },
        summary: {
          baselineSupportText: fmtMetric(baselineSupport, 1, "%"),
          turnoutExpectedText: fmtMetric(turnoutExpected, 1, "%"),
          turnoutBandText: "—",
          votesPer1pctText: "—",
        },
        ballot: {
          undecidedMode: state?.domains?.ballot?.undecidedMode || "proportional",
          undecidedPct: state?.domains?.ballot?.undecidedPct,
          yourCandidateId: state?.domains?.ballot?.yourCandidateId,
        },
      },
    },
  });

  const figures = Array.isArray(trust?.figures) ? trust.figures : [];
  const expectedSupportFigure = figures.find((row) => row.id === "expectedSupport");
  const turnoutFigure = figures.find((row) => row.id === "turnoutProjection");
  assert.ok(expectedSupportFigure, "expectedSupport trust figure missing");
  assert.ok(turnoutFigure, "turnoutProjection trust figure missing");

  for (const figure of [expectedSupportFigure, turnoutFigure]){
    assert.equal(figure?.displayValue, figure?.tracedValue, `${figure?.id} traced/display mismatch`);
    const mappings = Array.isArray(figure?.reportParityMappings) ? figure.reportParityMappings : [];
    assert.ok(mappings.length >= 2, `${figure?.id} missing report parity mappings`);
    for (const mapping of mappings){
      const report = mapping?.reportType === "client_standard" ? clientReport : internalReport;
      const reportValue = findMetricGridValue(report, {
        sectionId: mapping?.sectionId,
        metricLabel: mapping?.metricLabel,
      });
      assert.ok(reportValue, `${figure?.id} missing report value for ${mapping?.reportType}:${mapping?.sectionId}:${mapping?.metricLabel}`);
      assert.equal(reportValue, figure?.displayValue, `${figure?.id} report parity mismatch for ${mapping?.reportType}`);
    }
  }
});

test("decision trust parity: unmapped tier-1 figures explicitly show no direct report metric parity mapping", () => {
  const trust = buildDecisionTrustSurface({
    stageId: "plan",
    shellView: {
      campaignId: "demo-campaign",
      officeId: "office-1",
      scenarioId: "baseline",
      contextMissing: [],
    },
    stageViews: {
      plan: {
        summary: {
          workload: { volunteersNeeded: "130" },
          optimizer: { totalCost: "$64,000" },
          timeline: { remainingGapValue: "1,300" },
        },
        inputs: {
          timelineStaffCount: 12,
          timelineStaffHours: 40,
          timelineVolCount: 120,
          timelineVolHours: 4,
          optMode: "budget",
          optObjective: "net",
          optBudget: 64000,
        },
      },
    },
  });

  const figures = Array.isArray(trust?.figures) ? trust.figures : [];
  const staffing = figures.find((row) => row.id === "staffingNeed");
  const budget = figures.find((row) => row.id === "budgetRequirement");
  assert.ok(staffing);
  assert.ok(budget);
  assert.equal(Array.isArray(staffing?.reportParityMappings) ? staffing.reportParityMappings.length : -1, 0);
  assert.equal(Array.isArray(budget?.reportParityMappings) ? budget.reportParityMappings.length : -1, 0);
});
