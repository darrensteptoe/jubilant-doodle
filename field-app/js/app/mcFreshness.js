export function formatMcTimestampModule(ts){
  if (!ts) return "—";
  const d = new Date(ts);
  if (!isFinite(d.getTime())) return String(ts);
  try{
    return d.toLocaleString();
  } catch {
    return d.toISOString();
  }
}

export function computeDailyLogHashModule(args){
  const {
    state,
    normalizeDailyLogEntry,
    computeSnapshotHash,
  } = args || {};

  const raw = (state && state.ui && Array.isArray(state.ui.dailyLog)) ? state.ui.dailyLog : [];
  const norm = raw.map(normalizeDailyLogEntry).filter(Boolean).map((e) => ({
    date: e.date,
    doors: e.doors,
    calls: e.calls,
    attempts: e.attempts,
    convos: e.convos,
    supportIds: e.supportIds,
    orgHours: e.orgHours,
    volsActive: e.volsActive,
    notes: e.notes,
    updatedAt: e.updatedAt,
  }));
  norm.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return computeSnapshotHash({ modelVersion: "", scenarioState: { ui: { dailyLog: norm } } });
}

export function renderMcFreshnessModule(args){
  const {
    els,
    state,
    res,
    weeks,
    setTextPair,
    setHidden,
    hashMcInputs,
    getMcStaleness,
    computeDailyLogHash,
    renderOpsEnvelopeD2,
    renderFinishEnvelopeD3,
    renderMissRiskD4,
  } = args || {};

  if (!els.mcFreshTag && !els.mcLastRun && !els.mcStale) return;

  const has = !!state.mcLast;
  const meta = (state.ui && state.ui.mcMeta && typeof state.ui.mcMeta === "object") ? state.ui.mcMeta : null;

  if (els.mcRerun) els.mcRerun.disabled = !has;
  if (els.mcRerunSidebar) els.mcRerunSidebar.disabled = !has;

  if (!has){
    if (els.mcFreshTag){
      setTextPair(els.mcFreshTag, els.mcFreshTagSidebar, "Not run");
      els.mcFreshTag.classList.remove("ok", "warn", "bad");
      els.mcFreshTag.classList.add("warn");
    }
    if (els.mcLastRun) setTextPair(els.mcLastRun, els.mcLastRunSidebar, "Last run: —");
    if (els.mcStale){
      setHidden(els.mcStale, true);
      setHidden(els.mcStaleSidebar, true);
    }
    return;
  }

  const stale = getMcStaleness({
    state,
    res,
    weeks,
    hashMcInputs,
    computeDailyLogHash,
  });
  const staleInputs = !!stale.inputsChanged;
  const staleLog = !!stale.executionUpdated;

  if (meta){
    meta.isStale = !!stale.isStale;
    meta.staleReason = stale.reasonCode || "";
  }

  let status = "Fresh";
  let cls = "ok";
  if (staleInputs){
    status = "Stale: inputs changed";
    cls = "warn";
  } else if (staleLog){
    status = "Stale: execution updated";
    cls = "warn";
  }

  if (els.mcFreshTag){
    setTextPair(els.mcFreshTag, els.mcFreshTagSidebar, status);
    els.mcFreshTag.classList.remove("ok", "warn", "bad");
    els.mcFreshTag.classList.add(cls);
  }

  if (els.mcLastRun){
    const ts = meta && meta.lastRunAt ? meta.lastRunAt : "";
    setTextPair(els.mcLastRun, els.mcLastRunSidebar, `Last run: ${formatMcTimestampModule(ts)}`);
  }

  if (els.mcStale){
    setHidden(els.mcStale, !(staleInputs || staleLog));
    setHidden(els.mcStaleSidebar, !(staleInputs || staleLog));
  }

  renderOpsEnvelopeD2(res, weeks);
  renderFinishEnvelopeD3(res, weeks);
  renderMissRiskD4(res, weeks);
}
