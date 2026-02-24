import { readJsonFile } from "./utils.js";
import { PIPELINE_STAGES } from "./features/thirdWing/schema.js";
import {
  ensureThirdWingDefaults,
  getAll,
  getSummaryCounts,
  put,
  remove,
} from "./features/thirdWing/store.js";
import { computeOperationalRollups } from "./features/thirdWing/rollups.js";
import { downloadThirdWingSnapshot, importThirdWingSnapshot } from "./features/thirdWing/io.js";

const MODULE_IDS = [
  "overview",
  "recruitment",
  "interviews",
  "onboarding",
  "training",
  "shifts",
  "turf",
  "aggregate",
  "forecast",
  "io",
];

const els = {
  navButtons: Array.from(document.querySelectorAll(".camio-nav-btn[data-module]")),
  panels: Array.from(document.querySelectorAll(".camio-module[data-module-panel]")),
  btnTwExportJson: document.getElementById("btnTwExportJson"),
  btnTwImportJson: document.getElementById("btnTwImportJson"),
  twImportMode: document.getElementById("twImportMode"),
  twImportFile: document.getElementById("twImportFile"),
  btnTwRefresh: document.getElementById("btnTwRefresh"),
  ioStatus: document.getElementById("ioStatus"),
  ioDiagnostics: document.getElementById("ioDiagnostics"),

  intPersonId: document.getElementById("intPersonId"),
  intScheduledAt: document.getElementById("intScheduledAt"),
  intInterviewer: document.getElementById("intInterviewer"),
  intScore: document.getElementById("intScore"),
  intOutcome: document.getElementById("intOutcome"),
  intNotes: document.getElementById("intNotes"),
  btnSaveInterview: document.getElementById("btnSaveInterview"),
  btnClearInterview: document.getElementById("btnClearInterview"),
  intMsg: document.getElementById("intMsg"),
  intTbody: document.getElementById("intTbody"),

  onPersonId: document.getElementById("onPersonId"),
  onDocsSubmittedAt: document.getElementById("onDocsSubmittedAt"),
  onBackgroundStatus: document.getElementById("onBackgroundStatus"),
  onOnboardingStatus: document.getElementById("onOnboardingStatus"),
  onCompletedAt: document.getElementById("onCompletedAt"),
  onNotes: document.getElementById("onNotes"),
  btnSaveOnboarding: document.getElementById("btnSaveOnboarding"),
  btnClearOnboarding: document.getElementById("btnClearOnboarding"),
  onMsg: document.getElementById("onMsg"),
  onbTbody: document.getElementById("onbTbody"),

  trPersonId: document.getElementById("trPersonId"),
  trTrack: document.getElementById("trTrack"),
  trSessions: document.getElementById("trSessions"),
  trCompletionStatus: document.getElementById("trCompletionStatus"),
  trCompletedAt: document.getElementById("trCompletedAt"),
  trNotes: document.getElementById("trNotes"),
  btnSaveTraining: document.getElementById("btnSaveTraining"),
  btnClearTraining: document.getElementById("btnClearTraining"),
  trMsg: document.getElementById("trMsg"),
  trnTbody: document.getElementById("trnTbody"),
};

function clean(value){
  return String(value || "").trim();
}

function setText(id, value){
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = String(value ?? "");
}

function setStatus(text){
  if (els.ioStatus) els.ioStatus.textContent = text || "";
}

function setMsg(el, text){
  if (el) el.textContent = text || "";
}

function fmtInt(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString();
}

function fmt1(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.0";
  return n.toFixed(1);
}

function fmtDate(value){
  const ts = Date.parse(clean(value));
  if (!Number.isFinite(ts)) return "—";
  return new Date(ts).toLocaleString();
}

function stageEnteredAt(rec){
  const stage = clean(rec?.stage);
  const byStage = rec?.stageDates?.[stage];
  return clean(byStage) || clean(rec?.updatedAt) || clean(rec?.createdAt);
}

function daysSince(dateLike){
  const ts = Date.parse(clean(dateLike));
  if (!Number.isFinite(ts)) return null;
  const delta = Date.now() - ts;
  if (!Number.isFinite(delta) || delta < 0) return 0;
  return delta / 86400000;
}

