// @ts-check
export function createMcStateController({
  els,
  getState,
  setHidden,
  normalizeDailyLogEntry,
  computeSnapshotHash,
} = {}){
  function markMcStale(){
    if (!els?.mcStale && !els?.mcStaleSidebar) return;
    const state = getState();
    if (state?.mcLast){
      setHidden(els.mcStale, false);
      setHidden(els.mcStaleSidebar, false);
    }
  }

  function clearMcStale(){
    if (!els?.mcStale && !els?.mcStaleSidebar) return;
    setHidden(els.mcStale, true);
    setHidden(els.mcStaleSidebar, true);
    if (els.mcStale){
      els.mcStale.classList.remove("warn", "ok");
      els.mcStale.classList.add("warn");
    }
    if (els.mcStaleSidebar){
      els.mcStaleSidebar.classList.remove("warn", "ok");
      els.mcStaleSidebar.classList.add("warn");
    }
  }

  function computeDailyLogHash(){
    const state = getState();
    const logs = Array.isArray(state?.dailyLog) ? state.dailyLog : [];
    const normalized = logs
      .map((entry) => normalizeDailyLogEntry(entry))
      .filter((entry) => entry && entry.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return computeSnapshotHash({ dailyLog: normalized });
  }

  return {
    markMcStale,
    clearMcStale,
    computeDailyLogHash,
  };
}
