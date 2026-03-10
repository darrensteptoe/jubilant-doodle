// @ts-check
import { readJsonFile } from "./utils.js";
import { ensureOperationsDefaults, getAll, put, remove, makeOperationsId } from "./features/operations/store.js";
import { downloadOperationsSnapshot, importOperationsSnapshot, downloadStoreCsv, importStoreCsv } from "./features/operations/io.js";

const els = {
  shiftDate: document.getElementById("shiftDate"),
  shiftPersonId: document.getElementById("shiftPersonId"),
  shiftOffice: document.getElementById("shiftOffice"),
  shiftMode: document.getElementById("shiftMode"),
  shiftTurfId: document.getElementById("shiftTurfId"),
  shiftAttempts: document.getElementById("shiftAttempts"),
  shiftConvos: document.getElementById("shiftConvos"),
  shiftSupportIds: document.getElementById("shiftSupportIds"),
  shiftStartTime: document.getElementById("shiftStartTime"),
  shiftEndTime: document.getElementById("shiftEndTime"),
  shiftCheckInTime: document.getElementById("shiftCheckInTime"),
  shiftCheckOutTime: document.getElementById("shiftCheckOutTime"),
  btnSaveShift: document.getElementById("btnSaveShift"),
  btnClearShift: document.getElementById("btnClearShift"),
  shiftMsg: document.getElementById("shiftMsg"),
  shiftTbody: document.getElementById("shiftTbody"),
  countShifts: document.getElementById("countShifts"),
  sumAttempts: document.getElementById("sumAttempts"),
  sumHours: document.getElementById("sumHours"),
  btnExportJson: document.getElementById("btnExportJson"),
  btnImportJson: document.getElementById("btnImportJson"),
  btnExportCsv: document.getElementById("btnExportCsv"),
  btnImportCsv: document.getElementById("btnImportCsv"),
  importJsonFile: document.getElementById("importJsonFile"),
  importCsvFile: document.getElementById("importCsvFile"),
  ioMsg: document.getElementById("ioMsg"),
};

let editingShiftId = "";

function nowIso(){
  return new Date().toISOString();
}

function todayIso(){
  return nowIso().slice(0, 10);
}

function clean(v){
  return String(v || "").trim();
}

