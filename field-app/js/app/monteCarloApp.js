// Canonical Monte Carlo app module (Phase 11 consolidation).

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

export function hashMcInputsModule(args){
  const {
    state,
    res,
    weeks,
    deriveNeedVotes,
    safeNum,
    canonicalDoorsPerHourFromSnap,
  } = args || {};

  const needVotes = deriveNeedVotes(res);
  const payload = {
    weeks,
    needVotes,
    // Capacity
    orgCount: safeNum(state.orgCount),
    orgHoursPerWeek: safeNum(state.orgHoursPerWeek),
    volunteerMultBase: safeNum(state.volunteerMultBase),
    channelDoorPct: safeNum(state.channelDoorPct),
    doorsPerHour3: canonicalDoorsPerHourFromSnap(state),
    callsPerHour3: safeNum(state.callsPerHour3),
    // Base rates (Phase 2 + p3)
    contactRatePct: safeNum(state.contactRatePct),
    supportRatePct: safeNum(state.supportRatePct),
    turnoutReliabilityPct: safeNum(state.turnoutReliabilityPct),

    // Universe composition + retention
    universeLayerEnabled: !!state.universeLayerEnabled,
    universeDemPct: safeNum(state.universeDemPct),
    universeRepPct: safeNum(state.universeRepPct),
    universeNpaPct: safeNum(state.universeNpaPct),
    universeOtherPct: safeNum(state.universeOtherPct),
    retentionFactor: safeNum(state.retentionFactor),

    // Turnout / GOTV
    turnoutEnabled: !!state.turnoutEnabled,
    turnoutBaselinePct: safeNum(state.turnoutBaselinePct),
    turnoutTargetOverridePct: state.turnoutTargetOverridePct ?? "",
    gotvMode: state.gotvMode || "basic",
    gotvLiftPP: safeNum(state.gotvLiftPP),
    gotvMaxLiftPP: safeNum(state.gotvMaxLiftPP),
    gotvDiminishing: !!state.gotvDiminishing,
    gotvLiftMin: safeNum(state.gotvLiftMin),
    gotvLiftMode: safeNum(state.gotvLiftMode),
    gotvLiftMax: safeNum(state.gotvLiftMax),
    gotvMaxLiftPP2: safeNum(state.gotvMaxLiftPP2),

    // MC config
    mcMode: state.mcMode || "basic",
    mcVolatility: state.mcVolatility || "med",
    mcSeed: state.mcSeed || "",

    // Advanced ranges
    mcContactMin: safeNum(state.mcContactMin),
    mcContactMode: safeNum(state.mcContactMode),
    mcContactMax: safeNum(state.mcContactMax),
    mcPersMin: safeNum(state.mcPersMin),
    mcPersMode: safeNum(state.mcPersMode),
    mcPersMax: safeNum(state.mcPersMax),
    mcReliMin: safeNum(state.mcReliMin),
    mcReliMode: safeNum(state.mcReliMode),
    mcReliMax: safeNum(state.mcReliMax),
    mcDphMin: safeNum(state.mcDphMin),
    mcDphMode: safeNum(state.mcDphMode),
    mcDphMax: safeNum(state.mcDphMax),
    mcCphMin: safeNum(state.mcCphMin),
    mcCphMode: safeNum(state.mcCphMode),
    mcCphMax: safeNum(state.mcCphMax),
    mcVolMin: safeNum(state.mcVolMin),
    mcVolMode: safeNum(state.mcVolMode),
    mcVolMax: safeNum(state.mcVolMax),
  };
  return JSON.stringify(payload);
}

