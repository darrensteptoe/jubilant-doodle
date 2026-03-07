// @ts-check
// Canonical decision-session app module (Phase 11 consolidation).

export const OBJECTIVE_TEMPLATES = [
  { key: "win_prob", label: "Maximize win probability" },
  { key: "finish_date", label: "Finish earlier" },
  { key: "exec_feasible", label: "Maximize feasibility" },
  { key: "budget_eff", label: "Improve budget efficiency" },
  { key: "balanced", label: "Balanced (risk-aware)" },
];

export const RISK_POSTURES = [
  { key: "cautious", label: "Cautious" },
  { key: "balanced", label: "Balanced" },
  { key: "aggressive", label: "Aggressive" },
];

export function makeDecisionSessionIdCore(uid){
  return "ds_" + uid() + Date.now().toString(16);
}

export function makeDecisionOptionIdCore(uid){
  return "do_" + uid() + Date.now().toString(16);
}

export function ensureDecisionOptionShapeCore(o){
  if (!o || typeof o !== "object") return;
  if (!o.tactics || typeof o.tactics !== "object") o.tactics = {};
  const t = o.tactics;
  if (t.doors === undefined) t.doors = false;
  if (t.phones === undefined) t.phones = false;
  if (t.digital === undefined) t.digital = false;
}

export function ensureDecisionSessionShapeCore(s){
  if (!s || typeof s !== "object") return;

  if (!s.constraints || typeof s.constraints !== "object") s.constraints = {};
  const c = s.constraints;
  if (c.budget === undefined) c.budget = null;
  if (c.volunteerHrs === undefined) c.volunteerHrs = null;
  if (c.turfAccess === undefined) c.turfAccess = "";
  if (c.blackoutDates === undefined) c.blackoutDates = "";

  if (s.riskPosture === undefined) s.riskPosture = "balanced";
  if (!Array.isArray(s.nonNegotiables)) s.nonNegotiables = [];
  if (!Array.isArray(s.whatNeedsTrue)) s.whatNeedsTrue = [];
  if (s.recommendedOptionId === undefined) s.recommendedOptionId = null;

  if (!s.options || typeof s.options !== "object") s.options = {};
  for (const k of Object.keys(s.options)){
    ensureDecisionOptionShapeCore(s.options[k]);
  }
  if (s.activeOptionId && !s.options[s.activeOptionId]) s.activeOptionId = null;
}

export function ensureDecisionScaffoldCore(state, {
  ensureDecisionSessionShape,
  makeDecisionSessionId,
  objectiveTemplates,
  scenarioBaselineId,
}){
  if (!state) return;
  if (!state.ui) state.ui = {};
  const d = (state.ui.decision && typeof state.ui.decision === "object") ? state.ui.decision : null;
  if (!d){
    state.ui.decision = { sessions: {}, activeSessionId: null };
  }
  if (!state.ui.decision.sessions || typeof state.ui.decision.sessions !== "object"){
    state.ui.decision.sessions = {};
  }

  const ids = Object.keys(state.ui.decision.sessions);
  for (const k of ids){
    ensureDecisionSessionShape(state.ui.decision.sessions[k]);
  }
  if (!ids.length){
    const id = makeDecisionSessionId();
    state.ui.decision.sessions[id] = {
      id,
      name: "Decision Session",
      createdAt: new Date().toISOString(),
      scenarioId: state.ui.activeScenarioId || scenarioBaselineId,
      objectiveKey: objectiveTemplates?.[0]?.key || "win_prob",
      notes: "",
      constraints: { budget: null, volunteerHrs: null, turfAccess: "", blackoutDates: "" },
      riskPosture: "balanced",
      nonNegotiables: [],
      whatNeedsTrue: [],
      recommendedOptionId: null,
      options: {},
      activeOptionId: null,
    };
    state.ui.decision.activeSessionId = id;
    return;
  }

  const active = state.ui.decision.activeSessionId;
  if (!active || !state.ui.decision.sessions[active]){
    state.ui.decision.activeSessionId = ids[0];
  }
}

export function getActiveDecisionSessionCore(state){
  const id = state?.ui?.decision?.activeSessionId;
  const s = (id && state?.ui?.decision?.sessions) ? state.ui.decision.sessions[id] : null;
  return s || null;
}

export function listDecisionSessionsCore(state){
  const sessions = state?.ui?.decision?.sessions || {};
  const arr = Object.values(sessions);
  arr.sort((a, b) => String(a?.createdAt || "").localeCompare(String(b?.createdAt || "")));
  return arr;
}

export function decisionScenarioLabelCore(scenarioId, registry){
  const reg = registry || {};
  const rec = scenarioId ? reg[scenarioId] : null;
  if (!scenarioId) return "—";
  if (rec) return `${rec.name || rec.id} (${rec.id})`;
  return String(scenarioId);
}