function countByStage(pipelineRecords){
  const map = new Map();
  for (const stage of PIPELINE_STAGES){
    map.set(stage, 0);
  }
  const rows = Array.isArray(pipelineRecords) ? pipelineRecords : [];
  for (const rec of rows){
    const stage = clean(rec?.stage);
    if (!map.has(stage)) continue;
    map.set(stage, (map.get(stage) || 0) + 1);
  }
  return map;
}

function uniqueCount(rows, key){
  const seen = new Set();
  const list = Array.isArray(rows) ? rows : [];
  for (const row of list){
    const v = clean(row?.[key]);
    if (v) seen.add(v);
  }
  return seen.size;
}

function personNameMap(persons){
  return new Map((Array.isArray(persons) ? persons : []).map((p) => [String(p.id), clean(p.name) || String(p.id)]));
}

function fillPersonSelect(selectEl, persons){
  if (!selectEl) return;
  const rows = Array.isArray(persons) ? persons.slice() : [];
  const previous = clean(selectEl.value);
  rows.sort((a, b) => clean(a?.name).localeCompare(clean(b?.name)));

  selectEl.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = rows.length ? "Select person" : "No people in store";
  selectEl.appendChild(empty);

  for (const p of rows){
    const opt = document.createElement("option");
    opt.value = String(p.id);
    const name = clean(p.name) || String(p.id);
    const office = clean(p.office);
    opt.textContent = office ? `${name} (${office})` : name;
    selectEl.appendChild(opt);
  }

  if (previous && rows.some((p) => String(p.id) === previous)){
    selectEl.value = previous;
  }
}

function clearInterviewForm(){
  if (els.intPersonId) els.intPersonId.value = "";
  if (els.intScheduledAt) els.intScheduledAt.value = "";
  if (els.intInterviewer) els.intInterviewer.value = "";
  if (els.intScore) els.intScore.value = "";
  if (els.intOutcome) els.intOutcome.value = "pending";
  if (els.intNotes) els.intNotes.value = "";
  setMsg(els.intMsg, "");
}

function clearOnboardingForm(){
  if (els.onPersonId) els.onPersonId.value = "";
  if (els.onDocsSubmittedAt) els.onDocsSubmittedAt.value = "";
  if (els.onBackgroundStatus) els.onBackgroundStatus.value = "pending";
  if (els.onOnboardingStatus) els.onOnboardingStatus.value = "in_progress";
  if (els.onCompletedAt) els.onCompletedAt.value = "";
  if (els.onNotes) els.onNotes.value = "";
  setMsg(els.onMsg, "");
}

function clearTrainingForm(){
  if (els.trPersonId) els.trPersonId.value = "";
  if (els.trTrack) els.trTrack.value = "";
  if (els.trSessions) els.trSessions.value = "0";
  if (els.trCompletionStatus) els.trCompletionStatus.value = "not_started";
  if (els.trCompletedAt) els.trCompletedAt.value = "";
  if (els.trNotes) els.trNotes.value = "";
  setMsg(els.trMsg, "");
}

function activateModule(moduleId){
  const active = MODULE_IDS.includes(moduleId) ? moduleId : "overview";

  for (const btn of els.navButtons){
    const isActive = clean(btn.getAttribute("data-module")) === active;
    btn.classList.toggle("is-active", isActive);
  }

  for (const panel of els.panels){
    const isActive = clean(panel.getAttribute("data-module-panel")) === active;
    panel.classList.toggle("is-active", isActive);
  }

  const nextHash = `#${active}`;
  if (window.location.hash !== nextHash){
    history.replaceState(null, "", nextHash);
  }
}