function asInt(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function setMsg(el, text){
  if (el) el.textContent = text || "";
}

function combineDateAndTime(dateIso, hhmm){
  const d = clean(dateIso);
  const t = clean(hhmm);
  if (!d || !t) return "";
  const dt = new Date(`${d}T${t}`);
  if (!Number.isFinite(dt.getTime())) return "";
  return dt.toISOString();
}

function localTimeFromIso(iso){
  const dt = new Date(String(iso || ""));
  if (!Number.isFinite(dt.getTime())) return "";
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function hoursForShift(rec){
  const start = Date.parse(clean(rec?.checkInAt) || clean(rec?.startAt));
  const end = Date.parse(clean(rec?.checkOutAt) || clean(rec?.endAt));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return (end - start) / 3600000;
}

async function loadData(){
  const [persons, shifts] = await Promise.all([
    getAll("persons"),
    getAll("shiftRecords"),
  ]);
  return {
    persons: Array.isArray(persons) ? persons : [],
    shifts: Array.isArray(shifts) ? shifts : [],
  };
}

function personLabel(p){
  const name = clean(p?.name) || "Unknown";
  const office = clean(p?.office);
  return office ? `${name} (${office})` : name;
}

function fillPersonSelect(persons){
  if (!els.shiftPersonId) return;
  const rows = (Array.isArray(persons) ? persons : []).slice().sort((a, b) => personLabel(a).localeCompare(personLabel(b)));
  const prev = clean(els.shiftPersonId.value);
  els.shiftPersonId.innerHTML = "";

  const optNone = document.createElement("option");
  optNone.value = "";
  optNone.textContent = "Unassigned";
  els.shiftPersonId.appendChild(optNone);

  for (const p of rows){
    const opt = document.createElement("option");
    opt.value = clean(p?.id);
    opt.textContent = personLabel(p);
    els.shiftPersonId.appendChild(opt);
  }

  if (prev && rows.some((p) => clean(p?.id) === prev)){
    els.shiftPersonId.value = prev;
  }
}

function clearForm(){
  editingShiftId = "";
  if (els.shiftDate) els.shiftDate.value = todayIso();
  if (els.shiftPersonId) els.shiftPersonId.value = "";
  if (els.shiftOffice) els.shiftOffice.value = "";
  if (els.shiftMode) els.shiftMode.value = "doors";
  if (els.shiftTurfId) els.shiftTurfId.value = "";
  if (els.shiftAttempts) els.shiftAttempts.value = "";
  if (els.shiftConvos) els.shiftConvos.value = "";
  if (els.shiftSupportIds) els.shiftSupportIds.value = "";
  if (els.shiftStartTime) els.shiftStartTime.value = "";
  if (els.shiftEndTime) els.shiftEndTime.value = "";
  if (els.shiftCheckInTime) els.shiftCheckInTime.value = "";
  if (els.shiftCheckOutTime) els.shiftCheckOutTime.value = "";
  if (els.btnSaveShift) els.btnSaveShift.textContent = "Save shift";
  setMsg(els.shiftMsg, "");
}

async function saveShift(){
  const date = clean(els.shiftDate?.value) || todayIso();
  const personId = clean(els.shiftPersonId?.value);
  const attempts = asInt(els.shiftAttempts?.value);
  const convos = asInt(els.shiftConvos?.value);
  const supportIds = asInt(els.shiftSupportIds?.value);

  if (convos > attempts){
    setMsg(els.shiftMsg, "Conversations cannot exceed attempts.");
    return;
  }
  if (supportIds > convos){
    setMsg(els.shiftMsg, "Support IDs cannot exceed conversations.");
    return;
  }

  const { persons, shifts } = await loadData();
  const person = persons.find((p) => clean(p?.id) === personId) || null;
  const stamp = nowIso();

  const rec = {
    id: editingShiftId || makeOperationsId("shift"),
    personId,
    date,
    mode: clean(els.shiftMode?.value) || "doors",
    startAt: combineDateAndTime(date, clean(els.shiftStartTime?.value)),
    endAt: combineDateAndTime(date, clean(els.shiftEndTime?.value)),
    checkInAt: combineDateAndTime(date, clean(els.shiftCheckInTime?.value)),
    checkOutAt: combineDateAndTime(date, clean(els.shiftCheckOutTime?.value)),
    turfId: clean(els.shiftTurfId?.value),
    attempts,
    convos,
    supportIds,
    office: clean(els.shiftOffice?.value) || clean(person?.office),
    updatedAt: stamp,
  };

  const existing = shifts.find((s) => clean(s?.id) === clean(rec.id));
  rec.createdAt = clean(existing?.createdAt) || stamp;

  await put("shiftRecords", rec);
  setMsg(els.shiftMsg, existing ? "Shift updated." : "Shift saved.");
  clearForm();
  await renderShifts();
}

function formatNum(n){
  return String(Number.isFinite(n) ? n : 0);
}

function buildRow(rec, personMap){
  const tr = document.createElement("tr");
  const person = personMap.get(clean(rec?.personId));
  const hours = hoursForShift(rec);

  tr.innerHTML = `
    <td>${clean(rec?.date) || "-"}</td>
    <td>${clean(person?.name) || "Unassigned"}</td>
    <td>${clean(rec?.mode) || "-"}</td>
    <td>${clean(rec?.turfId) || "-"}</td>
    <td class="num">${formatNum(asInt(rec?.attempts))}</td>
    <td class="num">${formatNum(asInt(rec?.convos))}</td>
    <td class="num">${formatNum(asInt(rec?.supportIds))}</td>
    <td class="num">${hours.toFixed(2)}</td>
    <td>
      <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${clean(rec?.id)}" type="button">Edit</button>
      <button class="btn btn-sm btn-ghost" data-action="delete" data-id="${clean(rec?.id)}" type="button">Delete</button>
    </td>
  `;
  return tr;
}

function populateFormFromRecord(rec, personMap){
  editingShiftId = clean(rec?.id);
  if (els.shiftDate) els.shiftDate.value = clean(rec?.date) || todayIso();
  if (els.shiftPersonId) els.shiftPersonId.value = clean(rec?.personId);
  if (els.shiftOffice) els.shiftOffice.value = clean(rec?.office) || clean(personMap.get(clean(rec?.personId))?.office);
  if (els.shiftMode) els.shiftMode.value = clean(rec?.mode) || "doors";
  if (els.shiftTurfId) els.shiftTurfId.value = clean(rec?.turfId);
  if (els.shiftAttempts) els.shiftAttempts.value = formatNum(asInt(rec?.attempts));
  if (els.shiftConvos) els.shiftConvos.value = formatNum(asInt(rec?.convos));
  if (els.shiftSupportIds) els.shiftSupportIds.value = formatNum(asInt(rec?.supportIds));
  if (els.shiftStartTime) els.shiftStartTime.value = localTimeFromIso(rec?.startAt);
  if (els.shiftEndTime) els.shiftEndTime.value = localTimeFromIso(rec?.endAt);
  if (els.shiftCheckInTime) els.shiftCheckInTime.value = localTimeFromIso(rec?.checkInAt);
  if (els.shiftCheckOutTime) els.shiftCheckOutTime.value = localTimeFromIso(rec?.checkOutAt);
  if (els.btnSaveShift) els.btnSaveShift.textContent = "Update shift";
  setMsg(els.shiftMsg, `Editing ${clean(rec?.date)} ${clean(personMap.get(clean(rec?.personId))?.name) || "Unassigned"}`);
}

async function renderShifts(){
  const { persons, shifts } = await loadData();
  fillPersonSelect(persons);

  const personMap = new Map(persons.map((p) => [clean(p?.id), p]));
  const rows = shifts.slice().sort((a, b) => {
    const d = clean(b?.date).localeCompare(clean(a?.date));
    if (d !== 0) return d;
    return clean(b?.updatedAt).localeCompare(clean(a?.updatedAt));
  });

  let totalAttempts = 0;
  let totalHours = 0;
  for (const rec of rows){
    totalAttempts += asInt(rec?.attempts);
    totalHours += hoursForShift(rec);
  }

  if (els.countShifts) els.countShifts.textContent = String(rows.length);
  if (els.sumAttempts) els.sumAttempts.textContent = String(totalAttempts);
  if (els.sumHours) els.sumHours.textContent = totalHours.toFixed(1);

  if (!els.shiftTbody) return;
  els.shiftTbody.innerHTML = "";

  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="muted" colspan="9">No shift records yet.</td>';
    els.shiftTbody.appendChild(tr);
    return;
  }

  for (const rec of rows){
    els.shiftTbody.appendChild(buildRow(rec, personMap));
  }
}

function wireInputActions(){
  if (els.btnSaveShift){
    els.btnSaveShift.addEventListener("click", async () => {
      try{
        await saveShift();
      } catch (e){
        setMsg(els.shiftMsg, e?.message ? String(e.message) : "Save failed.");
      }
    });
  }

  if (els.btnClearShift){
    els.btnClearShift.addEventListener("click", clearForm);
  }

  if (els.shiftPersonId && els.shiftOffice){
    els.shiftPersonId.addEventListener("change", async () => {
      const personId = clean(els.shiftPersonId.value);
      if (!personId) return;
      const persons = await getAll("persons");
      const person = (Array.isArray(persons) ? persons : []).find((p) => clean(p?.id) === personId);
      if (person && !clean(els.shiftOffice.value)){
        els.shiftOffice.value = clean(person.office);
      }
    });
  }
}

function wireTableActions(){
  if (!els.shiftTbody) return;
  els.shiftTbody.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("button[data-action]");
    if (!btn) return;

    const action = clean(btn.getAttribute("data-action"));
    const id = clean(btn.getAttribute("data-id"));
    if (!id) return;

    const { persons, shifts } = await loadData();
    const rec = shifts.find((s) => clean(s?.id) === id);
    if (!rec) return;

    if (action === "delete"){
      await remove("shiftRecords", id);
      setMsg(els.shiftMsg, "Shift deleted.");
      if (editingShiftId === id) clearForm();
      await renderShifts();
      return;
    }

    if (action === "edit"){
      const personMap = new Map((Array.isArray(persons) ? persons : []).map((p) => [clean(p?.id), p]));
      populateFormFromRecord(rec, personMap);
    }
  });
}

