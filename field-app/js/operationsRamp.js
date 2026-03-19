// @ts-check
import { PIPELINE_STAGES, DEFAULT_FORECAST_CONFIG } from "./features/operations/schema.js";
import { ensureOperationsDefaults, getAll, getById, put } from "./features/operations/store.js";
import {
  operationsAddDaysUTC,
  operationsClampNumber,
  operationsFiniteNumber,
  operationsNonNegativeInt,
  operationsNonNegativeNumber,
  operationsParseDate,
  operationsParseIsoDateInput,
  operationsStartOfWeekUTC,
  operationsTodayIso,
  operationsTransitionKey,
  operationsToIsoDateUTC,
} from "./features/operations/time.js";
import {
  applyOperationsContextToLinks,
  resolveOperationsContext,
  summarizeOperationsContext,
  toOperationsStoreOptions,
} from "./features/operations/context.js";
import {
  formatOperationsFixed,
  formatOperationsPercentFromUnit,
  formatOperationsPercentInputValue,
} from "./features/operations/view.js";

const els = {
  asOfDate: document.getElementById("asOfDate"),
  horizonWeeks: document.getElementById("horizonWeeks"),
  btnRecompute: document.getElementById("btnRecompute"),
  btnSaveAssumptions: document.getElementById("btnSaveAssumptions"),
  btnResetAssumptions: document.getElementById("btnResetAssumptions"),
  forecastMsg: document.getElementById("forecastMsg"),
  assumptionTbody: document.getElementById("assumptionTbody"),
  baselineActive: document.getElementById("baselineActive"),
  openPipeline: document.getElementById("openPipeline"),
  expectedHorizon: document.getElementById("expectedHorizon"),
  expectedBeyond: document.getElementById("expectedBeyond"),
  weeklyTbody: document.getElementById("weeklyTbody"),
  personTbody: document.getElementById("personTbody"),
  btnExportWeeklyCsv: document.getElementById("btnExportWeeklyCsv"),
  btnExportPersonCsv: document.getElementById("btnExportPersonCsv"),
};

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

const state = {
  config: null,
  weeklyRows: [],
  personRows: [],
};

const operationsContext = resolveOperationsContext();
const storeScope = toOperationsStoreOptions(operationsContext);

const TRANSITIONS = PIPELINE_STAGES.slice(0, -1).map((from, idx) => {
  const to = PIPELINE_STAGES[idx + 1];
  return { from, to, key: operationsTransitionKey(from, to) };
});

function clean(v){
  return String(v == null ? "" : v).trim();
}

function setMsg(text){
  if (els.forecastMsg) els.forecastMsg.textContent = text || "";
}

function contextSummaryText(){
  return summarizeOperationsContext(operationsContext);
}

function normalizeConfig(raw){
  const source = (raw && typeof raw === "object") ? raw : {};
  const stageConversionDefaults = { ...(source.stageConversionDefaults || {}) };
  const stageDurationDefaultsDays = { ...(source.stageDurationDefaultsDays || {}) };

  for (const t of TRANSITIONS){
    const defaultConv = operationsFiniteNumber(DEFAULT_FORECAST_CONFIG.stageConversionDefaults?.[t.key], 1);
    const defaultDays = operationsFiniteNumber(DEFAULT_FORECAST_CONFIG.stageDurationDefaultsDays?.[t.key], 0);
    stageConversionDefaults[t.key] = operationsClampNumber(
      operationsFiniteNumber(stageConversionDefaults[t.key], defaultConv),
      0,
      1,
    );
    stageDurationDefaultsDays[t.key] = operationsNonNegativeNumber(
      stageDurationDefaultsDays[t.key],
      defaultDays,
    );
  }

  return {
    id: "default",
    stageConversionDefaults,
    stageDurationDefaultsDays,
    productivityDefaults: {
      ...(DEFAULT_FORECAST_CONFIG.productivityDefaults || {}),
      ...((source.productivityDefaults && typeof source.productivityDefaults === "object") ? source.productivityDefaults : {}),
    },
  };
}