/** @param {import("./types").DecisionSessionActionsCtx} ctx */
export function createDecisionSessionActions(ctx){
  const {
    els,
    stateRef,
    ensureDecisionScaffold,
    makeDecisionSessionId,
    makeDecisionOptionId,
    OBJECTIVE_TEMPLATES,
    SCENARIO_BASELINE_ID,
    getActiveDecisionSession,
    ensureDecisionSessionShape,
    getActiveDecisionOption,
    ensureDecisionOptionShape,
    ensureScenarioRegistry,
    persist,
    renderDecisionSessionD1,
  } = ctx || {};

  const state = () => stateRef?.();

  const createNewDecisionSession = () => {
    ensureDecisionScaffold();
    const s = state();
    const sessions = s.ui.decision.sessions;
    const id = makeDecisionSessionId();
    const n = Object.keys(sessions).length + 1;
    sessions[id] = {
      id,
      name: `Session ${n}`,
      createdAt: new Date().toISOString(),
      scenarioId: s.ui.activeScenarioId || SCENARIO_BASELINE_ID,
      objectiveKey: OBJECTIVE_TEMPLATES[0].key,
      notes: "",
      constraints: { budget: null, volunteerHrs: null, turfAccess: "", blackoutDates: "" },
      riskPosture: "balanced",
      nonNegotiables: [],
      options: {},
      activeOptionId: null,
    };
    s.ui.decision.activeSessionId = id;
    persist();
    renderDecisionSessionD1();
  };

  const renameActiveDecisionSession = () => {
    const s = getActiveDecisionSession();
    if (!s || !els?.decisionRename) return;
    const nm = String(els.decisionRename.value || "").trim();
    if (!nm) return;
    s.name = nm;
    persist();
    renderDecisionSessionD1();
  };

  const deleteActiveDecisionSession = () => {
    ensureDecisionScaffold();
    const root = state();
    const sessions = root.ui.decision.sessions;
    const ids = Object.keys(sessions);
    if (ids.length <= 1) return;
    const cur = root.ui.decision.activeSessionId;
    const s = sessions[cur];
    const nm = s ? (s.name || s.id) : "this session";
    const ok = confirm(`Delete "${nm}"?`);
    if (!ok) return;
    delete sessions[cur];
    const nextIds = Object.keys(sessions);
    root.ui.decision.activeSessionId = nextIds[0] || null;
    persist();
    renderDecisionSessionD1();
  };

  const linkDecisionSessionToActiveScenario = () => {
    const s = getActiveDecisionSession();
    if (!s) return;
    const root = state();
    ensureScenarioRegistry();
    s.scenarioId = root.ui.activeScenarioId || SCENARIO_BASELINE_ID;
    persist();
    renderDecisionSessionD1();
  };

  const createNewDecisionOption = () => {
    const s = getActiveDecisionSession();
    if (!s) return;
    const root = state();
    ensureDecisionSessionShape(s);

    const id = makeDecisionOptionId();
    const n = Object.keys(s.options || {}).length + 1;
    s.options[id] = {
      id,
      label: `Option ${n}`,
      createdAt: new Date().toISOString(),
      scenarioId: root.ui.activeScenarioId || SCENARIO_BASELINE_ID,
      tactics: { doors: false, phones: false, digital: false },
    };
    s.activeOptionId = id;
    persist();
    renderDecisionSessionD1();
  };

  const renameActiveDecisionOption = () => {
    const s = getActiveDecisionSession();
    if (!s) return;
    ensureDecisionSessionShape(s);
    const o = getActiveDecisionOption(s);
    if (!o || !els?.decisionOptionRename) return;
    const nm = String(els.decisionOptionRename.value || "").trim();
    if (!nm) return;
    o.label = nm;
    persist();
    renderDecisionSessionD1();
  };

  const deleteActiveDecisionOption = () => {
    const s = getActiveDecisionSession();
    if (!s) return;
    ensureDecisionSessionShape(s);
    const options = s.options || {};
    const ids = Object.keys(options);
    if (ids.length <= 1) return;

    const o = getActiveDecisionOption(s);
    if (!o) return;
    const nm = o.label || o.id;
    const ok = confirm(`Delete "${nm}"?`);
    if (!ok) return;

    delete options[o.id];
    const nextIds = Object.keys(options);
    s.activeOptionId = nextIds[0] || null;
    persist();
    renderDecisionSessionD1();
  };

  const linkDecisionOptionToActiveScenario = () => {
    const s = getActiveDecisionSession();
    if (!s) return;
    const root = state();
    ensureDecisionSessionShape(s);
    const o = getActiveDecisionOption(s);
    if (!o) return;
    ensureScenarioRegistry();
    o.scenarioId = root.ui.activeScenarioId || SCENARIO_BASELINE_ID;
    persist();
    renderDecisionSessionD1();
  };

  return {
    createNewDecisionSession,
    renameActiveDecisionSession,
    deleteActiveDecisionSession,
    linkDecisionSessionToActiveScenario,
    createNewDecisionOption,
    renameActiveDecisionOption,
    deleteActiveDecisionOption,
    linkDecisionOptionToActiveScenario,
  };
}

