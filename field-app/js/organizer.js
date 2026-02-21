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
  btnClear: document.getElementById("btnClear"),
  entryMsg: document.getElementById("entryMsg"),
  logTbody: document.getElementById("logTbody"),
  lastUpdate: document.getElementById("lastUpdate"),
  btnExport: document.getElementById("btnExport"),
};

let state = loadState() || {};
if (!state.ui) state.ui = {};
if (!Array.isArray(state.ui.dailyLog)) state.ui.dailyLog = [];

let editingDate = null;

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeEntry(raw){
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

function upsertEntry(entry){
  const n = normalizeEntry(entry);
  if (!n) return { ok: false, msg: "Invalid entry (date required: YYYY-MM-DD)" };
  const log = Array.isArray(state.ui.dailyLog) ? state.ui.dailyLog : [];
  const idx = log.findIndex(x => String(x?.date).slice(0,10) === n.date);
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

function exportJson(){
  const log = Array.isArray(state.ui.dailyLog) ? state.ui.dailyLog : [];
  const payload = {
    dailyLog: log,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    buildId: BUILD_ID,
  };

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

function wire(){
  if (els.logDate && !els.logDate.value) els.logDate.value = todayISO();

  if (els.btnSaveEntry) els.btnSaveEntry.addEventListener("click", () => {
    const date = String(els.logDate?.value || "").slice(0,10);
    const doors = safeNum(els.logDoors?.value) || 0;
    const calls = safeNum(els.logCalls?.value) || 0;
    const convos = safeNum(els.logConvos?.value) || 0;
    const supportIds = safeNum(els.logSupportIds?.value) || 0;
    const orgHours = safeNum(els.logOrgHours?.value) || 0;
    const volsActive = safeNum(els.logVols?.value) || 0;
    const notes = String(els.logNotes?.value || "");
    const attempts = doors + calls;

    const r = upsertEntry({ date, doors, calls, attempts, convos, supportIds, orgHours, volsActive, notes });
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
  if (els.btnExport) els.btnExport.addEventListener("click", () => { exportJson(); });

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
