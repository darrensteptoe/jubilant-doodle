// @ts-check
import { readJsonFile, roundWholeNumberByMode } from "./utils.js";
import { loadState } from "./storage.js";
import { PIPELINE_STAGES } from "./features/operations/schema.js";
import {
  ensureOperationsDefaults,
  getAll,
  getSummaryCounts,
  put,
  remove,
} from "./features/operations/store.js";
import { computeOperationalRollups } from "./features/operations/rollups.js";
import { computeOperationsPerformancePaceView } from "./features/operations/performancePace.js";
import {
  formatOperationsDateTime,
  formatOperationsOneDecimal,
  formatOperationsPercentFromUnit,
  formatOperationsWhole,
} from "./features/operations/view.js";
import {
  downloadOperationsSnapshot,
  importOperationsSnapshot,
  downloadStoreCsv,
  importStoreCsv,
} from "./features/operations/io.js";
import {
  applyOperationsContextToLinks,
  resolveOperationsContext,
  summarizeOperationsContext,
  toOperationsStoreOptions,
} from "./features/operations/context.js";
import {
  WORKED_ACTIVITY_MODE_ID,
  writeOperationsMapContext,
} from "./features/operations/mapContextBridge.js";
import {
  twCapBuildReadinessStatsModule,
  twCapCleanModule,
  twCapLatestRecordByPersonModule,
  twCapMedianModule,
  twCapParseDateModule,
  twCapRatioTextModule,
} from "./app/twCapHelpers.js";
import { operationsDaysSince } from "./features/operations/time.js";

const MODULE_IDS = [
  "overview",
  "operations_training",
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

const operationsContext = resolveOperationsContext();
const storeScope = toOperationsStoreOptions(operationsContext);

const els = {
  navButtons: Array.from(document.querySelectorAll(".operations-nav-btn[data-module]")),
  panels: Array.from(document.querySelectorAll(".operations-module[data-module-panel]")),
  trainingJumpButtons: Array.from(document.querySelectorAll("[data-training-jump-target]")),
  btnTwExportJson: document.getElementById("btnTwExportJson"),
  btnTwImportJson: document.getElementById("btnTwImportJson"),
  twImportMode: document.getElementById("twImportMode"),
  twImportFile: document.getElementById("twImportFile"),
  twCsvImportFile: document.getElementById("twCsvImportFile"),
  btnTwRefresh: document.getElementById("btnTwRefresh"),
  btnCsvExportInterviews: document.getElementById("btnCsvExportInterviews"),
  btnCsvImportInterviews: document.getElementById("btnCsvImportInterviews"),
  btnCsvExportOnboarding: document.getElementById("btnCsvExportOnboarding"),
  btnCsvImportOnboarding: document.getElementById("btnCsvImportOnboarding"),
  btnCsvExportTraining: document.getElementById("btnCsvExportTraining"),
  btnCsvImportTraining: document.getElementById("btnCsvImportTraining"),
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
  opPerfOrganizerTbody: document.getElementById("opPerfOrganizerTbody"),
  opPerfInsights: document.getElementById("opPerfInsights"),
  mapBridgeOrganizerSelect: document.getElementById("mapBridgeOrganizerSelect"),
  btnMapBridgeOrganizer: document.getElementById("btnMapBridgeOrganizer"),
  btnMapBridgeOffice: document.getElementById("btnMapBridgeOffice"),
  mapBridgeStatus: document.getElementById("mapBridgeStatus"),
  opsTrainingVideoHost: document.getElementById("opsTrainingVideoHost"),
  opsTrainingVideoStatus: document.getElementById("opsTrainingVideoStatus"),
};

function clean(value){
  return String(value || "").trim();
}

function readOperationsTrainingVideoUrl(){
  const viceConfig = (window && typeof window === "object" && window.__VICE_CONFIG__ && typeof window.__VICE_CONFIG__ === "object")
    ? window.__VICE_CONFIG__
    : {};
  return clean(
    viceConfig?.OPERATIONS_TRAINING_YOUTUBE_URL
    || viceConfig?.OPERATIONS_TRAINING_VIDEO_URL
    || (window && typeof window === "object" ? window.__OPERATIONS_TRAINING_VIDEO_URL : ""),
  );
}

function normalizeYouTubeVideoId(value){
  const id = clean(value).replace(/[^A-Za-z0-9_-]/g, "");
  return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : "";
}

function resolveOperationsTrainingVideoEmbedUrl(rawUrl){
  const candidate = clean(rawUrl);
  if (!candidate){
    return "";
  }
  let parsed;
  try {
    parsed = new URL(candidate, window.location.href);
  } catch {
    return "";
  }

  const host = clean(parsed.hostname).toLowerCase();
  const pathParts = clean(parsed.pathname)
    .split("/")
    .map((part) => clean(part))
    .filter(Boolean);
  let videoId = "";

  if (host === "youtu.be"){
    videoId = normalizeYouTubeVideoId(pathParts[0]);
  } else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")){
    if (pathParts[0] === "watch"){
      videoId = normalizeYouTubeVideoId(parsed.searchParams.get("v"));
    } else if (pathParts[0] === "shorts" || pathParts[0] === "live"){
      videoId = normalizeYouTubeVideoId(pathParts[1]);
    } else if (pathParts[0] === "embed"){
      videoId = normalizeYouTubeVideoId(pathParts[1]);
    }
  }

  if (!videoId){
    return "";
  }
  return `https://www.youtube.com/embed/${videoId}?rel=0`;
}