function moduleFromHash(){
  const raw = clean(window.location.hash).replace(/^#/, "");
  return MODULE_IDS.includes(raw) ? raw : "overview";
}

function renderInterviewTable(interviews, peopleById){
  if (!els.intTbody) return;
  const rows = (Array.isArray(interviews) ? interviews : [])
    .slice()
    .sort((a, b) => clean(b?.scheduledAt).localeCompare(clean(a?.scheduledAt)));

  els.intTbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="muted" colspan="7">No interview records yet.</td>';
    els.intTbody.appendChild(tr);
    return;
  }

  for (const rec of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(rec?.scheduledAt)}</td>
      <td>${clean(peopleById.get(String(rec?.personId))) || "—"}</td>
      <td>${clean(rec?.interviewer) || "—"}</td>
      <td class="num">${clean(rec?.score) || "—"}</td>
      <td>${clean(rec?.outcome) || "pending"}</td>
      <td>${clean(rec?.notes) || "—"}</td>
      <td><button class="btn btn-sm btn-ghost" type="button" data-action="delete-interview" data-id="${clean(rec?.id)}">Delete</button></td>
    `;
    els.intTbody.appendChild(tr);
  }
}

function renderOnboardingTable(onboardingRecords, peopleById){
  if (!els.onbTbody) return;
  const rows = (Array.isArray(onboardingRecords) ? onboardingRecords : [])
    .slice()
    .sort((a, b) => clean(b?.updatedAt).localeCompare(clean(a?.updatedAt)));

  els.onbTbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="muted" colspan="7">No onboarding records yet.</td>';
    els.onbTbody.appendChild(tr);
    return;
  }

  for (const rec of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${clean(peopleById.get(String(rec?.personId))) || "—"}</td>
      <td>${clean(rec?.docsSubmittedAt) || "—"}</td>
      <td>${clean(rec?.backgroundStatus) || "pending"}</td>
      <td>${clean(rec?.onboardingStatus) || "in_progress"}</td>
      <td>${clean(rec?.completedAt) || "—"}</td>
      <td>${clean(rec?.notes) || "—"}</td>
      <td><button class="btn btn-sm btn-ghost" type="button" data-action="delete-onboarding" data-id="${clean(rec?.id)}">Delete</button></td>
    `;
    els.onbTbody.appendChild(tr);
  }
}