export function getMcStaleness(args){
  const {
    state,
    res,
    weeks,
    hashMcInputs,
    computeDailyLogHash,
  } = args || {};

  if (!state || !state.mcLast){
    return {
      hasRun: false,
      isStale: false,
      inputsChanged: false,
      executionUpdated: false,
      reasonCode: "",
      reasonText: "",
    };
  }

  const meta = (state.ui && state.ui.mcMeta && typeof state.ui.mcMeta === "object")
    ? state.ui.mcMeta
    : null;

  if (!meta || !res || !hashMcInputs || !computeDailyLogHash){
    return {
      hasRun: true,
      isStale: false,
      inputsChanged: false,
      executionUpdated: false,
      reasonCode: "",
      reasonText: "",
    };
  }

  const nowHash = String(hashMcInputs(res, weeks));
  const inputsAtRun = meta.inputsHash ? String(meta.inputsHash) : String(state.mcLastHash || "");
  const logAtRun = meta.dailyLogHash ? String(meta.dailyLogHash) : "";
  const logNow = String(computeDailyLogHash());

  const inputsChanged = !!inputsAtRun && inputsAtRun !== nowHash;
  const executionUpdated = !!logAtRun && logAtRun !== logNow;
  const isStale = inputsChanged || executionUpdated;

  let reasonCode = "";
  let reasonText = "";
  if (inputsChanged && executionUpdated){
    reasonCode = "inputs_and_execution";
    reasonText = "inputs and execution updates changed since last MC run";
  } else if (inputsChanged){
    reasonCode = "inputs";
    reasonText = "inputs changed since last MC run";
  } else if (executionUpdated){
    reasonCode = "execution";
    reasonText = "execution updates changed since last MC run";
  }

  return {
    hasRun: true,
    isStale,
    inputsChanged,
    executionUpdated,
    reasonCode,
    reasonText,
  };
}