/** @param {import("./types").DecisionSessionBindingsCtx} ctx */
export function wireDecisionSessionBindings(ctx){
  const {
    els,
    ensureDecisionScaffold,
    getState,
    setState,
    persist,
    renderDecisionSessionD1,
    getActiveDecisionSession,
    ensureDecisionSessionShape,
    createNewDecisionSession,
    renameActiveDecisionSession,
    deleteActiveDecisionSession,
    linkDecisionSessionToActiveScenario,
    createNewDecisionOption,
    renameActiveDecisionOption,
    deleteActiveDecisionOption,
    linkDecisionOptionToActiveScenario,
    getActiveDecisionOption,
    ensureDecisionOptionShape,
    renderDecisionSummaryD4,
    buildDecisionSummaryText,
    copyTextToClipboard,
    decisionSummaryPlainText,
    decisionSessionExportObject,
    downloadJsonObject,
    runSensitivitySnapshotE4,
  } = ctx || {};

  if (!els) return;

  const wireInput = (el, patchFn, { parse = v => v, event, onCommit } = {}) => {
    if (!el) return;
    const ev = event || (el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input");
    el.addEventListener(ev, () => {
      const raw = el.type === "checkbox" ? el.checked : el.value;
      const val = parse(raw);
      setState(next => patchFn(next, val));
      if (onCommit) onCommit();
    });
  };

  const activeSessionId = () => {
    const s = getActiveDecisionSession?.();
    return s?.id || null;
  };

  ensureDecisionScaffold();

  if (els.decisionSessionSelect){
    els.decisionSessionSelect.addEventListener("change", () => {
      ensureDecisionScaffold();
      const id = els.decisionSessionSelect.value;
      const state = getState();
      if (id && state.ui?.decision?.sessions?.[id]){
        state.ui.decision.activeSessionId = id;
        persist();
        renderDecisionSessionD1();
      }
    });
  }

  if (els.btnDecisionNew) els.btnDecisionNew.addEventListener("click", () => createNewDecisionSession());
  if (els.btnDecisionRenameSave) els.btnDecisionRenameSave.addEventListener("click", () => renameActiveDecisionSession());
  if (els.btnDecisionDelete) els.btnDecisionDelete.addEventListener("click", () => deleteActiveDecisionSession());
  if (els.btnDecisionLinkScenario) els.btnDecisionLinkScenario.addEventListener("click", () => linkDecisionSessionToActiveScenario());

  wireInput(els.decisionNotes, (st, val) => {
    const sid = activeSessionId();
    const s = sid ? st.ui?.decision?.sessions?.[sid] : null;
    if (s) s.notes = val;
  });

  wireInput(els.decisionObjective, (st, val) => {
    const sid = activeSessionId();
    const s = sid ? st.ui?.decision?.sessions?.[sid] : null;
    if (s) s.objectiveKey = val;
  }, { onCommit: renderDecisionSessionD1 });

  wireInput(els.decisionBudget, (st, val) => {
    const sid = activeSessionId();
    const s = sid ? st.ui?.decision?.sessions?.[sid] : null;
    if (s){
      ensureDecisionSessionShape(s);
      s.constraints.budget = val;
    }
  }, { parse: raw => { const n = Number(String(raw).trim()); return (String(raw).trim() === "" || !Number.isFinite(n)) ? null : n; } });

  wireInput(els.decisionVolunteerHrs, (st, val) => {
    const sid = activeSessionId();
    const s = sid ? st.ui?.decision?.sessions?.[sid] : null;
    if (s){
      ensureDecisionSessionShape(s);
      s.constraints.volunteerHrs = val;
    }
  }, { parse: raw => { const n = Number(String(raw).trim()); return (String(raw).trim() === "" || !Number.isFinite(n)) ? null : n; } });

  wireInput(els.decisionTurfAccess, (st, val) => {
    const sid = activeSessionId();
    const s = sid ? st.ui?.decision?.sessions?.[sid] : null;
    if (s){
      ensureDecisionSessionShape(s);
      s.constraints.turfAccess = val;
    }
  });

  wireInput(els.decisionBlackoutDates, (st, val) => {
    const sid = activeSessionId();
    const s = sid ? st.ui?.decision?.sessions?.[sid] : null;
    if (s){
      ensureDecisionSessionShape(s);
      s.constraints.blackoutDates = val;
    }
  });

  wireInput(els.decisionRiskPosture, (st, val) => {
    const sid = activeSessionId();
    const s = sid ? st.ui?.decision?.sessions?.[sid] : null;
    if (s){
      ensureDecisionSessionShape(s);
      s.riskPosture = val || "balanced";
    }
  }, { onCommit: renderDecisionSessionD1 });

  wireInput(els.decisionNonNegotiables, (st, val) => {
    const sid = activeSessionId();
    const s = sid ? st.ui?.decision?.sessions?.[sid] : null;
    if (s){
      ensureDecisionSessionShape(s);
      s.nonNegotiables = val.split(/\r?\n|,/).map(x => String(x || "").trim()).filter(Boolean);
    }
  });

  if (els.decisionOptionSelect){
    els.decisionOptionSelect.addEventListener("change", () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      ensureDecisionSessionShape(s);
      const id = String(els.decisionOptionSelect.value || "");
      if (id && s.options && s.options[id]){
        s.activeOptionId = id;
        persist();
        renderDecisionSessionD1();
      }
    });
  }

  if (els.btnDecisionOptionNew) els.btnDecisionOptionNew.addEventListener("click", () => createNewDecisionOption());
  if (els.btnDecisionOptionRenameSave) els.btnDecisionOptionRenameSave.addEventListener("click", () => renameActiveDecisionOption());
  if (els.btnDecisionOptionDelete) els.btnDecisionOptionDelete.addEventListener("click", () => deleteActiveDecisionOption());
  if (els.btnDecisionOptionLinkScenario) els.btnDecisionOptionLinkScenario.addEventListener("click", () => linkDecisionOptionToActiveScenario());

  const tacticUpdate = () => {
    const s = getActiveDecisionSession();
    if (!s) return;
    ensureDecisionSessionShape(s);
    const o = getActiveDecisionOption(s);
    if (!o) return;
    ensureDecisionOptionShape(o);
    o.tactics.doors = !!els.decisionOptionTacticDoors?.checked;
    o.tactics.phones = !!els.decisionOptionTacticPhones?.checked;
    o.tactics.digital = !!els.decisionOptionTacticDigital?.checked;
    persist();
  };

  if (els.decisionOptionTacticDoors) els.decisionOptionTacticDoors.addEventListener("change", tacticUpdate);
  if (els.decisionOptionTacticPhones) els.decisionOptionTacticPhones.addEventListener("change", tacticUpdate);
  if (els.decisionOptionTacticDigital) els.decisionOptionTacticDigital.addEventListener("change", tacticUpdate);

  if (els.decisionRecommendSelect){
    els.decisionRecommendSelect.addEventListener("change", () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      ensureDecisionSessionShape(s);
      const id = String(els.decisionRecommendSelect.value || "").trim();
      s.recommendedOptionId = id || null;
      persist();
      renderDecisionSummaryD4(s);
    });
  }

  if (els.decisionWhatTrue){
    els.decisionWhatTrue.addEventListener("input", () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      ensureDecisionSessionShape(s);
      const raw = String(els.decisionWhatTrue.value || "");
      const arr = raw.split(/\r?\n/).map(x => String(x || "").trim()).filter(Boolean);
      s.whatNeedsTrue = arr;
      persist();
      renderDecisionSummaryD4(s);
    });
  }

  const setCopyStatus = (msg) => {
    if (els.decisionCopyStatus) els.decisionCopyStatus.textContent = String(msg || "");
  };

  if (els.btnDecisionCopyMd){
    els.btnDecisionCopyMd.addEventListener("click", async () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      const md = buildDecisionSummaryText(s);
      const ok = await copyTextToClipboard(md);
      setCopyStatus(ok ? "Copied summary (markdown)." : "Copy failed.");
    });
  }

  if (els.btnDecisionCopyText){
    els.btnDecisionCopyText.addEventListener("click", async () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      const md = buildDecisionSummaryText(s);
      const plain = decisionSummaryPlainText(md);
      const ok = await copyTextToClipboard(plain);
      setCopyStatus(ok ? "Copied summary (text)." : "Copy failed.");
    });
  }

  if (els.btnDecisionDownloadJson){
    els.btnDecisionDownloadJson.addEventListener("click", () => {
      const s = getActiveDecisionSession();
      if (!s) return;
      const obj = decisionSessionExportObject(s);
      if (!obj) return;
      const safe = String((s.name || s.id || "decision-session")).toLowerCase().replace(/[^a-z0-9\-\_]+/g, "-").replace(/\-+/g, "-").replace(/^\-+|\-+$/g, "");
      const fn = (safe ? safe : "decision-session") + ".json";
      downloadJsonObject(obj, fn);
      setCopyStatus("Downloaded session JSON.");
    });
  }

  if (els.btnSensRun){
    els.btnSensRun.addEventListener("click", async () => {
      await runSensitivitySnapshotE4();
    });
  }

  renderDecisionSessionD1();
}

