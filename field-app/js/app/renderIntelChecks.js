// @ts-check
import {
  benchmarkRefLabel,
  computeIntelIntegrityScore,
  ensureIntelCollections,
  getIntelWorkflow,
  getLatestBriefByKind,
  intelBriefKindLabel,
  listIntelBenchmarks,
  listIntelBriefKinds,
  listIntelEvidence,
  listIntelRequests,
  listMissingEvidenceAudit,
  listMissingNoteAudit,
  listShockScenarios,
} from "./intelControlsRuntime.js";

function fmtNum(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function pctInputValue(ratio, digits = 1){
  const n = Number(ratio);
  if (!Number.isFinite(n)) return "";
  const pct = n * 100;
  const fixed = pct.toFixed(Math.max(0, digits | 0));
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function fmtDate(iso){
  const s = String(iso || "").trim();
  return s ? s.slice(0, 10) : "—";
}

function makeOption(value, label){
  const opt = document.createElement("option");
  opt.value = value;
  opt.textContent = label;
  return opt;
}

function fillCorrelationSelect(selectEl, rows, selectedId){
  if (!selectEl) return;
  const keep = String(selectedId || "");
  selectEl.innerHTML = "";
  selectEl.appendChild(makeOption("", "None selected"));
  for (const row of rows){
    const id = String(row?.id || "").trim();
    if (!id) continue;
    const label = String(row?.label || id);
    selectEl.appendChild(makeOption(id, label));
  }
  selectEl.value = keep;
  if (selectEl.value !== keep) selectEl.value = "";
}

function fillBenchmarkTable(tbody, rows){
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="6" class="muted">No benchmark entries configured.</td>';
    tbody.appendChild(tr);
    return;
  }

  for (const row of rows){
    const tr = document.createElement("tr");
    const range = `${fmtNum(row?.range?.min)} .. ${fmtNum(row?.range?.max)}`;
    const sev = `${fmtNum(row?.severityBands?.warnAbove)} / ${fmtNum(row?.severityBands?.hardAbove)}`;
    const source = row?.source?.title || row?.source?.type || "—";
    tr.innerHTML = `
      <td>
        <div>${benchmarkRefLabel(row?.ref)}</div>
        <div class="muted" style="font-size:11px;">${row?.ref || "—"}</div>
      </td>
      <td>${row?.raceType || "all"}</td>
      <td class="num">${range}</td>
      <td class="num">${sev}</td>
      <td>${source}</td>
      <td class="num">
        <button type="button" class="btn btn-sm btn-ghost" data-bm-remove="${row?.id || ""}">Remove</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function fillAuditSelect(selectEl, rows){
  if (!selectEl) return;
  const previous = selectEl.value;
  selectEl.innerHTML = "";

  if (!rows.length){
    selectEl.appendChild(makeOption("", "No missing evidence items"));
    selectEl.disabled = true;
    return;
  }

  selectEl.disabled = false;
  selectEl.appendChild(makeOption("", "Select missing evidence item…"));
  for (const row of rows){
    const ref = row?.label || row?.ref || row?.key || "critical assumption";
    const ts = fmtDate(row?.ts);
    selectEl.appendChild(makeOption(String(row?.id || ""), `${ts} · ${ref}`));
  }

  const exists = rows.some((x) => String(x?.id || "") === previous);
  if (exists){
    selectEl.value = previous;
    return;
  }

  const firstId = String(rows[0]?.id || "");
  if (firstId){
    selectEl.value = firstId;
  }
}

function fillEvidenceTable(tbody, rows){
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="5" class="muted">No evidence records yet.</td>';
    tbody.appendChild(tr);
    return;
  }

  for (const row of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row?.title || "—"}</td>
      <td>${row?.source || "—"}</td>
      <td>${fmtDate(row?.capturedAt)}</td>
      <td>${row?.ref || "—"}</td>
      <td>${row?.id || "—"}</td>
    `;
    tbody.appendChild(tr);
  }
}

function fmtPct(v, digits = 1){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(Math.max(0, digits | 0))}%`;
}

function fmtInt(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

function fillDistrictEvidenceCandidateTable(tbody, rows){
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="3" class="muted">No candidate totals available.</td>';
    tbody.appendChild(tr);
    return;
  }
  for (const row of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${String(row?.candidateId || "—")}</td>
      <td class="num">${fmtInt(row?.votes)}</td>
      <td class="num">${fmtPct(row?.sharePct, 2)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function fillDistrictEvidenceLinkTable(tbody, rows){
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="4" class="muted">No precinct-to-geo links available.</td>';
    tbody.appendChild(tr);
    return;
  }
  const top = rows.slice(0, 20);
  for (const row of top){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${String(row?.precinctId || "—")}</td>
      <td>${String(row?.geoid || "—")}</td>
      <td class="num">${fmtNum(row?.crosswalkWeight)}</td>
      <td class="num">${fmtNum(row?.effectiveWeight)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function fillDistrictEvidenceDatasetRankTable(tbody, rows, selectedElectionId){
  if (!tbody) return;
  tbody.innerHTML = "";
  const selectedId = String(selectedElectionId || "").trim();
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="6" class="muted">No compatible election datasets available.</td>';
    tbody.appendChild(tr);
    return;
  }
  const top = rows.slice(0, 8);
  for (let i = 0; i < top.length; i++){
    const row = top[i] || {};
    const dataset = row.dataset || {};
    const id = String(dataset.id || "");
    const rank = i + 1;
    const selectedTag = selectedId && id === selectedId ? "Selected" : "";
    const score = Number(row.score);
    const reasons = Array.isArray(row.reasons) ? row.reasons.slice(0, 3).join(", ") : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="num">${rank}</td>
      <td>${id || "—"}</td>
      <td>${String(dataset.officeType || "—")}</td>
      <td>${String(dataset.vintage || dataset.cycleYear || "—")}</td>
      <td class="num">${Number.isFinite(score) ? score.toFixed(2) : "—"}</td>
      <td>${selectedTag || reasons || "—"}</td>
    `;
    tbody.appendChild(tr);
  }
}

