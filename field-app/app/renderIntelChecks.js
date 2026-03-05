import {
  benchmarkRefLabel,
  ensureIntelCollections,
  getLatestBriefByKind,
  listIntelBenchmarks,
  listIntelEvidence,
  listMissingEvidenceAudit,
} from "./intelControls.js";

function fmtNum(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
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

export function renderIntelChecksModule({ els, state } = {}){
  if (!els || !state) return;
  ensureIntelCollections(state);

  const benchmarks = listIntelBenchmarks(state).sort((a, b) => {
    const ar = String(a?.ref || "");
    const br = String(b?.ref || "");
    return ar.localeCompare(br);
  });

  const missingAudit = listMissingEvidenceAudit(state, { limit: 200 });
  const evidenceRows = listIntelEvidence(state, { limit: 8 });

  if (els.intelBenchmarkCount){
    els.intelBenchmarkCount.textContent = `${benchmarks.length} benchmark entr${benchmarks.length === 1 ? "y" : "ies"} configured.`;
  }
  if (els.intelBenchmarkStatus && !String(els.intelBenchmarkStatus.textContent || "").trim()){
    els.intelBenchmarkStatus.classList.remove("ok", "warn", "bad");
    els.intelBenchmarkStatus.classList.add("muted");
    els.intelBenchmarkStatus.textContent = "Ready.";
  }
  if (els.intelMissingEvidenceCount){
    els.intelMissingEvidenceCount.textContent = `${missingAudit.length} critical assumption edit(s) missing evidence.`;
  }
  if (els.intelEvidenceStatus && !String(els.intelEvidenceStatus.textContent || "").trim()){
    els.intelEvidenceStatus.classList.remove("ok", "warn", "bad");
    els.intelEvidenceStatus.classList.add("muted");
    els.intelEvidenceStatus.textContent = "Ready.";
  }

  fillBenchmarkTable(els.intelBenchmarkTbody, benchmarks);
  fillAuditSelect(els.intelAuditSelect, missingAudit);
  fillEvidenceTable(els.intelEvidenceTbody, evidenceRows);

  if (els.intelEvidenceCapturedAt && !els.intelEvidenceCapturedAt.value){
    els.intelEvidenceCapturedAt.value = new Date().toISOString().slice(0, 10);
  }

  const calibrationBrief = getLatestBriefByKind(state, "calibrationSources");
  const mcDist = String(state?.intelState?.simToggles?.mcDistribution || "triangular");
  const correlatedShocks = !!state?.intelState?.simToggles?.correlatedShocks;
  const corrMatrixId = String(state?.intelState?.simToggles?.correlationMatrixId || "");
  const corrModels = Array.isArray(state?.intelState?.correlationModels)
    ? state.intelState.correlationModels
    : [];
  if (els.intelMcDistribution){
    els.intelMcDistribution.value = mcDist;
  }
  if (els.intelCorrelatedShocks){
    els.intelCorrelatedShocks.checked = correlatedShocks;
    els.intelCorrelatedShocks.disabled = !corrModels.length;
  }
  fillCorrelationSelect(els.intelCorrelationMatrixId, corrModels, corrMatrixId);
  if (els.intelCorrelationMatrixId){
    els.intelCorrelationMatrixId.disabled = !corrModels.length;
  }
  if (els.intelCorrelationStatus){
    els.intelCorrelationStatus.classList.remove("ok", "warn", "bad");
    els.intelCorrelationStatus.classList.add(corrModels.length ? "muted" : "warn");
    els.intelCorrelationStatus.textContent = corrModels.length
      ? `${corrModels.length} correlation model${corrModels.length === 1 ? "" : "s"} configured.`
      : "No correlation models configured. Add or import one to enable correlated shocks.";
  }
  if (els.intelCalibrationBriefContent){
    els.intelCalibrationBriefContent.value = calibrationBrief?.content || "";
  }
  if (els.intelCalibrationStatus){
    els.intelCalibrationStatus.classList.remove("ok", "warn", "bad");
    if (calibrationBrief){
      els.intelCalibrationStatus.classList.add("muted");
      const ts = fmtDate(calibrationBrief?.createdAt);
      els.intelCalibrationStatus.textContent = `Last generated: ${ts}.`;
    } else {
      els.intelCalibrationStatus.classList.add("muted");
      els.intelCalibrationStatus.textContent = "No calibration brief generated yet.";
    }
  }
}
