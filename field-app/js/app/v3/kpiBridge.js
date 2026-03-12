import { createKpiCard } from "./componentFactory.js";
import { firstNonMissing, isMissingValue, readNumber } from "./stateBridge.js";

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

  const winProb = firstNonMissing(["#mcWinProb-sidebar", "#mcWinProb"]);
  const margin = firstNonMissing(["#mcP50", "#riskMarginBand-sidebar", "#mcMedian"]);
  const persuasionNeed = firstNonMissing(["#kpiPersuasionNeed-sidebar", "#kpiPersuasionNeed"]);
  const bottleneck =
    firstNonMissing(["#v3ReachSummaryConstraint", "#v3ReachConstraint", "#wkConstraint", "#optBinding"]) ||
    inferBottleneck();

  setKpiValue("v3KpiWinProb", winProb || "-");
  setKpiValue("v3KpiMargin", margin || "-");
  setKpiValue("v3KpiNeed", persuasionNeed || "-");
  setKpiValue("v3KpiBottleneck", bottleneck || "-");
}

function setKpiValue(id, value) {
  const node = document.getElementById(id);
  const valueNode = node ? node.querySelector(".fpe-kpi__value") : null;
  const normalized = String(value || "-").trim() || "-";
  if (valueNode instanceof HTMLElement) {
    valueNode.textContent = normalized;
  }
  if (node instanceof HTMLElement) {
    node.classList.toggle("is-empty", isMissingValue(normalized));
    node.classList.remove("fpe-kpi--neutral", "fpe-kpi--ok", "fpe-kpi--warn", "fpe-kpi--bad");
    node.classList.add(`fpe-kpi--${classifyKpiTone(id, normalized)}`);
  }
}

function inferBottleneck() {
  const gap = firstFiniteNumber(["#v3ReachSummaryGap", "#v3ReachGap", "#wkGapPerWeek"]);
  if (Number.isFinite(gap) && gap > 0) {
    return "Throughput constrained";
  }

  const missRisk = readNumber("#opsMissProb");
  if (Number.isFinite(missRisk) && missRisk > 40) {
    return "Timeline risk";
  }

  return "Balanced";
}

function firstFiniteNumber(selectors) {
  for (const selector of selectors) {
    const n = readNumber(selector);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return NaN;
}

function classifyKpiTone(id, value) {
  const source = `${id} ${value}`.toLowerCase();
  if (/(none|balanced|clear|ok)/.test(source)) {
    return "ok";
  }
  if (/(risk|constrained|gap|warning|binding)/.test(source)) {
    return "warn";
  }
  if (/(error|fail|critical)/.test(source)) {
    return "bad";
  }
  return "neutral";
}