function fillDataRefSelect(selectEl, rows, selectedId, labelFn, emptyLabel = "None selected"){
  if (!selectEl) return;
  const keep = String(selectedId || "").trim();
  const list = Array.isArray(rows) ? rows : [];
  selectEl.innerHTML = "";
  selectEl.appendChild(makeOption("", emptyLabel));
  let hasSelected = false;
  for (const row of list){
    const id = String(row?.id || "").trim();
    if (!id) continue;
    if (id === keep) hasSelected = true;
    const label = String(typeof labelFn === "function" ? labelFn(row) : id).trim() || id;
    selectEl.appendChild(makeOption(id, label));
  }
  if (keep && !hasSelected){
    selectEl.appendChild(makeOption(keep, `${keep} (missing from catalog)`));
  }
  selectEl.value = keep;
  if (selectEl.value !== keep) selectEl.value = "";
}

function dataRefItemLabel(row, kind){
  const id = String(row?.id || "").trim();
  if (!id) return "—";
  const tags = [];
  if (row?.isVerified) tags.push("verified");
  if (row?.isLatest) tags.push("latest");
  if (kind === "boundary"){
    const label = String(row?.label || "").trim();
    const vintage = String(row?.vintage || "").trim();
    return `${id}${label ? ` · ${label}` : ""}${vintage ? ` · ${vintage}` : ""}${tags.length ? ` [${tags.join(", ")}]` : ""}`;
  }
  if (kind === "crosswalk"){
    const fromId = String(row?.fromBoundarySetId || "").trim();
    const toId = String(row?.toBoundarySetId || "").trim();
    const method = String(row?.method || "").trim();
    const unit = String(row?.unit || "").trim();
    return `${id}${fromId && toId ? ` · ${fromId}→${toId}` : ""}${unit || method ? ` · ${unit}${method ? `/${method}` : ""}` : ""}${tags.length ? ` [${tags.join(", ")}]` : ""}`;
  }
  if (kind === "election"){
    const office = String(row?.officeType || "").trim();
    const cycle = String(row?.cycleYear || row?.vintage || "").trim();
    return `${id}${office ? ` · ${office}` : ""}${cycle ? ` · ${cycle}` : ""}${tags.length ? ` [${tags.join(", ")}]` : ""}`;
  }
  const vintage = String(row?.vintage || "").trim();
  return `${id}${vintage ? ` · ${vintage}` : ""}${tags.length ? ` [${tags.join(", ")}]` : ""}`;
}

function renderDataRefStatus(el, text, kind = "muted"){
  if (!el) return;
  el.classList.remove("ok", "warn", "bad", "muted");
  el.classList.add(kind);
  el.textContent = String(text || "Data refs ready.");
}

function fmtWhatIfTarget(row){
  const op = String(row?.op || "").trim();
  const label = String(row?.label || row?.key || "assumption");
  if (op === "delta"){
    const n = Number(row?.delta ?? row?.value);
    const signed = Number.isFinite(n)
      ? `${n >= 0 ? "+" : ""}${Number.isInteger(n) ? String(n) : n.toFixed(2)}`
      : "—";
    return `${label}: ${signed}`;
  }
  const n = Number(row?.suggestedValue ?? row?.value);
  const value = Number.isFinite(n)
    ? (Number.isInteger(n) ? String(n) : n.toFixed(2))
    : "—";
  return `${label}: ${value}`;
}