export function fmtSignedModule(v, fmtInt){
  if (v == null || !isFinite(v)) return "—";
  const n = Math.round(v);
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${fmtInt(Math.abs(n))}`;
}

export function renderMcVisualsAdapterModule(args){
  const {
    renderMcVisualsModule,
    els,
    summary,
    clamp,
    fmtSigned,
  } = args || {};
  return renderMcVisualsModule({ els, summary, clamp, fmtSigned });
}

export function renderMcResultsAdapterModule(args){
  const {
    renderMcResultsModule,
    els,
    summary,
    setTextPair,
    fmtSigned,
    fmtInt,
    renderMcVisuals,
  } = args || {};
  return renderMcResultsModule({
    els,
    summary,
    setTextPair,
    fmtSigned,
    fmtInt,
    renderMcVisuals,
  });
}

export function hashOpsEnvelopeInputsModule(args){
  const {
    state,
    res,
    weeks,
    getEffectiveBaseRates,
    computeSnapshotHash,
    hashMcInputs,
    safeNum,
  } = args || {};

  const eff = getEffectiveBaseRates();
  return computeSnapshotHash({
    h: hashMcInputs(res, weeks),
    weeks,
    mcMode: state.mcMode || "basic",
    mcVolatility: state.mcVolatility || "med",
    mcSeed: state.mcSeed || "",
    mcContactMin: safeNum(state.mcContactMin),
    mcContactMode: safeNum(state.mcContactMode),
    mcContactMax: safeNum(state.mcContactMax),
    mcPersMin: safeNum(state.mcPersMin),
    mcPersMode: safeNum(state.mcPersMode),
    mcPersMax: safeNum(state.mcPersMax),
    volBoost: safeNum(eff.volatilityBoost) || 0,
  });
}

export function computeOpsEnvelopeD2Module(args){
  const {
    state,
    res,
    weeks,
    weeklyContext,
    computeWeeklyOpsContext,
    getEffectiveBaseRates,
    safeNum,
    buildAdvancedSpecs,
    buildBasicSpecs,
    hashMcInputs,
    makeRng,
    triSample,
    clamp,
    quantileSorted,
  } = args || {};

  const w = (weeks != null && isFinite(weeks) && weeks > 0) ? weeks : null;
  if (!w) return null;

  const ctx = weeklyContext || ((typeof computeWeeklyOpsContext === "function") ? computeWeeklyOpsContext(res, w) : null);
  if (!ctx || !(ctx.goal > 0)) return null;

  const eff = getEffectiveBaseRates();
  const baseCr = eff.cr;
  const baseSr = eff.sr;
  if (!(baseCr > 0) || !(baseSr > 0)) return null;

  const baseRr = (eff.tr != null && isFinite(eff.tr) && eff.tr > 0) ? eff.tr : 0.75;
  const baseDph = (safeNum(state.doorsPerHour3) != null && safeNum(state.doorsPerHour3) > 0) ? safeNum(state.doorsPerHour3) : 30;
  const baseCph = (safeNum(state.callsPerHour3) != null && safeNum(state.callsPerHour3) > 0) ? safeNum(state.callsPerHour3) : 25;
  const baseVol = (safeNum(state.volunteerMultBase) != null && safeNum(state.volunteerMultBase) > 0) ? safeNum(state.volunteerMultBase) : 1;

  const volBoost = safeNum(eff.volatilityBoost) || 0;
  const specs = (String(state.mcMode || "basic") === "advanced")
    ? buildAdvancedSpecs({ baseCr, basePr: baseSr, baseRr, baseDph, baseCph, baseVol, volBoost })
    : buildBasicSpecs({ baseCr, basePr: baseSr, baseRr, baseDph, baseCph, baseVol, volBoost });

  const runs = 200;
  const seedStr = `${state.mcSeed || ""}|opsEnvelope|${hashMcInputs(res, w)}`;
  const rng = makeRng(seedStr);

  const convos = [];
  const attempts = [];

  for (let i = 0; i < runs; i++){
    const cr = clamp(triSample(specs.contactRate.min, specs.contactRate.mode, specs.contactRate.max, rng), 0.0001, 1);
    const sr = clamp(triSample(specs.persuasionRate.min, specs.persuasionRate.mode, specs.persuasionRate.max, rng), 0.0001, 1);

    const convosPerWeek = (ctx.goal / sr) / w;
    const attemptsPerWeek = convosPerWeek / cr;

    if (isFinite(convosPerWeek) && convosPerWeek > 0) convos.push(convosPerWeek);
    if (isFinite(attemptsPerWeek) && attemptsPerWeek > 0) attempts.push(attemptsPerWeek);
  }

  if (convos.length < 10 || attempts.length < 10) return null;
  convos.sort((a, b) => a - b);
  attempts.sort((a, b) => a - b);

  return {
    runs,
    attempts: {
      p10: quantileSorted(attempts, 0.10),
      p50: quantileSorted(attempts, 0.50),
      p90: quantileSorted(attempts, 0.90),
    },
    convos: {
      p10: quantileSorted(convos, 0.10),
      p50: quantileSorted(convos, 0.50),
      p90: quantileSorted(convos, 0.90),
    }
  };
}

export function renderOpsEnvelopeD2Module(args){
  const {
    els,
    state,
    res,
    weeks,
    hashOpsEnvelopeInputs,
    computeOpsEnvelopeD2,
    persist,
    fmtInt,
  } = args || {};

  if (!els.opsAttP10 && !els.opsConP10) return;

  const clear = () => {
    if (els.opsAttP10) els.opsAttP10.textContent = "—";
    if (els.opsAttP50) els.opsAttP50.textContent = "—";
    if (els.opsAttP90) els.opsAttP90.textContent = "—";
    if (els.opsConP10) els.opsConP10.textContent = "—";
    if (els.opsConP50) els.opsConP50.textContent = "—";
    if (els.opsConP90) els.opsConP90.textContent = "—";
  };

  if (!state.mcLast){
    clear();
    return;
  }

  const h = hashOpsEnvelopeInputs(res, weeks);
  const cached = (state.ui && state.ui.opsEnvelope && typeof state.ui.opsEnvelope === "object") ? state.ui.opsEnvelope : null;
  let env = (cached && cached.hash === h) ? cached.env : null;

  if (!env){
    env = computeOpsEnvelopeD2(res, weeks);
    if (!env){
      clear();
      return;
    }
    if (!state.ui) state.ui = {};
    state.ui.opsEnvelope = { hash: h, env, computedAt: new Date().toISOString() };
    persist();
  }

  const fmt = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.round(v));

  if (els.opsAttP10) els.opsAttP10.textContent = fmt(env.attempts.p10);
  if (els.opsAttP50) els.opsAttP50.textContent = fmt(env.attempts.p50);
  if (els.opsAttP90) els.opsAttP90.textContent = fmt(env.attempts.p90);
  if (els.opsConP10) els.opsConP10.textContent = fmt(env.convos.p10);
  if (els.opsConP50) els.opsConP50.textContent = fmt(env.convos.p50);
  if (els.opsConP90) els.opsConP90.textContent = fmt(env.convos.p90);
}

export function hashFinishEnvelopeInputsModule(args){
  const {
    res,
    weeks,
    hashOpsEnvelopeInputs,
    computeSnapshotHash,
    computeDailyLogHash,
    fmtISODate,
  } = args || {};

  const today = fmtISODate(new Date());
  return computeSnapshotHash({
    h: hashOpsEnvelopeInputs(res, weeks),
    dailyLogHash: computeDailyLogHash(),
    today,
  });
}

export function computeFinishEnvelopeD3Module(args){
  const {
    state,
    res,
    weeks,
    weeklyContext,
    executionSnapshot,
    computeWeeklyOpsContext,
    computeLastNLogSums,
    getEffectiveBaseRates,
    safeNum,
    buildAdvancedSpecs,
    buildBasicSpecs,
    hashMcInputs,
    makeRng,
    triSample,
    clamp,
    quantileSorted,
  } = args || {};

  const w = (weeks != null && isFinite(weeks) && weeks > 0) ? weeks : null;
  if (!w) return null;

  const ctx = weeklyContext || ((typeof computeWeeklyOpsContext === "function") ? computeWeeklyOpsContext(res, w) : null);
  if (!ctx || !(ctx.goal > 0)) return null;

  const execLog = executionSnapshot?.log || null;
  const log = Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : null;

  if ((!execLog || !execLog.hasLog) && (!log || !log.length)) return null;

  let paceAttemptsWeek = null;
  let doneAttempts = null;

  if (execLog?.hasLog && isFinite(execLog.sumAttemptsWindow) && execLog.days > 0){
    paceAttemptsWeek = (execLog.sumAttemptsWindow / execLog.days) * 7;
    doneAttempts = isFinite(execLog.sumAttemptsAll) ? execLog.sumAttemptsAll : 0;
  }

  if (!(paceAttemptsWeek > 0)){
    const last7 = (typeof computeLastNLogSums === "function") ? computeLastNLogSums(7) : null;
    if (!last7?.hasLog || !(last7.days > 0)) return null;
    paceAttemptsWeek = (last7.sumAttempts / last7.days) * 7;
  }
  if (!(paceAttemptsWeek > 0)) return null;

  if (!(doneAttempts >= 0)){
    doneAttempts = 0;
    for (const x of (log || [])){
      if (!x || !x.date) continue;
      const doors = safeNum(x?.doors) || 0;
      const calls = safeNum(x?.calls) || 0;
      const attempts = (x?.attempts != null && x.attempts !== "") ? (safeNum(x.attempts) || 0) : (doors + calls);
      doneAttempts += attempts;
    }
  }

  const eff = getEffectiveBaseRates();
  const baseCr = eff.cr;
  const baseSr = eff.sr;
  if (!(baseCr > 0) || !(baseSr > 0)) return null;

  const baseRr = (eff.tr != null && isFinite(eff.tr) && eff.tr > 0) ? eff.tr : 0.75;
  const baseDph = (safeNum(state.doorsPerHour3) != null && safeNum(state.doorsPerHour3) > 0) ? safeNum(state.doorsPerHour3) : 30;
  const baseCph = (safeNum(state.callsPerHour3) != null && safeNum(state.callsPerHour3) > 0) ? safeNum(state.callsPerHour3) : 25;
  const baseVol = (safeNum(state.volunteerMultBase) != null && safeNum(state.volunteerMultBase) > 0) ? safeNum(state.volunteerMultBase) : 1;
  const volBoost = safeNum(eff.volatilityBoost) || 0;

  const specs = (String(state.mcMode || "basic") === "advanced")
    ? buildAdvancedSpecs({ baseCr, basePr: baseSr, baseRr, baseDph, baseCph, baseVol, volBoost })
    : buildBasicSpecs({ baseCr, basePr: baseSr, baseRr, baseDph, baseCph, baseVol, volBoost });

  const runs = 200;
  const seedStr = `${state.mcSeed || ""}|finishEnvelope|${hashMcInputs(res, w)}`;
  const rng = makeRng(seedStr);

  const dayOffsets = [];
  for (let i = 0; i < runs; i++){
    const cr = clamp(triSample(specs.contactRate.min, specs.contactRate.mode, specs.contactRate.max, rng), 0.0001, 1);
    const sr = clamp(triSample(specs.persuasionRate.min, specs.persuasionRate.mode, specs.persuasionRate.max, rng), 0.0001, 1);

    const convosNeeded = ctx.goal / sr;
    const attemptsNeeded = convosNeeded / cr;
    const remaining = Math.max(0, attemptsNeeded - doneAttempts);
    const weeksToFinish = remaining / paceAttemptsWeek;
    const daysToFinish = weeksToFinish * 7;
    if (isFinite(daysToFinish) && daysToFinish >= 0) dayOffsets.push(daysToFinish);
  }

  if (dayOffsets.length < 10) return null;
  dayOffsets.sort((a, b) => a - b);

  return {
    runs,
    paceAttemptsWeek,
    p10Days: quantileSorted(dayOffsets, 0.10),
    p50Days: quantileSorted(dayOffsets, 0.50),
    p90Days: quantileSorted(dayOffsets, 0.90),
  };
}

export function renderFinishEnvelopeD3Module(args){
  const {
    els,
    state,
    res,
    weeks,
    hashFinishEnvelopeInputs,
    computeFinishEnvelopeD3,
    persist,
    fmtISODate,
  } = args || {};

  if (!els.opsFinishP10 && !els.opsFinishP50 && !els.opsFinishP90) return;

  const clear = () => {
    if (els.opsFinishP10) els.opsFinishP10.textContent = "—";
    if (els.opsFinishP50) els.opsFinishP50.textContent = "—";
    if (els.opsFinishP90) els.opsFinishP90.textContent = "—";
  };

  if (!state.mcLast){
    clear();
    return;
  }

  const h = hashFinishEnvelopeInputs(res, weeks);
  const cached = (state.ui && state.ui.finishEnvelope && typeof state.ui.finishEnvelope === "object") ? state.ui.finishEnvelope : null;
  let env = (cached && cached.hash === h) ? cached.env : null;

  if (!env){
    env = computeFinishEnvelopeD3(res, weeks);
    if (!env){
      clear();
      return;
    }
    if (!state.ui) state.ui = {};
    state.ui.finishEnvelope = { hash: h, env, computedAt: new Date().toISOString() };
    persist();
  }

  const base = new Date();
  const fmt = (days) => {
    if (days == null || !isFinite(days)) return "—";
    const dt = new Date(base.getTime() + Math.round(days) * 24 * 3600 * 1000);
    return fmtISODate(dt);
  };

  if (els.opsFinishP10) els.opsFinishP10.textContent = fmt(env.p10Days);
  if (els.opsFinishP50) els.opsFinishP50.textContent = fmt(env.p50Days);
  if (els.opsFinishP90) els.opsFinishP90.textContent = fmt(env.p90Days);
}

export function hashMissRiskInputsModule(args){
  const {
    res,
    weeks,
    hashOpsEnvelopeInputs,
    computeSnapshotHash,
    computeDailyLogHash,
  } = args || {};

  return computeSnapshotHash({
    h: hashOpsEnvelopeInputs(res, weeks),
    dailyLogHash: computeDailyLogHash(),
  });
}

export function computeMissRiskD4Module(args){
  const {
    state,
    res,
    weeks,
    weeklyContext,
    executionSnapshot,
    computeWeeklyOpsContext,
    computeLastNLogSums,
    getEffectiveBaseRates,
    safeNum,
    buildAdvancedSpecs,
    buildBasicSpecs,
    hashMcInputs,
    makeRng,
    triSample,
    clamp,
  } = args || {};

  const w = (weeks != null && isFinite(weeks) && weeks > 0) ? weeks : null;
  if (!w) return null;

  const ctx = weeklyContext || ((typeof computeWeeklyOpsContext === "function") ? computeWeeklyOpsContext(res, w) : null);
  if (!ctx || !(ctx.goal > 0)) return null;

  const execLog = executionSnapshot?.log || null;
  let paceAttemptsWeek = null;
  if (execLog?.hasLog && isFinite(execLog.sumAttemptsWindow) && execLog.days > 0){
    paceAttemptsWeek = (execLog.sumAttemptsWindow / execLog.days) * 7;
  }
  if (!(paceAttemptsWeek > 0)){
    const last7 = (typeof computeLastNLogSums === "function") ? computeLastNLogSums(7) : null;
    if (!last7?.hasLog || !(last7.days > 0)) return null;
    paceAttemptsWeek = (last7.sumAttempts / last7.days) * 7;
  }
  if (!(paceAttemptsWeek > 0)) return null;

  const eff = getEffectiveBaseRates();
  const baseCr = eff.cr;
  const baseSr = eff.sr;
  if (!(baseCr > 0) || !(baseSr > 0)) return null;

  const baseRr = (eff.tr != null && isFinite(eff.tr) && eff.tr > 0) ? eff.tr : 0.75;
  const baseDph = (safeNum(state.doorsPerHour3) != null && safeNum(state.doorsPerHour3) > 0) ? safeNum(state.doorsPerHour3) : 30;
  const baseCph = (safeNum(state.callsPerHour3) != null && safeNum(state.callsPerHour3) > 0) ? safeNum(state.callsPerHour3) : 25;
  const baseVol = (safeNum(state.volunteerMultBase) != null && safeNum(state.volunteerMultBase) > 0) ? safeNum(state.volunteerMultBase) : 1;
  const volBoost = safeNum(eff.volatilityBoost) || 0;

  const specs = (String(state.mcMode || "basic") === "advanced")
    ? buildAdvancedSpecs({ baseCr, basePr: baseSr, baseRr, baseDph, baseCph, baseVol, volBoost })
    : buildBasicSpecs({ baseCr, basePr: baseSr, baseRr, baseDph, baseCph, baseVol, volBoost });

  const runs = 200;
  const seedStr = `${state.mcSeed || ""}|missRisk|${hashMcInputs(res, w)}`;
  const rng = makeRng(seedStr);

  let miss = 0;
  let n = 0;

  for (let i = 0; i < runs; i++){
    const cr = clamp(triSample(specs.contactRate.min, specs.contactRate.mode, specs.contactRate.max, rng), 0.0001, 1);
    const sr = clamp(triSample(specs.persuasionRate.min, specs.persuasionRate.mode, specs.persuasionRate.max, rng), 0.0001, 1);

    const convosPerWeek = (ctx.goal / sr) / w;
    const attemptsPerWeek = convosPerWeek / cr;

    if (!isFinite(attemptsPerWeek) || !(attemptsPerWeek > 0)) continue;
    n++;
    if (attemptsPerWeek > paceAttemptsWeek) miss++;
  }

  if (n < 25) return null;
  return {
    runs: n,
    prob: miss / n,
    paceAttemptsWeek
  };
}

export function renderMissRiskD4Module(args){
  const {
    els,
    state,
    res,
    weeks,
    hashMissRiskInputs,
    computeMissRiskD4,
    persist,
  } = args || {};

  if (!els.opsMissProb && !els.opsMissTag) return;

  const clear = () => {
    if (els.opsMissProb) els.opsMissProb.textContent = "—";
    if (els.opsMissTag){
      els.opsMissTag.textContent = "—";
      els.opsMissTag.classList.remove("ok", "warn", "bad");
    }
  };

  if (!state.mcLast){
    clear();
    return;
  }

  const h = hashMissRiskInputs(res, weeks);
  const cached = (state.ui && state.ui.missRiskD4 && typeof state.ui.missRiskD4 === "object") ? state.ui.missRiskD4 : null;
  let env = (cached && cached.hash === h) ? cached.env : null;

  if (!env){
    env = computeMissRiskD4(res, weeks);
    if (!env){
      clear();
      return;
    }
    if (!state.ui) state.ui = {};
    state.ui.missRiskD4 = { hash: h, env, computedAt: new Date().toISOString() };
    persist();
  }

  const prob = env.prob;
  const pct = (prob == null || !isFinite(prob)) ? "—" : `${(prob * 100).toFixed(1)}%`;

  if (els.opsMissProb) els.opsMissProb.textContent = pct;

  if (els.opsMissTag){
    let label = "Low";
    let cls = "ok";
    if (prob >= 0.60){
      label = "High";
      cls = "bad";
    } else if (prob >= 0.30){
      label = "Moderate";
      cls = "warn";
    }
    els.opsMissTag.textContent = label;
    els.opsMissTag.classList.remove("ok", "warn", "bad");
    els.opsMissTag.classList.add(cls);
  }
}

export function quantileSortedModule(sorted, q){
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] == null) return sorted[base];
  return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function normalizeTri({ min, mode, max }, { clamp }){
  let a = min;
  let b = mode;
  let c = max;
  if (!isFinite(a)) a = 0;
  if (!isFinite(b)) b = 0;
  if (!isFinite(c)) c = 0;

  const lo = Math.min(a, b, c);
  const hi = Math.max(a, b, c);
  b = clamp(b, lo, hi);
  return { min: lo, mode: b, max: hi };
}

function spread(base, w, minClamp, maxClamp, { clamp }){
  const mode = base;
  const min = clamp(base * (1 - w), minClamp, maxClamp);
  const max = clamp(base * (1 + w), minClamp, maxClamp);
  return normalizeTri({ min, mode, max }, { clamp });
}

function triFromPctInputs(minIn, modeIn, maxIn, baseUnit, { safeNum, clamp }){
  const fallbackMode = baseUnit;
  const minV = safeNum(minIn);
  const modeV = safeNum(modeIn);
  const maxV = safeNum(maxIn);

  const mode = (modeV != null) ? clamp(modeV, 0, 100) / 100 : fallbackMode;
  const min = (minV != null) ? clamp(minV, 0, 100) / 100 : clamp(mode * 0.8, 0, 1);
  const max = (maxV != null) ? clamp(maxV, 0, 100) / 100 : clamp(mode * 1.2, 0, 1);

  return normalizeTri({ min, mode, max }, { clamp });
}

function triFromNumInputs(minIn, modeIn, maxIn, base, floor, { safeNum, clamp }){
  const minV = safeNum(minIn);
  const modeV = safeNum(modeIn);
  const maxV = safeNum(maxIn);

  const mode = (modeV != null && modeV > 0) ? modeV : base;
  const min = (minV != null && minV > 0) ? minV : Math.max(floor, mode * 0.8);
  const max = (maxV != null && maxV > 0) ? maxV : Math.max(min + floor, mode * 1.2);

  return normalizeTri({ min, mode, max }, { clamp });
}

export function buildBasicSpecsModule(args){
  const {
    state,
    clamp,
    baseCr,
    basePr,
    baseRr,
    baseDph,
    baseCph,
    baseVol,
    volBoost = 0,
  } = args || {};

  const v = (state.mcVolatility || "med");
  const w = (v === "low") ? 0.10 : (v === "high") ? 0.30 : 0.20;

  return {
    contactRate: spread(baseCr, w, 0, 1, { clamp }),
    persuasionRate: spread(basePr, w + (volBoost || 0), 0, 1, { clamp }),
    turnoutReliability: spread(baseRr, w + (volBoost || 0), 0, 1, { clamp }),
    doorsPerHour: spread(baseDph, w, 0.01, Infinity, { clamp }),
    callsPerHour: spread(baseCph, w, 0.01, Infinity, { clamp }),
    volunteerMult: spread(baseVol, w, 0.01, Infinity, { clamp }),
  };
}

export function buildAdvancedSpecsModule(args){
  const {
    state,
    safeNum,
    clamp,
    baseCr,
    basePr,
    baseRr,
    baseDph,
    baseCph,
    baseVol,
    volBoost = 0,
  } = args || {};

  const cr = triFromPctInputs(state.mcContactMin, state.mcContactMode, state.mcContactMax, baseCr, { safeNum, clamp });
  const pr0 = triFromPctInputs(state.mcPersMin, state.mcPersMode, state.mcPersMax, basePr, { safeNum, clamp });
  const rr0 = triFromPctInputs(state.mcReliMin, state.mcReliMode, state.mcReliMax, baseRr, { safeNum, clamp });

  const widen = (tri, boost) => {
    if (!tri || tri.min == null || tri.mode == null || tri.max == null) return tri;
    const b = Math.max(0, Number(boost) || 0);
    if (b <= 0) return tri;
    const mid = tri.mode;
    const span = tri.max - tri.min;
    const extra = span * b;
    return {
      min: Math.max(0, tri.min - extra),
      mode: Math.min(1, Math.max(0, mid)),
      max: Math.min(1, tri.max + extra),
    };
  };

  const pr = widen(pr0, volBoost);
  const rr = widen(rr0, volBoost);

  const dph = triFromNumInputs(state.mcDphMin, state.mcDphMode, state.mcDphMax, baseDph, 0.01, { safeNum, clamp });
  const cph = triFromNumInputs(state.mcCphMin, state.mcCphMode, state.mcCphMax, baseCph, 0.01, { safeNum, clamp });
  const vm = triFromNumInputs(state.mcVolMin, state.mcVolMode, state.mcVolMax, baseVol, 0.01, { safeNum, clamp });

  return {
    contactRate: cr,
    persuasionRate: pr,
    turnoutReliability: rr,
    doorsPerHour: dph,
    callsPerHour: cph,
    volunteerMult: vm,
  };
}

export function runMonteCarloNowModule(args){
  const {
    state,
    computeElectionSnapshot,
    computeExecutionSnapshot,
    computeWeeklyOpsContext,
    derivedWeeksRemaining,
    buildModelInputFromState,
    safeNum,
    engine,
    deriveNeedVotes,
    setLastRenderCtx,
    hashMcInputs,
    runMonteCarloSim,
    computeDailyLogHash,
    persist,
    clearMcStale,
    renderMcResults,
    renderMcFreshness,
    renderRiskFramingE2,
    renderSensitivitySnapshotE4,
  } = args || {};

  let planningSnapshot = null;
  try{
    planningSnapshot = (typeof computeElectionSnapshot === "function")
      ? computeElectionSnapshot({ state, nowDate: new Date(), toNum: safeNum })
      : null;
  } catch {
    planningSnapshot = null;
  }

  const weeks = planningSnapshot?.weeks ?? derivedWeeksRemaining();
  const modelInput = planningSnapshot?.modelInput || buildModelInputFromState(state, safeNum);
  const res = planningSnapshot?.res || engine.computeAll(modelInput);
  const w = (weeks != null && weeks >= 0) ? weeks : null;
  const needVotes = (planningSnapshot?.needVotes != null)
    ? planningSnapshot.needVotes
    : deriveNeedVotes(res);

  const weeklyContext = (typeof computeWeeklyOpsContext === "function")
    ? (computeWeeklyOpsContext(res, w) || null)
    : null;
  const expectedAPH = (
    weeklyContext?.doorShare != null &&
    weeklyContext?.doorsPerHour != null &&
    weeklyContext?.callsPerHour != null
  )
    ? (weeklyContext.doorShare * weeklyContext.doorsPerHour + (1 - weeklyContext.doorShare) * weeklyContext.callsPerHour)
    : null;
  let executionSnapshot = null;
  try{
    executionSnapshot = (typeof computeExecutionSnapshot === "function")
      ? computeExecutionSnapshot({
          planningSnapshot: planningSnapshot || { weeks: w },
          weeklyContext,
          dailyLog: state?.ui?.dailyLog || [],
          assumedCR: weeklyContext?.cr ?? null,
          assumedSR: weeklyContext?.sr ?? null,
          expectedAPH,
          windowN: 7,
          safeNumFn: safeNum,
        })
      : null;
  } catch {
    executionSnapshot = null;
  }

  if (typeof setLastRenderCtx === "function"){
    setLastRenderCtx({ res, weeks: w, needVotes, modelInput, planningSnapshot, weeklyContext, executionSnapshot });
  }

  const h = hashMcInputs(res, w);
  const sim = runMonteCarloSim({ res, weeks: w, needVotes, runs: 10000, seed: state.mcSeed || "" });

  state.mcLast = sim;
  state.mcLastHash = h;

  if (!state.ui) state.ui = {};
  state.ui.mcMeta = {
    lastRunAt: new Date().toISOString(),
    inputsHash: h,
    dailyLogHash: computeDailyLogHash(),
  };

  persist();
  clearMcStale();
  renderMcResults(sim);
  renderMcFreshness(res, w, { weeklyContext, executionSnapshot });
  renderRiskFramingE2();
  renderSensitivitySnapshotE4();
}
