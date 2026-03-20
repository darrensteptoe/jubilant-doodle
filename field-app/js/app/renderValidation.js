// @ts-check
import { buildValidationChecklistView } from "../core/validationView.js";
import { buildRealismValidationRows } from "./realismDiagnostics.js";
import { buildModelReadinessValidationRows } from "./modelReadiness.js";

export function renderValidationModule(args){
  const {
    els,
    state,
    res,
    weeks,
    benchmarkWarnings = [],
    evidenceWarnings = [],
    driftSummary = null,
    governance = null,
    realism = null,
    validationSnapshot = null,
  } = args || {};

  const list = els?.validationList || els?.validationListSidebar;
  if (!list) return;
  const baseRows = buildValidationChecklistView({
    state,
    res,
    weeks,
    benchmarkWarnings,
    evidenceWarnings,
    driftSummary,
    governance,
  });
  const realismRows = buildRealismValidationRows(realism, { limit: 4 });
  const readinessRows = buildModelReadinessValidationRows(validationSnapshot?.readiness || null, { maxIssues: 4 });

  const deduped = [];
  const seen = new Set();
  for (const row of [...baseRows, ...realismRows, ...readinessRows]){
    const kind = row?.kind === "bad" ? "bad" : (row?.kind === "warn" ? "warn" : "ok");
    const text = String(row?.text || "").trim();
    if (!text) continue;
    const key = `${kind}::${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ kind, text });
  }

  list.innerHTML = "";
  for (const it of deduped){
    const li = document.createElement("li");
    li.className = it.kind;
    li.textContent = it.text;
    list.appendChild(li);
  }
}
