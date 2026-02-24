import { safeNum } from "./utils.js";
import { loadState, saveState } from "./storage.js";
import { APP_VERSION, BUILD_ID } from "./build.js";

const els = {
  logDate: document.getElementById("logDate"),
  logDoors: document.getElementById("logDoors"),
  logCalls: document.getElementById("logCalls"),
  logConvos: document.getElementById("logConvos"),
  logSupportIds: document.getElementById("logSupportIds"),
  logOrgHours: document.getElementById("logOrgHours"),
  logVols: document.getElementById("logVols"),
  logNotes: document.getElementById("logNotes"),
  btnSaveEntry: document.getElementById("btnSaveEntry"),
  btnDupYesterday: document.getElementById("btnDupYesterday"),
  btnClear: document.getElementById("btnClear"),
  entryMsg: document.getElementById("entryMsg"),
  logTbody: document.getElementById("logTbody"),
  lastUpdate: document.getElementById("lastUpdate"),
  missingDays: document.getElementById("missingDays"),
  btnCopyJson: document.getElementById("btnCopyJson"),
  btnDownloadJson: document.getElementById("btnDownloadJson"),
  btnPreviewShiftSync: document.getElementById("btnPreviewShiftSync"),
  btnApplyShiftSync: document.getElementById("btnApplyShiftSync"),
  shiftSyncOverwrite: document.getElementById("shiftSyncOverwrite"),
  shiftSyncStatus: document.getElementById("shiftSyncStatus"),
  shiftSyncPreview: document.getElementById("shiftSyncPreview"),
};

let state = loadState() || {};
if (!state.ui) state.ui = {};
if (!Array.isArray(state.ui.dailyLog)) state.ui.dailyLog = [];

let editingDate = null;
let shiftSyncPlan = null;
let operationsApiPromise = null;

const SHIFT_SYNC_TAG = "[sync:operations-shifts]";

function isISODate(s){
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").slice(0,10));
}

