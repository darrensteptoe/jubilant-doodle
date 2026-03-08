// @ts-check
import { PIPELINE_STAGES, DEFAULT_FORECAST_CONFIG } from "./features/operations/schema.js";
import { ensureOperationsDefaults, getAll, getById, put } from "./features/operations/store.js";

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

const TRANSITIONS = PIPELINE_STAGES.slice(0, -1).map((from, idx) => {
  const to = PIPELINE_STAGES[idx + 1];
  return { from, to, key: transitionKey(from, to) };
});

function clean(v){
  return String(v == null ? "" : v).trim();
}

function asNum(v, fallback = 0){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asInt(v, fallback = 0){
  return Math.max(0, Math.floor(asNum(v, fallback)));
}

function clamp(v, min, max){
  return Math.max(min, Math.min(max, v));
}

function todayIso(){
  return new Date().toISOString().slice(0, 10);
}

function transitionKey(from, to){
  return `${slug(from)}_to_${slug(to)}`;
}

function slug(s){
  return clean(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseIsoDateInput(value){
  const s = clean(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function parseAnyDate(value){
  const s = clean(value);
  if (!s) return null;
  const iso = parseIsoDateInput(s);
  if (iso) return iso;
  const dt = new Date(s);
  return Number.isFinite(dt.getTime()) ? dt : null;
}

function toIsoDateUTC(dt){
  if (!(dt instanceof Date) || !Number.isFinite(dt.getTime())) return "";
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfWeekUTC(dt){
  const base = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  const day = (base.getUTCDay() + 6) % 7;
  base.setUTCDate(base.getUTCDate() - day);
  return base;
}

function addDaysUTC(dt, days){
  return new Date(dt.getTime() + (asNum(days, 0) * DAY_MS));
}

function setMsg(text){
  if (els.forecastMsg) els.forecastMsg.textContent = text || "";
}

function normalizeConfig(raw){
  const source = (raw && typeof raw === "object") ? raw : {};
  const stageConversionDefaults = { ...(source.stageConversionDefaults || {}) };
  const stageDurationDefaultsDays = { ...(source.stageDurationDefaultsDays || {}) };

  for (const t of TRANSITIONS){
    const defaultConv = asNum(DEFAULT_FORECAST_CONFIG.stageConversionDefaults?.[t.key], 1);
    const defaultDays = asNum(DEFAULT_FORECAST_CONFIG.stageDurationDefaultsDays?.[t.key], 0);
    stageConversionDefaults[t.key] = clamp(asNum(stageConversionDefaults[t.key], defaultConv), 0, 1);
    stageDurationDefaultsDays[t.key] = Math.max(0, asNum(stageDurationDefaultsDays[t.key], defaultDays));
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
    const conv = clamp(asNum(config.stageConversionDefaults?.[t.key], 0), 0, 1);
    const days = Math.max(0, asNum(config.stageDurationDefaultsDays?.[t.key], 0));
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.from} -> ${t.to}</td>
      <td class="num"><input class="input num" id="conv_${t.key}" type="number" min="0" max="100" step="0.1" value="${(conv * 100).toFixed(1)}" /></td>
      <td class="num"><input class="input num" id="days_${t.key}" type="number" min="0" max="180" step="0.5" value="${days.toFixed(1)}" /></td>
    `;
    els.assumptionTbody.appendChild(tr);
  }
}

function readAssumptionsFromUi(baseConfig){
  const next = normalizeConfig(baseConfig || DEFAULT_FORECAST_CONFIG);
  for (const t of TRANSITIONS){
    const convInput = document.getElementById(`conv_${t.key}`);
    const daysInput = document.getElementById(`days_${t.key}`);
    const convPct = clamp(asNum(convInput?.value, next.stageConversionDefaults[t.key] * 100), 0, 100);
    const days = Math.max(0, asNum(daysInput?.value, next.stageDurationDefaultsDays[t.key]));
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
  const baseDate = parseAnyDate(stageDate) || parseAnyDate(rec?.updatedAt) || parseAnyDate(rec?.createdAt) || asOfDate;

  let probability = 1;
  let daysToActive = 0;
  for (let i = idx; i < PIPELINE_STAGES.length - 1; i++){
    const key = transitionKey(PIPELINE_STAGES[i], PIPELINE_STAGES[i + 1]);
    const conv = clamp(asNum(config.stageConversionDefaults?.[key], 1), 0, 1);
    const days = Math.max(0, asNum(config.stageDurationDefaultsDays?.[key], 0));
    probability *= conv;
    daysToActive += days;
  }

  const projectedDate = addDaysUTC(baseDate, daysToActive);
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

  const week0 = startOfWeekUTC(asOfDate);
  const weeklyRows = [];
  for (let i = 0; i < horizonWeeks; i++){
    weeklyRows.push({
      weekStarting: toIsoDateUTC(addDaysUTC(week0, i * 7)),
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
      projectedActiveDate: toIsoDateUTC(projection.projectedDate),
    });

    const weekStart = startOfWeekUTC(projection.projectedDate);
    let weekIdx = Math.floor((weekStart.getTime() - week0.getTime()) / WEEK_MS);
    if (!Number.isFinite(weekIdx)) weekIdx = -1;
    if (weekIdx < 0) weekIdx = 0;

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
  if (els.expectedHorizon) els.expectedHorizon.textContent = result.expectedHorizon.toFixed(2);
  if (els.expectedBeyond) els.expectedBeyond.textContent = result.expectedBeyond.toFixed(2);

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
          <td class="num">${row.expectedNewActive.toFixed(2)}</td>
          <td class="num">${row.recruitCount}</td>
          <td class="num">${row.cumulativeExpectedActive.toFixed(2)}</td>
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
          <td class="num">${(row.probability * 100).toFixed(1)}%</td>
          <td class="num">${row.daysToActive.toFixed(1)}</td>
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
  const asOfDate = parseIsoDateInput(els.asOfDate?.value) || parseIsoDateInput(todayIso()) || new Date();
  const horizonWeeks = clamp(asInt(els.horizonWeeks?.value, 16), 1, 104);
  if (els.horizonWeeks) els.horizonWeeks.value = String(horizonWeeks);

  const config = readAssumptionsFromUi(state.config || DEFAULT_FORECAST_CONFIG);
  state.config = config;

  const [persons, pipelineRecords] = await Promise.all([
    getAll("persons"),
    getAll("pipelineRecords"),
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
  });
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
  });
  state.config = normalizeConfig(saved || reset);
  renderAssumptionTable(state.config);
  await recomputeForecast("Reset defaults");
}

function exportWeeklyCsv(){
  const rows = (state.weeklyRows || []).map((r) => [
    r.weekStarting,
    r.expectedNewActive.toFixed(4),
    String(r.recruitCount),
    r.cumulativeExpectedActive.toFixed(4),
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
    (r.probability * 100).toFixed(2),
    r.daysToActive.toFixed(2),
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
  await ensureOperationsDefaults();
  if (els.asOfDate && !clean(els.asOfDate.value)){
    els.asOfDate.value = todayIso();
  }

  const stored = await getById("forecastConfigs", "default");
  state.config = normalizeConfig(stored || DEFAULT_FORECAST_CONFIG);
  renderAssumptionTable(state.config);

  wire();
  await recomputeForecast("Init");
}

init().catch((e) => {
  setMsg(e?.message ? String(e.message) : "Initialization failed.");
});