export function renderDecisionOptionsPanelCore({
  els,
  session,
  ensureDecisionSessionShape,
  listDecisionOptions,
  getActiveDecisionOption,
  decisionScenarioLabel,
}){
  if (!els.decisionOptionSelect) return;
  if (!session) return;

  ensureDecisionSessionShape(session);

  const options = listDecisionOptions(session);
  const active = getActiveDecisionOption(session);

  els.decisionOptionSelect.innerHTML = "";
  if (!options.length){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No options yet";
    els.decisionOptionSelect.appendChild(opt);
    els.decisionOptionSelect.value = "";
  } else {
    for (const o of options){
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = o.label || o.id;
      els.decisionOptionSelect.appendChild(opt);
    }
    els.decisionOptionSelect.value = session.activeOptionId || options[0].id;
    if (!session.activeOptionId) session.activeOptionId = els.decisionOptionSelect.value;
  }

  const has = !!active;

  if (els.decisionOptionRename){
    els.decisionOptionRename.value = has ? String(active.label || "") : "";
    els.decisionOptionRename.disabled = !has;
  }

  if (els.btnDecisionOptionRenameSave) els.btnDecisionOptionRenameSave.disabled = !has;
  if (els.btnDecisionOptionDelete) els.btnDecisionOptionDelete.disabled = options.length <= 1;
  if (els.btnDecisionOptionLinkScenario) els.btnDecisionOptionLinkScenario.disabled = !has;

  if (els.decisionOptionScenarioLabel){
    els.decisionOptionScenarioLabel.textContent = has ? decisionScenarioLabel(active.scenarioId || null) : "—";
  }

  const t = has ? (active.tactics || {}) : {};
  if (els.decisionOptionTacticDoors){
    els.decisionOptionTacticDoors.checked = !!t.doors;
    els.decisionOptionTacticDoors.disabled = !has;
  }
  if (els.decisionOptionTacticPhones){
    els.decisionOptionTacticPhones.checked = !!t.phones;
    els.decisionOptionTacticPhones.disabled = !has;
  }
  if (els.decisionOptionTacticDigital){
    els.decisionOptionTacticDigital.checked = !!t.digital;
    els.decisionOptionTacticDigital.disabled = !has;
  }
}

