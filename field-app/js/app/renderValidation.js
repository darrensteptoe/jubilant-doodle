// @ts-check
import { buildValidationChecklistView } from "../core/validationView.js";

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
  } = args || {};

  const list = els?.validationList || els?.validationListSidebar;
  if (!list) return;
  const deduped = buildValidationChecklistView({
    state,
    res,
    weeks,
    benchmarkWarnings,
    evidenceWarnings,
    driftSummary,
    governance,
  });

  list.innerHTML = "";
  for (const it of deduped){
    const li = document.createElement("li");
    li.className = it.kind;
    li.textContent = it.text;
    list.appendChild(li);
  }
}
