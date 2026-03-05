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
