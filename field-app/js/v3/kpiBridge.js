import { createKpiCard } from "./componentFactory.js";
import { firstNonEmpty, parseNumber, readText } from "./stateBridge.js";

const KPI_SPECS = [
  { id: "v3KpiWinProb", label: "Win probability" },
  { id: "v3KpiMargin", label: "Projected margin (P50)" },
  { id: "v3KpiNeed", label: "Persuasion votes needed" },
  { id: "v3KpiBottleneck", label: "Primary bottleneck" }
];

export function ensureKpiStrip() {
  const strip = document.getElementById("v3KpiStrip");
  if (!strip || strip.children.length > 0) {
    return;
  }

  KPI_SPECS.forEach((spec) => {
    strip.appendChild(createKpiCard(spec.label, spec.id));
  });
}

export function syncKpis() {
  ensureKpiStrip();

  const winProb = firstNonEmpty(["#mcWinProb-sidebar", "#mcWinProb"]);
  const margin = firstNonEmpty(["#mcP50", "#riskMarginBand-sidebar", "#mcMedian"]);
  const persuasionNeed = firstNonEmpty(["#kpiPersuasionNeed-sidebar", "#kpiPersuasionNeed"]);
  const bottleneck = firstNonEmpty(["#wkConstraint", "#optBinding"]) || inferBottleneck();

  setKpiValue("v3KpiWinProb", winProb || "-");
  setKpiValue("v3KpiMargin", margin || "-");
  setKpiValue("v3KpiNeed", persuasionNeed || "-");
  setKpiValue("v3KpiBottleneck", bottleneck || "-");
}

function setKpiValue(id, value) {
  const node = document.getElementById(id);
  const valueNode = node ? node.querySelector(".fpe-kpi__value") : null;
  if (valueNode) {
    valueNode.textContent = value;
  }
}

function inferBottleneck() {
  const gap = parseNumber(readText("#wkGapPerWeek"));
  if (Number.isFinite(gap) && gap > 0) {
    return "Throughput constrained";
  }

  const missRisk = parseNumber(readText("#opsMissProb"));
  if (Number.isFinite(missRisk) && missRisk > 40) {
    return "Timeline risk";
  }

  return "Balanced";
}