function renderAssumptionTable(config){
  if (!els.assumptionTbody) return;
  els.assumptionTbody.innerHTML = "";

  for (const t of TRANSITIONS){
    const conv = operationsClampNumber(operationsFiniteNumber(config.stageConversionDefaults?.[t.key], 0), 0, 1);
    const days = operationsNonNegativeNumber(config.stageDurationDefaultsDays?.[t.key], 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.from} -> ${t.to}</td>
      <td class="num"><input class="input num" id="conv_${t.key}" type="number" min="0" max="100" step="0.1" value="${formatOperationsPercentInputValue(conv, { digits: 1, fallback: "0.0" })}" /></td>
      <td class="num"><input class="input num" id="days_${t.key}" type="number" min="0" max="180" step="0.5" value="${formatOperationsFixed(days, { digits: 1, fallback: "0.0" })}" /></td>
    `;
    els.assumptionTbody.appendChild(tr);
  }
}

function readAssumptionsFromUi(baseConfig){
  const next = normalizeConfig(baseConfig || DEFAULT_FORECAST_CONFIG);
  for (const t of TRANSITIONS){
    const convInput = document.getElementById(`conv_${t.key}`);
    const daysInput = document.getElementById(`days_${t.key}`);
    const convPct = operationsClampNumber(
      operationsFiniteNumber(convInput?.value, next.stageConversionDefaults[t.key] * 100),
      0,
      100,
    );
    const days = operationsNonNegativeNumber(daysInput?.value, next.stageDurationDefaultsDays[t.key]);
    next.stageConversionDefaults[t.key] = convPct / 100;
    next.stageDurationDefaultsDays[t.key] = days;
  }
  return next;
}

function projectRecord(rec, config, asOfDate){
  const stage = clean(rec?.stage);
  const idx = PIPELINE_STAGES.indexOf(stage);
  if (idx < 0) return { skip: "unknown_stage" };
  if (stage === "Active") return { skip: "already_active" };
  if (clean(rec?.dropoffReason)) return { skip: "dropoff" };

  const stageDate = rec?.stageDates?.[stage];
  const baseDate = operationsParseDate(stageDate) || operationsParseDate(rec?.updatedAt) || operationsParseDate(rec?.createdAt) || asOfDate;

  let probability = 1;
  let daysToActive = 0;
  for (let i = idx; i < PIPELINE_STAGES.length - 1; i++){
    const key = operationsTransitionKey(PIPELINE_STAGES[i], PIPELINE_STAGES[i + 1]);
    const conv = operationsClampNumber(operationsFiniteNumber(config.stageConversionDefaults?.[key], 1), 0, 1);
    const days = operationsNonNegativeNumber(config.stageDurationDefaultsDays?.[key], 0);
    probability *= conv;
    daysToActive += days;
  }

  const projectedDate = operationsAddDaysUTC(baseDate, daysToActive);
  return {
    id: clean(rec?.id),
    personId: clean(rec?.personId),
    currentStage: stage,
    probability,
    daysToActive,
    projectedDate,
  };
}

function computeRampForecast({ persons, pipelineRecords, config, asOfDate, horizonWeeks }){
  const personMap = new Map((Array.isArray(persons) ? persons : []).map((p) => [clean(p?.id), p]));
  const records = Array.isArray(pipelineRecords) ? pipelineRecords : [];

  let baselineActive = 0;
  for (const rec of records){
    if (clean(rec?.stage) === "Active") baselineActive += 1;
  }

  const week0 = operationsStartOfWeekUTC(asOfDate);
  const weeklyRows = [];
  for (let i = 0; i < horizonWeeks; i++){
    weeklyRows.push({
      weekStarting: operationsToIsoDateUTC(operationsAddDaysUTC(week0, i * 7)),
      expectedNewActive: 0,
      recruitCount: 0,
      cumulativeExpectedActive: 0,
    });
  }

  let expectedBeyond = 0;
  let skippedDropoff = 0;
  let skippedUnknownStage = 0;
  const personRows = [];

  for (const rec of records){
    const projection = projectRecord(rec, config, asOfDate);
    if (projection.skip){
      if (projection.skip === "dropoff") skippedDropoff += 1;
      if (projection.skip === "unknown_stage") skippedUnknownStage += 1;
      continue;
    }

    const name = clean(personMap.get(projection.personId)?.name) || clean(rec?.name) || projection.personId || "Unknown";
    personRows.push({
      name,
      currentStage: projection.currentStage,
      probability: projection.probability,
      daysToActive: projection.daysToActive,
      projectedActiveDate: operationsToIsoDateUTC(projection.projectedDate),
    });

    const weekStart = operationsStartOfWeekUTC(projection.projectedDate);
    const weekIdx = operationsNonNegativeInt((weekStart.getTime() - week0.getTime()) / WEEK_MS, 0);

    if (weekIdx >= horizonWeeks){
      expectedBeyond += projection.probability;
      continue;
    }

    weeklyRows[weekIdx].expectedNewActive += projection.probability;
    weeklyRows[weekIdx].recruitCount += 1;
  }

  let running = baselineActive;
  let expectedHorizon = 0;
  for (const row of weeklyRows){
    expectedHorizon += row.expectedNewActive;
    running += row.expectedNewActive;
    row.cumulativeExpectedActive = running;
  }

  personRows.sort((a, b) => {
    const d = String(a.projectedActiveDate).localeCompare(String(b.projectedActiveDate));
    if (d !== 0) return d;
    return b.probability - a.probability;
  });

  const openPipeline = records.filter((r) => {
    const stage = clean(r?.stage);
    if (!stage || stage === "Active") return false;
    if (clean(r?.dropoffReason)) return false;
    return true;
  }).length;

  return {
    baselineActive,
    openPipeline,
    expectedHorizon,
    expectedBeyond,
    weeklyRows,
    personRows,
    skippedDropoff,
    skippedUnknownStage,
  };
}

function renderForecast(result){
  if (els.baselineActive) els.baselineActive.textContent = String(result.baselineActive);
  if (els.openPipeline) els.openPipeline.textContent = String(result.openPipeline);
  if (els.expectedHorizon) els.expectedHorizon.textContent = formatOperationsFixed(result.expectedHorizon, { digits: 2, fallback: "0.00" });
  if (els.expectedBeyond) els.expectedBeyond.textContent = formatOperationsFixed(result.expectedBeyond, { digits: 2, fallback: "0.00" });

  if (els.weeklyTbody){
    els.weeklyTbody.innerHTML = "";
    if (!result.weeklyRows.length){
      const tr = document.createElement("tr");
      tr.innerHTML = '<td class="muted" colspan="4">No weekly rows.</td>';
      els.weeklyTbody.appendChild(tr);
    } else {
      for (const row of result.weeklyRows){
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.weekStarting}</td>
          <td class="num">${formatOperationsFixed(row.expectedNewActive, { digits: 2, fallback: "0.00" })}</td>
          <td class="num">${row.recruitCount}</td>
          <td class="num">${formatOperationsFixed(row.cumulativeExpectedActive, { digits: 2, fallback: "0.00" })}</td>
        `;
        els.weeklyTbody.appendChild(tr);
      }
    }
  }

  if (els.personTbody){
    els.personTbody.innerHTML = "";
    if (!result.personRows.length){
      const tr = document.createElement("tr");
      tr.innerHTML = '<td class="muted" colspan="5">No projectable pipeline records.</td>';
      els.personTbody.appendChild(tr);
    } else {
      for (const row of result.personRows){
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.name}</td>
          <td>${row.currentStage}</td>
          <td class="num">${formatOperationsPercentFromUnit(row.probability, { digits: 1, fallback: "—" })}</td>
          <td class="num">${formatOperationsFixed(row.daysToActive, { digits: 1, fallback: "0.0" })}</td>
          <td>${row.projectedActiveDate}</td>
        `;
        els.personTbody.appendChild(tr);
      }
    }
  }
}

function rowsToCsv(headers, rows){
  const esc = (v) => {
    const raw = (v == null) ? "" : String(v);
    if (/[",\n\r]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
    return raw;
  };
  const lines = [headers.map(esc).join(",")];
  for (const row of rows){
    lines.push(row.map(esc).join(","));
  }
  return lines.join("\n");
}

function downloadText(filename, text, contentType){
  const blob = new Blob([String(text || "")], { type: contentType || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function recomputeForecast(originLabel){
  const asOfDate = operationsParseIsoDateInput(els.asOfDate?.value) || operationsParseIsoDateInput(operationsTodayIso()) || new Date();
  const horizonWeeks = operationsClampNumber(operationsNonNegativeInt(els.horizonWeeks?.value, 16), 1, 104);
  if (els.horizonWeeks) els.horizonWeeks.value = String(horizonWeeks);

  const config = readAssumptionsFromUi(state.config || DEFAULT_FORECAST_CONFIG);
  state.config = config;

  const [persons, pipelineRecords] = await Promise.all([
    getAll("persons", storeScope),
    getAll("pipelineRecords", storeScope),
  ]);

  const result = computeRampForecast({
    persons,
    pipelineRecords,
    config,
    asOfDate,
    horizonWeeks,
  });

  state.weeklyRows = result.weeklyRows;
  state.personRows = result.personRows;
  renderForecast(result);

  setMsg(`${originLabel}: forecast updated. Skipped dropoff=${result.skippedDropoff}, unknown stage=${result.skippedUnknownStage}.`);
}

async function saveAssumptions(){
  const config = readAssumptionsFromUi(state.config || DEFAULT_FORECAST_CONFIG);
  const saved = await put("forecastConfigs", {
    id: "default",
    stageConversionDefaults: config.stageConversionDefaults,
    stageDurationDefaultsDays: config.stageDurationDefaultsDays,
    productivityDefaults: config.productivityDefaults,
  }, storeScope);
  state.config = normalizeConfig(saved || config);
  renderAssumptionTable(state.config);
  await recomputeForecast("Save assumptions");
}

async function resetDefaults(){
  const reset = normalizeConfig(DEFAULT_FORECAST_CONFIG);
  const saved = await put("forecastConfigs", {
    id: "default",
    stageConversionDefaults: reset.stageConversionDefaults,
    stageDurationDefaultsDays: reset.stageDurationDefaultsDays,
    productivityDefaults: reset.productivityDefaults,
  }, storeScope);
  state.config = normalizeConfig(saved || reset);
  renderAssumptionTable(state.config);
  await recomputeForecast("Reset defaults");
}

function exportWeeklyCsv(){
  const rows = (state.weeklyRows || []).map((r) => [
    r.weekStarting,
    formatOperationsFixed(r.expectedNewActive, { digits: 4, fallback: "0.0000" }),
    String(r.recruitCount),
    formatOperationsFixed(r.cumulativeExpectedActive, { digits: 4, fallback: "0.0000" }),
  ]);
  const csv = rowsToCsv([
    "week_starting",
    "expected_new_active_fte",
    "recruits_landing",
    "cumulative_expected_active",
  ], rows);
  downloadText("operations-ramp-weekly.csv", csv, "text/csv");
}

function exportPersonCsv(){
  const rows = (state.personRows || []).map((r) => [
    r.name,
    r.currentStage,
    formatOperationsPercentInputValue(r.probability, { digits: 2, fallback: "0.00" }),
    formatOperationsFixed(r.daysToActive, { digits: 2, fallback: "0.00" }),
    r.projectedActiveDate,
  ]);
  const csv = rowsToCsv([
    "name",
    "current_stage",
    "probability_active_percent",
    "days_to_active",
    "projected_active_date",
  ], rows);
  downloadText("operations-ramp-detail.csv", csv, "text/csv");
}

function wire(){
  if (els.btnRecompute){
    els.btnRecompute.addEventListener("click", async () => {
      try {
        await recomputeForecast("Manual recompute");
      } catch (e){
        setMsg(e?.message ? String(e.message) : "Recompute failed.");
      }
    });
  }

  if (els.btnSaveAssumptions){
    els.btnSaveAssumptions.addEventListener("click", async () => {
      try {
        await saveAssumptions();
      } catch (e){
        setMsg(e?.message ? String(e.message) : "Save assumptions failed.");
      }
    });
  }

  if (els.btnResetAssumptions){
    els.btnResetAssumptions.addEventListener("click", async () => {
      try {
        const ok = window.confirm("Reset ramp assumptions to defaults?");
        if (!ok) return;
        await resetDefaults();
      } catch (e){
        setMsg(e?.message ? String(e.message) : "Reset defaults failed.");
      }
    });
  }

  if (els.btnExportWeeklyCsv){
    els.btnExportWeeklyCsv.addEventListener("click", exportWeeklyCsv);
  }

  if (els.btnExportPersonCsv){
    els.btnExportPersonCsv.addEventListener("click", exportPersonCsv);
  }
}

async function init(){
  applyOperationsContextToLinks(operationsContext, ".note a[href]");
  await ensureOperationsDefaults(storeScope);
  if (els.asOfDate && !clean(els.asOfDate.value)){
    els.asOfDate.value = operationsTodayIso();
  }

  const stored = await getById("forecastConfigs", "default", storeScope);
  state.config = normalizeConfig(stored || DEFAULT_FORECAST_CONFIG);
  renderAssumptionTable(state.config);

  wire();
  await recomputeForecast("Init");
  setMsg(`Ready. ${contextSummaryText()}`);
}

init().catch((e) => {
  setMsg(e?.message ? String(e.message) : "Initialization failed.");
});
