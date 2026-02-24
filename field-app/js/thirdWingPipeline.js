import { readJsonFile } from "./utils.js";
import { PIPELINE_STAGES } from "./features/thirdWing/schema.js";
import { ensureThirdWingDefaults, getAll, put, makeThirdWingId } from "./features/thirdWing/store.js";
import { downloadThirdWingSnapshot, importThirdWingSnapshot, downloadStoreCsv, importStoreCsv } from "./features/thirdWing/io.js";

const els = {
  leadName: document.getElementById("leadName"),
  leadOffice: document.getElementById("leadOffice"),
  leadRegion: document.getElementById("leadRegion"),
  leadRecruiter: document.getElementById("leadRecruiter"),
  leadSourceChannel: document.getElementById("leadSourceChannel"),
  leadStage: document.getElementById("leadStage"),
  btnSaveLead: document.getElementById("btnSaveLead"),
  btnClearLead: document.getElementById("btnClearLead"),
  leadMsg: document.getElementById("leadMsg"),
  pipelineTbody: document.getElementById("pipelineTbody"),
  countPersons: document.getElementById("countPersons"),
  countPipeline: document.getElementById("countPipeline"),
  countActiveStage: document.getElementById("countActiveStage"),
  btnExportJson: document.getElementById("btnExportJson"),
  btnImportJson: document.getElementById("btnImportJson"),
  btnExportCsv: document.getElementById("btnExportCsv"),
  btnImportCsv: document.getElementById("btnImportCsv"),
  importJsonFile: document.getElementById("importJsonFile"),
  importCsvFile: document.getElementById("importCsvFile"),
  ioMsg: document.getElementById("ioMsg"),
};

function nowIso(){
  return new Date().toISOString();
}

function clean(v){
  return String(v || "").trim();
}

function norm(v){
  return clean(v).toLowerCase();
}

function daysSince(iso){
  const ts = Date.parse(String(iso || ""));
  if (!Number.isFinite(ts)) return null;
  const delta = Date.now() - ts;
  if (!Number.isFinite(delta) || delta < 0) return 0;
  return Math.floor(delta / 86400000);
}

function setMsg(el, text){
  if (el) el.textContent = text || "";
}

function fillStages(selectEl){
  if (!selectEl) return;
  selectEl.innerHTML = "";
  for (const stage of PIPELINE_STAGES){
    const opt = document.createElement("option");
    opt.value = stage;
    opt.textContent = stage;
    selectEl.appendChild(opt);
  }
}

function clearForm(){
  if (els.leadName) els.leadName.value = "";
  if (els.leadOffice) els.leadOffice.value = "";
  if (els.leadRegion) els.leadRegion.value = "";
  if (els.leadRecruiter) els.leadRecruiter.value = "";
  if (els.leadSourceChannel) els.leadSourceChannel.value = "";
  if (els.leadStage) els.leadStage.value = PIPELINE_STAGES[0];
  setMsg(els.leadMsg, "");
}

async function loadData(){
  const [persons, pipelineRecords] = await Promise.all([
    getAll("persons"),
    getAll("pipelineRecords"),
  ]);
  return {
    persons: Array.isArray(persons) ? persons : [],
    pipelineRecords: Array.isArray(pipelineRecords) ? pipelineRecords : [],
  };
}

function findPersonMatch(persons, { name, office, region }){
  const nName = norm(name);
  const nOffice = norm(office);
  const nRegion = norm(region);
  return persons.find((p) => {
    return norm(p?.name) === nName && norm(p?.office) === nOffice && norm(p?.region) === nRegion;
  }) || null;
}

function nextStage(stage){
  const idx = PIPELINE_STAGES.indexOf(stage);
  if (idx < 0) return PIPELINE_STAGES[0];
  if (idx + 1 >= PIPELINE_STAGES.length) return PIPELINE_STAGES[idx];
  return PIPELINE_STAGES[idx + 1];
}

async function saveLead(){
  const name = clean(els.leadName?.value);
  if (!name){
    setMsg(els.leadMsg, "Name is required.");
    return;
  }

  const office = clean(els.leadOffice?.value);
  const region = clean(els.leadRegion?.value);
  const recruiter = clean(els.leadRecruiter?.value);
  const sourceChannel = clean(els.leadSourceChannel?.value);
  const stage = clean(els.leadStage?.value) || PIPELINE_STAGES[0];
  const stamp = nowIso();

  const { persons, pipelineRecords } = await loadData();
  let person = findPersonMatch(persons, { name, office, region });
  if (!person){
    person = {
      id: makeThirdWingId("per"),
      name,
      office,
      region,
      role: "canvasser",
      active: stage === "Active",
      createdAt: stamp,
      updatedAt: stamp,
    };
  } else {
    person = {
      ...person,
      name,
      office,
      region,
      active: stage === "Active" ? true : !!person.active,
      updatedAt: stamp,
    };
  }

  const existing = pipelineRecords.find((r) => String(r?.personId) === String(person.id));
  const stageDates = { ...(existing?.stageDates || {}) };
  if (!stageDates[stage]) stageDates[stage] = stamp;

  const record = {
    id: existing?.id || makeThirdWingId("pipe"),
    personId: person.id,
    recruiter,
    sourceChannel,
    office,
    region,
    stage,
    stageDates,
    dropoffReason: existing?.dropoffReason || "",
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
  };

  await put("persons", person);
  await put("pipelineRecords", record);
  setMsg(els.leadMsg, existing ? "Updated existing pipeline record." : "Created pipeline record.");
  await renderPipeline();
}