export function renderIntelChecksModule({
  els,
  state,
  engine,
  benchmarkWarnings = [],
  driftSummary = null,
} = {}){
  if (!els || !state) return;
  ensureIntelCollections(state);

  const benchmarks = listIntelBenchmarks(state).sort((a, b) => {
    const ar = String(a?.ref || "");
    const br = String(b?.ref || "");
    return ar.localeCompare(br);
  });

  const missingAudit = listMissingEvidenceAudit(state, { limit: 200 });
  const missingNoteAudit = listMissingNoteAudit(state, { limit: 200 });
  const evidenceRows = listIntelEvidence(state, { limit: 8 });
  const workflow = getIntelWorkflow(state) || {};
  const integrity = computeIntelIntegrityScore(state, {
    benchmarkWarnings,
    driftFlags: Array.isArray(driftSummary?.flags) ? driftSummary.flags : [],
    staleDays: 30,
  });

  if (els.intelBenchmarkCount){
    els.intelBenchmarkCount.textContent = `${benchmarks.length} benchmark entr${benchmarks.length === 1 ? "y" : "ies"} configured.`;
  }
  if (els.intelBenchmarkStatus && !String(els.intelBenchmarkStatus.textContent || "").trim()){
    els.intelBenchmarkStatus.classList.remove("ok", "warn", "bad");
    els.intelBenchmarkStatus.classList.add("muted");
    els.intelBenchmarkStatus.textContent = "Ready.";
  }
  if (els.intelMissingEvidenceCount){
    els.intelMissingEvidenceCount.textContent = missingAudit.length
      ? `${missingAudit.length} critical assumption edit(s) missing evidence. Select one below and attach supporting evidence.`
      : "No critical assumption edits are missing evidence.";
  }
  if (els.intelMissingNoteCount){
    els.intelMissingNoteCount.textContent = missingNoteAudit.length
      ? `${missingNoteAudit.length} critical assumption edit(s) missing note. Add a short note in Evidence notes to resolve.`
      : "No critical assumption edits are missing notes.";
  }
  if (els.intelEvidenceStatus && !String(els.intelEvidenceStatus.textContent || "").trim()){
    els.intelEvidenceStatus.classList.remove("ok", "warn", "bad");
    els.intelEvidenceStatus.classList.add("muted");
    els.intelEvidenceStatus.textContent = "Select an audit item, then attach evidence. Add a note when required.";
  }

  fillBenchmarkTable(els.intelBenchmarkTbody, benchmarks);
  fillAuditSelect(els.intelAuditSelect, missingAudit);
  fillEvidenceTable(els.intelEvidenceTbody, evidenceRows);

  if (els.intelScenarioLocked){
    els.intelScenarioLocked.checked = !!workflow.scenarioLocked;
  }
  if (els.intelRequireCriticalNote){
    els.intelRequireCriticalNote.checked = workflow.requireCriticalNote !== false;
  }
  if (els.intelRequireCriticalEvidence){
    els.intelRequireCriticalEvidence.checked = workflow.requireCriticalEvidence !== false;
  }
  if (els.intelScenarioLockReason && document.activeElement !== els.intelScenarioLockReason){
    els.intelScenarioLockReason.value = String(workflow.lockReason || "");
  }
  if (els.intelCriticalChangeNote && document.activeElement !== els.intelCriticalChangeNote){
    const pendingNote = String(state?.ui?.pendingCriticalNote || "");
    if (els.intelCriticalChangeNote.value !== pendingNote) els.intelCriticalChangeNote.value = pendingNote;
  }
  if (els.intelScenarioLockStatus){
    els.intelScenarioLockStatus.classList.remove("ok", "warn", "bad", "muted");
    if (workflow.scenarioLocked){
      els.intelScenarioLockStatus.classList.add("warn");
      const reason = String(workflow.lockReason || "").trim();
      els.intelScenarioLockStatus.textContent = reason
        ? `Scenario lock ON. Reason: ${reason}`
        : "Scenario lock ON. Inputs are read-only until unlocked.";
    } else {
      els.intelScenarioLockStatus.classList.add("muted");
      els.intelScenarioLockStatus.textContent = "Scenario lock OFF.";
    }
  }
  if (els.intelWorkflowStatus){
    els.intelWorkflowStatus.classList.remove("ok", "warn", "bad", "muted");
    const integrityText = `Integrity score: ${integrity.score} (${integrity.grade}).`;
    if (missingAudit.length || missingNoteAudit.length){
      els.intelWorkflowStatus.classList.add(integrity.score < 70 ? "bad" : "warn");
      const parts = [];
      if (missingAudit.length) parts.push(`${missingAudit.length} missing evidence`);
      if (missingNoteAudit.length) parts.push(`${missingNoteAudit.length} missing note`);
      els.intelWorkflowStatus.textContent = `Open governance items: ${parts.join(", ")}. ${integrityText}`;
    } else {
      if (integrity.score >= 85){
        els.intelWorkflowStatus.classList.add("ok");
        els.intelWorkflowStatus.textContent = `Governance controls healthy. ${integrityText}`;
      } else if (integrity.score >= 70){
        els.intelWorkflowStatus.classList.add("warn");
        els.intelWorkflowStatus.textContent = `Governance controls mostly healthy. ${integrityText}`;
      } else {
        els.intelWorkflowStatus.classList.add("bad");
        els.intelWorkflowStatus.textContent = `Governance attention needed. ${integrityText}`;
      }
    }
  }

  if (els.intelEvidenceCapturedAt && !els.intelEvidenceCapturedAt.value){
    els.intelEvidenceCapturedAt.value = new Date().toISOString().slice(0, 10);
  }

  const knownBriefKinds = new Set(listIntelBriefKinds());
  const selectedBriefKind = (() => {
    const raw = String(state?.ui?.intelBriefKind || els.intelBriefKind?.value || "calibrationSources").trim();
    return knownBriefKinds.has(raw) ? raw : "calibrationSources";
  })();
  if (state?.ui){
    state.ui.intelBriefKind = selectedBriefKind;
  }
  if (els.intelBriefKind && document.activeElement !== els.intelBriefKind){
    els.intelBriefKind.value = selectedBriefKind;
  }

  const calibrationBrief = getLatestBriefByKind(state, selectedBriefKind);
  const mcDist = String(state?.intelState?.simToggles?.mcDistribution || "triangular");
  const correlatedShocks = !!state?.intelState?.simToggles?.correlatedShocks;
  const corrMatrixId = String(state?.intelState?.simToggles?.correlationMatrixId || "");
  const corrModels = Array.isArray(state?.intelState?.correlationModels)
    ? state.intelState.correlationModels
    : [];
  const shockEnabled = !!state?.intelState?.simToggles?.shockScenariosEnabled;
  const shockRows = listShockScenarios(state);
  const decayEnabled = !!state?.intelState?.expertToggles?.capacityDecayEnabled;
  const decayModelType = String(state?.intelState?.expertToggles?.decayModel?.type || "linear");
  const decayWeeklyPct = Number(state?.intelState?.expertToggles?.decayModel?.weeklyDecayPct);
  const decayFloorPct = Number(state?.intelState?.expertToggles?.decayModel?.floorPctOfBaseline);
  const observedRows = Array.isArray(state?.intelState?.observedMetrics) ? state.intelState.observedMetrics : [];
  const recommendationRows = Array.isArray(state?.intelState?.recommendations) ? state.intelState.recommendations : [];
  const whatIfRows = listIntelRequests(state, { limit: 25 });
  const autoDriftRecs = recommendationRows
    .filter((x) => String(x?.source || "").trim() === "auto.realityDrift.v1")
    .sort((a, b) => Number(a?.priority || 99) - Number(b?.priority || 99));
  if (els.intelMcDistribution){
    els.intelMcDistribution.value = mcDist;
  }
  if (els.intelCorrelatedShocks){
    els.intelCorrelatedShocks.checked = correlatedShocks;
  }
  fillCorrelationSelect(els.intelCorrelationMatrixId, corrModels, corrMatrixId);
  if (els.intelCorrelationMatrixId){
    els.intelCorrelationMatrixId.disabled = !corrModels.length;
  }
  const selectedCorr = corrModels.find((row) => String(row?.id || "").trim() === corrMatrixId) || null;
  const selectedCorrLabel = String(selectedCorr?.label || selectedCorr?.id || "").trim();
  if (els.intelCorrelationStatus){
    els.intelCorrelationStatus.classList.remove("ok", "warn", "bad", "muted");
    if (!corrModels.length){
      els.intelCorrelationStatus.classList.add("warn");
      els.intelCorrelationStatus.textContent = "No correlation models configured. Add default model or import JSON first.";
    } else if (!corrMatrixId){
      els.intelCorrelationStatus.classList.add(correlatedShocks ? "warn" : "muted");
      els.intelCorrelationStatus.textContent = correlatedShocks
        ? `Correlated shocks is ON, but no model is selected. Choose one of ${corrModels.length} configured models.`
        : `${corrModels.length} correlation model${corrModels.length === 1 ? "" : "s"} configured. Select one to prepare correlated shocks.`;
    } else {
      els.intelCorrelationStatus.classList.add(correlatedShocks ? "ok" : "muted");
      els.intelCorrelationStatus.textContent = correlatedShocks
        ? `Using "${selectedCorrLabel || corrMatrixId}" for correlated shocks. Re-run Monte Carlo to apply.`
        : `Selected "${selectedCorrLabel || corrMatrixId}". Enable Correlated shocks to apply in Monte Carlo.`;
    }
  }
  if (els.intelCorrelationDisabledHint){
    els.intelCorrelationDisabledHint.classList.remove("ok", "warn", "bad", "muted");
    if (!corrModels.length){
      els.intelCorrelationDisabledHint.classList.add("warn");
      els.intelCorrelationDisabledHint.textContent = "Selector disabled: no models configured. Click Add default model or paste JSON and click Import model JSON.";
    } else if (!correlatedShocks){
      els.intelCorrelationDisabledHint.classList.add("muted");
      els.intelCorrelationDisabledHint.textContent = "Correlation model is selectable now. Enable Correlated shocks to use it in Monte Carlo.";
    } else if (!corrMatrixId){
      els.intelCorrelationDisabledHint.classList.add("warn");
      els.intelCorrelationDisabledHint.textContent = "Correlated shocks is ON, but no model is selected yet.";
    } else {
      els.intelCorrelationDisabledHint.classList.add("ok");
      els.intelCorrelationDisabledHint.textContent = "Correlation model is active for the next Monte Carlo run.";
    }
  }
  if (els.intelShockScenariosEnabled){
    els.intelShockScenariosEnabled.checked = shockEnabled;
  }
  if (els.intelCapacityDecayEnabled){
    els.intelCapacityDecayEnabled.checked = decayEnabled;
  }
  if (els.intelDecayModelType){
    els.intelDecayModelType.value = decayModelType;
  }
  if (els.intelDecayWeeklyPct){
    els.intelDecayWeeklyPct.value = pctInputValue(decayWeeklyPct, 1);
  }
  if (els.intelDecayFloorPct){
    els.intelDecayFloorPct.value = pctInputValue(decayFloorPct, 1);
  }
  if (els.intelDecayStatus){
    els.intelDecayStatus.classList.remove("ok", "warn", "bad");
    if (!decayEnabled){
      els.intelDecayStatus.classList.add("muted");
      els.intelDecayStatus.textContent = "Capacity decay OFF (steady capacity assumption).";
    } else {
      const weeklyText = pctInputValue(decayWeeklyPct, 1) || "0";
      const floorText = pctInputValue(decayFloorPct, 1) || "0";
      els.intelDecayStatus.classList.add("ok");
      els.intelDecayStatus.textContent = `Capacity decay ON (${decayModelType}, ${weeklyText}% weekly, floor ${floorText}% baseline). Re-run Monte Carlo to apply.`;
    }
  }
  if (els.intelShockScenarioCount){
    els.intelShockScenarioCount.textContent = `${shockRows.length} scenario${shockRows.length === 1 ? "" : "s"} configured.`;
  }
  if (els.intelShockStatus){
    els.intelShockStatus.classList.remove("ok", "warn", "bad");
    if (!shockRows.length){
      els.intelShockStatus.classList.add("warn");
      els.intelShockStatus.textContent = "No shock scenarios configured. Add or import one before enabling.";
    } else if (shockEnabled){
      els.intelShockStatus.classList.add("ok");
      els.intelShockStatus.textContent = `Shock sampling ON (${shockRows.length} scenario${shockRows.length === 1 ? "" : "s"}). Re-run Monte Carlo to apply.`;
    } else {
      els.intelShockStatus.classList.add("muted");
      els.intelShockStatus.textContent = `Shock sampling OFF (${shockRows.length} scenario${shockRows.length === 1 ? "" : "s"} configured).`;
    }
  }
  if (els.intelCalibrationBriefContent){
    els.intelCalibrationBriefContent.value = calibrationBrief?.content || "";
  }
  if (els.intelCalibrationStatus){
    els.intelCalibrationStatus.classList.remove("ok", "warn", "bad");
    if (calibrationBrief){
      els.intelCalibrationStatus.classList.add("muted");
      const ts = fmtDate(calibrationBrief?.createdAt);
      els.intelCalibrationStatus.textContent = `${intelBriefKindLabel(selectedBriefKind)} brief · last generated ${ts}.`;
    } else {
      els.intelCalibrationStatus.classList.add("muted");
      els.intelCalibrationStatus.textContent = `No ${intelBriefKindLabel(selectedBriefKind).toLowerCase()} brief generated yet.`;
    }
  }
  if (els.intelObservedCount){
    els.intelObservedCount.textContent = `${observedRows.length} observed metric entr${observedRows.length === 1 ? "y" : "ies"} captured.`;
  }
  if (els.intelObservedStatus){
    els.intelObservedStatus.classList.remove("ok", "warn", "bad");
    els.intelObservedStatus.classList.add(observedRows.length ? "muted" : "warn");
    els.intelObservedStatus.textContent = observedRows.length
      ? "Observed metrics are available for drift tracking."
      : "No observed metrics captured yet. Use Capture observed metrics.";
  }
  if (els.intelRecommendationCount){
    els.intelRecommendationCount.textContent = `${autoDriftRecs.length} active drift recommendation${autoDriftRecs.length === 1 ? "" : "s"}.`;
  }
  if (els.intelRecommendationStatus){
    els.intelRecommendationStatus.classList.remove("ok", "warn", "bad");
    if (!observedRows.length){
      els.intelRecommendationStatus.classList.add("warn");
      els.intelRecommendationStatus.textContent = "Capture observed metrics first, then generate drift recommendations.";
    } else if (autoDriftRecs.length){
      els.intelRecommendationStatus.classList.add("ok");
      els.intelRecommendationStatus.textContent = "Drift recommendations are active. Review before applying any assumptions.";
    } else {
      els.intelRecommendationStatus.classList.add("muted");
      els.intelRecommendationStatus.textContent = "No active drift recommendations (within tolerance).";
    }
  }
  if (els.btnIntelApplyTopRecommendation){
    const top = autoDriftRecs[0] || null;
    els.btnIntelApplyTopRecommendation.disabled = !top;
    const p = Number(top?.priority);
    const pText = Number.isFinite(p) ? `P${p}` : "top";
    els.btnIntelApplyTopRecommendation.textContent = top ? `Apply ${pText} recommendation` : "Apply top recommendation";
  }
  if (els.intelRecommendationPreview){
    if (!autoDriftRecs.length){
      els.intelRecommendationPreview.value = "";
    } else {
      const lines = autoDriftRecs.slice(0, 5).map((row, idx) => {
        const p = Number(row?.priority);
        const pText = Number.isFinite(p) ? `P${p}` : "P—";
        const title = String(row?.title || "Recommendation");
        const detail = String(row?.detail || "").trim();
        return `${idx + 1}. [${pText}] ${title}${detail ? `\n   ${detail}` : ""}`;
      });
      els.intelRecommendationPreview.value = lines.join("\n");
    }
  }
  if (els.intelWhatIfCount){
    els.intelWhatIfCount.textContent = `${whatIfRows.length} what-if request${whatIfRows.length === 1 ? "" : "s"} parsed.`;
  }
  if (els.intelWhatIfStatus){
    els.intelWhatIfStatus.classList.remove("ok", "warn", "bad", "muted");
    const latest = whatIfRows[0] || null;
    if (!latest){
      els.intelWhatIfStatus.classList.add("muted");
      els.intelWhatIfStatus.textContent = "No what-if requests parsed yet.";
    } else if (String(latest?.status || "") === "partial"){
      const unresolved = Number(latest?.parsed?.unresolvedCount || 0);
      els.intelWhatIfStatus.classList.add("warn");
      els.intelWhatIfStatus.textContent = unresolved
        ? `Latest request parsed with ${unresolved} unresolved segment${unresolved === 1 ? "" : "s"}.`
        : "Latest request parsed with unresolved segments.";
    } else {
      els.intelWhatIfStatus.classList.add("ok");
      els.intelWhatIfStatus.textContent = "Latest request parsed successfully.";
    }
  }
  if (els.intelWhatIfPreview){
    const latest = whatIfRows[0] || null;
    if (!latest){
      els.intelWhatIfPreview.value = "";
    } else {
      const targets = Array.isArray(latest?.parsed?.targets) ? latest.parsed.targets : [];
      const unresolved = Array.isArray(latest?.parsed?.unresolvedSegments) ? latest.parsed.unresolvedSegments : [];
      const lines = [
        `Prompt: ${String(latest?.prompt || "")}`,
        `Status: ${String(latest?.status || "parsed")}`,
        `Parsed targets: ${targets.length}`,
      ];
      if (targets.length){
        for (const row of targets.slice(0, 8)){
          lines.push(`- ${fmtWhatIfTarget(row)}`);
        }
      }
      if (unresolved.length){
        lines.push(`Unresolved: ${unresolved.length}`);
        for (const row of unresolved.slice(0, 5)){
          lines.push(`- ${String(row?.segment || "segment")} (${String(row?.reason || "unresolved")})`);
        }
      }
      els.intelWhatIfPreview.value = lines.join("\n");
    }
  }

  const compileDistrictEvidence = engine?.snapshot?.compileDistrictEvidence;
  const resolveDistrictEvidenceInputs = engine?.snapshot?.resolveDistrictEvidenceInputs;
  const resolveDataRefsByPolicy = engine?.snapshot?.resolveDataRefsByPolicy;
  const buildDataSourceRegistry = engine?.snapshot?.buildDataSourceRegistry;
  const rankElectionDatasetsForScenario = engine?.snapshot?.rankElectionDatasetsForScenario;
  let resolvedInputs = null;
  if (typeof resolveDistrictEvidenceInputs === "function"){
    try{
      resolvedInputs = resolveDistrictEvidenceInputs(state);
    } catch {
      resolvedInputs = null;
    }
  }

  const districtBlob = (state?.geoPack && typeof state.geoPack === "object" && state.geoPack.district && typeof state.geoPack.district === "object")
    ? state.geoPack.district
    : {};
  const evidenceInputs = (districtBlob.evidenceInputs && typeof districtBlob.evidenceInputs === "object")
    ? districtBlob.evidenceInputs
    : {};
  const precinctResults = Array.isArray(resolvedInputs?.precinctResults)
    ? resolvedInputs.precinctResults
    : Array.isArray(evidenceInputs.precinctResults)
    ? evidenceInputs.precinctResults
    : (Array.isArray(districtBlob.precinctResults) ? districtBlob.precinctResults : []);
  const crosswalkRows = Array.isArray(resolvedInputs?.crosswalkRows)
    ? resolvedInputs.crosswalkRows
    : Array.isArray(evidenceInputs.crosswalkRows)
    ? evidenceInputs.crosswalkRows
    : (Array.isArray(districtBlob.crosswalkRows) ? districtBlob.crosswalkRows : (Array.isArray(districtBlob.precinctToGeo) ? districtBlob.precinctToGeo : []));
  const censusGeoRows = Array.isArray(resolvedInputs?.censusGeoRows)
    ? resolvedInputs.censusGeoRows
    : Array.isArray(evidenceInputs.censusGeoRows)
    ? evidenceInputs.censusGeoRows
    : (Array.isArray(districtBlob.censusGeoRows) ? districtBlob.censusGeoRows : (Array.isArray(districtBlob.censusRows) ? districtBlob.censusRows : []));
  const resolverMode = String(resolvedInputs?.sourceMode || "");
  const resolverNotes = Array.isArray(resolvedInputs?.notes)
    ? resolvedInputs.notes.map((x) => String(x || "").trim()).filter(Boolean)
    : [];

  let registry = null;
  if (typeof buildDataSourceRegistry === "function"){
    try{
      registry = buildDataSourceRegistry(state?.dataCatalog);
    } catch {
      registry = null;
    }
  }

  const refsIn = (state?.dataRefs && typeof state.dataRefs === "object") ? state.dataRefs : {};
  const dataRefMode = String(refsIn.mode || "pinned_verified").trim() || "pinned_verified";
  const boundaryId = String(refsIn.boundarySetId || "").trim();
  const censusId = String(refsIn.censusDatasetId || "").trim();
  const electionId = String(refsIn.electionDatasetId || "").trim();
  const crosswalkId = String(refsIn.crosswalkVersionId || "").trim();

  if (els.intelDataRefMode){
    els.intelDataRefMode.value = dataRefMode;
    if (els.intelDataRefMode.value !== dataRefMode) els.intelDataRefMode.value = "pinned_verified";
  }
  fillDataRefSelect(
    els.intelDataRefBoundarySet,
    registry?.boundarySets || [],
    boundaryId,
    (row) => dataRefItemLabel(row, "boundary")
  );
  fillDataRefSelect(
    els.intelDataRefCrosswalkVersion,
    registry?.crosswalks || [],
    crosswalkId,
    (row) => dataRefItemLabel(row, "crosswalk")
  );
  fillDataRefSelect(
    els.intelDataRefCensusDataset,
    registry?.censusDatasets || [],
    censusId,
    (row) => dataRefItemLabel(row, "census")
  );
  fillDataRefSelect(
    els.intelDataRefElectionDataset,
    registry?.electionDatasets || [],
    electionId,
    (row) => dataRefItemLabel(row, "election")
  );

  let policyResolution = null;
  if (typeof resolveDataRefsByPolicy === "function"){
    try{
      policyResolution = resolveDataRefsByPolicy({
        dataRefs: state?.dataRefs,
        dataCatalog: state?.dataCatalog,
        scenario: state,
      });
    } catch {
      policyResolution = null;
    }
  }
  const sourceParts = [];
  if (dataRefMode) sourceParts.push(`Mode: ${dataRefMode}`);
  if (censusId) sourceParts.push(`Census: ${censusId}`);
  if (electionId) sourceParts.push(`Election: ${electionId}`);
  if (crosswalkId) sourceParts.push(`Crosswalk: ${crosswalkId}`);
  if (resolverMode) sourceParts.push(`Input mode: ${resolverMode}`);
  if (els.intelDistrictEvidenceSource){
    els.intelDistrictEvidenceSource.textContent = sourceParts.length
      ? sourceParts.join(" · ")
      : "No pinned datasets selected yet.";
  }

  const resolutionNotes = Array.isArray(policyResolution?.notes)
    ? policyResolution.notes.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const selectedByPolicy = policyResolution?.selected || {};
  const effectiveIds = {
    boundarySetId: String(selectedByPolicy.boundarySetId || boundaryId || "").trim(),
    crosswalkVersionId: String(selectedByPolicy.crosswalkVersionId || crosswalkId || "").trim(),
    censusDatasetId: String(selectedByPolicy.censusDatasetId || censusId || "").trim(),
    electionDatasetId: String(selectedByPolicy.electionDatasetId || electionId || "").trim(),
  };
  if (els.intelDataRefStatus){
    if (policyResolution?.usedFallbacks && resolutionNotes.length){
      renderDataRefStatus(
        els.intelDataRefStatus,
        `Policy fallback active: ${resolutionNotes[0]}`,
        "warn"
      );
    } else if (resolutionNotes.length){
      renderDataRefStatus(els.intelDataRefStatus, resolutionNotes[0], "warn");
    } else if (
      !effectiveIds.boundarySetId &&
      !effectiveIds.crosswalkVersionId &&
      !effectiveIds.censusDatasetId &&
      !effectiveIds.electionDatasetId
    ){
      renderDataRefStatus(els.intelDataRefStatus, "Data refs not configured yet.", "muted");
    } else {
      renderDataRefStatus(els.intelDataRefStatus, "Data refs ready.", "ok");
    }
  }

  const selectedElectionId = String(
    effectiveIds.electionDatasetId ||
    ""
  ).trim();
  const selectedBoundaryId = String(
    effectiveIds.boundarySetId ||
    ""
  ).trim();
  let rankedElectionDatasets = [];
  if (typeof rankElectionDatasetsForScenario === "function"){
    try{
      rankedElectionDatasets = rankElectionDatasetsForScenario({
        registry,
        dataCatalog: state?.dataCatalog,
        scenario: state,
        boundarySetId: selectedBoundaryId,
        requireVerified: true,
      });
    } catch {
      rankedElectionDatasets = [];
    }
  }
  fillDistrictEvidenceDatasetRankTable(
    els.intelDistrictEvidenceDatasetRankTbody,
    Array.isArray(rankedElectionDatasets) ? rankedElectionDatasets : [],
    selectedElectionId
  );
  if (els.btnIntelDataRefSelectTopElection){
    els.btnIntelDataRefSelectTopElection.disabled = !Array.isArray(rankedElectionDatasets) || rankedElectionDatasets.length === 0;
  }
  if (els.btnIntelDataRefsPin){
    els.btnIntelDataRefsPin.disabled = typeof engine?.snapshot?.materializePinnedDataRefs !== "function";
  }
  if (els.intelDistrictEvidenceSelectedElection){
    const topId = String(rankedElectionDatasets?.[0]?.dataset?.id || "").trim();
    const rankIndex = Array.isArray(rankedElectionDatasets)
      ? rankedElectionDatasets.findIndex((x) => String(x?.dataset?.id || "") === selectedElectionId)
      : -1;
    if (!selectedElectionId){
      els.intelDistrictEvidenceSelectedElection.textContent = "Election dataset: none selected";
    } else if (rankIndex === 0){
      els.intelDistrictEvidenceSelectedElection.textContent = `Election dataset: ${selectedElectionId} (top compatible)`;
    } else if (rankIndex > 0){
      els.intelDistrictEvidenceSelectedElection.textContent = `Election dataset: ${selectedElectionId} (rank #${rankIndex + 1}; top is ${topId || "—"})`;
    } else if (topId){
      els.intelDistrictEvidenceSelectedElection.textContent = `Election dataset: ${selectedElectionId} (not in compatible set; top is ${topId})`;
    } else {
      els.intelDistrictEvidenceSelectedElection.textContent = `Election dataset: ${selectedElectionId}`;
    }
  }

  if (typeof compileDistrictEvidence !== "function"){
    if (els.intelDistrictEvidenceStatus){
      els.intelDistrictEvidenceStatus.classList.remove("ok", "warn", "bad");
      els.intelDistrictEvidenceStatus.classList.add("warn");
      els.intelDistrictEvidenceStatus.textContent = "District evidence compiler unavailable in engine snapshot.";
    }
    if (els.intelDistrictEvidenceCoverage) els.intelDistrictEvidenceCoverage.textContent = "Coverage: —";
    if (els.intelDistrictEvidenceVotes) els.intelDistrictEvidenceVotes.textContent = "Votes: —";
    if (els.intelDistrictEvidenceSignal) els.intelDistrictEvidenceSignal.textContent = "Persuasion signal: —";
    fillDistrictEvidenceCandidateTable(els.intelDistrictEvidenceCandidateTbody, []);
    fillDistrictEvidenceLinkTable(els.intelDistrictEvidenceLinkTbody, []);
    fillDistrictEvidenceDatasetRankTable(els.intelDistrictEvidenceDatasetRankTbody, rankedElectionDatasets, selectedElectionId);
    return;
  }

  let evidence = null;
  try{
    evidence = compileDistrictEvidence({
      geoUnits: state?.geoPack?.units || [],
      precinctResults,
      crosswalkRows,
      censusGeoRows,
    });
  } catch (err){
    if (els.intelDistrictEvidenceStatus){
      const msg = String(err?.message || "compile failed");
      els.intelDistrictEvidenceStatus.classList.remove("ok", "warn", "bad");
      els.intelDistrictEvidenceStatus.classList.add("bad");
      els.intelDistrictEvidenceStatus.textContent = `District evidence compile failed: ${msg}`;
    }
    if (els.intelDistrictEvidenceCoverage) els.intelDistrictEvidenceCoverage.textContent = "Coverage: —";
    if (els.intelDistrictEvidenceVotes) els.intelDistrictEvidenceVotes.textContent = "Votes: —";
    if (els.intelDistrictEvidenceSignal) els.intelDistrictEvidenceSignal.textContent = "Persuasion signal: —";
    fillDistrictEvidenceCandidateTable(els.intelDistrictEvidenceCandidateTbody, []);
    fillDistrictEvidenceLinkTable(els.intelDistrictEvidenceLinkTbody, []);
    fillDistrictEvidenceDatasetRankTable(els.intelDistrictEvidenceDatasetRankTbody, rankedElectionDatasets, selectedElectionId);
    return;
  }

  const candidateTotals = Array.isArray(evidence?.candidateTotals) ? evidence.candidateTotals : [];
  const links = Array.isArray(evidence?.precinctToGeo) ? evidence.precinctToGeo : [];
  const coveragePct = Number(evidence?.reconciliation?.coveragePct);
  const unmatchedVotes = Number(evidence?.reconciliation?.unmatchedVotes);
  const totalVotes = Number(evidence?.summary?.totalVotes);
  const signal = Number(evidence?.persuasionSignal?.index);
  const signalNote = String(evidence?.persuasionSignal?.note || "").trim();
  const warnings = Array.isArray(evidence?.warnings) ? evidence.warnings : [];
  const mergedNotes = resolverNotes.concat(
    warnings.map((x) => String(x || "").trim()).filter(Boolean)
  );

  if (els.intelDistrictEvidenceStatus){
    els.intelDistrictEvidenceStatus.classList.remove("ok", "warn", "bad", "muted");
    if (!precinctResults.length || !crosswalkRows.length || !censusGeoRows.length){
      els.intelDistrictEvidenceStatus.classList.add("warn");
      const note = mergedNotes[0] || "Load precinct results, crosswalk rows, and census geo rows into geoPack.district.evidenceInputs or geoPack.district.evidenceStore to activate full district evidence.";
      els.intelDistrictEvidenceStatus.textContent = note;
    } else if (mergedNotes.length){
      els.intelDistrictEvidenceStatus.classList.add("warn");
      els.intelDistrictEvidenceStatus.textContent = `Evidence compiled with warnings: ${mergedNotes[0]}`;
    } else {
      els.intelDistrictEvidenceStatus.classList.add("ok");
      els.intelDistrictEvidenceStatus.textContent =
        `Evidence ready: ${candidateTotals.length} candidates, ${links.length} precinct links, ${Number(evidence?.summary?.geoRowsCount || 0)} geo rows.`;
    }
  }
  if (els.intelDistrictEvidenceCoverage){
    els.intelDistrictEvidenceCoverage.textContent = Number.isFinite(coveragePct)
      ? `Coverage: ${fmtPct(coveragePct, 2)} · Unmatched votes: ${fmtInt(unmatchedVotes)}`
      : "Coverage: —";
  }
  if (els.intelDistrictEvidenceVotes){
    els.intelDistrictEvidenceVotes.textContent = Number.isFinite(totalVotes)
      ? `Weighted total votes: ${fmtInt(totalVotes)}`
      : "Weighted total votes: —";
  }
  if (els.intelDistrictEvidenceSignal){
    els.intelDistrictEvidenceSignal.textContent = Number.isFinite(signal)
      ? `Persuasion signal index: ${signal.toFixed(3)}${signalNote ? ` · ${signalNote}` : ""}`
      : "Persuasion signal index: —";
  }

  fillDistrictEvidenceCandidateTable(els.intelDistrictEvidenceCandidateTbody, candidateTotals);
  fillDistrictEvidenceLinkTable(els.intelDistrictEvidenceLinkTbody, links);
}