function renderTrainingTable(trainingRecords, peopleById){
  if (!els.trnTbody) return;
  const rows = (Array.isArray(trainingRecords) ? trainingRecords : [])
    .slice()
    .sort((a, b) => clean(b?.updatedAt).localeCompare(clean(a?.updatedAt)));

  els.trnTbody.innerHTML = "";
  if (!rows.length){
    const tr = document.createElement("tr");
    tr.innerHTML = '<td class="muted" colspan="7">No training records yet.</td>';
    els.trnTbody.appendChild(tr);
    return;
  }

  for (const rec of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${clean(peopleById.get(String(rec?.personId))) || "—"}</td>
      <td>${clean(rec?.trainingTrack) || "—"}</td>
      <td class="num">${fmtInt(rec?.sessions || 0)}</td>
      <td>${clean(rec?.completionStatus) || "not_started"}</td>
      <td>${clean(rec?.completedAt) || "—"}</td>
      <td>${clean(rec?.notes) || "—"}</td>
      <td><button class="btn btn-sm btn-ghost" type="button" data-action="delete-training" data-id="${clean(rec?.id)}">Delete</button></td>
    `;
    els.trnTbody.appendChild(tr);
  }
}

async function refreshDashboard(){
  await ensureThirdWingDefaults();

  const [
    persons,
    pipelineRecords,
    interviews,
    onboardingRecords,
    trainingRecords,
    shiftRecords,
    turfEvents,
    forecastConfigs,
    counts,
  ] = await Promise.all([
    getAll("persons"),
    getAll("pipelineRecords"),
    getAll("interviews"),
    getAll("onboardingRecords"),
    getAll("trainingRecords"),
    getAll("shiftRecords"),
    getAll("turfEvents"),
    getAll("forecastConfigs"),
    getSummaryCounts(),
  ]);

  const peopleById = personNameMap(persons);
  fillPersonSelect(els.intPersonId, persons);
  fillPersonSelect(els.onPersonId, persons);
  fillPersonSelect(els.trPersonId, persons);

  renderInterviewTable(interviews, peopleById);
  renderOnboardingTable(onboardingRecords, peopleById);
  renderTrainingTable(trainingRecords, peopleById);

  const stageCounts = countByStage(pipelineRecords);
  const activeStage = stageCounts.get("Active") || 0;

  let stageDaysTotal = 0;
  let stageDaysCount = 0;
  for (const rec of pipelineRecords){
    const d = daysSince(stageEnteredAt(rec));
    if (!Number.isFinite(d)) continue;
    stageDaysTotal += d;
    stageDaysCount += 1;
  }
  const avgDaysInStage = stageDaysCount > 0 ? (stageDaysTotal / stageDaysCount) : 0;

  const rollups = computeOperationalRollups({ shiftRecords, turfEvents, options: { allowTurfFallbackAttempts: false } });
  const coverage = rollups.coverage || {};
  const prod = rollups.production || {};
  const dedupe = rollups.dedupe || {};

  setText("ovPersons", fmtInt(persons.length));
  setText("ovPipeline", fmtInt(pipelineRecords.length));
  setText("ovShifts", fmtInt(shiftRecords.length));
  setText("ovTurf", fmtInt(turfEvents.length));
  setText("ovForecastConfigs", fmtInt(forecastConfigs.length));
  setText("ovActiveStage", fmtInt(activeStage));
  setText("ovNote", `Production source: ${prod.source || "shift"} | Dedupe rule: ${dedupe.rule || "shift_primary_turf_coverage"}`);

  setText("recSourced", fmtInt(stageCounts.get("Sourced") || 0));
  setText("recContacted", fmtInt(stageCounts.get("Contacted") || 0));
  setText("recPhoneScreen", fmtInt(stageCounts.get("Phone Screen") || 0));
  setText("recInterviewed", fmtInt(stageCounts.get("Interviewed") || 0));
  setText("recOfferAccepted", fmtInt(stageCounts.get("Offer Accepted") || 0));
  setText("recActive", fmtInt(stageCounts.get("Active") || 0));
  setText("recAvgDaysInStage", fmt1(avgDaysInStage));

  const interviewQueue = interviews.filter((r) => clean(r?.outcome) === "pending").length;
  setText("intRecordCount", fmtInt(interviews.length));
  setText("intQueue", fmtInt(interviewQueue));
  setText("intOfferExtended", fmtInt(stageCounts.get("Offer Extended") || 0));
  setText("intOfferAccepted", fmtInt(stageCounts.get("Offer Accepted") || 0));

  const docsSubmitted = onboardingRecords.filter((r) => clean(r?.docsSubmittedAt)).length;
  const backgroundPassed = onboardingRecords.filter((r) => clean(r?.backgroundStatus) === "passed").length;
  const onboardingCompleted = onboardingRecords.filter((r) => clean(r?.onboardingStatus) === "completed").length;
  setText("onRecordCount", fmtInt(onboardingRecords.length));
  setText("onDocsSubmitted", fmtInt(docsSubmitted));
  setText("onBackgroundPassed", fmtInt(backgroundPassed));
  setText("onTrainingComplete", fmtInt(onboardingCompleted));

  const trainingCompleted = trainingRecords.filter((r) => clean(r?.completionStatus) === "completed").length;
  const trainingInProgress = trainingRecords.filter((r) => clean(r?.completionStatus) === "in_progress").length;
  const trainingTotal = trainingRecords.length;
  const readyRatio = trainingTotal > 0 ? (100 * trainingCompleted / trainingTotal) : 0;
  setText("trRecordCount", fmtInt(trainingTotal));
  setText("trTrainingComplete", fmtInt(trainingCompleted));
  setText("trActive", fmtInt(trainingInProgress));
  setText("trReadyRatio", `${readyRatio.toFixed(1)}%`);

  setText("shShiftCount", fmtInt(shiftRecords.length));
  setText("shAttempts", fmtInt(prod.attempts || 0));
  setText("shConvos", fmtInt(prod.convos || 0));
  setText("shSupportIds", fmtInt(prod.supportIds || 0));
  setText("shHours", fmt1(prod.hours || 0));

  setText("tfEvents", fmtInt(coverage.eventCount || 0));
  setText("tfAttempts", fmtInt(coverage.attempts || 0));
  setText("tfCanvassed", fmtInt(coverage.canvassed || 0));
  setText("tfVbms", fmtInt(coverage.vbms || 0));
  setText("tfPrecincts", fmtInt(uniqueCount(turfEvents, "precinct")));
  setText("tfTurfs", fmtInt(uniqueCount(turfEvents, "turfId")));

  setText("agSource", clean(prod.source) || "shift");
  setText("agAttempts", fmtInt(prod.attempts || 0));
  setText("agConvos", fmtInt(prod.convos || 0));
  setText("agSupportIds", fmtInt(prod.supportIds || 0));
  setText("agHours", fmt1(prod.hours || 0));
  setText("agExcludedAttempts", fmtInt(dedupe.excludedTurfAttempts || 0));
  setText("agExcludedRecords", fmtInt(dedupe.excludedTurfAttemptRecords || 0));

  setText("fcBaselineActive", fmtInt(activeStage));
  setText("fcOpenPipeline", fmtInt(Math.max(0, pipelineRecords.length - activeStage)));
  setText("fcConfigCount", fmtInt(forecastConfigs.length));

  if (els.ioDiagnostics){
    const diagnostics = {
      available: true,
      counts: counts || {},
      rollups: {
        production: {
          source: prod.source || "shift",
          attempts: Number(prod.attempts || 0),
          convos: Number(prod.convos || 0),
          supportIds: Number(prod.supportIds || 0),
          hours: Number(prod.hours || 0),
        },
        dedupe: {
          rule: dedupe.rule || "shift_primary_turf_coverage",
          excludedTurfAttemptRecords: Number(dedupe.excludedTurfAttemptRecords || 0),
          excludedTurfAttempts: Number(dedupe.excludedTurfAttempts || 0),
          includedFallbackAttempts: Number(dedupe.includedFallbackAttempts || 0),
        },
      },
    };
    els.ioDiagnostics.textContent = JSON.stringify(diagnostics, null, 2);
  }
}

async function saveInterview(){
  const personId = clean(els.intPersonId?.value);
  if (!personId){
    setMsg(els.intMsg, "Select a person first.");
    return;
  }

  const scoreNum = Number(els.intScore?.value);
  await put("interviews", {
    personId,
    scheduledAt: clean(els.intScheduledAt?.value),
    interviewer: clean(els.intInterviewer?.value),
    score: Number.isFinite(scoreNum) ? scoreNum : "",
    outcome: clean(els.intOutcome?.value) || "pending",
    notes: clean(els.intNotes?.value),
  });

  setMsg(els.intMsg, "Interview record saved.");
  clearInterviewForm();
  await refreshDashboard();
}

async function saveOnboarding(){
  const personId = clean(els.onPersonId?.value);
  if (!personId){
    setMsg(els.onMsg, "Select a person first.");
    return;
  }

  await put("onboardingRecords", {
    personId,
    docsSubmittedAt: clean(els.onDocsSubmittedAt?.value),
    backgroundStatus: clean(els.onBackgroundStatus?.value) || "pending",
    onboardingStatus: clean(els.onOnboardingStatus?.value) || "in_progress",
    completedAt: clean(els.onCompletedAt?.value),
    notes: clean(els.onNotes?.value),
  });

  setMsg(els.onMsg, "Onboarding record saved.");
  clearOnboardingForm();
  await refreshDashboard();
}

async function saveTraining(){
  const personId = clean(els.trPersonId?.value);
  if (!personId){
    setMsg(els.trMsg, "Select a person first.");
    return;
  }

  const sessions = Number(els.trSessions?.value);
  await put("trainingRecords", {
    personId,
    trainingTrack: clean(els.trTrack?.value),
    sessions: Number.isFinite(sessions) ? Math.max(0, Math.round(sessions)) : 0,
    completionStatus: clean(els.trCompletionStatus?.value) || "not_started",
    completedAt: clean(els.trCompletedAt?.value),
    notes: clean(els.trNotes?.value),
  });

  setMsg(els.trMsg, "Training record saved.");
  clearTrainingForm();
  await refreshDashboard();
}

function wireCrudActions(){
  if (els.btnSaveInterview){
    els.btnSaveInterview.addEventListener("click", () => {
      saveInterview().catch((err) => setMsg(els.intMsg, err?.message ? String(err.message) : "Save failed."));
    });
  }
  if (els.btnClearInterview){
    els.btnClearInterview.addEventListener("click", clearInterviewForm);
  }

  if (els.btnSaveOnboarding){
    els.btnSaveOnboarding.addEventListener("click", () => {
      saveOnboarding().catch((err) => setMsg(els.onMsg, err?.message ? String(err.message) : "Save failed."));
    });
  }
  if (els.btnClearOnboarding){
    els.btnClearOnboarding.addEventListener("click", clearOnboardingForm);
  }

  if (els.btnSaveTraining){
    els.btnSaveTraining.addEventListener("click", () => {
      saveTraining().catch((err) => setMsg(els.trMsg, err?.message ? String(err.message) : "Save failed."));
    });
  }
  if (els.btnClearTraining){
    els.btnClearTraining.addEventListener("click", clearTrainingForm);
  }

  if (els.intTbody){
    els.intTbody.addEventListener("click", async (event) => {
      const btn = event.target?.closest?.("button[data-action='delete-interview']");
      if (!btn) return;
      const id = clean(btn.getAttribute("data-id"));
      if (!id) return;
      await remove("interviews", id);
      await refreshDashboard();
    });
  }

  if (els.onbTbody){
    els.onbTbody.addEventListener("click", async (event) => {
      const btn = event.target?.closest?.("button[data-action='delete-onboarding']");
      if (!btn) return;
      const id = clean(btn.getAttribute("data-id"));
      if (!id) return;
      await remove("onboardingRecords", id);
      await refreshDashboard();
    });
  }

  if (els.trnTbody){
    els.trnTbody.addEventListener("click", async (event) => {
      const btn = event.target?.closest?.("button[data-action='delete-training']");
      if (!btn) return;
      const id = clean(btn.getAttribute("data-id"));
      if (!id) return;
      await remove("trainingRecords", id);
      await refreshDashboard();
    });
  }
}

function wireModuleNav(){
  for (const btn of els.navButtons){
    btn.addEventListener("click", () => {
      const mod = clean(btn.getAttribute("data-module"));
      activateModule(mod);
    });
  }
  window.addEventListener("hashchange", () => activateModule(moduleFromHash()));
}

function wireIoActions(){
  if (els.btnTwExportJson){
    els.btnTwExportJson.addEventListener("click", async () => {
      try {
        await downloadThirdWingSnapshot("third-wing-snapshot.json");
        setStatus("Exported Third Wing JSON snapshot.");
      } catch (err) {
        setStatus(err?.message ? String(err.message) : "Export failed.");
      }
    });
  }

  if (els.btnTwImportJson && els.twImportFile){
    els.btnTwImportJson.addEventListener("click", () => els.twImportFile.click());

    els.twImportFile.addEventListener("change", async () => {
      try {
        const file = els.twImportFile.files?.[0];
        if (!file) return;

        const payload = await readJsonFile(file);
        if (!payload || typeof payload !== "object"){
          throw new Error("Invalid JSON file.");
        }

        const mode = clean(els.twImportMode?.value) === "replace" ? "replace" : "merge";
        await importThirdWingSnapshot(payload, { mode });
        setStatus(`Imported Third Wing JSON (${mode}).`);
        await refreshDashboard();
      } catch (err) {
        setStatus(err?.message ? String(err.message) : "Import failed.");
      } finally {
        els.twImportFile.value = "";
      }
    });
  }

  if (els.btnTwRefresh){
    els.btnTwRefresh.addEventListener("click", async () => {
      try {
        await refreshDashboard();
        setStatus("Diagnostics refreshed.");
      } catch (err) {
        setStatus(err?.message ? String(err.message) : "Refresh failed.");
      }
    });
  }
}

async function init(){
  activateModule(moduleFromHash());
  wireModuleNav();
  wireCrudActions();
  wireIoActions();
  clearInterviewForm();
  clearOnboardingForm();
  clearTrainingForm();
  await refreshDashboard();
  setStatus("Ready.");
}

init().catch((err) => {
  setStatus(err?.message ? String(err.message) : "Initialization failed.");
});
