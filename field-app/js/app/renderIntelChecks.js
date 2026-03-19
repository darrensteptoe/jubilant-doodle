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
  listAutoDriftRecommendations,
  listMissingEvidenceAudit,
  listMissingNoteAudit,
  listShockScenarios,
} from "./intelControlsRuntime.js";
import {
  buildControlsBenchmarkDraftStatus,
  buildControlsApplyTopRecommendationButtonLabel,
  buildControlsAuditSelectOption,
  buildControlsBenchmarkCountText,
  buildControlsBenchmarkTableRowView,
  buildControlsCalibrationStatusView,
  buildControlsCorrelationHintStatusView,
  buildControlsCorrelationStatusView,
  buildControlsDecayStatusView,
  buildControlsEvidenceAttachStatus,
  buildControlsEvidenceRowView,
  buildControlsMissingEvidenceCountText,
  buildControlsMissingNoteCountText,
  buildControlsScenarioLockStatus,
  buildControlsShockScenarioCountText,
  buildControlsShockStatusView,
  buildControlsObservedStatusView,
  buildControlsRecommendationStatusView,
  buildControlsWhatIfDetailedPreviewText,
  buildControlsWhatIfStatusView,
  buildControlsWorkflowStatus,
  buildControlsWorkflowIntegrityStatusView,
  buildObservedCountText,
  buildRecommendationCountText,
  buildRecommendationPreviewTextFromIntel,
  buildWhatIfCountText,
  formatControlsPercentInputValue,
} from "../core/controlsView.js";
import { benchmarkScopeLabel } from "../core/benchmarkProfiles.js";

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
    const view = buildControlsBenchmarkTableRowView(row);
    const scopeLabel = benchmarkScopeLabel(view.scopeKey);
    tr.innerHTML = `
      <td>
        <div>${benchmarkRefLabel(row?.ref)}</div>
        <div class="muted" style="font-size:11px;">${row?.ref || "—"}</div>
      </td>
      <td>
        <div>${scopeLabel}</div>
        <div class="muted" style="font-size:11px;">${view.scopeSubText || "—"}</div>
      </td>
      <td class="num">${view.rangeText}</td>
      <td class="num">${view.severityText}</td>
      <td>${view.sourceText}</td>
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
    const option = buildControlsAuditSelectOption(row);
    selectEl.appendChild(makeOption(option.value, option.label));
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
    const view = buildControlsEvidenceRowView(row);
    tr.innerHTML = `
      <td>${view.title}</td>
      <td>${view.source}</td>
      <td>${view.capturedAt}</td>
      <td>${view.ref}</td>
      <td>${view.id}</td>
    `;
    tbody.appendChild(tr);
  }
}

export function renderIntelChecksModule({
  els,
  state,
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
    els.intelBenchmarkCount.textContent = buildControlsBenchmarkCountText(benchmarks.length);
  }
  if (els.intelBenchmarkStatus && !String(els.intelBenchmarkStatus.textContent || "").trim()){
    els.intelBenchmarkStatus.classList.remove("ok", "warn", "bad");
    els.intelBenchmarkStatus.classList.add("muted");
    els.intelBenchmarkStatus.textContent = buildControlsBenchmarkDraftStatus({
      reference: String(els.intelBenchmarkRef?.value || ""),
    });
  }
  if (els.intelMissingEvidenceCount){
    els.intelMissingEvidenceCount.textContent = buildControlsMissingEvidenceCountText(missingAudit.length);
  }
  if (els.intelMissingNoteCount){
    els.intelMissingNoteCount.textContent = buildControlsMissingNoteCountText(missingNoteAudit.length);
  }
  if (els.intelEvidenceStatus && !String(els.intelEvidenceStatus.textContent || "").trim()){
    els.intelEvidenceStatus.classList.remove("ok", "warn", "bad");
    els.intelEvidenceStatus.classList.add("muted");
    els.intelEvidenceStatus.textContent = buildControlsEvidenceAttachStatus({
      evidenceRowCount: evidenceRows.length,
      unresolvedAuditCount: missingAudit.length,
      evidenceTitle: String(els.intelEvidenceTitle?.value || ""),
      evidenceSource: String(els.intelEvidenceSource?.value || ""),
    });
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
    const lockStatusText = buildControlsScenarioLockStatus({
      locked: !!workflow.scenarioLocked,
      lockReason: String(workflow.lockReason || ""),
    });
    if (workflow.scenarioLocked){
      els.intelScenarioLockStatus.classList.add("warn");
      els.intelScenarioLockStatus.textContent = lockStatusText;
    } else {
      els.intelScenarioLockStatus.classList.add("muted");
      els.intelScenarioLockStatus.textContent = lockStatusText;
    }
  }
  if (els.intelWorkflowStatus){
    els.intelWorkflowStatus.classList.remove("ok", "warn", "bad", "muted");
    const workflowBaseText = buildControlsWorkflowStatus({
      scenarioLocked: !!workflow.scenarioLocked,
      requireCriticalNote: workflow.requireCriticalNote !== false,
      requireCriticalEvidence: workflow.requireCriticalEvidence !== false,
    });
    const workflowStatusView = buildControlsWorkflowIntegrityStatusView({
      workflowBaseText,
      integrityScore: integrity.score,
      integrityGrade: integrity.grade,
      missingEvidenceCount: missingAudit.length,
      missingNoteCount: missingNoteAudit.length,
    });
    els.intelWorkflowStatus.classList.add(workflowStatusView.tone);
    els.intelWorkflowStatus.textContent = workflowStatusView.text;
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
  const autoDriftRecs = listAutoDriftRecommendations(state);
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
  const correlationStatusView = buildControlsCorrelationStatusView({
    enabled: correlatedShocks,
    modelCount: corrModels.length,
    selectedModelId: corrMatrixId,
    selectedModelLabel: selectedCorrLabel,
  });
  const correlationHintView = buildControlsCorrelationHintStatusView({
    enabled: correlatedShocks,
    modelCount: corrModels.length,
    selectedModelId: corrMatrixId,
    selectedModelLabel: selectedCorrLabel,
  });
  if (els.intelCorrelationStatus){
    els.intelCorrelationStatus.classList.remove("ok", "warn", "bad", "muted");
    els.intelCorrelationStatus.classList.add(correlationStatusView.tone);
    els.intelCorrelationStatus.textContent = correlationStatusView.text;
  }
  if (els.intelCorrelationDisabledHint){
    els.intelCorrelationDisabledHint.classList.remove("ok", "warn", "bad", "muted");
    els.intelCorrelationDisabledHint.classList.add(correlationHintView.tone);
    els.intelCorrelationDisabledHint.textContent = correlationHintView.text;
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
    els.intelDecayWeeklyPct.value = formatControlsPercentInputValue(decayWeeklyPct, 1);
  }
  if (els.intelDecayFloorPct){
    els.intelDecayFloorPct.value = formatControlsPercentInputValue(decayFloorPct, 1);
  }
  if (els.intelDecayStatus){
    els.intelDecayStatus.classList.remove("ok", "warn", "bad", "muted");
    const decayStatusView = buildControlsDecayStatusView({
      enabled: decayEnabled,
      weeklyPct: formatControlsPercentInputValue(decayWeeklyPct, 1) || "0",
      modelType: decayModelType,
      floorPct: formatControlsPercentInputValue(decayFloorPct, 1) || "0",
    });
    els.intelDecayStatus.classList.add(decayStatusView.tone);
    els.intelDecayStatus.textContent = decayStatusView.text;
  }
  if (els.intelShockScenarioCount){
    els.intelShockScenarioCount.textContent = buildControlsShockScenarioCountText(shockRows.length);
  }
  if (els.intelShockStatus){
    els.intelShockStatus.classList.remove("ok", "warn", "bad", "muted");
    const shockStatusView = buildControlsShockStatusView({
      enabled: shockEnabled,
      scenarioCount: shockRows.length,
    });
    els.intelShockStatus.classList.add(shockStatusView.tone);
    els.intelShockStatus.textContent = shockStatusView.text;
  }
  if (els.intelCalibrationBriefContent){
    els.intelCalibrationBriefContent.value = calibrationBrief?.content || "";
  }
  if (els.intelCalibrationStatus){
    els.intelCalibrationStatus.classList.remove("ok", "warn", "bad", "muted");
    const calibrationStatusView = buildControlsCalibrationStatusView({
      briefKindLabel: intelBriefKindLabel(selectedBriefKind),
      hasBrief: Boolean(calibrationBrief),
      createdAt: calibrationBrief?.createdAt,
    });
    els.intelCalibrationStatus.classList.add(calibrationStatusView.tone);
    els.intelCalibrationStatus.textContent = calibrationStatusView.text;
  }
  const intelObservedView = { observedMetrics: observedRows };
  const intelRecommendationView = { recommendations: autoDriftRecs };
  const intelWhatIfView = { intelRequests: whatIfRows };
  if (els.intelObservedCount){
    els.intelObservedCount.textContent = buildObservedCountText(intelObservedView);
  }
  if (els.intelObservedStatus){
    els.intelObservedStatus.classList.remove("ok", "warn", "bad", "muted");
    const observedStatusView = buildControlsObservedStatusView(intelObservedView);
    els.intelObservedStatus.classList.add(observedStatusView.tone);
    els.intelObservedStatus.textContent = observedStatusView.text;
  }
  if (els.intelRecommendationCount){
    els.intelRecommendationCount.textContent = buildRecommendationCountText(intelRecommendationView);
  }
  if (els.intelRecommendationStatus){
    els.intelRecommendationStatus.classList.remove("ok", "warn", "bad", "muted");
    const recommendationStatusView = buildControlsRecommendationStatusView({
      observedIntel: intelObservedView,
      recommendationIntel: intelRecommendationView,
    });
    els.intelRecommendationStatus.classList.add(recommendationStatusView.tone);
    els.intelRecommendationStatus.textContent = recommendationStatusView.text;
  }
  if (els.btnIntelApplyTopRecommendation){
    const top = autoDriftRecs[0] || null;
    els.btnIntelApplyTopRecommendation.disabled = !top;
    els.btnIntelApplyTopRecommendation.textContent = buildControlsApplyTopRecommendationButtonLabel(top);
  }
  if (els.intelRecommendationPreview){
    els.intelRecommendationPreview.value = buildRecommendationPreviewTextFromIntel(intelRecommendationView);
  }
  if (els.intelWhatIfCount){
    els.intelWhatIfCount.textContent = buildWhatIfCountText(intelWhatIfView);
  }
  if (els.intelWhatIfStatus){
    els.intelWhatIfStatus.classList.remove("ok", "warn", "bad", "muted");
    const latest = whatIfRows[0] || null;
    const whatIfStatusView = buildControlsWhatIfStatusView({
      latestRequest: latest,
      intel: intelWhatIfView,
    });
    els.intelWhatIfStatus.classList.add(whatIfStatusView.tone);
    els.intelWhatIfStatus.textContent = whatIfStatusView.text;
  }
  if (els.intelWhatIfPreview){
    const latest = whatIfRows[0] || null;
    els.intelWhatIfPreview.value = buildControlsWhatIfDetailedPreviewText(latest);
  }
}
