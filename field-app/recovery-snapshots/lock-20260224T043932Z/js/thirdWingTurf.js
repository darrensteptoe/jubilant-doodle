import { readJsonFile } from "./utils.js";
import { ensureThirdWingDefaults, getAll, put, remove, makeThirdWingId } from "./features/thirdWing/store.js";
import { downloadThirdWingSnapshot, importThirdWingSnapshot, downloadStoreCsv, importStoreCsv } from "./features/thirdWing/io.js";

const els = {
  turfDate: document.getElementById("turfDate"),
  turfTurfId: document.getElementById("turfTurfId"),
  turfPrecinct: document.getElementById("turfPrecinct"),
  turfCounty: document.getElementById("turfCounty"),
  turfAssignedTo: document.getElementById("turfAssignedTo"),
  turfMode: document.getElementById("turfMode"),
  turfShiftId: document.getElementById("turfShiftId"),
  turfAttempts: document.getElementById("turfAttempts"),
  turfCanvassed: document.getElementById("turfCanvassed"),
  turfVbms: document.getElementById("turfVbms"),
  btnSaveTurf: document.getElementById("btnSaveTurf"),
  btnClearTurf: document.getElementById("btnClearTurf"),
  turfMsg: document.getElementById("turfMsg"),
  turfTbody: document.getElementById("turfTbody"),
  countEvents: document.getElementById("countEvents"),
  sumAttempts: document.getElementById("sumAttempts"),
  countPrecincts: document.getElementById("countPrecincts"),
  countTurfs: document.getElementById("countTurfs"),
  btnExportJson: document.getElementById("btnExportJson"),
  btnImportJson: document.getElementById("btnImportJson"),
  btnExportCsv: document.getElementById("btnExportCsv"),
  btnImportCsv: document.getElementById("btnImportCsv"),
  importJsonFile: document.getElementById("importJsonFile"),
  importCsvFile: document.getElementById("importCsvFile"),
  ioMsg: document.getElementById("ioMsg"),
};

let editingTurfId = "";

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

async function loadData(){
  const [persons, events] = await Promise.all([
    getAll("persons"),
    getAll("turfEvents"),
  ]);
  return {
    persons: Array.isArray(persons) ? persons : [],
    events: Array.isArray(events) ? events : [],
  };
}

function personLabel(p){
  const name = clean(p?.name) || "Unknown";
  const office = clean(p?.office);
  return office ? `${name} (${office})` : name;
}

function fillPersonSelect(persons){
  if (!els.turfAssignedTo) return;
  const rows = (Array.isArray(persons) ? persons : []).slice().sort((a, b) => personLabel(a).localeCompare(personLabel(b)));
  const prev = clean(els.turfAssignedTo.value);
  els.turfAssignedTo.innerHTML = "";

  const optNone = document.createElement("option");
  optNone.value = "";
  optNone.textContent = "Unassigned";
  els.turfAssignedTo.appendChild(optNone);

  for (const p of rows){
    const opt = document.createElement("option");
    opt.value = clean(p?.id);
    opt.textContent = personLabel(p);
    els.turfAssignedTo.appendChild(opt);
  }

  if (prev && rows.some((p) => clean(p?.id) === prev)){
    els.turfAssignedTo.value = prev;
  }
}

function clearForm(){
  editingTurfId = "";
  if (els.turfDate) els.turfDate.value = todayIso();
  if (els.turfTurfId) els.turfTurfId.value = "";
  if (els.turfPrecinct) els.turfPrecinct.value = "";
  if (els.turfCounty) els.turfCounty.value = "";
  if (els.turfAssignedTo) els.turfAssignedTo.value = "";
  if (els.turfMode) els.turfMode.value = "doors";
  if (els.turfShiftId) els.turfShiftId.value = "";
  if (els.turfAttempts) els.turfAttempts.value = "";
  if (els.turfCanvassed) els.turfCanvassed.value = "";
  if (els.turfVbms) els.turfVbms.value = "";
  if (els.btnSaveTurf) els.btnSaveTurf.textContent = "Save turf event";
  setMsg(els.turfMsg, "");
}

