export function normalizeDailyLogEntryCore(raw, { safeNum }){
  if (!raw || typeof raw !== "object") return null;
  const date = String(raw.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const doors = safeNum(raw.doors) || 0;
  const calls = safeNum(raw.calls) || 0;
  const convos = safeNum(raw.convos) || 0;
  const supportIds = safeNum(raw.supportIds) || 0;
  const orgHours = safeNum(raw.orgHours) || 0;
  const volsActive = safeNum(raw.volsActive) || 0;
  const attempts = (raw.attempts != null && raw.attempts !== "") ? (safeNum(raw.attempts) || 0) : (doors + calls);
  const notes = (raw.notes == null) ? "" : String(raw.notes);
  const updatedAt = Number(raw.updatedAt || 0) || 0;

  return { date, doors, calls, attempts, convos, supportIds, orgHours, volsActive, notes, updatedAt };
}

export function mergeDailyLogIntoStateCore(imported, {
  state,
  setState,
  markMcStale,
  normalizeDailyLogEntry
}){
  const arr = Array.isArray(imported)
    ? imported
    : (Array.isArray(imported?.dailyLog) ? imported.dailyLog
      : (Array.isArray(imported?.ui?.dailyLog) ? imported.ui.dailyLog : null));
  if (!arr) return { ok: false, msg: "No dailyLog array found in JSON" };

  if (!state.ui) state.ui = {};
  const existing = Array.isArray(state.ui.dailyLog) ? state.ui.dailyLog : [];

  const byDate = new Map();
  for (const e of existing){
    const n = normalizeDailyLogEntry(e);
    if (!n) continue;
    byDate.set(n.date, n);
  }

  let added = 0;
  let replaced = 0;
  let ignored = 0;

  for (const e of arr){
    const n = normalizeDailyLogEntry(e);
    if (!n){ ignored++; continue; }
    const prev = byDate.get(n.date);
    if (!prev){
      byDate.set(n.date, n);
      added++;
      continue;
    }
    // Prefer the most recently updated. If neither has updatedAt, prefer imported.
    const prevTs = Number(prev.updatedAt || 0) || 0;
    const nextTs = Number(n.updatedAt || 0) || 0;
    const takeImported = (nextTs >= prevTs);
    if (takeImported){
      byDate.set(n.date, n);
      replaced++;
    } else {
      ignored++;
    }
  }

  const merged = Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  // daily log changes should mark plan/MC as stale
  markMcStale();
  setState((s) => {
    if (!s.ui) s.ui = {};
    s.ui.dailyLog = merged;
  });

  return { ok: true, msg: `Merged daily log: ${added} new, ${replaced} updated, ${ignored} ignored` };
}

export function exportDailyLogCore({
  state,
  APP_VERSION,
  BUILD_ID,
  downloadText
}){
  const log = Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : [];
  const payload = {
    dailyLog: log,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    buildId: BUILD_ID,
  };
  downloadText(JSON.stringify(payload, null, 2), "daily-log.json", "application/json");
}
