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
};

let state = loadState() || {};
if (!state.ui) state.ui = {};
if (!Array.isArray(state.ui.dailyLog)) state.ui.dailyLog = [];

let editingDate = null;

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
renderTable();