function wireIoActions(){
  if (els.btnExportJson){
    els.btnExportJson.addEventListener("click", async () => {
      try{
        await downloadOperationsSnapshot("operations-snapshot.json");
        setMsg(els.ioMsg, "Operations JSON exported.");
      } catch (e){
        setMsg(els.ioMsg, e?.message ? String(e.message) : "Export failed.");
      }
    });
  }

  if (els.btnImportJson && els.importJsonFile){
    els.btnImportJson.addEventListener("click", () => els.importJsonFile.click());
    els.importJsonFile.addEventListener("change", async () => {
      try{
        const file = els.importJsonFile.files?.[0];
        if (!file) return;
        const payload = await readJsonFile(file);
        await importOperationsSnapshot(payload, { mode: "merge" });
        setMsg(els.ioMsg, "Operations JSON imported (merge).");
        await renderShifts();
      } catch (e){
        setMsg(els.ioMsg, e?.message ? String(e.message) : "Import failed.");
      } finally {
        els.importJsonFile.value = "";
      }
    });
  }

  if (els.btnExportCsv){
    els.btnExportCsv.addEventListener("click", async () => {
      try{
        await downloadStoreCsv("shiftRecords", "shift-records.csv");
        setMsg(els.ioMsg, "Shifts CSV exported.");
      } catch (e){
        setMsg(els.ioMsg, e?.message ? String(e.message) : "CSV export failed.");
      }
    });
  }

  if (els.btnImportCsv && els.importCsvFile){
    els.btnImportCsv.addEventListener("click", () => els.importCsvFile.click());
    els.importCsvFile.addEventListener("change", async () => {
      try{
        const file = els.importCsvFile.files?.[0];
        if (!file) return;
        const text = await file.text();
        await importStoreCsv("shiftRecords", text, { mode: "merge" });
        setMsg(els.ioMsg, "Shifts CSV imported (merge).");
        await renderShifts();
      } catch (e){
        setMsg(els.ioMsg, e?.message ? String(e.message) : "CSV import failed.");
      } finally {
        els.importCsvFile.value = "";
      }
    });
  }
}

async function init(){
  await ensureOperationsDefaults();
  clearForm();
  await renderShifts();
  wireInputActions();
  wireTableActions();
  wireIoActions();
}

init().catch((e) => {
  setMsg(els.shiftMsg, e?.message ? String(e.message) : "Initialization failed.");
});