async function saveEvent(){
  const date = clean(els.turfDate?.value) || todayIso();
  const turfId = clean(els.turfTurfId?.value);
  const precinct = clean(els.turfPrecinct?.value);
  const county = clean(els.turfCounty?.value);
  const assignedTo = clean(els.turfAssignedTo?.value);
  const mode = clean(els.turfMode?.value) || "doors";
  const shiftId = clean(els.turfShiftId?.value);
  const attempts = asInt(els.turfAttempts?.value);
  const canvassed = asInt(els.turfCanvassed?.value);
  const vbms = asInt(els.turfVbms?.value);

  if (!turfId && !precinct){
    setMsg(els.turfMsg, "Provide Turf ID or Precinct.");
    return;
  }
  if (canvassed > attempts){
    setMsg(els.turfMsg, "Canvassed cannot exceed attempts.");
    return;
  }

  const { events } = await loadData();
  const stamp = nowIso();
  const rec = {
    id: editingTurfId || makeThirdWingId("turf"),
    turfId,
    precinct,
    county,
    date,
    assignedTo,
    mode,
    shiftId,
    attempts,
    canvassed,
    vbms,
    updatedAt: stamp,
  };

  const existing = events.find((e) => clean(e?.id) === clean(rec.id));
  rec.createdAt = clean(existing?.createdAt) || stamp;

  await put("turfEvents", rec);
  setMsg(els.turfMsg, existing ? "Turf event updated." : "Turf event saved.");
  clearForm();
  await renderEvents();
}

function buildRow(rec, personMap){
  const tr = document.createElement("tr");
  const person = personMap.get(clean(rec?.assignedTo));
  tr.innerHTML = `
    <td>${clean(rec?.date) || "-"}</td>
    <td>${clean(rec?.turfId) || "-"}</td>
    <td>${clean(rec?.precinct) || "-"}</td>
    <td>${clean(person?.name) || "Unassigned"}</td>
    <td>${clean(rec?.mode) || "-"}</td>
    <td class="num">${asInt(rec?.attempts)}</td>
    <td class="num">${asInt(rec?.canvassed)}</td>
    <td class="num">${asInt(rec?.vbms)}</td>
    <td>
      <button class="btn btn-sm btn-ghost" data-action="edit" data-id="${clean(rec?.id)}" type="button">Edit</button>
      <button class="btn btn-sm btn-ghost" data-action="delete" data-id="${clean(rec?.id)}" type="button">Delete</button>
    </td>
  `;
  return tr;
}

function populateForm(rec){
  editingTurfId = clean(rec?.id);
  if (els.turfDate) els.turfDate.value = clean(rec?.date) || todayIso();
  if (els.turfTurfId) els.turfTurfId.value = clean(rec?.turfId);
  if (els.turfPrecinct) els.turfPrecinct.value = clean(rec?.precinct);
  if (els.turfCounty) els.turfCounty.value = clean(rec?.county);
  if (els.turfAssignedTo) els.turfAssignedTo.value = clean(rec?.assignedTo);
  if (els.turfMode) els.turfMode.value = clean(rec?.mode) || "doors";
  if (els.turfShiftId) els.turfShiftId.value = clean(rec?.shiftId);
  if (els.turfAttempts) els.turfAttempts.value = String(asInt(rec?.attempts));
  if (els.turfCanvassed) els.turfCanvassed.value = String(asInt(rec?.canvassed));
  if (els.turfVbms) els.turfVbms.value = String(asInt(rec?.vbms));
  if (els.btnSaveTurf) els.btnSaveTurf.textContent = "Update turf event";
  setMsg(els.turfMsg, `Editing ${clean(rec?.date)} ${clean(rec?.turfId) || clean(rec?.precinct) || "turf event"}`);
}