function asNonNegInt(v){
  const n = safeNum(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function asNonNegNum(v){
  const n = safeNum(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isoToDate(iso){
  if (!isISODate(iso)) return null;
  const [y,m,d] = iso.split("-").map(x => Number(x));
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (!Number.isFinite(dt.getTime())) return null;
  return dt;
}

function dateToISO(dt){
  if (!(dt instanceof Date) || !Number.isFinite(dt.getTime())) return "";
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysISO(iso, delta){
  const dt = isoToDate(iso);
  if (!dt) return "";
  dt.setUTCDate(dt.getUTCDate() + (Number(delta) || 0));
  return dateToISO(dt);
}

function clean(v){
  return String(v == null ? "" : v).trim();
}

function isoFromAnyDate(raw){
  const s = clean(raw);
  if (!s) return "";
  if (isISODate(s)) return s.slice(0, 10);
  const ts = Date.parse(s);
  if (!Number.isFinite(ts)) return "";
  return dateToISO(new Date(ts));
}

function shiftModeBucket(mode){
  const m = clean(mode).toLowerCase();
  if (!m || m === "door" || m === "doors") return "doors";
  if (m === "call" || m === "calls" || m === "phone" || m === "phonebank") return "calls";
  return "";
}

function shiftHours(raw){
  const start = Date.parse(clean(raw?.checkInAt) || clean(raw?.startAt));
  const end = Date.parse(clean(raw?.checkOutAt) || clean(raw?.endAt));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return (end - start) / 3600000;
}

function stripSyncNote(notes){
  const parts = clean(notes)
    .split("|")
    .map((p) => clean(p))
    .filter(Boolean)
    .filter((p) => !p.includes(SHIFT_SYNC_TAG));
  return parts.join(" | ");
}

function migrateLegacyShiftSyncTags(){
  const log = Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : [];
  let changed = false;
  const migrated = log.map((raw) => {
    const n = normalizeEntry(raw);
    if (!n) return raw;
    const notes = String(n.notes || "");
    const normalizedNotes = notes.replace(/\[sync:[^\]]*shifts\]/g, SHIFT_SYNC_TAG);
    if (normalizedNotes === notes) return n;
    changed = true;
    return { ...n, notes: normalizedNotes, updatedAt: Date.now() };
  });
  if (!changed) return;
  state.ui.dailyLog = migrated;
  persist();
}

function combineManualAndSyncNotes(existingNotes, syncNote){
  const manual = stripSyncNote(existingNotes);
  if (manual && syncNote) return `${manual} | ${syncNote}`;
  return syncNote || manual || "";
}

function normalizeEntry(raw){
  if (!raw || typeof raw !== "object") return null;
  const date = String(raw.date || "").slice(0, 10);
  if (!isISODate(date)) return null;
  const doors = asNonNegInt(raw.doors);
  const calls = asNonNegInt(raw.calls);
  const convos = asNonNegInt(raw.convos);
  const supportIds = asNonNegInt(raw.supportIds);
  const orgHours = asNonNegNum(raw.orgHours);
  const volsActive = asNonNegInt(raw.volsActive);
  const attempts = (raw.attempts != null && raw.attempts !== "") ? (safeNum(raw.attempts) || 0) : (doors + calls);
  const notes = (raw.notes == null) ? "" : String(raw.notes);
  const updatedAt = Number(raw.updatedAt || 0) || 0;
  return { date, doors, calls, attempts: asNonNegInt(attempts), convos, supportIds, orgHours, volsActive, notes, updatedAt };
}

function persist(){
  saveState(state);
}

function setMsg(text){
  if (els.entryMsg) els.entryMsg.textContent = text || "";
}

function setShiftSyncStatus(text){
  if (els.shiftSyncStatus) els.shiftSyncStatus.textContent = text || "";
}

function setShiftSyncPreview(text){
  if (els.shiftSyncPreview) els.shiftSyncPreview.textContent = text || "";
}

async function loadOperationsApi(){
  if (operationsApiPromise) return operationsApiPromise;
  operationsApiPromise = import("./features/operations/store.js")
    .then((mod) => mod || null)
    .catch(() => null);
  return operationsApiPromise;
}

function aggregateShiftRecordsByDate(shiftRecords){
  const rows = Array.isArray(shiftRecords) ? shiftRecords : [];
  const byDate = new Map();
  let skippedNoDate = 0;
  let skippedUnsupportedModeShifts = 0;
  let skippedUnsupportedModeAttempts = 0;
  let clampedConvos = 0;
  let clampedSupportIds = 0;

  for (const rec of rows){
    const date = isoFromAnyDate(rec?.date || rec?.checkInAt || rec?.startAt || rec?.endAt);
    if (!date){
      skippedNoDate += 1;
      continue;
    }

    const mode = shiftModeBucket(rec?.mode);
    const attempts = asNonNegInt(rec?.attempts);
    if (!mode){
      skippedUnsupportedModeShifts += 1;
      skippedUnsupportedModeAttempts += attempts;
      continue;
    }

    const convos = asNonNegInt(rec?.convos);
    const supportIds = asNonNegInt(rec?.supportIds);
    const hours = asNonNegNum(shiftHours(rec));

    const day = byDate.get(date) || {
      date,
      doors: 0,
      calls: 0,
      convos: 0,
      supportIds: 0,
      orgHours: 0,
      shiftCount: 0,
    };

    day[mode] += attempts;
    day.convos += convos;
    day.supportIds += supportIds;
    day.orgHours += hours;
    day.shiftCount += 1;
    byDate.set(date, day);
  }

  const dayRows = Array.from(byDate.values())
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((day) => {
      const attempts = asNonNegInt(day.doors + day.calls);
      let convos = asNonNegInt(day.convos);
      let supportIds = asNonNegInt(day.supportIds);
      if (convos > attempts){
        clampedConvos += (convos - attempts);
        convos = attempts;
      }
      if (supportIds > convos){
        clampedSupportIds += (supportIds - convos);
        supportIds = convos;
      }
      return {
        date: day.date,
        doors: asNonNegInt(day.doors),
        calls: asNonNegInt(day.calls),
        attempts,
        convos,
        supportIds,
        orgHours: Number(asNonNegNum(day.orgHours).toFixed(2)),
        shiftCount: asNonNegInt(day.shiftCount),
      };
    });

  return {
    sourceShiftCount: rows.length,
    dayRows,
    skippedNoDate,
    skippedUnsupportedModeShifts,
    skippedUnsupportedModeAttempts,
    clampedConvos,
    clampedSupportIds,
  };
}

function buildShiftSyncPlan(agg, opts = {}){
  const overwrite = Boolean(opts.overwrite);
  const currentLog = Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : [];
  const existingByDate = new Map();
  for (const raw of currentLog){
    const n = normalizeEntry(raw);
    if (n) existingByDate.set(n.date, n);
  }

  const entries = [];
  let createCount = 0;
  let overwriteCount = 0;
  let skippedExistingCount = 0;
  let candidateOverwriteCount = 0;

  for (const day of agg.dayRows){
    const prev = existingByDate.get(day.date) || null;
    const syncNote = `${SHIFT_SYNC_TAG} shifts:${day.shiftCount} attempts:${day.attempts}`;
    const next = normalizeEntry({
      date: day.date,
      doors: day.doors,
      calls: day.calls,
      attempts: day.attempts,
      convos: day.convos,
      supportIds: day.supportIds,
      orgHours: day.orgHours,
      volsActive: prev ? asNonNegInt(prev.volsActive) : 0,
      notes: combineManualAndSyncNotes(prev?.notes, syncNote),
      updatedAt: Date.now(),
    });
    if (!next) continue;

    if (prev){
      candidateOverwriteCount += 1;
      if (!overwrite){
        skippedExistingCount += 1;
        continue;
      }
      overwriteCount += 1;
      entries.push({ mode: "overwrite", entry: next });
      continue;
    }

    createCount += 1;
    entries.push({ mode: "create", entry: next });
  }

  return {
    overwriteEnabled: overwrite,
    sourceShiftCount: agg.sourceShiftCount,
    aggregatedDayCount: agg.dayRows.length,
    createCount,
    overwriteCount,
    candidateOverwriteCount,
    skippedExistingCount,
    skippedNoDate: agg.skippedNoDate,
    skippedUnsupportedModeShifts: agg.skippedUnsupportedModeShifts,
    skippedUnsupportedModeAttempts: agg.skippedUnsupportedModeAttempts,
    clampedConvos: agg.clampedConvos,
    clampedSupportIds: agg.clampedSupportIds,
    applyCount: entries.length,
    entries,
  };
}

function renderShiftSyncPlan(plan){
  if (!plan){
    if (els.btnApplyShiftSync) els.btnApplyShiftSync.disabled = true;
    setShiftSyncStatus("No preview yet.");
    setShiftSyncPreview("Guardrails: no silent writes, no auto-sync, no overwrite unless checked.");
    return;
  }

  if (els.btnApplyShiftSync) els.btnApplyShiftSync.disabled = plan.applyCount === 0;
  const modeText = plan.overwriteEnabled ? "Overwrite ON" : "Overwrite OFF";
  const status = `${modeText} · Source shifts ${plan.sourceShiftCount} · Shift-days ${plan.aggregatedDayCount} · Creates ${plan.createCount} · Applies ${plan.applyCount}`;
  const preview = [
    `Overwrite candidates: ${plan.candidateOverwriteCount}`,
    `Skipped existing: ${plan.skippedExistingCount}`,
    `Skipped unsupported modes: ${plan.skippedUnsupportedModeShifts} shifts (${plan.skippedUnsupportedModeAttempts} attempts)`,
    `Skipped missing dates: ${plan.skippedNoDate}`,
    `Clamped convos/support: ${plan.clampedConvos}/${plan.clampedSupportIds}`,
  ].join(" · ");

  setShiftSyncStatus(status);
  setShiftSyncPreview(preview);
}

async function previewShiftSync(){
  setShiftSyncStatus("Building shift sync preview...");
  setShiftSyncPreview("");

  const api = await loadOperationsApi();
  if (!api || typeof api.getAll !== "function"){
    shiftSyncPlan = null;
    renderShiftSyncPlan(null);
    setShiftSyncStatus("Operations store not available in this build.");
    return null;
  }

  const shifts = await api.getAll("shiftRecords");
  const agg = aggregateShiftRecordsByDate(shifts);
  shiftSyncPlan = buildShiftSyncPlan(agg, {
    overwrite: Boolean(els.shiftSyncOverwrite?.checked),
  });
  renderShiftSyncPlan(shiftSyncPlan);
  return shiftSyncPlan;
}

function applyShiftSyncPlan(plan){
  if (!plan || !Array.isArray(plan.entries) || plan.entries.length === 0){
    return { ok: false, msg: "Nothing to apply from preview." };
  }

  const normalized = (Array.isArray(state.ui?.dailyLog) ? state.ui.dailyLog : [])
    .map(normalizeEntry)
    .filter(Boolean);
  const idxByDate = new Map(normalized.map((e, idx) => [e.date, idx]));
  let created = 0;
  let overwritten = 0;

  for (const row of plan.entries){
    const entry = normalizeEntry(row?.entry);
    if (!entry) continue;
    const idx = idxByDate.get(entry.date);
    if (idx == null){
      idxByDate.set(entry.date, normalized.length);
      normalized.push(entry);
      created += 1;
      continue;
    }
    normalized[idx] = {
      ...normalized[idx],
      ...entry,
      volsActive: asNonNegInt(normalized[idx]?.volsActive),
      notes: entry.notes,
      updatedAt: Date.now(),
    };
    overwritten += 1;
  }

  state.ui.dailyLog = normalized.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  persist();
  renderTable();
  return { ok: true, created, overwritten };
}

function clearForm(){
  editingDate = null;
  els.logDate.value = todayISO();
  els.logDoors.value = "";
  els.logCalls.value = "";
  els.logConvos.value = "";
  els.logSupportIds.value = "";
  els.logOrgHours.value = "";
  els.logVols.value = "";
  els.logNotes.value = "";
  setMsg("");
  if (els.btnSaveEntry) els.btnSaveEntry.textContent = "Save entry";
}

function upsertEntry(entry, opts = {}){
  const n = normalizeEntry(entry);
  if (!n) return { ok: false, msg: "Invalid entry (date required: YYYY-MM-DD)" };
  const log = Array.isArray(state.ui.dailyLog) ? state.ui.dailyLog : [];
  const idx = log.findIndex(x => String(x?.date).slice(0,10) === n.date);

  if (n.attempts < 0 || n.convos < 0 || n.supportIds < 0 || n.doors < 0 || n.calls < 0 || n.volsActive < 0 || n.orgHours < 0){
    return { ok: false, msg: "Numbers cannot be negative" };
  }
  if (n.convos > n.attempts){
    return { ok: false, msg: "Conversations cannot exceed attempts" };
  }
  if (n.supportIds > n.convos){
    return { ok: false, msg: "Support IDs cannot exceed conversations" };
  }

  const isEditSave = Boolean(opts.isEditSave);
  const allowOverwrite = Boolean(opts.allowOverwrite);

  if (idx !== -1 && !isEditSave && !allowOverwrite){
    return { ok: false, msg: "Entry already exists for that date" };
  }
  const nowTs = Date.now();
  n.updatedAt = nowTs;
  if (idx === -1){
    state.ui.dailyLog = [...log, n].sort((a,b) => String(a.date).localeCompare(String(b.date)));
    persist();
    return { ok: true, msg: "Saved" };
  }
  const prev = normalizeEntry(log[idx]) || { date: n.date };
  // Preserve max updatedAt (but we always set to now)
  state.ui.dailyLog[idx] = { ...prev, ...n };
  state.ui.dailyLog = state.ui.dailyLog.sort((a,b) => String(a.date).localeCompare(String(b.date)));
  persist();
  return { ok: true, msg: "Updated" };
}

function deleteEntry(date){
  const log = Array.isArray(state.ui.dailyLog) ? state.ui.dailyLog : [];
  state.ui.dailyLog = log.filter(x => String(x?.date).slice(0,10) !== date);
  persist();
}

function renderTable(){
  const log = Array.isArray(state.ui.dailyLog) ? state.ui.dailyLog : [];
  const sorted = [...log].map(normalizeEntry).filter(Boolean).sort((a,b) => String(b.date).localeCompare(String(a.date)));

  if (els.logTbody){
    els.logTbody.innerHTML = "";
    for (const e of sorted){
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><button class="link" data-edit="1" data-date="${e.date}">${e.date}</button></td>
        <td>${Math.round(e.attempts || 0)}</td>
        <td>${Math.round(e.convos || 0)}</td>
        <td>${Math.round(e.supportIds || 0)}</td>
        <td>${e.orgHours ? e.orgHours : 0}</td>
        <td>${Math.round(e.volsActive || 0)}</td>
        <td>
          <button class="btn btn-sm btn-ghost" data-del="1" data-date="${e.date}">Delete</button>
        </td>
      `;
      els.logTbody.appendChild(tr);
    }
  }

  const last = sorted[0];
  if (els.lastUpdate) els.lastUpdate.textContent = last?.date || "—";

  if (els.missingDays){
    els.missingDays.textContent = formatMissingDays(log);
  }
}

function formatMissingDays(log){
  const dates = (Array.isArray(log) ? log : []).map(x => String(x?.date).slice(0,10)).filter(isISODate);
  const uniq = Array.from(new Set(dates)).sort((a,b) => a.localeCompare(b));
  if (uniq.length < 2) return "—";
  const start = uniq[0];
  const end = uniq[uniq.length - 1];
  let cur = start;
  const have = new Set(uniq);
  const missing = [];
  while (cur && cur <= end){
    if (!have.has(cur)) missing.push(cur);
    const next = addDaysISO(cur, 1);
    if (!next || next === cur) break;
    cur = next;
  }
  if (missing.length === 0) return "None";
  const ranges = [];
  let i = 0;
  while (i < missing.length){
    const a = missing[i];
    let b = a;
    while (i + 1 < missing.length && addDaysISO(b, 1) === missing[i + 1]){
      b = missing[i + 1];
      i++;
    }
    ranges.push(a === b ? a : `${a}–${b}`);
    i++;
  }
  const preview = ranges.slice(0, 4).join(", ");
  const more = ranges.length > 4 ? ` +${ranges.length - 4} more` : "";
  return `${missing.length} (${preview}${more})`;
}

function duplicateYesterdayIntoForm(){
  const date = String(els.logDate?.value || "").slice(0,10);
  if (!isISODate(date)){
    setMsg("Set a date first");
    return;
  }
  if (editingDate){
    setMsg("Clear editing before duplicating yesterday");
    return;
  }
  const y = addDaysISO(date, -1);
  if (!y){
    setMsg("Invalid date");
    return;
  }
  const log = Array.isArray(state.ui.dailyLog) ? state.ui.dailyLog : [];
  const src = log.map(normalizeEntry).filter(Boolean).find(x => x.date === y);
  if (!src){
    setMsg(`No entry found for ${y}`);
    return;
  }
  els.logDoors.value = String(src.doors || 0);
  els.logCalls.value = String(src.calls || 0);
  els.logConvos.value = String(src.convos || 0);
  els.logSupportIds.value = String(src.supportIds || 0);
  els.logOrgHours.value = String(src.orgHours || 0);
  els.logVols.value = String(src.volsActive || 0);
  els.logNotes.value = "";
  setMsg(`Duplicated ${y} into ${date}`);
}

function fillFormForDate(date){
  const log = Array.isArray(state.ui.dailyLog) ? state.ui.dailyLog : [];
  const e = log.map(normalizeEntry).filter(Boolean).find(x => x.date === date);
  if (!e) return;
  editingDate = e.date;
  els.logDate.value = e.date;
  els.logDoors.value = String(e.doors || 0);
  els.logCalls.value = String(e.calls || 0);
  els.logConvos.value = String(e.convos || 0);
  els.logSupportIds.value = String(e.supportIds || 0);
  els.logOrgHours.value = String(e.orgHours || 0);
  els.logVols.value = String(e.volsActive || 0);
  els.logNotes.value = e.notes || "";
  if (els.btnSaveEntry) els.btnSaveEntry.textContent = "Update entry";
  setMsg(`Editing ${e.date}`);
}

function buildExportPayload(){
  const log = Array.isArray(state.ui.dailyLog) ? state.ui.dailyLog : [];
  return {
    dailyLog: log,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    buildId: BUILD_ID,
  };
}

function downloadJson(payload){
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "daily-log.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function copyJson(payload){
  const text = JSON.stringify(payload, null, 2);
  try{
    if (navigator?.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }
  } catch {
    // fall through
  }
  try{
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "readonly");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return { ok };
  } catch {
    return { ok: false };
  }
}

function wire(){
  if (els.logDate && !els.logDate.value) els.logDate.value = todayISO();

  if (els.btnSaveEntry) els.btnSaveEntry.addEventListener("click", () => {
    const date = String(els.logDate?.value || "").slice(0,10);
    if (!isISODate(date)){
      setMsg("Date is required");
      return;
    }

    if (editingDate && editingDate !== date){
      setMsg("While editing, date is locked. Clear to start a new entry.");
      return;
    }

    const doors = asNonNegInt(els.logDoors?.value);
    const calls = asNonNegInt(els.logCalls?.value);
    const convos = asNonNegInt(els.logConvos?.value);
    const supportIds = asNonNegInt(els.logSupportIds?.value);
    const orgHours = asNonNegNum(els.logOrgHours?.value);
    const volsActive = asNonNegInt(els.logVols?.value);
    const notes = String(els.logNotes?.value || "");
    const attempts = doors + calls;

    if (convos > attempts){
      setMsg("Conversations cannot exceed attempts");
      return;
    }
    if (supportIds > convos){
      setMsg("Support IDs cannot exceed conversations");
      return;
    }

    const log = Array.isArray(state.ui.dailyLog) ? state.ui.dailyLog : [];
    const exists = log.some(x => String(x?.date).slice(0,10) === date);
    let allowOverwrite = false;
    if (exists && !editingDate){
      allowOverwrite = window.confirm(`An entry already exists for ${date}. Overwrite it?`);
      if (!allowOverwrite){
        setMsg("Not saved");
        return;
      }
    }

    const r = upsertEntry(
      { date, doors, calls, attempts, convos, supportIds, orgHours, volsActive, notes },
      { isEditSave: Boolean(editingDate), allowOverwrite }
    );
    setMsg(r.msg);
    renderTable();
    if (r.ok){
      // Keep date, clear other fields for next day
      if (!editingDate) {
        els.logDoors.value = "";
        els.logCalls.value = "";
        els.logConvos.value = "";
        els.logSupportIds.value = "";
        els.logOrgHours.value = "";
        els.logVols.value = "";
        els.logNotes.value = "";
      }
      editingDate = null;
      if (els.btnSaveEntry) els.btnSaveEntry.textContent = "Save entry";
    }
  });

  if (els.btnClear) els.btnClear.addEventListener("click", () => { clearForm(); });
  if (els.btnDupYesterday) els.btnDupYesterday.addEventListener("click", () => { duplicateYesterdayIntoForm(); });
  if (els.btnDownloadJson) els.btnDownloadJson.addEventListener("click", () => {
    downloadJson(buildExportPayload());
    setMsg("Downloaded JSON");
  });
  if (els.btnCopyJson) els.btnCopyJson.addEventListener("click", async () => {
    const r = await copyJson(buildExportPayload());
    setMsg(r.ok ? "Copied JSON" : "Copy failed");
  });
  if (els.shiftSyncOverwrite) els.shiftSyncOverwrite.addEventListener("change", () => {
    shiftSyncPlan = null;
    renderShiftSyncPlan(null);
    setShiftSyncStatus("Overwrite option changed. Run preview again.");
  });
  if (els.btnPreviewShiftSync) els.btnPreviewShiftSync.addEventListener("click", async () => {
    try{
      const plan = await previewShiftSync();
      if (!plan){
        setMsg("Shift sync preview unavailable");
        return;
      }
      setMsg(`Shift sync preview ready (${plan.applyCount} day rows to apply).`);
    } catch (err){
      shiftSyncPlan = null;
      renderShiftSyncPlan(null);
      setShiftSyncStatus(err?.message ? String(err.message) : "Shift sync preview failed.");
      setMsg("Shift sync preview failed");
    }
  });
  if (els.btnApplyShiftSync) els.btnApplyShiftSync.addEventListener("click", async () => {
    try{
      let plan = shiftSyncPlan;
      if (!plan) plan = await previewShiftSync();
      if (!plan || plan.applyCount === 0){
        setMsg("Nothing to apply from shift sync");
        return;
      }
      if (plan.overwriteEnabled && plan.overwriteCount > 0){
        const ok = window.confirm(`Overwrite ${plan.overwriteCount} existing day entries from Operations shifts?`);
        if (!ok){
          setMsg("Shift sync cancelled");
          return;
        }
      }
      const result = applyShiftSyncPlan(plan);
      if (!result.ok){
        setMsg(result.msg || "Shift sync failed");
        return;
      }
      setMsg(`Shift sync applied: ${result.created} created, ${result.overwritten} overwritten.`);
      await previewShiftSync();
    } catch (err){
      setMsg(err?.message ? String(err.message) : "Shift sync apply failed.");
    }
  });

  if (els.logTbody) els.logTbody.addEventListener("click", (e) => {
    const t = e?.target;
    if (!t || !t.getAttribute) return;
    if (t.getAttribute("data-edit") === "1"){
      const date = t.getAttribute("data-date");
      if (date) fillFormForDate(date);
      return;
    }
    if (t.getAttribute("data-del") === "1"){
      const date = t.getAttribute("data-date");
      if (!date) return;
      deleteEntry(date);
      renderTable();
      if (editingDate === date) clearForm();
      setMsg(`Deleted ${date}`);
      return;
    }
  });
}

wire();
migrateLegacyShiftSyncTags();
renderTable();
renderShiftSyncPlan(null);