async function updateStage(recordId, stage){
  const { pipelineRecords, persons } = await loadData();
  const rec = pipelineRecords.find((r) => String(r?.id) === String(recordId));
  if (!rec) return;
  const stamp = nowIso();
  const stageDates = { ...(rec.stageDates || {}) };
  if (!stageDates[stage]) stageDates[stage] = stamp;
  const next = { ...rec, stage, stageDates, updatedAt: stamp };
  await put("pipelineRecords", next);

  const person = persons.find((p) => String(p?.id) === String(rec.personId));
  if (person && stage === "Active"){
    await put("persons", { ...person, active: true, updatedAt: stamp });
  }
}

function buildRow({ rec, person }){
  const tr = document.createElement("tr");
  const stage = clean(rec?.stage) || PIPELINE_STAGES[0];
  const entered = rec?.stageDates?.[stage] || rec?.updatedAt || rec?.createdAt;
  const totalSince = rec?.createdAt || entered;

  const stageSelectId = `stage_${clean(rec?.id).replace(/[^a-zA-Z0-9_]/g, "_")}`;

  tr.innerHTML = `
    <td>${clean(person?.name) || "—"}</td>
    <td>${clean(rec?.office || person?.office) || "—"}</td>
    <td>${clean(rec?.region || person?.region) || "—"}</td>
    <td>${clean(rec?.recruiter) || "—"}</td>
    <td>
      <select class="select input-sm" id="${stageSelectId}">
        ${PIPELINE_STAGES.map((s) => `<option value="${s}" ${s === stage ? "selected" : ""}>${s}</option>`).join("")}
      </select>
    </td>
    <td class="num">${daysSince(entered) == null ? "—" : String(daysSince(entered))}</td>
    <td class="num">${daysSince(totalSince) == null ? "—" : String(daysSince(totalSince))}</td>
    <td>
      <button class="btn btn-sm btn-ghost" data-action="advance" data-id="${rec.id}" type="button">Advance</button>
      <button class="btn btn-sm btn-ghost" data-action="save-stage" data-id="${rec.id}" data-select="${stageSelectId}" type="button">Save</button>
    </td>
  `;
  return tr;
}

async function renderPipeline(){
  const { persons, pipelineRecords } = await loadData();
  const byPerson = new Map(persons.map((p) => [String(p.id), p]));
  const rows = pipelineRecords
    .slice()
    .sort((a, b) => String(b?.updatedAt || "").localeCompare(String(a?.updatedAt || "")));

  if (els.countPersons) els.countPersons.textContent = String(persons.length);
  if (els.countPipeline) els.countPipeline.textContent = String(pipelineRecords.length);
  if (els.countActiveStage) els.countActiveStage.textContent = String(rows.filter((r) => clean(r?.stage) === "Active").length);

  if (!els.pipelineTbody) return;
  els.pipelineTbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="muted" colspan="8">No pipeline records yet.</td>';
    els.pipelineTbody.appendChild(tr);
    return;
  }

  for (const rec of rows){
    const person = byPerson.get(String(rec?.personId));
    els.pipelineTbody.appendChild(buildRow({ rec, person }));
  }
}

function wireTableActions(){
  if (!els.pipelineTbody) return;
  els.pipelineTbody.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("button[data-action]");
    if (!btn) return;
    const action = clean(btn.getAttribute("data-action"));
    const id = clean(btn.getAttribute("data-id"));
    if (!id) return;

    if (action === "advance"){
      const { pipelineRecords } = await loadData();
      const rec = pipelineRecords.find((r) => String(r?.id) === id);
      if (!rec) return;
      await updateStage(id, nextStage(clean(rec.stage) || PIPELINE_STAGES[0]));
      await renderPipeline();
      return;
    }

    if (action === "save-stage"){
      const selId = clean(btn.getAttribute("data-select"));
      const sel = selId ? document.getElementById(selId) : null;
      const stage = clean(sel?.value) || PIPELINE_STAGES[0];
      await updateStage(id, stage);
      await renderPipeline();
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
        await renderPipeline();
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
        await downloadStoreCsv("pipelineRecords", "pipeline-records.csv");
        setMsg(els.ioMsg, "Pipeline CSV exported.");
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
        await importStoreCsv("pipelineRecords", text, { mode: "merge" });
        setMsg(els.ioMsg, "Pipeline CSV imported (merge).");
        await renderPipeline();
      } catch (e){
        setMsg(els.ioMsg, e?.message ? String(e.message) : "CSV import failed.");
      } finally {
        els.importCsvFile.value = "";
      }
    });
  }
}

async function init(){
  fillStages(els.leadStage);
  clearForm();
  await ensureThirdWingDefaults();
  await renderPipeline();

  if (els.btnSaveLead){
    els.btnSaveLead.addEventListener("click", async () => {
      try{
        await saveLead();
      } catch (e){
        setMsg(els.leadMsg, e?.message ? String(e.message) : "Save failed.");
      }
    });
  }
  if (els.btnClearLead){
    els.btnClearLead.addEventListener("click", clearForm);
  }

  wireTableActions();
  wireIoActions();
}

init().catch((e) => {
  setMsg(els.leadMsg, e?.message ? String(e.message) : "Initialization failed.");
});

