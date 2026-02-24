import { readJsonFile } from "./utils.js";
import { PIPELINE_STAGES } from "./features/thirdWing/schema.js";
import { ensureThirdWingDefaults, getAll, getSummaryCounts } from "./features/thirdWing/store.js";
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
};

function setText(id, value){
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = String(value ?? "");
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

function clean(value){
  return String(value || "").trim();
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

function setStatus(text){
  if (els.ioStatus) els.ioStatus.textContent = text || "";
}

async function refreshDashboard(){
  await ensureThirdWingDefaults();

  const [persons, pipelineRecords, shiftRecords, turfEvents, forecastConfigs, counts] = await Promise.all([
    getAll("persons"),
    getAll("pipelineRecords"),
    getAll("shiftRecords"),
    getAll("turfEvents"),
    getAll("forecastConfigs"),
    getSummaryCounts(),
  ]);

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

  setText("intQueue", fmtInt(stageCounts.get("Interviewed") || 0));
  setText("intOfferExtended", fmtInt(stageCounts.get("Offer Extended") || 0));
  setText("intOfferAccepted", fmtInt(stageCounts.get("Offer Accepted") || 0));

  setText("onDocsSubmitted", fmtInt(stageCounts.get("Docs Submitted") || 0));
  setText("onBackgroundPassed", fmtInt(stageCounts.get("Background Passed") || 0));
  setText("onTrainingComplete", fmtInt(stageCounts.get("Training Complete") || 0));

  const trainingComplete = stageCounts.get("Training Complete") || 0;
  const active = stageCounts.get("Active") || 0;
  const readyDen = trainingComplete + active;
  const readyRatio = readyDen > 0 ? (100 * active / readyDen) : 0;
  setText("trTrainingComplete", fmtInt(trainingComplete));
  setText("trActive", fmtInt(active));
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
  wireIoActions();
  await refreshDashboard();
  setStatus("Ready.");
}

init().catch((err) => {
  setStatus(err?.message ? String(err.message) : "Initialization failed.");
});