export function renderDecisionSessionPanelCore({
  els,
  state,
  ensureDecisionScaffold,
  listDecisionSessions,
  getActiveDecisionSession,
  ensureDecisionSessionShape,
  objectiveTemplates,
  riskPostures,
  decisionScenarioLabel,
  renderDecisionOptions,
  renderDecisionSummary,
}){
  if (!els.decisionSessionSelect && !els.decisionActiveLabel) return;
  ensureDecisionScaffold();
  const sessions = listDecisionSessions();
  const activeId = state.ui.decision.activeSessionId;
  const active = getActiveDecisionSession();
  ensureDecisionSessionShape(active);

  if (els.decisionSessionSelect){
    els.decisionSessionSelect.innerHTML = "";
    for (const s of sessions){
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.name || s.id;
      els.decisionSessionSelect.appendChild(opt);
    }
    els.decisionSessionSelect.value = activeId;
  }

  if (els.decisionActiveLabel){
    els.decisionActiveLabel.textContent = active ? `Active session: ${active.name || active.id}` : "Active session: —";
  }

  if (els.decisionRename){
    els.decisionRename.value = active?.name || "";
  }

  if (els.decisionObjective){
    els.decisionObjective.innerHTML = "";
    for (const o of objectiveTemplates){
      const opt = document.createElement("option");
      opt.value = o.key;
      opt.textContent = o.label;
      els.decisionObjective.appendChild(opt);
    }
    els.decisionObjective.value = active?.objectiveKey || objectiveTemplates[0].key;
  }

  if (els.decisionNotes){
    els.decisionNotes.value = active?.notes || "";
  }

  if (els.decisionBudget){
    const v = active?.constraints?.budget;
    els.decisionBudget.value = (v == null || !Number.isFinite(Number(v))) ? "" : String(v);
  }

  if (els.decisionVolunteerHrs){
    const v = active?.constraints?.volunteerHrs;
    els.decisionVolunteerHrs.value = (v == null || !Number.isFinite(Number(v))) ? "" : String(v);
  }

  if (els.decisionTurfAccess){
    els.decisionTurfAccess.value = String(active?.constraints?.turfAccess || "");
  }

  if (els.decisionBlackoutDates){
    els.decisionBlackoutDates.value = String(active?.constraints?.blackoutDates || "");
  }

  if (els.decisionRiskPosture){
    if (!els.decisionRiskPosture.options.length){
      for (const rp of riskPostures){
        const opt = document.createElement("option");
        opt.value = rp.key;
        opt.textContent = rp.label;
        els.decisionRiskPosture.appendChild(opt);
      }
    }
    els.decisionRiskPosture.value = String(active?.riskPosture || "balanced");
  }

  if (els.decisionNonNegotiables){
    const lines = Array.isArray(active?.nonNegotiables) ? active.nonNegotiables : [];
    els.decisionNonNegotiables.value = lines.join("\n");
  }

  if (els.decisionScenarioLabel){
    els.decisionScenarioLabel.textContent = decisionScenarioLabel(active?.scenarioId || null);
  }

  if (els.btnDecisionDelete){
    els.btnDecisionDelete.disabled = sessions.length <= 1;
  }

  renderDecisionOptions(active);
  renderDecisionSummary(active);
}