function renderOperationsTrainingVideo(){
  const host = els.opsTrainingVideoHost;
  const status = els.opsTrainingVideoStatus;
  if (!(host instanceof HTMLElement)){
    return;
  }
  host.innerHTML = "";
  const configuredUrl = readOperationsTrainingVideoUrl();
  const embedUrl = resolveOperationsTrainingVideoEmbedUrl(configuredUrl);

  if (!embedUrl){
    const placeholder = document.createElement("div");
    placeholder.className = "operations-training-video-placeholder";
    placeholder.innerHTML = `
      <h4>Training video coming soon</h4>
      <p>A full walkthrough video will appear here once it has been added. Until then, use the written guide below for a complete overview of how to use the Operations Hub.</p>
    `;
    host.appendChild(placeholder);
    if (status instanceof HTMLElement){
      status.textContent = "Training video coming soon. Use the written guide below until the walkthrough is added.";
    }
    return;
  }

  const frame = document.createElement("iframe");
  frame.src = embedUrl;
  frame.title = "Operations Hub training walkthrough";
  frame.loading = "lazy";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  frame.allowFullscreen = true;

  const frameWrap = document.createElement("div");
  frameWrap.className = "operations-training-video-embed";
  frameWrap.appendChild(frame);
  host.appendChild(frameWrap);
  if (status instanceof HTMLElement){
    status.textContent = "Video walkthrough loaded.";
  }
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

function setMapBridgeStatus(text){
  if (els.mapBridgeStatus) {
    els.mapBridgeStatus.textContent = text || "";
  }
}

function contextSummaryText(){
  return summarizeOperationsContext(operationsContext);
}

function buildMapStageUrl(){
  const url = new URL("index.html", window.location.href);
  url.searchParams.set("stage", "map");
  const campaignId = clean(operationsContext?.campaignId);
  const campaignName = clean(operationsContext?.campaignName);
  const officeId = clean(operationsContext?.officeId);
  if (campaignId) url.searchParams.set("campaign", campaignId);
  if (campaignName) url.searchParams.set("campaignName", campaignName);
  if (officeId) url.searchParams.set("office", officeId);
  return url.toString();
}

function mapBridgeOrganizerSelection(){
  const select = els.mapBridgeOrganizerSelect;
  if (!(select instanceof HTMLSelectElement)) {
    return { organizerId: "", organizerName: "" };
  }
  const organizerId = clean(select.value);
  if (!organizerId) {
    return { organizerId: "", organizerName: "" };
  }
  const activeOption = select.selectedOptions?.[0];
  const organizerName = clean(activeOption?.dataset?.organizerName || activeOption?.textContent || organizerId);
  return { organizerId, organizerName };
}

function syncMapBridgeOrganizerOptions(performancePace){
  const select = els.mapBridgeOrganizerSelect;
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  const organizerRows = Array.isArray(performancePace?.organizers) ? performancePace.organizers : [];
  const previous = clean(select.value);
  const options = organizerRows
    .map((row) => ({
      organizerId: clean(row?.organizerId),
      name: clean(row?.name) || clean(row?.organizerId),
      status: clean(row?.status),
      completedThisWeek: Number(row?.completedThisWeek || 0) || 0,
    }))
    .filter((row) => row.organizerId)
    .sort((a, b) => a.name.localeCompare(b.name));

  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All organizers (office scope)";
  select.appendChild(allOption);
  for (const row of options){
    const option = document.createElement("option");
    option.value = row.organizerId;
    option.dataset.organizerName = row.name;
    option.textContent = row.status
      ? `${row.name} (${row.status}; this week ${fmtInt(row.completedThisWeek)})`
      : `${row.name} (this week ${fmtInt(row.completedThisWeek)})`;
    select.appendChild(option);
  }
  if (previous && options.some((row) => row.organizerId === previous)){
    select.value = previous;
  } else {
    select.value = "";
  }
}

function publishWorkedMapBridgeContext({ focusType, organizerId = "", organizerName = "" }){
  const officeId = clean(operationsContext?.officeId);
  const campaignId = clean(operationsContext?.campaignId);
  const campaignName = clean(operationsContext?.campaignName);
  const next = writeOperationsMapContext({
    focusType: clean(focusType),
    organizerId: clean(organizerId),
    organizerName: clean(organizerName),
    officeId,
    campaignId,
    campaignName,
    requestedMode: WORKED_ACTIVITY_MODE_ID,
    source: "operations_hub",
  });
  return next;
}

function openMapWithWorkedBridge({ focusType, organizerId = "", organizerName = "" }){
  const next = publishWorkedMapBridgeContext({
    focusType,
    organizerId,
    organizerName,
  });
  const target = buildMapStageUrl();
  if (focusType === "organizer" && clean(next?.organizerId)){
    setMapBridgeStatus(`Opening map worked geography for organizer ${clean(next.organizerName) || clean(next.organizerId)}.`);
  } else if (focusType === "office" && clean(next?.officeId)){
    setMapBridgeStatus(`Opening map worked geography for office ${clean(next.officeId)}.`);
  } else {
    setMapBridgeStatus("Opening map worked geography with office scope.");
  }
  window.location.assign(target);
}

function fmtInt(value){
  return formatOperationsWhole(value, { fallback: "0" });
}

function fmt1(value){
  return formatOperationsOneDecimal(value, { digits: 1, fallback: "0.0" });
}

function fmtPct01(value){
  return formatOperationsPercentFromUnit(value, { digits: 1, fallback: "—" });
}

function fmtDate(value){
  return formatOperationsDateTime(clean(value), { fallback: "—" });
}

function fmtRatePerWeek(value){
  return Number.isFinite(Number(value)) ? `${fmt1(value)}/wk` : "—";
}

function ratioText(numerator, denominator){
  return twCapRatioTextModule(numerator, denominator);
}

function buildReadinessStats(onboardingRecords, trainingRecords){
  return twCapBuildReadinessStatsModule(onboardingRecords, trainingRecords, {
    twCapLatestRecordByPerson: (rows) => twCapLatestRecordByPersonModule(rows, {
      twCapClean: twCapCleanModule,
      twCapParseDate: twCapParseDateModule,
    }),
    twCapClean: twCapCleanModule,
    twCapParseDate: twCapParseDateModule,
    twCapMedian: twCapMedianModule,
  });
}

function stageEnteredAt(rec){
  const stage = clean(rec?.stage);
  const byStage = rec?.stageDates?.[stage];
  return clean(byStage) || clean(rec?.updatedAt) || clean(rec?.createdAt);
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

function officeMixSummaryText(officeMix){
  const rows = Array.isArray(officeMix) ? officeMix : [];
  if (!rows.length) return "Office staffing mix unavailable.";
  return rows
    .slice(0, 4)
    .map((row) => {
      const office = clean(row?.officeId) || "unassigned";
      const organizers = fmtInt(row?.organizerCount || 0);
      const paidCanvassers = fmtInt(row?.paidCanvasserCount || 0);
      const volunteers = fmtInt(row?.activeVolunteerCount || 0);
      return `${office}: org ${organizers} | paid canv ${paidCanvassers} | vol ${volunteers}`;
    })
    .join(" · ");
}

function renderPerformancePace(view){
  const office = (view && typeof view === "object" && view.office && typeof view.office === "object")
    ? view.office
    : {};
  const organizers = Array.isArray(view?.organizers) ? view.organizers : [];
  const insights = Array.isArray(view?.insights) ? view.insights : [];
  const weekly = (office && typeof office.weekly === "object") ? office.weekly : {};

  const goal = Number(office.goal);
  const completed = Number(office.completedToDate);
  const remaining = Number(office.remainingToGoal);
  const percentComplete = Number(office.percentComplete);
  const percentRemaining = Number(office.percentRemaining);
  const requiredWeeklyPace = Number(office.requiredWeeklyPace);
  const averageWeeklyPace = Number(office.averageWeeklyPace);
  const activeVolunteers = Number(office.activeVolunteers);
  const vbmsCollected = Number(office.vbmsCollected);
  const thisWeek = Number(weekly.thisWeek);
  const priorWeek = Number(weekly.priorWeek);
  const paceStatus = clean(office.paceStatus) || "—";
  const weeklyDirection = clean(weekly.direction);

  setText("opPerfGoal", Number.isFinite(goal) ? fmtInt(goal) : "—");
  setText("opPerfCompleted", Number.isFinite(completed) ? fmtInt(completed) : "—");
  setText("opPerfRemaining", Number.isFinite(remaining) ? fmtInt(remaining) : "—");
  setText("opPerfPctComplete", Number.isFinite(percentComplete) ? fmtPct01(percentComplete) : "—");
  setText("opPerfPctRemaining", Number.isFinite(percentRemaining) ? fmtPct01(percentRemaining) : "—");
  setText("opPerfRequiredWeekly", fmtRatePerWeek(requiredWeeklyPace));
  setText("opPerfAverageWeekly", fmtRatePerWeek(averageWeeklyPace));
  setText("opPerfPaceStatus", paceStatus);
  setText("opPerfActiveVolunteers", Number.isFinite(activeVolunteers) ? fmtInt(activeVolunteers) : "—");
  setText("opPerfVbms", Number.isFinite(vbmsCollected) ? fmtInt(vbmsCollected) : "—");
  setText("opPerfThisWeek", Number.isFinite(thisWeek) ? fmtInt(thisWeek) : "—");
  setText("opPerfPriorWeek", Number.isFinite(priorWeek) ? fmtInt(priorWeek) : "—");

  const trendLabel = weeklyDirection === "up"
    ? "Trend: improving vs prior week."
    : (weeklyDirection === "down" ? "Trend: lower vs prior week." : "Trend: flat vs prior week.");
  const goalSourceText = clean(view?.goalSource) === "goalSupportIds"
    ? "Canonical source: goalSupportIds."
    : "Canonical goal not found for this scope.";
  const weeksText = Number.isFinite(Number(office.weeksRemaining))
    ? `Weeks remaining: ${fmt1(office.weeksRemaining)}.`
    : "Weeks remaining unavailable.";
  setText("opPerfMeta", `${goalSourceText} ${weeksText} ${trendLabel}`);

  if (els.opPerfOrganizerTbody){
    els.opPerfOrganizerTbody.innerHTML = "";
    if (!organizers.length){
      const tr = document.createElement("tr");
      tr.innerHTML = '<td class="muted" colspan="11">No organizer production rows available for this scope yet.</td>';
      els.opPerfOrganizerTbody.appendChild(tr);
    } else {
      for (const row of organizers){
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${clean(row?.name) || "—"}</td>
          <td class="num">${fmtInt(row?.completedThisWeek || 0)}</td>
          <td class="num">${fmtInt(row?.completedToDate || 0)}</td>
          <td class="num">${Number.isFinite(Number(row?.percentToShare)) ? fmtPct01(row.percentToShare) : "—"}</td>
          <td class="num">${Number.isFinite(Number(row?.remainingToShare)) ? fmtInt(row.remainingToShare) : "—"}</td>
          <td class="num">${fmtRatePerWeek(row?.requiredWeeklyPace)}</td>
          <td class="num">${fmtRatePerWeek(row?.averageWeeklyPace)}</td>
          <td class="num">${fmtInt(row?.activeVolunteers || 0)}</td>
          <td class="num">${fmtInt(row?.vbmsCollected || 0)}</td>
          <td>${clean(row?.status) || "—"}</td>
          <td>${clean(row?.improvementCue) || "—"}</td>
        `;
        els.opPerfOrganizerTbody.appendChild(tr);
      }
    }
  }

  if (els.opPerfInsights){
    els.opPerfInsights.innerHTML = "";
    if (!insights.length){
      const li = document.createElement("li");
      li.className = "muted";
      li.textContent = "No deterministic coaching insights yet for this scope.";
      els.opPerfInsights.appendChild(li);
    } else {
      for (const insight of insights){
        const li = document.createElement("li");
        li.textContent = clean(insight);
        els.opPerfInsights.appendChild(li);
      }
    }
  }
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

function normalizeTrainingAnchor(value){
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function moduleExists(moduleId){
  const id = clean(moduleId);
  if (!id){
    return false;
  }
  if (MODULE_IDS.includes(id)){
    return true;
  }
  return els.navButtons.some((btn) => clean(btn.getAttribute("data-module")) === id)
    || els.panels.some((panel) => clean(panel.getAttribute("data-module-panel")) === id);
}

function decodeHashFragment(raw){
  const value = clean(raw);
  if (!value){
    return "";
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseModuleHash(hashValue = window.location.hash){
  const raw = decodeHashFragment(clean(hashValue).replace(/^#/, ""));
  const fallback = { moduleId: "overview", trainingAnchor: "" };
  if (!raw){
    return fallback;
  }
  const match = raw.match(/^([^:/]+)(?:[:/](.+))?$/);
  const moduleId = clean(match?.[1]);
  if (!moduleExists(moduleId)){
    return fallback;
  }
  const trainingAnchor = moduleId === "operations_training"
    ? normalizeTrainingAnchor(match?.[2])
    : "";
  return { moduleId, trainingAnchor };
}

function scrollToOperationsTrainingAnchor(anchorId, { smooth = false } = {}){
  const id = normalizeTrainingAnchor(anchorId);
  if (!id){
    return false;
  }
  const target = document.getElementById(id);
  if (!(target instanceof HTMLElement)){
    return false;
  }
  target.scrollIntoView({
    behavior: smooth ? "smooth" : "auto",
    block: "start",
  });
  return true;
}

function activateModule(moduleId, { trainingAnchor = "", smoothScroll = false, updateHash = true } = {}){
  const active = moduleExists(moduleId) ? clean(moduleId) : "overview";
  const activeTrainingAnchor = active === "operations_training" ? normalizeTrainingAnchor(trainingAnchor) : "";

  for (const btn of els.navButtons){
    const isActive = clean(btn.getAttribute("data-module")) === active;
    btn.classList.toggle("is-active", isActive);
  }

  for (const panel of els.panels){
    const isActive = clean(panel.getAttribute("data-module-panel")) === active;
    panel.classList.toggle("is-active", isActive);
  }

  const nextHash = activeTrainingAnchor
    ? `#${active}:${activeTrainingAnchor}`
    : `#${active}`;
  if (updateHash && window.location.hash !== nextHash){
    history.replaceState(null, "", nextHash);
  }
  if (active === "operations_training" && activeTrainingAnchor){
    requestAnimationFrame(() => {
      scrollToOperationsTrainingAnchor(activeTrainingAnchor, { smooth: smoothScroll });
    });
  }
}

function moduleFromHash(){
  return parseModuleHash().moduleId;
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
  await ensureOperationsDefaults(storeScope);

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
    getAll("persons", storeScope),
    getAll("pipelineRecords", storeScope),
    getAll("interviews", storeScope),
    getAll("onboardingRecords", storeScope),
    getAll("trainingRecords", storeScope),
    getAll("shiftRecords", storeScope),
    getAll("turfEvents", storeScope),
    getAll("forecastConfigs", storeScope),
    getSummaryCounts(storeScope),
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
    const d = operationsDaysSince(stageEnteredAt(rec), { floor: false });
    if (!Number.isFinite(d)) continue;
    stageDaysTotal += d;
    stageDaysCount += 1;
  }
  const avgDaysInStage = stageDaysCount > 0 ? (stageDaysTotal / stageDaysCount) : 0;

  const rollups = computeOperationalRollups({
    persons,
    shiftRecords,
    turfEvents,
    options: { allowTurfFallbackAttempts: false },
  });
  const scopedState = loadState(storeScope) || {};
  const performancePace = computeOperationsPerformancePaceView({
    stateSnapshot: scopedState,
    persons,
    shiftRecords,
    turfEvents,
  });
  const coverage = rollups.coverage || {};
  const prod = rollups.production || {};
  const workforce = rollups.workforce || {};
  const officeMix = Array.isArray(rollups.officeMix) ? rollups.officeMix : [];
  const dedupe = rollups.dedupe || {};

  setText("ovPersons", fmtInt(persons.length));
  setText("ovPipeline", fmtInt(pipelineRecords.length));
  setText("ovShifts", fmtInt(shiftRecords.length));
  setText("ovTurf", fmtInt(turfEvents.length));
  setText("ovForecastConfigs", fmtInt(forecastConfigs.length));
  setText("ovActiveStage", fmtInt(activeStage));
  setText("ovOrganizerCount", fmtInt(workforce.organizerCount || 0));
  setText("ovPaidCanvasserCount", fmtInt(workforce.paidCanvasserCount || 0));
  setText("ovActiveVolunteerCount", fmtInt(workforce.activeVolunteerCount || 0));
  setText("ovVolunteerShowRate", fmtPct01(workforce.volunteerShowRate));
  setText("ovOrganizerSupervisionCapacity", fmtInt(workforce.organizerSupervisionCapacity || 0));
  setText("ovNote", `Production source: ${prod.source || "shift"} | Dedupe rule: ${dedupe.rule || "shift_primary_turf_coverage"}`);
  setText("ovOfficeMix", officeMixSummaryText(officeMix));
  renderPerformancePace(performancePace);
  syncMapBridgeOrganizerOptions(performancePace);
  const activeOrganizer = mapBridgeOrganizerSelection();
  if (activeOrganizer.organizerId){
    setMapBridgeStatus(`Ready to open map worked geography for organizer ${activeOrganizer.organizerName || activeOrganizer.organizerId}.`);
  } else {
    setMapBridgeStatus("Ready to open map worked geography for active office scope or selected organizer.");
  }

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
  const readyRatioText = `${formatOperationsOneDecimal(readyRatio, { digits: 1, fallback: "0.0" })}%`;
  setText("trRecordCount", fmtInt(trainingTotal));
  setText("trTrainingComplete", fmtInt(trainingCompleted));
  setText("trActive", fmtInt(trainingInProgress));
  setText("trReadyRatio", readyRatioText);

  const interviewPassCount = interviews.filter((r) => clean(r?.outcome) === "pass").length;
  const interviewCompleteCount = interviews.filter((r) => {
    const outcome = clean(r?.outcome);
    return outcome && outcome !== "pending";
  }).length;
  const offerExtendedCount = Number(stageCounts.get("Offer Extended") || 0);
  const offerAcceptedCount = Number(stageCounts.get("Offer Accepted") || 0);
  const onboardingCompletionRate = onboardingRecords.length > 0 ? (onboardingCompleted / onboardingRecords.length) : null;
  const trainingCompletionRate = trainingTotal > 0 ? (trainingCompleted / trainingTotal) : null;
  const interviewPassRate = interviewCompleteCount > 0 ? (interviewPassCount / interviewCompleteCount) : null;
  const offerAcceptRate = offerExtendedCount > 0 ? (offerAcceptedCount / offerExtendedCount) : null;
  const rampSignals = [interviewPassRate, offerAcceptRate, onboardingCompletionRate, trainingCompletionRate]
    .filter((v) => Number.isFinite(v));
  const compositeRampSignal = rampSignals.length > 0
    ? rampSignals.reduce((sum, v) => sum + v, 0) / rampSignals.length
    : null;
  const compositeRampSignalText = formatOperationsPercentFromUnit(compositeRampSignal, { digits: 1, fallback: "—" });

  setText("fcInterviewPassRate", ratioText(interviewPassCount, interviewCompleteCount));
  setText("fcOfferAcceptRate", ratioText(offerAcceptedCount, offerExtendedCount));
  setText("fcOnboardingCompletionRate", ratioText(onboardingCompleted, onboardingRecords.length));
  setText("fcTrainingCompletionRate", ratioText(trainingCompleted, trainingTotal));
  setText("fcCompositeRampSignal", compositeRampSignalText);
  setText(
    "fcHintNote",
    Number.isFinite(compositeRampSignal)
      ? `Display-only diagnostics. Composite ramp signal: ${compositeRampSignalText} (avg of interview/offer/onboarding/training conversion hints).`
      : "Display-only diagnostics. Add interview/onboarding/training records to unlock conversion hints."
  );

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

  const readiness = buildReadinessStats(onboardingRecords, trainingRecords);
  setText("agReadyNow", fmtInt(readiness.readyNow));
  setText("agRecentReadyPerWeek", fmt1(readiness.recentReadyPerWeek));
  setText("agReadyIn14d", fmt1(readiness.projectedReady14d));
  setText("agMedianReadyDays", Number.isFinite(readiness.medianReadyDays) ? fmt1(readiness.medianReadyDays) : "—");

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
        workforce: {
          organizerCount: Number(workforce.organizerCount || 0),
          paidCanvasserCount: Number(workforce.paidCanvasserCount || 0),
          activeVolunteerCount: Number(workforce.activeVolunteerCount || 0),
          activePaidHeadcount: Number(workforce.activePaidHeadcount || 0),
          activeStipendHeadcount: Number(workforce.activeStipendHeadcount || 0),
          activeVolunteerHeadcount: Number(workforce.activeVolunteerHeadcount || 0),
          volunteerShowRate: Number.isFinite(workforce.volunteerShowRate) ? Number(workforce.volunteerShowRate) : null,
          organizerRecruitmentMultiplier: Number.isFinite(workforce.organizerRecruitmentMultiplier) ? Number(workforce.organizerRecruitmentMultiplier) : null,
          organizerSupervisionCapacity: Number.isFinite(workforce.organizerSupervisionCapacity) ? Number(workforce.organizerSupervisionCapacity) : null,
          paidCanvasserProductivity: Number.isFinite(workforce.paidCanvasserProductivity) ? Number(workforce.paidCanvasserProductivity) : null,
          volunteerProductivity: Number.isFinite(workforce.volunteerProductivity) ? Number(workforce.volunteerProductivity) : null,
        },
        officeMix: officeMix.map((row) => ({
          officeId: clean(row?.officeId) || "unassigned",
          headcount: Number(row?.headcount || 0),
          activeHeadcount: Number(row?.activeHeadcount || 0),
          organizerCount: Number(row?.organizerCount || 0),
          paidCanvasserCount: Number(row?.paidCanvasserCount || 0),
          activeVolunteerCount: Number(row?.activeVolunteerCount || 0),
          volunteerLeadCount: Number(row?.volunteerLeadCount || 0),
          paidHeadcount: Number(row?.paidHeadcount || 0),
          stipendHeadcount: Number(row?.stipendHeadcount || 0),
          volunteerHeadcount: Number(row?.volunteerHeadcount || 0),
        })),
        readiness: {
          readyNow: Number(readiness.readyNow || 0),
          recentReadyPerWeek: Number(readiness.recentReadyPerWeek || 0),
          projectedReady14d: Number(readiness.projectedReady14d || 0),
          medianReadyDays: Number.isFinite(readiness.medianReadyDays) ? Number(readiness.medianReadyDays) : null,
        },
        rampHints: {
          interviewPassRate: Number.isFinite(interviewPassRate) ? Number(interviewPassRate) : null,
          offerAcceptRate: Number.isFinite(offerAcceptRate) ? Number(offerAcceptRate) : null,
          onboardingCompletionRate: Number.isFinite(onboardingCompletionRate) ? Number(onboardingCompletionRate) : null,
          trainingCompletionRate: Number.isFinite(trainingCompletionRate) ? Number(trainingCompletionRate) : null,
          compositeRampSignal: Number.isFinite(compositeRampSignal) ? Number(compositeRampSignal) : null,
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
  }, storeScope);

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
  }, storeScope);

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
    sessions: Number.isFinite(sessions)
      ? Math.max(0, roundWholeNumberByMode(sessions, { mode: "round", fallback: 0 }) || 0)
      : 0,
    completionStatus: clean(els.trCompletionStatus?.value) || "not_started",
    completedAt: clean(els.trCompletedAt?.value),
    notes: clean(els.trNotes?.value),
  }, storeScope);

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
      await remove("interviews", id, storeScope);
      await refreshDashboard();
    });
  }

  if (els.onbTbody){
    els.onbTbody.addEventListener("click", async (event) => {
      const btn = event.target?.closest?.("button[data-action='delete-onboarding']");
      if (!btn) return;
      const id = clean(btn.getAttribute("data-id"));
      if (!id) return;
      await remove("onboardingRecords", id, storeScope);
      await refreshDashboard();
    });
  }

  if (els.trnTbody){
    els.trnTbody.addEventListener("click", async (event) => {
      const btn = event.target?.closest?.("button[data-action='delete-training']");
      if (!btn) return;
      const id = clean(btn.getAttribute("data-id"));
      if (!id) return;
      await remove("trainingRecords", id, storeScope);
      await refreshDashboard();
    });
  }
}

