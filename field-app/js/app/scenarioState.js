export function scenarioCloneCore(obj){
  try{
    if (typeof structuredClone === "function") return structuredClone(obj);
  } catch {}
  try{
    return JSON.parse(JSON.stringify(obj));
  } catch {
    if (obj && typeof obj === "object") return Array.isArray(obj) ? obj.slice() : { ...obj };
    return obj;
  }
}

export function scenarioInputsFromStateCore(src){
  const s = scenarioCloneCore(src);
  if (s && typeof s === "object"){
    delete s.ui;
    delete s.mcLast;
    delete s.mcLastHash;
  }
  return s;
}

export function scenarioOutputsFromStateCore(src){
  const ui = src?.ui || {};
  return {
    planMeta: scenarioCloneCore(ui.lastPlanMeta || {}),
    summary: scenarioCloneCore(ui.lastSummary || {}),
    timeline: scenarioCloneCore(ui.lastTimeline || {}),
    tlMeta: scenarioCloneCore(ui.lastTlMeta || {}),
    diagnostics: scenarioCloneCore(ui.lastDiagnostics || {}),
  };
}

