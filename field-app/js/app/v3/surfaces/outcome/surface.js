export function renderOutcomeSurfaceRows(rows, context = {}) {
  const {
    formatPercentFromUnit,
    formatSignedWhole,
  } = context;

  if (
    typeof formatPercentFromUnit !== "function"
    || typeof formatSignedWhole !== "function"
  ) {
    return;
  }

  const tbody = document.getElementById("v3OutcomeSurfaceTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }

  tbody.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td class="muted">Run surface compute.</td>
        <td class="num muted">-</td>
        <td class="num muted">-</td>
        <td class="num muted">-</td>
        <td class="num muted">-</td>
      </tr>
    `;
    return;
  }

  for (const row of list) {
    const tr = document.createElement("tr");
    const td0 = document.createElement("td");
    td0.textContent = String(row?.leverValue ?? "—");

    const td1 = document.createElement("td");
    td1.className = "num";
    td1.textContent = formatPercentFromUnit(Number(row?.winProb), 1);

    const td2 = document.createElement("td");
    td2.className = "num";
    td2.textContent = formatSignedWhole(Number(row?.p10));

    const td3 = document.createElement("td");
    td3.className = "num";
    td3.textContent = formatSignedWhole(Number(row?.p50));

    const td4 = document.createElement("td");
    td4.className = "num";
    td4.textContent = formatSignedWhole(Number(row?.p90));

    tr.append(td0, td1, td2, td3, td4);
    tbody.appendChild(tr);
  }
}

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeText(value) {
  return String(value == null ? "" : value).trim();
}

function formatPercent(value, digits = 1) {
  const num = toFiniteNumber(value);
  if (num == null) {
    return "—";
  }
  return `${(num * 100).toFixed(digits)}%`;
}

function formatSigned(value, digits = 2) {
  const num = toFiniteNumber(value);
  if (num == null) {
    return "—";
  }
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(digits)}`;
}

function normalizeSensitivityRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((row) => ({
      label: normalizeText(row?.label || row?.name || ""),
      impact: toFiniteNumber(row?.impact),
    }))
    .filter((row) => row.label && row.impact != null)
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

function deriveCapacityBindingSignal(outcomeGapNote) {
  const note = normalizeText(outcomeGapNote);
  if (!note) {
    return null;
  }
  const token = note.toLowerCase();
  if (token.includes("see reach capacity outlook")) {
    return null;
  }
  if (
    token.includes("shortfall")
    || token.includes("behind")
    || token.includes("deficit")
    || token.includes("insufficient")
    || token.includes("gap")
    || token.includes("miss")
  ) {
    return `Capacity is binding (${note}).`;
  }
  if (token.includes("on track") || token.includes("ahead") || token.includes("surplus")) {
    return null;
  }
  return `Capacity posture: ${note}.`;
}

function deriveBindingFactorLine({
  bridgeMc,
  outcomeGapNote,
  governanceView,
  bridgedSurfaceStatus,
  outcomeWinProb,
}) {
  const capacitySignal = deriveCapacityBindingSignal(outcomeGapNote);
  if (capacitySignal) {
    return `Binding factor: ${capacitySignal}`;
  }

  const requiredShiftP50 = toFiniteNumber(bridgeMc?.requiredShiftP50);
  if (requiredShiftP50 != null && requiredShiftP50 > 0) {
    return `Binding factor: Persuasion shift remains binding (median break-even needs ${Math.round(requiredShiftP50)} net votes).`;
  }

  const cliffRisk = toFiniteNumber(bridgeMc?.cliffRisk);
  if (cliffRisk != null && cliffRisk >= 0.18) {
    return `Binding factor: Downside cliff pressure is binding (cliff risk ${formatPercent(cliffRisk)}).`;
  }

  const confidenceBand = normalizeText(governanceView?.confidenceBand).toLowerCase();
  if (confidenceBand === "low" || confidenceBand === "critical") {
    return `Binding factor: Evidence confidence is binding (governance confidence ${confidenceBand}).`;
  }

  const surfaceText = normalizeText(bridgedSurfaceStatus).toLowerCase();
  if (surfaceText.includes("cliff")) {
    return "Binding factor: Surface cliff behavior is binding near the current assumption range.";
  }

  const winProb = toFiniteNumber(outcomeWinProb);
  if (winProb != null) {
    return `Binding factor: No single hard bottleneck detected; current modeled win probability is ${formatPercent(winProb)}.`;
  }
  return "";
}

function deriveStabilityLine({
  bridgeMc,
  governanceView,
  outcomeFragilityIndex,
  outcomeRiskLabel,
}) {
  const p10 = toFiniteNumber(bridgeMc?.p10);
  const p50 = toFiniteNumber(bridgeMc?.p50);
  const requiredShiftP50 = toFiniteNumber(bridgeMc?.requiredShiftP50);
  const shock25 = toFiniteNumber(bridgeMc?.shockLoss25);
  const cliffRisk = toFiniteNumber(bridgeMc?.cliffRisk);
  const fragilityIndex = toFiniteNumber(bridgeMc?.fragilityIndex);
  const fragilityText = normalizeText(outcomeFragilityIndex).toLowerCase();
  const confidenceBand = normalizeText(governanceView?.confidenceBand).toLowerCase();
  const riskText = normalizeText(outcomeRiskLabel).toLowerCase();

  const fragilityReasons = [];
  if (p10 != null && p50 != null && p10 < 0 && p50 >= 0) {
    fragilityReasons.push("downside path is negative while the median path is positive");
  }
  if (fragilityIndex != null && fragilityIndex >= 0.55) {
    fragilityReasons.push(`fragility index is elevated (${fragilityIndex.toFixed(2)})`);
  } else if (fragilityText === "high") {
    fragilityReasons.push("fragility posture is high");
  }
  if (cliffRisk != null && cliffRisk >= 0.2) {
    fragilityReasons.push(`cliff risk is ${formatPercent(cliffRisk)}`);
  }
  if (shock25 != null && shock25 >= 0.12) {
    fragilityReasons.push(`win probability is shock-sensitive at -25 (${formatPercent(shock25)} loss)`);
  }
  if (confidenceBand === "low" || confidenceBand === "critical") {
    fragilityReasons.push(`governance confidence is ${confidenceBand}`);
  }
  if (riskText.includes("high")) {
    fragilityReasons.push("risk posture is high");
  }
  if (fragilityReasons.length) {
    return `Why fragile: ${fragilityReasons.slice(0, 2).join("; ")}.`;
  }

  const stableReasons = [];
  if (p10 != null && p10 >= 0) {
    stableReasons.push("downside path stays non-negative");
  }
  if (requiredShiftP50 != null && requiredShiftP50 <= 0) {
    stableReasons.push("median break-even shift is already cleared");
  }
  if (cliffRisk != null && cliffRisk <= 0.08) {
    stableReasons.push("cliff risk is contained");
  }
  if (fragilityIndex != null && fragilityIndex <= 0.3) {
    stableReasons.push(`fragility index is low (${fragilityIndex.toFixed(2)})`);
  } else if (fragilityText === "low") {
    stableReasons.push("fragility posture is low");
  }
  if (stableReasons.length >= 2) {
    return `Why stable: ${stableReasons.slice(0, 2).join("; ")}.`;
  }

  if (p50 != null || requiredShiftP50 != null) {
    const shiftText = requiredShiftP50 == null ? "n/a" : `${Math.round(requiredShiftP50)}`;
    return `Why moderate: path remains assumption-sensitive (median margin ${p50 == null ? "n/a" : p50.toFixed(0)}, break-even shift ${shiftText}).`;
  }
  return "";
}

function deriveBenchmarkTensionLine({ benchmarkAdvisory, bridgeMc }) {
  const advisory = benchmarkAdvisory && typeof benchmarkAdvisory === "object" ? benchmarkAdvisory : null;
  if (!advisory) {
    return "";
  }
  const winProb = toFiniteNumber(bridgeMc?.winProb);
  const confidenceFloor = toFiniteNumber(advisory.confidenceFloor);
  const confidenceBand = normalizeText(advisory.confidenceBand).toLowerCase();
  if (winProb == null || confidenceFloor == null) {
    return "";
  }
  const delta = winProb - confidenceFloor;
  if (delta <= -0.05) {
    return `Benchmark realism tension: modeled win probability ${formatPercent(winProb)} sits below benchmark confidence floor ${formatPercent(confidenceFloor)}.`;
  }
  if (delta >= 0.15 && (confidenceBand === "low" || confidenceBand === "critical")) {
    return `Benchmark realism tension: modeled win probability ${formatPercent(winProb)} is materially above a ${confidenceBand.toUpperCase()} benchmark floor ${formatPercent(confidenceFloor)}.`;
  }
  return "";
}

export function deriveOutcomeDriverNarrative(context = {}) {
  const bridgeMc = context?.bridgeMc && typeof context.bridgeMc === "object" ? context.bridgeMc : null;
  const governanceView = context?.governanceView && typeof context.governanceView === "object" ? context.governanceView : null;
  const sensitivityRows = normalizeSensitivityRows(context?.bridgedSensitivityRows);
  const topDriver = sensitivityRows.length ? sensitivityRows[0] : null;
  const bindingLine = deriveBindingFactorLine({
    bridgeMc,
    outcomeGapNote: context?.outcomeGapNote,
    governanceView,
    bridgedSurfaceStatus: context?.bridgedSurfaceStatus,
    outcomeWinProb: bridgeMc?.winProb,
  });
  const stabilityLine = deriveStabilityLine({
    bridgeMc,
    governanceView,
    outcomeFragilityIndex: context?.outcomeFragilityIndex,
    outcomeRiskLabel: context?.outcomeRiskLabel,
  });
  const benchmarkLine = deriveBenchmarkTensionLine({
    benchmarkAdvisory: context?.benchmarkAdvisory,
    bridgeMc,
  });
  const dominantLine = topDriver
    ? `Dominant factor: ${topDriver.label} (sensitivity impact ${formatSigned(topDriver.impact)}).`
    : "";

  const lines = [bindingLine, dominantLine, stabilityLine, benchmarkLine].filter(Boolean);
  if (!lines.length) {
    return {
      ready: false,
      statusText: "Run Monte Carlo and sensitivity ranking to generate deterministic driver narrative.",
      lines: [],
    };
  }

  return {
    ready: true,
    statusText: "Deterministic narrative from current MC, sensitivity, governance, and benchmark signals.",
    lines,
  };
}

export function syncOutcomeDriverNarrative({ statusId, listId, narrative }) {
  const status = document.getElementById(statusId);
  const list = document.getElementById(listId);
  if (!(status instanceof HTMLElement) || !(list instanceof HTMLElement)) {
    return;
  }
  const view = narrative && typeof narrative === "object" ? narrative : null;
  if (!view || !Array.isArray(view.lines) || !view.ready) {
    status.textContent = (view && normalizeText(view.statusText)) || "Deterministic narrative unavailable.";
    list.innerHTML = '<li class="muted">No deterministic narrative yet.</li>';
    return;
  }
  status.textContent = normalizeText(view.statusText) || "Deterministic narrative.";
  list.innerHTML = view.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
}

export function syncOutcomeImpactTraceFallback({ targetId, outcomeGapNote, outcomeRiskLabel, outcomeWinProb }) {
  const target = document.getElementById(targetId);
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const rows = [
    `Capacity -> Gap note: ${String(outcomeGapNote || "—").trim() || "—"}`,
    `Risk posture -> ${String(outcomeRiskLabel || "—").trim() || "—"}`,
    `Win probability context -> ${String(outcomeWinProb || "—").trim() || "—"}`,
  ];
  target.innerHTML = rows.map((row) => `<li>${escapeHtml(row)}</li>`).join("");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