export function computeDecisionKeyOutCore(inputs, deps = {}){
  const {
    scenarioClone,
    engine,
    derivedWeeksRemaining,
    computeElectionSnapshot,
    computeWeeklyOpsContextFromSnap,
    targetFinishDateFromSnap,
    safeNum,
  } = deps || {};
  try{
    const snap = scenarioClone(inputs || {});
    if (typeof computeElectionSnapshot === "function"){
      try{
        const planningSnapshot = computeElectionSnapshot({
          state: snap,
          nowDate: new Date(),
          toNum: (typeof safeNum === "function") ? safeNum : undefined,
        });
        const resSnap = planningSnapshot?.res || null;
        const weeksSnap = planningSnapshot?.weeks ?? null;
        if (resSnap){
          const ctxSnap = computeWeeklyOpsContextFromSnap(snap, resSnap, weeksSnap);
          const finishSnap = targetFinishDateFromSnap(snap, weeksSnap);
          return { weeks: weeksSnap, ctx: ctxSnap, finish: finishSnap };
        }
      } catch {
        // Fall back to legacy path.
      }
    }

    const res = engine.computeAll(snap);
    const weeksFn = (typeof derivedWeeksRemaining === "function")
      ? derivedWeeksRemaining
      : engine?.derivedWeeksRemaining;
    const weeks = (typeof weeksFn === "function") ? weeksFn({
      weeksRemainingOverride: snap?.weeksRemaining,
      electionDateISO: snap?.electionDate ? `${snap.electionDate}T00:00:00` : "",
    }) : null;
    const ctx = computeWeeklyOpsContextFromSnap(snap, res, weeks);
    const finish = targetFinishDateFromSnap(snap, weeks);
    return { weeks, ctx, finish };
  } catch {
    return { weeks: null, ctx: null, finish: null };
  }
}

export function decisionOptionDisplayCore(option){
  if (!option) return "—";
  const label = option.label || option.id;
  const sid = option.scenarioId ? ` · ${option.scenarioId}` : "";
  return label + sid;
}