function wireModuleNav(){
  for (const btn of els.navButtons){
    btn.addEventListener("click", () => {
      const mod = clean(btn.getAttribute("data-module"));
      activateModule(mod, { updateHash: true });
    });
  }
  window.addEventListener("hashchange", () => {
    const route = parseModuleHash();
    activateModule(route.moduleId, {
      trainingAnchor: route.trainingAnchor,
      updateHash: false,
    });
  });
}

function wireOperationsTrainingAnchors(){
  for (const btn of els.trainingJumpButtons){
    btn.addEventListener("click", () => {
      const targetId = clean(btn.getAttribute("data-training-jump-target"));
      if (!targetId){
        return;
      }
      activateModule("operations_training", {
        trainingAnchor: targetId,
        smoothScroll: true,
        updateHash: true,
      });
    });
  }
}

function wireMapBridgeActions(){
  if (els.mapBridgeOrganizerSelect){
    els.mapBridgeOrganizerSelect.addEventListener("change", () => {
      const activeOrganizer = mapBridgeOrganizerSelection();
      if (activeOrganizer.organizerId){
        publishWorkedMapBridgeContext({
          focusType: "organizer",
          organizerId: activeOrganizer.organizerId,
          organizerName: activeOrganizer.organizerName,
        });
        setMapBridgeStatus(`Organizer focus set: ${activeOrganizer.organizerName || activeOrganizer.organizerId}. Open map to inspect worked geography.`);
      } else {
        publishWorkedMapBridgeContext({
          focusType: "office",
        });
        setMapBridgeStatus("Organizer focus cleared. Office worked geography focus is ready.");
      }
    });
  }

  if (els.btnMapBridgeOrganizer){
    els.btnMapBridgeOrganizer.addEventListener("click", () => {
      const activeOrganizer = mapBridgeOrganizerSelection();
      if (!activeOrganizer.organizerId){
        setMapBridgeStatus("Select an organizer first, then open organizer worked geography.");
        return;
      }
      openMapWithWorkedBridge({
        focusType: "organizer",
        organizerId: activeOrganizer.organizerId,
        organizerName: activeOrganizer.organizerName,
      });
    });
  }

  if (els.btnMapBridgeOffice){
    els.btnMapBridgeOffice.addEventListener("click", () => {
      openMapWithWorkedBridge({ focusType: "office" });
    });
  }
}

