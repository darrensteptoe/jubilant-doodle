// @ts-check

import assert from "node:assert/strict";
import test from "node:test";

import { makeCanonicalState } from "../state/schema.js";
import { composeReportDocument } from "./composeReport.js";
import { renderReportHtmlDocument } from "./renderers/html.js";
import { renderReportPdfHtmlDocument } from "./renderers/pdf.js";

const NOW_ISO = "2026-03-20T12:00:00.000Z";

function buildMinimalState() {
  const state = makeCanonicalState({ nowDate: new Date(NOW_ISO) });
  state.domains.campaign.campaignId = "demo_campaign";
  state.domains.campaign.campaignName = "Demo Campaign";
  state.domains.campaign.officeId = "demo_office";
  state.domains.campaign.scenarioName = "baseline";
  state.domains.scenarios.activeScenarioId = "baseline";
  state.domains.scenarios.selectedScenarioId = "baseline";
  return state;
}

test("report renderer: html renderer returns structured report html", () => {
  const state = buildMinimalState();
  const report = composeReportDocument({
    reportType: "client_standard",
    state,
    nowDate: new Date(NOW_ISO),
  });
  const html = renderReportHtmlDocument(report, { includeStyles: true });

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<header class="report-header">/);
  assert.match(html, /<section class="report-section"/);
  assert.match(html, /report-metric-grid/);
  assert.match(html, /Generated:/);
});

test("report renderer: pdf renderer is print-ready and includes the title", () => {
  const state = buildMinimalState();
  const report = composeReportDocument({
    reportType: "internal_full",
    state,
    nowDate: new Date(NOW_ISO),
  });
  const pdfHtml = renderReportPdfHtmlDocument(report, { includeStyles: true });

  assert.match(pdfHtml, /<!doctype html>/i);
  assert.match(pdfHtml, /@media print/);
  assert.match(pdfHtml, /report-section/);
  assert.match(pdfHtml, new RegExp(report.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("report renderer: handles empty or partial report structures safely", () => {
  const html = renderReportHtmlDocument({
    title: "Partial report",
    generatedAt: NOW_ISO,
    reportType: "internal_full",
    sections: [
      { id: "empty_section", title: "Empty section" },
    ],
  });

  assert.match(html, /Empty section/);
  assert.match(html, /No section content\./);
});

test("report renderer: appendix blocks render stable detail rows", () => {
  const html = renderReportHtmlDocument({
    title: "Appendix test",
    generatedAt: NOW_ISO,
    reportType: "internal_full",
    sections: [
      {
        id: "appendix",
        title: "Appendix",
        blocks: [
          {
            id: "appendix_1",
            type: "appendix",
            title: "Source references",
            rows: [
              { label: "Snapshot hash", value: "abc123" },
              { label: "Scenario", value: "baseline" },
            ],
          },
        ],
      },
    ],
  });

  assert.match(html, /Source references/);
  assert.match(html, /Snapshot hash/);
  assert.match(html, /abc123/);
  assert.match(html, /Scenario/);
});

