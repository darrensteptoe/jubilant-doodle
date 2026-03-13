import { createKpiCard } from "./componentFactory.js";
import { firstNonMissing, isMissingValue, readText } from "./stateBridge.js";

const OUTCOME_API_KEY = "__FPE_OUTCOME_API__";
const REACH_API_KEY = "__FPE_REACH_API__";

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

  const outcomeView = readOutcomeBridgeView();
  const winProb =
    formatBridgeWinProb(outcomeView?.mc?.winProb) ||
    firstNonMissing(["#mcWinProb-sidebar"]);
  const margin =
    formatBridgeMargin(outcomeView?.mc?.p50) ||
    readSidebarMarginFallback();
  const persuasionNeed = firstNonMissing(["#kpiPersuasionNeed-sidebar", "#kpiPersuasionNeed"]);
  const bottleneck = inferBottleneck(outcomeView);

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

function inferBottleneck(outcomeView = null) {
  const reachView = readReachBridgeView();
  const reachConstraint = String(
    reachView?.summary?.constraint ||
    reachView?.weekly?.constraint ||
    ""
  ).toLowerCase();
  if (reachConstraint.includes("capacity")) {
    return "Throughput constrained";
  }
  if (reachConstraint.includes("timeline")) {
    return "Timeline risk";
  }
  if (reachConstraint.includes("rate")) {
    return "Rate assumptions";
  }
  if (reachConstraint.includes("feasible") || reachConstraint.includes("none")) {
    return "Balanced";
  }

  const gapFromBridge = Number(
    reachView?.weekly?.gapPerWeek ??
    reachView?.weekly?.gap ??
    reachView?.summary?.gapPerWeek ??
    reachView?.summary?.gap
  );
  if (Number.isFinite(gapFromBridge) && gapFromBridge > 0) {
    return "Throughput constrained";
  }

  const riskGrade = String(outcomeView?.mc?.riskGrade || "").toLowerCase();
  if (riskGrade.includes("high")) {
    return "Timeline risk";
  }
  if (riskGrade.includes("moderate")) {
    return "Watch risk";
  }

  return "Balanced";
}

function readOutcomeBridgeView() {
  const api = window[OUTCOME_API_KEY];
  if (!api || typeof api.getView !== "function") {
    return null;
  }
  try {
    const view = api.getView();
    return view && typeof view === "object" ? view : null;
  } catch {
    return null;
  }
}

function readReachBridgeView() {
  const api = window[REACH_API_KEY];
  if (!api || typeof api.getView !== "function") {
    return null;
  }
  try {
    const view = api.getView();
    return view && typeof view === "object" ? view : null;
  } catch {
    return null;
  }
}

function formatBridgeWinProb(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return "";
  }
  return `${(n * 100).toFixed(1)}%`;
}

function formatBridgeMargin(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return "";
  }
  const rounded = Math.round(n);
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function readSidebarMarginFallback() {
  const riskBand = String(readText("#riskMarginBand-sidebar") || "").trim();
  if (!isMissingValue(riskBand)) {
    return riskBand;
  }

  const p50Sidebar = String(readText("#mcP50-sidebar") || "").trim();
  if (!p50Sidebar) {
    return "";
  }
  const colon = p50Sidebar.indexOf(":");
  const value = colon >= 0 ? p50Sidebar.slice(colon + 1).trim() : p50Sidebar;
  return isMissingValue(value) ? "" : value;
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