function wireIoActions(){
  if (els.btnTwExportJson){
    els.btnTwExportJson.addEventListener("click", async () => {
      try {
        await downloadOperationsSnapshot("operations-snapshot.json", { context: storeScope });
        setStatus("Exported Operations JSON snapshot.");
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
        await importOperationsSnapshot(payload, { mode, context: storeScope });
        setStatus(`Imported Operations JSON (${mode}).`);
        await refreshDashboard();
      } catch (err) {
        setStatus(err?.message ? String(err.message) : "Import failed.");
      } finally {
        els.twImportFile.value = "";
      }
    });
  }

  if (els.btnCsvExportInterviews){
    els.btnCsvExportInterviews.addEventListener("click", async () => {
      try {
        await downloadStoreCsv("interviews", "operations-interviews.csv", { context: storeScope });
        setStatus("Exported Interviews CSV.");
      } catch (err) {
        setStatus(err?.message ? String(err.message) : "Interviews CSV export failed.");
      }
    });
  }
  if (els.btnCsvExportOnboarding){
    els.btnCsvExportOnboarding.addEventListener("click", async () => {
      try {
        await downloadStoreCsv("onboardingRecords", "operations-onboarding.csv", { context: storeScope });
        setStatus("Exported Onboarding CSV.");
      } catch (err) {
        setStatus(err?.message ? String(err.message) : "Onboarding CSV export failed.");
      }
    });
  }
  if (els.btnCsvExportTraining){
    els.btnCsvExportTraining.addEventListener("click", async () => {
      try {
        await downloadStoreCsv("trainingRecords", "operations-training.csv", { context: storeScope });
        setStatus("Exported Training CSV.");
      } catch (err) {
        setStatus(err?.message ? String(err.message) : "Training CSV export failed.");
      }
    });
  }

  if (els.btnCsvImportInterviews && els.twCsvImportFile){
    els.btnCsvImportInterviews.addEventListener("click", () => {
      els.twCsvImportFile.dataset.store = "interviews";
      els.twCsvImportFile.click();
    });
  }
  if (els.btnCsvImportOnboarding && els.twCsvImportFile){
    els.btnCsvImportOnboarding.addEventListener("click", () => {
      els.twCsvImportFile.dataset.store = "onboardingRecords";
      els.twCsvImportFile.click();
    });
  }
  if (els.btnCsvImportTraining && els.twCsvImportFile){
    els.btnCsvImportTraining.addEventListener("click", () => {
      els.twCsvImportFile.dataset.store = "trainingRecords";
      els.twCsvImportFile.click();
    });
  }

  if (els.twCsvImportFile){
    els.twCsvImportFile.addEventListener("change", async () => {
      try {
        const file = els.twCsvImportFile.files?.[0];
        const storeName = clean(els.twCsvImportFile.dataset.store);
        if (!file || !storeName) return;
        const mode = clean(els.twImportMode?.value) === "replace" ? "replace" : "merge";
        const text = await file.text();
        const result = await importStoreCsv(storeName, text, { mode, context: storeScope });
        setStatus(`Imported ${storeName} CSV (${mode}, ${fmtInt(result?.count || 0)} rows).`);
        await refreshDashboard();
      } catch (err) {
        setStatus(err?.message ? String(err.message) : "CSV import failed.");
      } finally {
        els.twCsvImportFile.value = "";
        delete els.twCsvImportFile.dataset.store;
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
  applyOperationsContextToLinks(operationsContext, ".note a[href], .toolbar a[href]");
  renderOperationsTrainingVideo();
  const route = parseModuleHash();
  activateModule(route.moduleId, {
    trainingAnchor: route.trainingAnchor,
    updateHash: true,
  });
  wireModuleNav();
  wireOperationsTrainingAnchors();
  wireCrudActions();
  wireMapBridgeActions();
  wireIoActions();
  clearInterviewForm();
  clearOnboardingForm();
  clearTrainingForm();
  await refreshDashboard();
  setStatus(`Ready. ${contextSummaryText()}`);
}

init().catch((err) => {
  setStatus(err?.message ? String(err.message) : "Initialization failed.");
});