async function renderEvents(){
  const { persons, events } = await loadData();
  fillPersonSelect(persons);

  const personMap = new Map(persons.map((p) => [clean(p?.id), p]));
  const rows = events.slice().sort((a, b) => {
    const d = clean(b?.date).localeCompare(clean(a?.date));
    if (d !== 0) return d;
    return clean(b?.updatedAt).localeCompare(clean(a?.updatedAt));
  });

  const uniquePrecincts = new Set();
  const uniqueTurfs = new Set();
  let totalAttempts = 0;

  for (const rec of rows){
    const p = clean(rec?.precinct);
    const t = clean(rec?.turfId);
    if (p) uniquePrecincts.add(p);
    if (t) uniqueTurfs.add(t);
    totalAttempts += asInt(rec?.attempts);
  }

  if (els.countEvents) els.countEvents.textContent = String(rows.length);
  if (els.sumAttempts) els.sumAttempts.textContent = String(totalAttempts);
  if (els.countPrecincts) els.countPrecincts.textContent = String(uniquePrecincts.size);
  if (els.countTurfs) els.countTurfs.textContent = String(uniqueTurfs.size);

  if (!els.turfTbody) return;
  els.turfTbody.innerHTML = "";

  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="muted" colspan="9">No turf events yet.</td>';
    els.turfTbody.appendChild(tr);
    return;
  }

  for (const rec of rows){
    els.turfTbody.appendChild(buildRow(rec, personMap));
  }
}

function wireInputActions(){
  if (els.btnSaveTurf){
    els.btnSaveTurf.addEventListener("click", async () => {
      try{
        await saveEvent();
      } catch (e){
        setMsg(els.turfMsg, e?.message ? String(e.message) : "Save failed.");
      }
    });
  }

  if (els.btnClearTurf){
    els.btnClearTurf.addEventListener("click", clearForm);
  }
}

function wireTableActions(){
  if (!els.turfTbody) return;
  els.turfTbody.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("button[data-action]");
    if (!btn) return;

    const action = clean(btn.getAttribute("data-action"));
    const id = clean(btn.getAttribute("data-id"));
    if (!id) return;

    const { events } = await loadData();
    const rec = events.find((x) => clean(x?.id) === id);
    if (!rec) return;

    if (action === "delete"){
      await remove("turfEvents", id);
      setMsg(els.turfMsg, "Turf event deleted.");
      if (editingTurfId === id) clearForm();
      await renderEvents();
      return;
    }

    if (action === "edit"){
      populateForm(rec);
    }
  });
}

function wireIoActions(){
  if (els.btnExportJson){
    els.btnExportJson.addEventListener("click", async () => {
      try{
        await downloadThirdWingSnapshot("third-wing-snapshot.json");
        setMsg(els.ioMsg, "Third Wing JSON exported.");
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
        await importThirdWingSnapshot(payload, { mode: "merge" });
        setMsg(els.ioMsg, "Third Wing JSON imported (merge).");
        await renderEvents();
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
        await downloadStoreCsv("turfEvents", "turf-events.csv");
        setMsg(els.ioMsg, "Turf CSV exported.");
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
        await importStoreCsv("turfEvents", text, { mode: "merge" });
        setMsg(els.ioMsg, "Turf CSV imported (merge).");
        await renderEvents();
      } catch (e){
        setMsg(els.ioMsg, e?.message ? String(e.message) : "CSV import failed.");
      } finally {
        els.importCsvFile.value = "";
      }
    });
  }
}

async function init(){
  await ensureThirdWingDefaults();
  clearForm();
  await renderEvents();
  wireInputActions();
  wireTableActions();
  wireIoActions();
}

init().catch((e) => {
  setMsg(els.turfMsg, e?.message ? String(e.message) : "Initialization failed.");
});