export function buildDecisionSummaryTextCore(session, deps = {}){
  const {
    ensureScenarioRegistry,
    state,
    SCENARIO_BASELINE_ID,
    scenarioClone,
    engine,
    derivedWeeksRemaining,
    computeElectionSnapshot,
    computeWeeklyOpsContextFromSnap,
    targetFinishDateFromSnap,
    fmtISODate,
    OBJECTIVE_TEMPLATES,
    fmtInt,
    safeNum,
    clamp,
  } = deps || {};

  try{
    ensureScenarioRegistry();
    const reg = state?.ui?.scenarios || {};
    const baseline = reg[SCENARIO_BASELINE_ID] || null;

    const s = session || null;
    if (!s || !baseline) return "—";

    const options = (s.options && typeof s.options === "object") ? s.options : {};
    const pickId = s.recommendedOptionId || s.activeOptionId || null;
    const opt = (pickId && options[pickId]) ? options[pickId] : null;

    const baseInputs = scenarioClone(baseline.inputs || {});
    const optScenarioId = opt?.scenarioId || s.scenarioId || state?.ui?.activeScenarioId || SCENARIO_BASELINE_ID;
    const optRec = reg[optScenarioId] || null;
    const optInputs = scenarioClone((optRec?.inputs) || {});

    const coreDeps = {
      scenarioClone,
      engine,
      derivedWeeksRemaining,
      computeElectionSnapshot,
      computeWeeklyOpsContextFromSnap,
      targetFinishDateFromSnap,
      safeNum,
    };
    const baseOut = computeDecisionKeyOutCore(baseInputs, coreDeps);
    const optOut = computeDecisionKeyOutCore(optInputs, coreDeps);

    const fmtNum = (v) => (v == null || !isFinite(v)) ? "—" : fmtInt(Math.ceil(v));
    const fmtDate = (d) => d ? fmtISODate(d) : "—";
    const deltaNum = (a, b) => (a == null || b == null || !isFinite(a) || !isFinite(b)) ? null : (b - a);

    const bCtx = baseOut.ctx || {};
    const oCtx = optOut.ctx || {};

    const attemptsWBase = bCtx.attemptsPerWeek ?? null;
    const attemptsWOpt = oCtx.attemptsPerWeek ?? null;
    const convosWBase = bCtx.convosPerWeek ?? null;
    const convosWOpt = oCtx.convosPerWeek ?? null;

    const gap = oCtx.gap;
    const gapLine = (gap == null || !isFinite(gap))
      ? "—"
      : (gap <= 0 ? "Executable at current capacity" : `Shortfall: ${fmtInt(Math.ceil(gap))} attempts/week`);

    const doorSharePct = safeNum(optInputs?.channelDoorPct);
    const doorShare = (doorSharePct == null) ? null : clamp(doorSharePct / 100, 0, 1);
    const doorsHr = safeNum(optInputs?.doorsPerHour3);
    const callsHr = safeNum(optInputs?.callsPerHour3);
    const aph = (doorShare != null && doorsHr != null && callsHr != null) ? (doorShare * doorsHr + (1 - doorShare) * callsHr) : null;

    const attemptsPerDay = (attemptsWOpt != null && isFinite(attemptsWOpt)) ? (attemptsWOpt / 7) : null;
    const doorsPerDay = (attemptsPerDay != null && doorShare != null) ? (attemptsPerDay * doorShare) : null;
    const callsPerDay = (attemptsPerDay != null && doorShare != null) ? (attemptsPerDay * (1 - doorShare)) : null;
    const hrsPerWeek = (attemptsWOpt != null && aph != null && aph > 0) ? (attemptsWOpt / aph) : null;

    const tactics = opt?.tactics ? Object.keys(opt.tactics).filter(k => !!opt.tactics[k]) : [];
    const tacticsLine = tactics.length ? tactics.map(k => k.toUpperCase()).join(", ") : "—";

    const explicitWhatTrue = Array.isArray(s.whatNeedsTrue)
      ? s.whatNeedsTrue.map((x) => String(x || "").trim()).filter(Boolean)
      : [];
    const autoWhatTrue = [];
    if (!explicitWhatTrue.length){
      if (attemptsWOpt != null && isFinite(attemptsWOpt)){
        autoWhatTrue.push(`Hold execution at ~${fmtInt(Math.ceil(attemptsWOpt))} attempts/week (~${fmtInt(Math.ceil(attemptsWOpt / 7))}/day).`);
      }
      if (gap != null && isFinite(gap)){
        if (gap <= 0){
          autoWhatTrue.push("Keep weekly capacity at or above required attempts.");
        } else {
          autoWhatTrue.push(`Close shortfall of ~${fmtInt(Math.ceil(gap))} attempts/week before committing this option.`);
        }
      }
      if (tactics.length){
        autoWhatTrue.push(`Execute selected tactic mix consistently: ${tactics.map(k => k.toUpperCase()).join(", ")}.`);
      }
      const budgetCap = safeNum(s?.constraints?.budget);
      if (budgetCap != null && budgetCap > 0){
        autoWhatTrue.push(`Stay within budget cap: $${fmtInt(Math.ceil(budgetCap))}.`);
      }
      const volunteerCap = safeNum(s?.constraints?.volunteerHrs);
      if (volunteerCap != null && volunteerCap > 0 && hrsPerWeek != null && isFinite(hrsPerWeek) && hrsPerWeek > volunteerCap){
        autoWhatTrue.push(`Resolve volunteer-hours constraint (needed ~${fmtInt(Math.ceil(hrsPerWeek))} hrs/week vs cap ${fmtInt(Math.ceil(volunteerCap))}).`);
      }
    }
    const whatTrue = explicitWhatTrue.length ? explicitWhatTrue : autoWhatTrue;
    const whatTrueLines = (whatTrue.length ? whatTrue : ["Review assumptions and constraints before sign-off."])
      .map((x) => `- [ ] ${x}`)
      .join("\n");

    const lines = [];
    lines.push(`# Decision Summary: ${s.name || s.id}`);
    lines.push(`Date: ${fmtISODate(new Date(s.createdAt || Date.now()))}`);
    lines.push(`Objective: ${(OBJECTIVE_TEMPLATES.find(x => x.key === s.objectiveKey)?.label) || s.objectiveKey || "—"}`);
    lines.push("");
    lines.push("## Recommendation");
    lines.push(`Recommended option: ${opt ? (opt.label || opt.id) : "—"}`);
    lines.push(`Option scenario: ${optScenarioId}${optRec?.name ? ` (${optRec.name})` : ""}`);
    lines.push(`Tactics tags: ${tacticsLine}`);
    lines.push("");
    lines.push("## Baseline vs Option (key deltas)");
    lines.push(`Attempts/week: ${fmtNum(attemptsWBase)} → ${fmtNum(attemptsWOpt)}${(deltaNum(attemptsWBase, attemptsWOpt) == null || deltaNum(attemptsWBase, attemptsWOpt) === 0) ? "" : ` (${(deltaNum(attemptsWBase, attemptsWOpt) > 0 ? "+" : "")}${fmtInt(Math.round(deltaNum(attemptsWBase, attemptsWOpt)))})`}`);
    lines.push(`Convos/week: ${fmtNum(convosWBase)} → ${fmtNum(convosWOpt)}${(deltaNum(convosWBase, convosWOpt) == null || deltaNum(convosWBase, convosWOpt) === 0) ? "" : ` (${(deltaNum(convosWBase, convosWOpt) > 0 ? "+" : "")}${fmtInt(Math.round(deltaNum(convosWBase, convosWOpt)))})`}`);
    lines.push(`Finish date (target): ${fmtDate(baseOut.finish)} → ${fmtDate(optOut.finish)}`);
    lines.push(`Execution status (this week): ${gapLine}`);
    lines.push("");
    lines.push("## What needs to be true");
    lines.push(whatTrueLines);
    lines.push("");
    lines.push("## Next 7 days (execution plan)");
    if (attemptsWOpt == null || !isFinite(attemptsWOpt)){
      lines.push("- Attempts/week: —");
    } else {
      lines.push(`- Attempts/week: ${fmtInt(Math.ceil(attemptsWOpt))} (~${fmtInt(Math.ceil(attemptsWOpt / 7))}/day)`);
    }
    if (doorsPerDay != null && callsPerDay != null){
      lines.push(`- Daily targets: ${fmtInt(Math.ceil(doorsPerDay))} doors/day · ${fmtInt(Math.ceil(callsPerDay))} calls/day`);
    } else {
      lines.push("- Daily targets: —");
    }
    if (hrsPerWeek != null && isFinite(hrsPerWeek)){
      lines.push(`- Estimated hours/week required: ${fmtInt(Math.ceil(hrsPerWeek))} hrs`);
    } else {
      lines.push("- Estimated hours/week required: —");
    }
    if (Array.isArray(s.nonNegotiables) && s.nonNegotiables.length){
      lines.push("");
      lines.push("## Non-negotiables");
      for (const x of s.nonNegotiables) lines.push(`- ${x}`);
    }

    return lines.join("\n");
  } catch {
    return "—";
  }
}

export function copyTextToClipboardCore(text){
  const s = String(text || "");
  if (!s) return Promise.resolve(false);
  if (navigator.clipboard && navigator.clipboard.writeText){
    return navigator.clipboard.writeText(s).then(() => true).catch(() => false);
  }
  try{
    const ta = document.createElement("textarea");
    ta.value = s;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return Promise.resolve(!!ok);
  } catch {
    return Promise.resolve(false);
  }
}

export function decisionSummaryPlainTextCore(markdown){
  const s = String(markdown || "");
  return s
    .replace(/^###\s+/gm, "")
    .replace(/^##\s+/gm, "")
    .replace(/^#\s+/gm, "")
    .replace(/^\-\s+/gm, "• ")
    .replace(/\*\*/g, "");
}

export function decisionSessionExportObjectCore(session, deps = {}){
  const s = session ? structuredClone(session) : null;
  if (!s) return null;
  const buildDecisionSummaryText = deps.buildDecisionSummaryText || (() => "");
  return {
    type: "decision_session",
    exportedAt: new Date().toISOString(),
    activeScenarioId: deps.activeScenarioId || null,
    session: s,
    summaryMarkdown: buildDecisionSummaryText(s),
  };
}

export function downloadJsonObjectCore(obj, filename){
  try{
    const name = String(filename || "decision-session.json");
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  } catch {
    // ignore
  }
}

export function renderDecisionSummaryPanelCore({
  els,
  session,
  decisionOptionDisplay,
  buildDecisionSummaryText,
}){
  if (!session) return;

  if (els.decisionRecommendSelect){
    els.decisionRecommendSelect.innerHTML = "";
    const options = (session.options && typeof session.options === "object") ? Object.values(session.options) : [];
    options.sort((a, b) => String(a?.createdAt || "").localeCompare(String(b?.createdAt || "")));
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "—";
    els.decisionRecommendSelect.appendChild(ph);
    for (const o of options){
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = decisionOptionDisplay(o);
      els.decisionRecommendSelect.appendChild(opt);
    }
    els.decisionRecommendSelect.value = session.recommendedOptionId || "";
  }

  if (els.decisionWhatTrue){
    const lines = Array.isArray(session.whatNeedsTrue) ? session.whatNeedsTrue : [];
    els.decisionWhatTrue.value = lines.join("\n");
  }

  if (els.decisionSummaryPreview){
    els.decisionSummaryPreview.value = buildDecisionSummaryText(session);
  }
}
