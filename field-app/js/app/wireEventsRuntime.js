// @ts-check
import {
  addDefaultShockScenario,
  addDefaultCorrelationModel,
  attachEvidenceRecord,
  captureObservedMetricsFromDrift,
  createWhatIfIntelRequest,
  generateCalibrationSourceBrief,
  generateDriftExplanationBrief,
  generateScenarioDiffBrief,
  generateScenarioSummaryBrief,
  generateSensitivityInterpretationBrief,
  getLatestBriefByKind,
  intelBriefKindLabel,
  listIntelBriefKinds,
  importCorrelationModelsJson,
  importShockScenariosJson,
  loadDefaultBenchmarksForRaceType,
  listShockScenarios,
  getIntelWorkflow,
  listMissingEvidenceAudit,
  applyRecommendationDraftPatch,
  refreshDriftRecommendationsFromDrift,
  removeBenchmarkEntry,
  upsertBenchmarkEntry,
} from "./intelControlsRuntime.js";
import { ensureBudgetShape } from "./state.js";
import { applyDataRefPolicyRuntime } from "./dataRefPolicyRuntime.js";
import { normalizeElectionPrecinctPayload } from "../core/electionProviderAdapter.js";
import { buildDistrictDemoPayload } from "../core/districtDemoData.js";
import { resetIntelGeoBoundaryCache } from "./intelGeoMap.js";
import { wireDistrictCensusSimpleEvents } from "./districtCensusSimple.js";

/** @param {import("./types").WireEventsCtx} ctx */
export function wireBudgetTimelineEvents(ctx){
  const { els, state: initialState, getState, safeNum, commitUIUpdate, render } = ctx || {};
  const currentState = () => {
    if (typeof getState === "function"){
      const s = getState();
      return (s && typeof s === "object") ? s : null;
    }
    return (initialState && typeof initialState === "object") ? initialState : null;
  };
  const withState = (fn) => {
    const s = currentState();
    if (!s) return;
    fn(s);
  };

  if (!els || !currentState()) return;

  const ensureBudget = (state) => {
    ensureBudgetShape(state);
  };

  const watchBool = (el, fn) => {
    if (!el) return;
    el.addEventListener("change", () => {
      withState((state) => {
        ensureBudget(state);
        fn(state);
      });
      commitUIUpdate();
    });
  };

  const watchNum = (el, fn) => {
    if (!el) return;
    el.addEventListener("input", () => {
      withState((state) => {
        ensureBudget(state);
        fn(state);
      });
      commitUIUpdate();
    });
  };

  watchBool(els.roiDoorsEnabled, (state) => { state.budget.tactics.doors.enabled = !!els.roiDoorsEnabled.checked; });
  watchNum(els.roiDoorsCpa, (state) => { state.budget.tactics.doors.cpa = safeNum(els.roiDoorsCpa.value) ?? 0; });
  watchNum(els.roiDoorsCr, (state) => { state.budget.tactics.doors.crPct = safeNum(els.roiDoorsCr.value); });
  watchNum(els.roiDoorsSr, (state) => { state.budget.tactics.doors.srPct = safeNum(els.roiDoorsSr.value); });

  watchBool(els.roiPhonesEnabled, (state) => { state.budget.tactics.phones.enabled = !!els.roiPhonesEnabled.checked; });
  watchNum(els.roiPhonesCpa, (state) => { state.budget.tactics.phones.cpa = safeNum(els.roiPhonesCpa.value) ?? 0; });
  watchNum(els.roiPhonesCr, (state) => { state.budget.tactics.phones.crPct = safeNum(els.roiPhonesCr.value); });
  watchNum(els.roiPhonesSr, (state) => { state.budget.tactics.phones.srPct = safeNum(els.roiPhonesSr.value); });

  watchBool(els.roiTextsEnabled, (state) => { state.budget.tactics.texts.enabled = !!els.roiTextsEnabled.checked; });
  watchNum(els.roiTextsCpa, (state) => { state.budget.tactics.texts.cpa = safeNum(els.roiTextsCpa.value) ?? 0; });
  watchNum(els.roiTextsCr, (state) => { state.budget.tactics.texts.crPct = safeNum(els.roiTextsCr.value); });
  watchNum(els.roiTextsSr, (state) => { state.budget.tactics.texts.srPct = safeNum(els.roiTextsSr.value); });

  watchNum(els.roiOverheadAmount, (state) => { state.budget.overheadAmount = safeNum(els.roiOverheadAmount.value) ?? 0; });
  watchBool(els.roiIncludeOverhead, (state) => { state.budget.includeOverhead = !!els.roiIncludeOverhead.checked; });

  const watchOpt = (el, fn, evt = "input") => {
    if (!el) return;
    el.addEventListener(evt, () => {
      withState((state) => {
        ensureBudget(state);
        fn(state);
      });
      commitUIUpdate();
    });
  };

  watchOpt(els.optMode, (state) => { state.budget.optimize.mode = els.optMode.value; }, "change");
  watchOpt(els.optObjective, (state) => { state.budget.optimize.objective = els.optObjective.value; }, "change");
  watchOpt(els.tlOptEnabled, (state) => { state.budget.optimize.tlConstrainedEnabled = !!els.tlOptEnabled.checked; }, "change");
  watchOpt(els.tlOptObjective, (state) => { state.budget.optimize.tlConstrainedObjective = els.tlOptObjective.value || "max_net"; }, "change");
  watchOpt(els.optBudget, (state) => { state.budget.optimize.budgetAmount = safeNum(els.optBudget.value) ?? 0; });
  watchOpt(els.optCapacity, (state) => { state.budget.optimize.capacityAttempts = els.optCapacity.value ?? ""; });
  watchOpt(els.optStep, (state) => { state.budget.optimize.step = safeNum(els.optStep.value) ?? 25; });
  watchOpt(els.optUseDecay, (state) => { state.budget.optimize.useDecay = !!els.optUseDecay.checked; }, "change");

  const watchTL = (el, fn, evt = "input") => {
    if (!el) return;
    el.addEventListener(evt, () => {
      withState((state) => { fn(state); });
      commitUIUpdate();
    });
  };

  watchTL(els.timelineEnabled, (state) => { state.timelineEnabled = !!els.timelineEnabled.checked; }, "change");
  watchTL(els.timelineActiveWeeks, (state) => { state.timelineActiveWeeks = els.timelineActiveWeeks.value ?? ""; });
  watchTL(els.timelineGotvWeeks, (state) => { state.timelineGotvWeeks = safeNum(els.timelineGotvWeeks.value); });
  watchTL(els.timelineStaffCount, (state) => { state.timelineStaffCount = safeNum(els.timelineStaffCount.value) ?? 0; });
  watchTL(els.timelineStaffHours, (state) => { state.timelineStaffHours = safeNum(els.timelineStaffHours.value) ?? 0; });
  watchTL(els.timelineVolCount, (state) => { state.timelineVolCount = safeNum(els.timelineVolCount.value) ?? 0; });
  watchTL(els.timelineVolHours, (state) => { state.timelineVolHours = safeNum(els.timelineVolHours.value) ?? 0; });
  watchTL(els.timelineRampEnabled, (state) => { state.timelineRampEnabled = !!els.timelineRampEnabled.checked; }, "change");
  watchTL(els.timelineRampMode, (state) => { state.timelineRampMode = els.timelineRampMode.value || "linear"; }, "change");
  watchTL(els.timelineDoorsPerHour, (state) => { state.timelineDoorsPerHour = safeNum(els.timelineDoorsPerHour.value) ?? 0; });
  watchTL(els.timelineCallsPerHour, (state) => { state.timelineCallsPerHour = safeNum(els.timelineCallsPerHour.value) ?? 0; });
  watchTL(els.timelineTextsPerHour, (state) => { state.timelineTextsPerHour = safeNum(els.timelineTextsPerHour.value) ?? 0; });

  if (els.optRun) els.optRun.addEventListener("click", () => { render(); });
  if (els.roiRefresh) els.roiRefresh.addEventListener("click", () => { render(); });
}

/** @param {import("./types").WireEventsCtx} ctx */
export function wireIntelChecksEvents(ctx){
  const { els, state: initialState, getState, commitUIUpdate, safeNum, computeRealityDrift, markMcStale, engine } = ctx || {};
  const currentState = () => {
    if (typeof getState === "function"){
      const s = getState();
      return (s && typeof s === "object") ? s : null;
    }
    return (initialState && typeof initialState === "object") ? initialState : null;
  };
  if (!els || !currentState()) return;
  const districtCensusSimpleMode = true;
  if (districtCensusSimpleMode){
    wireDistrictCensusSimpleEvents({
      els,
      state: initialState,
      getState,
      commitUIUpdate,
      engine,
    });
    return;
  }
  const districtPhase1Mode = true;

  {
    const s = currentState();
    if (s && s.useDistrictIntel && !s?.districtIntelPack?.ready){
      s.useDistrictIntel = false;
    }
  }

  const setStatus = (el, msg, kind = "muted") => {
    if (!el) return;
    el.classList.remove("ok", "warn", "bad", "muted");
    el.classList.add(kind);
    el.textContent = String(msg || "Ready.");
  };
  const setBenchmarkStatus = (msg, kind = "muted") => setStatus(els.intelBenchmarkStatus, msg, kind);
  const setEvidenceStatus = (msg, kind = "muted") => setStatus(els.intelEvidenceStatus, msg, kind);
  const setWorkflowStatus = (msg, kind = "muted") => setStatus(els.intelWorkflowStatus, msg, kind);
  const setDataRefStatus = (msg, kind = "muted") => setStatus(els.intelDataRefStatus, msg, kind);
  const setIngestStatus = (msg, kind = "muted") => setStatus(els.intelIngestStatus, msg, kind);
  const setDistrictIntelStatus = (msg, kind = "muted") => setStatus(els.intelDistrictIntelStatus, msg, kind);
  const setGeoInspectorCopyStatus = (msg, kind = "muted") => setStatus(els.intelGeoInspectorCopyStatus, msg, kind);
  const setAreaAssistLookupStatus = (msg, kind = "muted") => setStatus(els.intelAreaAssistLookupStatus, msg, kind);
  let areaAssistFetchTimer = 0;
  let censusGeoFetchTimer = 0;
  const queueAreaAssistLookupFetch = () => {
    if (!els.btnIntelAreaAssistFetchCodes) return;
    if (areaAssistFetchTimer){
      clearTimeout(areaAssistFetchTimer);
    }
    areaAssistFetchTimer = setTimeout(() => {
      areaAssistFetchTimer = 0;
      const btn = els.btnIntelAreaAssistFetchCodes;
      if (!btn || btn.disabled) return;
      btn.click();
    }, 180);
  };
  const queueCensusGeoRowsFetch = () => {
    if (!els.btnIntelFetchCensusGeoRows) return;
    if (censusGeoFetchTimer){
      clearTimeout(censusGeoFetchTimer);
    }
    censusGeoFetchTimer = setTimeout(() => {
      censusGeoFetchTimer = 0;
      const btn = els.btnIntelFetchCensusGeoRows;
      if (!btn || btn.disabled) return;
      btn.click();
    }, 260);
  };
  const ACS5_GEO_ENRICH_MAX_AUTO_STEPS = 6;
  const ACS5_GEO_ENRICH_VARS = [
    "B01003_001E",
    "B25001_001E",
    "B25003_001E",
    "B25003_003E",
    "B25024_001E",
    "B25024_006E",
    "B25024_007E",
    "B25024_008E",
    "B25024_009E",
    "B15003_001E",
    "B15003_022E",
    "B15003_023E",
    "B15003_024E",
    "B15003_025E",
    "B01001_001E",
    "B01001_007E",
    "B01001_008E",
    "B01001_009E",
    "B01001_010E",
    "B01001_011E",
    "B01001_012E",
    "B01001_020E",
    "B01001_021E",
    "B01001_022E",
    "B01001_023E",
    "B01001_024E",
    "B01001_025E",
    "B01001_031E",
    "B01001_032E",
    "B01001_033E",
    "B01001_034E",
    "B01001_035E",
    "B01001_036E",
    "B01001_044E",
    "B01001_045E",
    "B01001_046E",
    "B01001_047E",
    "B01001_048E",
    "B01001_049E",
    "C16002_001E",
    "C16002_004E",
    "C16002_007E",
    "C16002_010E",
    "C16002_013E",
    "B08013_001E",
    "B08303_001E",
    "B08134_001E",
    "B19013_001E",
  ];
  const ACS5_GEO_ENRICH_GET = ["NAME"].concat(ACS5_GEO_ENRICH_VARS).join(",");

  const normalizeDataRefMode = (mode) => {
    const m = String(mode || "").trim().toLowerCase();
    if (m === "latest_verified" || m === "manual" || m === "pinned_verified") return m;
    return "pinned_verified";
  };

  const ALLOWED_AREA_TYPES = new Set(["", "CD", "SLDU", "SLDL", "COUNTY", "PLACE", "CUSTOM"]);
  const normalizeAreaTypeInput = (v) => {
    const t = String(v || "").trim().toUpperCase();
    return ALLOWED_AREA_TYPES.has(t) ? t : "";
  };
  const normalizeAreaResolutionInput = (v) => {
    const r = String(v || "").trim().toLowerCase();
    return r === "block_group" ? "block_group" : "tract";
  };
  const normalizeAcsYearPreference = (v) => {
    const raw = String(v || "").trim().toLowerCase();
    if (!raw || raw === "auto" || raw === "auto_latest" || raw === "latest"){
      return "auto_latest";
    }
    const m = String(v || "").trim().match(/^(19|20)\d{2}$/);
    return m ? m[0] : "auto_latest";
  };
  const buildAcsYearPreferenceList = (preferredYear) => {
    const pref = normalizeAcsYearPreference(preferredYear);
    if (pref !== "auto_latest"){
      return [pref];
    }
    const nowYear = new Date().getUTCFullYear();
    const out = [];
    for (let i = 1; i <= ACS5_GEO_ENRICH_MAX_AUTO_STEPS; i += 1){
      const y = nowYear - i;
      if (y < 2009) break;
      out.push(String(y));
    }
    return out.length ? out : ["2024", "2023", "2022"];
  };
  const cleanDigits = (v, maxLen = 0) => {
    const d = String(v || "").replace(/\D+/g, "");
    if (maxLen > 0) return d.slice(0, maxLen);
    return d;
  };
  const normalizeAreaGeoId = (geoidRaw, resolution) => {
    const geoid = cleanDigits(geoidRaw, 16);
    const mode = normalizeAreaResolutionInput(resolution);
    if (mode === "block_group"){
      return geoid.length >= 12 ? geoid.slice(0, 12) : "";
    }
    return geoid.length >= 11 ? geoid.slice(0, 11) : "";
  };
  const cleanText = (v, maxLen = 120) => String(v || "").trim().slice(0, Math.max(1, maxLen));
  const toYear = (v) => {
    const m = String(v || "").trim().match(/(19|20)\d{2}/);
    return m ? Number(m[0]) : null;
  };

  const cleanDataRefId = (v) => {
    const s = String(v || "").trim();
    return s || null;
  };

  const cleanDataRefNum = (v, min, max) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.max(min, Math.min(max, n));
  };

  const parseJsonInput = (raw, label) => {
    const text = String(raw || "").trim();
    if (!text){
      return { ok: false, error: `${label} is empty.` };
    }
    try{
      return { ok: true, value: JSON.parse(text) };
    } catch (err){
      return { ok: false, error: `${label} is invalid JSON: ${String(err?.message || "parse failed")}` };
    }
  };

  const rowsFromPayload = (payload, preferredKey) => {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === "object"){
      if (Array.isArray(payload[preferredKey])) return payload[preferredKey];
      if (Array.isArray(payload.rows)) return payload.rows;
    }
    return null;
  };

  const ensureCatalogLists = (s) => {
    if (!s || typeof s !== "object") return null;
    if (!s.dataCatalog || typeof s.dataCatalog !== "object") s.dataCatalog = {};
    if (!Array.isArray(s.dataCatalog.censusDatasets)) s.dataCatalog.censusDatasets = [];
    if (!Array.isArray(s.dataCatalog.electionDatasets)) s.dataCatalog.electionDatasets = [];
    if (!Array.isArray(s.dataCatalog.boundarySets)) s.dataCatalog.boundarySets = [];
    if (!Array.isArray(s.dataCatalog.crosswalks)) s.dataCatalog.crosswalks = [];
    return s.dataCatalog;
  };

  const upsertCatalogById = (rows, entry) => {
    const list = Array.isArray(rows) ? rows : [];
    const id = String(entry?.id || "").trim();
    if (!id) return { mode: "skipped", list };
    const idx = list.findIndex((x) => String(x?.id || "").trim() === id);
    if (idx >= 0){
      list[idx] = entry;
      return { mode: "updated", list };
    }
    list.push(entry);
    list.sort((a, b) => String(a?.id || "").localeCompare(String(b?.id || "")));
    return { mode: "created", list };
  };

  const ensureDistrictEvidenceContainers = (s) => {
    if (!s || typeof s !== "object") return null;
    if (!s.geoPack || typeof s.geoPack !== "object") s.geoPack = {};
    const geo = s.geoPack;
    if (!geo.district || typeof geo.district !== "object") geo.district = {};
    const district = geo.district;
    if (!district.evidenceStore || typeof district.evidenceStore !== "object") district.evidenceStore = {};
    if (!district.evidenceInputs || typeof district.evidenceInputs !== "object") district.evidenceInputs = {};
    if (!district.evidenceInputMeta || typeof district.evidenceInputMeta !== "object") district.evidenceInputMeta = {};
    if (!district.evidenceStore.electionByDatasetId || typeof district.evidenceStore.electionByDatasetId !== "object"){
      district.evidenceStore.electionByDatasetId = {};
    }
    if (!district.evidenceStore.censusByDatasetId || typeof district.evidenceStore.censusByDatasetId !== "object"){
      district.evidenceStore.censusByDatasetId = {};
    }
    if (!district.evidenceStore.crosswalkByVersionId || typeof district.evidenceStore.crosswalkByVersionId !== "object"){
      district.evidenceStore.crosswalkByVersionId = {};
    }
    if (!Array.isArray(district.evidenceInputs.precinctResults)) district.evidenceInputs.precinctResults = [];
    if (!Array.isArray(district.evidenceInputs.crosswalkRows)) district.evidenceInputs.crosswalkRows = [];
    if (!Array.isArray(district.evidenceInputs.censusGeoRows)) district.evidenceInputs.censusGeoRows = [];
    return district;
  };

  const ensureDataRefShape = (s) => {
    if (!s || typeof s !== "object") return null;
    if (!s.dataRefs || typeof s.dataRefs !== "object") s.dataRefs = {};
    if (!s.dataCatalog || typeof s.dataCatalog !== "object") s.dataCatalog = {};
    s.dataRefs.mode = normalizeDataRefMode(s.dataRefs.mode);
    s.dataRefs.boundarySetId = cleanDataRefId(s.dataRefs.boundarySetId);
    s.dataRefs.crosswalkVersionId = cleanDataRefId(s.dataRefs.crosswalkVersionId);
    s.dataRefs.censusDatasetId = cleanDataRefId(s.dataRefs.censusDatasetId);
    s.dataRefs.electionDatasetId = cleanDataRefId(s.dataRefs.electionDatasetId);
    s.dataRefs.electionStrictSimilarity = !!s.dataRefs.electionStrictSimilarity;
    s.dataRefs.electionMaxYearDelta = cleanDataRefNum(s.dataRefs.electionMaxYearDelta, 0, 30);
    s.dataRefs.electionMinCoveragePct = cleanDataRefNum(s.dataRefs.electionMinCoveragePct, 0, 100);
    return s.dataRefs;
  };

  const ensureGeoPackShape = (s) => {
    if (!s || typeof s !== "object") return null;
    if (!s.geoPack || typeof s.geoPack !== "object") s.geoPack = {};
    const geo = s.geoPack;
    if (!geo.area || typeof geo.area !== "object") geo.area = {};
    geo.resolution = normalizeAreaResolutionInput(geo.resolution);
    geo.area.type = normalizeAreaTypeInput(geo.area.type) || "COUNTY";
    geo.area.stateFips = cleanDigits(geo.area.stateFips, 2);
    geo.area.district = cleanText(geo.area.district, 16);
    geo.area.countyFips = cleanDigits(geo.area.countyFips, 5);
    geo.area.placeFips = cleanDigits(geo.area.placeFips, 5);
    geo.area.label = cleanText(geo.area.label, 120);
    return geo;
  };

  const ensureGeoDistrict = (s) => {
    const geo = ensureGeoPackShape(s);
    if (!geo) return null;
    if (!geo.district || typeof geo.district !== "object") geo.district = {};
    geo.district.acsYearPreference = normalizeAcsYearPreference(geo.district.acsYearPreference);
    return geo.district;
  };

  const normalizeGeoInspectorId = (v) => String(v || "").trim().slice(0, 32);

  const stampDataRefCheck = (refs) => {
    if (!refs || typeof refs !== "object") return;
    refs.lastCheckedAt = new Date().toISOString();
  };

  const markDistrictIntelStale = (s, reason) => {
    if (!s || typeof s !== "object") return;
    if (!s.districtIntelPack || typeof s.districtIntelPack !== "object") return;
    const msg = String(reason || "").trim() || "Area/resolution changed.";
    s.districtIntelPack.ready = false;
    if (!Array.isArray(s.districtIntelPack.warnings)) s.districtIntelPack.warnings = [];
    if (!s.districtIntelPack.warnings.includes(msg)) s.districtIntelPack.warnings.push(msg);
  };

  const rankTopCompatibleElection = (s) => {
    const buildDataSourceRegistry = engine?.snapshot?.buildDataSourceRegistry;
    const rankElectionDatasetsForScenario = engine?.snapshot?.rankElectionDatasetsForScenario;
    const resolveDataRefsByPolicy = engine?.snapshot?.resolveDataRefsByPolicy;
    if (typeof rankElectionDatasetsForScenario !== "function") return null;
    const registry = typeof buildDataSourceRegistry === "function"
      ? buildDataSourceRegistry(s?.dataCatalog)
      : null;
    const resolution = typeof resolveDataRefsByPolicy === "function"
      ? resolveDataRefsByPolicy({
        dataRefs: s?.dataRefs,
        dataCatalog: s?.dataCatalog,
        scenario: s,
      })
      : null;
    const boundarySetId = String(resolution?.selected?.boundarySetId || s?.dataRefs?.boundarySetId || "").trim() || null;
    const strictSimilarity = !!s?.dataRefs?.electionStrictSimilarity;
    const maxYearDelta = cleanDataRefNum(s?.dataRefs?.electionMaxYearDelta, 0, 30);
    const minCoveragePct = cleanDataRefNum(s?.dataRefs?.electionMinCoveragePct, 0, 100);
    const ranked = rankElectionDatasetsForScenario({
      registry,
      dataCatalog: s?.dataCatalog,
      scenario: s,
      boundarySetId,
      requireVerified: true,
      filters: {
        strictSimilarity,
        maxYearDelta,
        minCoveragePct,
      },
    });
    return Array.isArray(ranked) && ranked.length ? ranked[0] : null;
  };

  if (els.intelDataRefMode){
    els.intelDataRefMode.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const refs = ensureDataRefShape(s);
      if (!refs) return;
      refs.mode = normalizeDataRefMode(els.intelDataRefMode.value);
      if (refs.mode !== "pinned_verified") refs.pinnedAt = null;
      stampDataRefCheck(refs);
      setDataRefStatus(`Data source mode set to ${refs.mode}.`, "ok");
      commitUIUpdate();
    });
  }

  if (els.intelUseDistrictToggle){
    els.intelUseDistrictToggle.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const ready = !!s?.districtIntelPack?.ready;
      const wantsOn = !!els.intelUseDistrictToggle.checked;
      const validateDistrictDataContract = engine?.snapshot?.validateDistrictDataContract;
      const alignmentWarnings = districtPhase1Mode
        ? []
        : (typeof validateDistrictDataContract === "function")
        ? (() => {
          try{
            const out = validateDistrictDataContract(s);
            const warnings = Array.isArray(out?.warnings) ? out.warnings : [];
            return warnings.map((x) => String(x || "").trim()).filter((x) => String(x).toLowerCase().includes("provenance"));
          } catch {
            return [];
          }
        })()
        : [];
      if (wantsOn && !ready){
        s.useDistrictIntel = false;
        els.intelUseDistrictToggle.checked = false;
        setDistrictIntelStatus("District-intel pack is not ready yet. Generate assumptions first.", "muted");
        commitUIUpdate();
        return;
      }
      if (wantsOn && alignmentWarnings.length){
        s.useDistrictIntel = false;
        els.intelUseDistrictToggle.checked = false;
        setDistrictIntelStatus(`District-intel alignment warning: ${alignmentWarnings[0]}`, "warn");
        commitUIUpdate();
        return;
      }
      s.useDistrictIntel = wantsOn;
      if (s.useDistrictIntel){
        setDistrictIntelStatus(
          ready
            ? "District-intel assumptions enabled."
            : "District-intel enabled, but no ready pack exists yet. Generate assumptions first.",
          ready ? "ok" : "warn"
        );
      } else {
        setDistrictIntelStatus("District-intel assumptions disabled.", "muted");
      }
      commitUIUpdate();
    });
  }

  const onAreaChange = (mutator, successMsg) => {
    const s = currentState();
    if (!s) return;
    const geo = ensureGeoPackShape(s);
    if (!geo) return;
    let beforeAreaFingerprint = "";
    try{
      beforeAreaFingerprint = String(buildAreaMeta(s)?.areaFingerprint || "").trim();
    } catch {
      beforeAreaFingerprint = "";
    }
    const district = ensureGeoDistrict(s);
    mutator(geo);
    geo.generatedAt = null;
    geo.areaBoundary = null;
    let afterAreaFingerprint = "";
    try{
      afterAreaFingerprint = String(buildAreaMeta(s)?.areaFingerprint || "").trim();
    } catch {
      afterAreaFingerprint = "";
    }
    const areaChanged = beforeAreaFingerprint !== afterAreaFingerprint;
    if (areaChanged){
      const refs = ensureDataRefShape(s);
      if (refs){
        refs.boundarySetId = null;
        refs.crosswalkVersionId = null;
        refs.censusDatasetId = null;
        refs.electionDatasetId = null;
        stampDataRefCheck(refs);
      }
      if (s.dataCatalog && typeof s.dataCatalog === "object"){
        s.dataCatalog.activeBoundarySetId = null;
        s.dataCatalog.activeCrosswalkVersionId = null;
      }
    }
    if (district){
      district.selectedGeoId = null;
      district.areaBoundary = null;
      district.censusRowsV2 = [];
      district.censusRowsV2Meta = null;
      if (!district.evidenceInputs || typeof district.evidenceInputs !== "object") district.evidenceInputs = {};
      district.evidenceInputs.precinctResults = [];
      district.evidenceInputs.crosswalkRows = [];
      district.evidenceInputs.censusGeoRows = [];
      district.evidenceInputMeta = {};
    }
    markDistrictIntelStale(s, "District area/resolution changed; regenerate district-intel assumptions.");
    if (s.useDistrictIntel){
      s.useDistrictIntel = false;
      if (els.intelUseDistrictToggle) els.intelUseDistrictToggle.checked = false;
      setDistrictIntelStatus("Area/resolution changed. District-intel was turned OFF until assumptions are regenerated.", "muted");
    }
    if (areaChanged){
      setDataRefStatus(`${successMsg} Data refs were cleared for the new area.`, "ok");
    } else {
      setDataRefStatus(successMsg, "ok");
    }
    commitUIUpdate();
  };

  if (els.intelAreaType){
    els.intelAreaType.addEventListener("change", () => {
      onAreaChange((geo) => {
        const nextType = normalizeAreaTypeInput(els.intelAreaType.value);
        geo.area.type = nextType;
        if (nextType === "COUNTY"){
          geo.area.placeFips = "";
          geo.area.district = "";
          return;
        }
        if (nextType === "PLACE"){
          geo.area.countyFips = "";
          geo.area.district = "";
          return;
        }
        if (nextType === "CD" || nextType === "SLDU" || nextType === "SLDL"){
          geo.area.countyFips = "";
          geo.area.placeFips = "";
          return;
        }
      }, "Area type updated.");
      queueAreaAssistLookupFetch();
      queueCensusGeoRowsFetch();
    });
  }
  if (els.intelAreaResolution){
    els.intelAreaResolution.addEventListener("change", () => {
      onAreaChange((geo) => {
        geo.resolution = normalizeAreaResolutionInput(els.intelAreaResolution.value);
      }, "Area resolution updated.");
      queueAreaAssistLookupFetch();
      queueCensusGeoRowsFetch();
    });
  }
  if (els.intelAcsYearPreference){
    els.intelAcsYearPreference.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const district = ensureGeoDistrict(s);
      if (!district) return;
      district.acsYearPreference = normalizeAcsYearPreference(els.intelAcsYearPreference.value);
      commitUIUpdate();
      queueCensusGeoRowsFetch();
    });
  }
  if (els.intelAreaLabel){
    els.intelAreaLabel.addEventListener("input", () => onAreaChange((geo) => {
      geo.area.label = cleanText(els.intelAreaLabel.value, 120);
    }, "Area label updated."));
  }
  if (els.intelAreaStateFips){
    els.intelAreaStateFips.addEventListener("change", () => {
      onAreaChange((geo) => {
        const nextState = cleanDigits(els.intelAreaStateFips.value, 2);
        const prevState = cleanDigits(geo.area.stateFips, 2);
        geo.area.stateFips = nextState;
        const currentType = normalizeAreaTypeInput(geo.area.type);
        if (!currentType){
          geo.area.type = "COUNTY";
          if (els.intelAreaType) els.intelAreaType.value = "COUNTY";
        }
        if (!nextState || (prevState && prevState !== nextState)){
          geo.area.countyFips = "";
          geo.area.placeFips = "";
          if (els.intelAreaCountyFips) els.intelAreaCountyFips.value = "";
          if (els.intelAreaPlaceFips) els.intelAreaPlaceFips.value = "";
        }
      }, "Area state FIPS updated.");
      queueAreaAssistLookupFetch();
      queueCensusGeoRowsFetch();
    });
  }
  if (els.intelAreaDistrict){
    els.intelAreaDistrict.addEventListener("input", () => {
      onAreaChange((geo) => {
        geo.area.district = cleanText(els.intelAreaDistrict.value, 16);
      }, "Area district code updated.");
      queueAreaAssistLookupFetch();
      queueCensusGeoRowsFetch();
    });
  }
  if (els.intelAreaCountyFips){
    els.intelAreaCountyFips.addEventListener("input", () => {
      onAreaChange((geo) => {
        geo.area.type = "COUNTY";
        geo.area.countyFips = cleanDigits(els.intelAreaCountyFips.value, 5);
      }, "Area county FIPS updated.");
      queueAreaAssistLookupFetch();
      queueCensusGeoRowsFetch();
    });
  }
  if (els.intelAreaPlaceFips){
    els.intelAreaPlaceFips.addEventListener("input", () => {
      onAreaChange((geo) => {
        geo.area.type = "PLACE";
        geo.area.countyFips = "";
        geo.area.district = "";
        geo.area.placeFips = cleanDigits(els.intelAreaPlaceFips.value, 5);
      }, "Area place FIPS updated.");
      queueAreaAssistLookupFetch();
      queueCensusGeoRowsFetch();
    });
  }
  if (els.intelAreaAssistState){
    els.intelAreaAssistState.addEventListener("change", () => {
      const stateFips = cleanDigits(els.intelAreaAssistState.value, 2);
      if (!stateFips || stateFips.length < 2) return;
      onAreaChange((geo) => {
        geo.area.type = normalizeAreaTypeInput(geo.area.type) || "COUNTY";
        geo.area.stateFips = stateFips;
        geo.area.countyFips = "";
        geo.area.placeFips = "";
      }, "Area state selected from suggestions.");
      if (els.intelAreaType && !normalizeAreaTypeInput(els.intelAreaType.value)){
        els.intelAreaType.value = "COUNTY";
      }
      if (els.intelAreaStateFips) els.intelAreaStateFips.value = stateFips;
      if (els.intelAreaCountyFips) els.intelAreaCountyFips.value = "";
      if (els.intelAreaPlaceFips) els.intelAreaPlaceFips.value = "";
      queueAreaAssistLookupFetch();
    });
  }
  if (els.intelAreaAssistCounty){
    els.intelAreaAssistCounty.addEventListener("change", () => {
      const county5 = cleanDigits(els.intelAreaAssistCounty.value, 5);
      if (!county5 || county5.length < 5) return;
      const stateFips = county5.slice(0, 2);
      onAreaChange((geo) => {
        geo.area.type = "COUNTY";
        geo.area.stateFips = stateFips;
        geo.area.countyFips = county5;
        geo.area.placeFips = "";
      }, "Area county selected from suggestions.");
      if (els.intelAreaType) els.intelAreaType.value = "COUNTY";
      if (els.intelAreaStateFips) els.intelAreaStateFips.value = stateFips;
      if (els.intelAreaCountyFips) els.intelAreaCountyFips.value = county5;
      if (els.intelAreaPlaceFips) els.intelAreaPlaceFips.value = "";
      queueAreaAssistLookupFetch();
      queueCensusGeoRowsFetch();
    });
  }
  if (els.intelAreaAssistPlace){
    els.intelAreaAssistPlace.addEventListener("change", () => {
      const place7 = cleanDigits(els.intelAreaAssistPlace.value, 7);
      if (!place7 || place7.length < 7) return;
      const stateFips = place7.slice(0, 2);
      const placeFips = place7.slice(2, 7);
      onAreaChange((geo) => {
        geo.area.type = "PLACE";
        geo.area.stateFips = stateFips;
        geo.area.countyFips = "";
        geo.area.district = "";
        geo.area.placeFips = placeFips;
      }, "Area place selected from suggestions.");
      if (els.intelAreaType) els.intelAreaType.value = "PLACE";
      if (els.intelAreaStateFips) els.intelAreaStateFips.value = stateFips;
      if (els.intelAreaCountyFips) els.intelAreaCountyFips.value = "";
      if (els.intelAreaPlaceFips) els.intelAreaPlaceFips.value = placeFips;
      queueAreaAssistLookupFetch();
      queueCensusGeoRowsFetch();
    });
  }
  if (els.intelAreaAssistGeo){
    els.intelAreaAssistGeo.addEventListener("change", () => {
      const geoid = cleanDigits(els.intelAreaAssistGeo.value, 16);
      if (!geoid || geoid.length < 5) return;
      const stateFips = geoid.slice(0, 2);
      const countyFips = geoid.slice(0, 5);
      onAreaChange((geo) => {
        const currentType = normalizeAreaTypeInput(geo.area.type) || "COUNTY";
        geo.area.type = currentType;
        geo.area.stateFips = stateFips;
        if (currentType === "COUNTY"){
          geo.area.countyFips = countyFips;
        }
      }, "Area narrowed from GEO suggestion.");
      if (els.intelAreaType && !normalizeAreaTypeInput(els.intelAreaType.value)){
        els.intelAreaType.value = "COUNTY";
      }
      if (els.intelAreaStateFips) els.intelAreaStateFips.value = stateFips;
      if (els.intelAreaCountyFips){
        const currentType = normalizeAreaTypeInput(els.intelAreaType?.value);
        if (currentType === "COUNTY"){
          els.intelAreaCountyFips.value = countyFips;
        }
      }
      const s = currentState();
      if (!s) return;
      const district = ensureGeoDistrict(s);
      if (!district) return;
      district.selectedGeoId = geoid;
      commitUIUpdate();
      queueCensusGeoRowsFetch();
    });
  }
  if (els.btnIntelAreaAssistFetchCodes){
    els.btnIntelAreaAssistFetchCodes.addEventListener("click", async () => {
      const s = currentState();
      if (!s) return;
      const geo = ensureGeoPackShape(s);
      const district = ensureGeoDistrict(s);
      if (!geo || !district){
        setAreaAssistLookupStatus("Unable to initialize district area lookup containers.", "warn");
        return;
      }
      const stateFips = cleanDigits(geo?.area?.stateFips || els.intelAreaStateFips?.value, 2);
      if (stateFips.length !== 2){
        setAreaAssistLookupStatus("Enter State FIPS first (two digits) before fetching lookup lists.", "warn");
        return;
      }
      if (typeof fetch !== "function"){
        setAreaAssistLookupStatus("Fetch API is unavailable in this browser.", "warn");
        return;
      }
      const countyRaw = cleanDigits(geo?.area?.countyFips || els.intelAreaCountyFips?.value, 5);
      const county3 = countyRaw.length >= 5 ? countyRaw.slice(2, 5) : cleanDigits(countyRaw, 3);
      const placeFips = cleanDigits(geo?.area?.placeFips || els.intelAreaPlaceFips?.value, 5);
      const areaType = normalizeAreaTypeInput(geo?.area?.type);
      const districtCode = normalizeDistrictCodeForAreaType(areaType, geo?.area?.district || els.intelAreaDistrict?.value);
      const resolution = String(geo?.resolution || "tract").toLowerCase() === "block_group" ? "block_group" : "tract";
      const countyUrl = `https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*&in=state:${stateFips}`;
      const placeUrl = `https://api.census.gov/data/2020/dec/pl?get=NAME&for=place:*&in=state:${stateFips}`;
      const geoRequests = buildGeoLookupRequestPlan({
        stateFips,
        county3,
        placeFips,
        areaType,
        district: districtCode,
        resolution,
      });
      const geoScope = geoRequests[0]?.label || ((areaType === "PLACE" && placeFips.length === 5)
        ? `place ${placeFips}`
        : (county3 ? `county ${county3}` : ""));
      const btn = els.btnIntelAreaAssistFetchCodes;
      btn.disabled = true;
      setAreaAssistLookupStatus(`Fetching lookup for state ${stateFips}${geoScope ? `, ${geoScope}` : ""}...`, "muted");
      try{
        const [countyPayload, placePayload] = await Promise.all([
          fetchJsonFromUrl(countyUrl, "County lookup"),
          fetchJsonFromUrl(placeUrl, "Place lookup"),
        ]);
        const counties = normalizeCensusCountyLookup(countyPayload, stateFips);
        const places = normalizeCensusPlaceLookup(placePayload, stateFips);
        let geos = [];
        let geoUrl = "";
        let geoScopeLabel = geoScope;
        for (const req of geoRequests){
          geoUrl = req.url;
          geoScopeLabel = req.label || geoScopeLabel;
          try{
            const payload = await fetchJsonFromUrl(req.url, "GEO lookup");
            geos = normalizeCensusGeoLookup(payload, stateFips, resolution);
            if (geos.length) break;
          } catch {}
        }
        district.areaAssistLookup = {
          stateFips,
          counties,
          places,
          geos,
          geoResolution: resolution,
          geoCounty3: county3 || "",
          geoPlaceFips: areaType === "PLACE" && placeFips.length === 5 ? placeFips : "",
          geoAreaType: areaType || null,
          geoDistrictCode: districtCode || "",
          source: "census_api_2020_dec_pl",
          countyUrl,
          placeUrl,
          geoUrl: geoUrl || null,
          geoScope: geoScopeLabel || null,
          fetchedAt: new Date().toISOString(),
        };
        const placeLookupHint = areaType === "PLACE" && placeFips.length === 5 && !county3 && geos.length === 0
          ? " Add county to use county fallback if place GEO lookup is unavailable."
          : "";
        setAreaAssistLookupStatus(
          `Lookup loaded for state ${stateFips}: ${counties.length} counties, ${places.length} places${geoUrl ? `, ${geos.length} ${resolution === "block_group" ? "block groups" : "tracts"} in ${geoScopeLabel || "selected area"}` : ""}.${placeLookupHint}`,
          (counties.length || places.length || geos.length) ? "ok" : "warn"
        );
        commitUIUpdate();
      } catch (err){
        const msg = String(err?.message || "lookup fetch failed");
        setAreaAssistLookupStatus(`Lookup fetch failed: ${msg}`, "warn");
      } finally {
        btn.disabled = false;
      }
    });
  }
  if (els.intelGeoInspectorSelect){
    els.intelGeoInspectorSelect.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const district = ensureGeoDistrict(s);
      if (!district) return;
      district.selectedGeoId = normalizeGeoInspectorId(els.intelGeoInspectorSelect.value);
      commitUIUpdate();
    });
  }
  if (els.btnIntelGeoInspectorReloadBoundary){
    els.btnIntelGeoInspectorReloadBoundary.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const district = ensureGeoDistrict(s);
      if (!district) return;
      const selected = normalizeGeoInspectorId(district.selectedGeoId || els.intelGeoInspectorSelect?.value || "");
      if (!selected){
        setStatus(els.intelDistrictEvidenceMapStatus, "Select a GEO first, then reload boundary.", "warn");
        return;
      }
      district.selectedGeoId = selected;
      resetIntelGeoBoundaryCache(selected);
      commitUIUpdate();
    });
  }
  if (els.btnIntelGenerateDistrictIntel){
    els.btnIntelGenerateDistrictIntel.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;

      const buildDistrictIntelPackFromEvidence = engine?.snapshot?.buildDistrictIntelPackFromEvidence;
      const compileDistrictEvidence = engine?.snapshot?.compileDistrictEvidence;
      const resolveDistrictEvidenceInputs = engine?.snapshot?.resolveDistrictEvidenceInputs;
      const resolveDataRefsByPolicy = engine?.snapshot?.resolveDataRefsByPolicy;

      if (typeof buildDistrictIntelPackFromEvidence !== "function"){
        setDistrictIntelStatus("District-intel builder unavailable in engine snapshot.", "warn");
        return;
      }
      const district = ensureGeoDistrict(s);
      if (!district){
        setDistrictIntelStatus("District-intel generation blocked: unable to initialize district containers.", "warn");
        return;
      }
      let resolvedInputs = null;
      if (typeof resolveDistrictEvidenceInputs === "function"){
        try{
          resolvedInputs = resolveDistrictEvidenceInputs(s);
        } catch {
          resolvedInputs = null;
        }
      }
      const censusGeoRows = Array.isArray(resolvedInputs?.censusGeoRows)
        ? resolvedInputs.censusGeoRows
        : Array.isArray(district.censusRowsV2)
        ? district.censusRowsV2
        : Array.isArray(district?.evidenceInputs?.censusGeoRows)
        ? district.evidenceInputs.censusGeoRows
        : Array.isArray(district.censusGeoRows)
        ? district.censusGeoRows
        : Array.isArray(district.censusRows)
        ? district.censusRows
        : [];
      const areaMeta = buildAreaMeta(s);
      const areaGeoAllowSet = buildAreaGeoAllowSet(s, areaMeta);
      const scopedCensusGeoRows = areaMeta?.type
        ? censusGeoRows.filter((row) => rowMatchesArea(row, areaMeta, areaGeoAllowSet))
        : censusGeoRows;
      if (!scopedCensusGeoRows.length){
        if (censusGeoRows.length){
          setDistrictIntelStatus("Cannot generate assumptions until census rows match the selected area.", "warn");
        } else {
          setDistrictIntelStatus("Cannot generate assumptions until census rows are present for the active area.", "warn");
        }
        return;
      }

      let evidence = null;
      let compileWarn = "";
      if (typeof compileDistrictEvidence === "function"){
        try{
          evidence = compileDistrictEvidence({
            geoUnits: s?.geoPack?.units || [],
            precinctResults: [],
            crosswalkRows: [],
            censusGeoRows: scopedCensusGeoRows,
          });
        } catch (err){
          compileWarn = `District evidence compile failed: ${String(err?.message || "unknown error")}`;
        }
      } else {
        compileWarn = "";
      }
      if (!evidence || typeof evidence !== "object"){
        const geoRows = scopedCensusGeoRows.map((row) => ({
          geoid: String(row?.geoid || ""),
          totalVotes: 0,
          candidateVotes: {},
          sourcePrecincts: 0,
          hasElection: false,
          hasCensus: true,
          census: row?.values && typeof row.values === "object" ? row.values : {},
        }));
        const censusTotals = {};
        for (const row of geoRows){
          const census = (row?.census && typeof row.census === "object") ? row.census : {};
          for (const key of Object.keys(census)){
            const n = Number(census[key]);
            if (!Number.isFinite(n)) continue;
            censusTotals[key] = (Number(censusTotals[key]) || 0) + n;
          }
        }
        evidence = {
          candidateTotals: [],
          precinctToGeo: [],
          geoRows,
          censusTotals,
          summary: { geoRowsCount: geoRows.length, totalVotes: 0 },
          reconciliation: { coveragePct: null, unmatchedVotes: 0 },
          persuasionSignal: { index: null, note: "" },
          warnings: compileWarn ? [compileWarn] : [],
        };
      }

      let refs = null;
      if (typeof resolveDataRefsByPolicy === "function"){
        try{
          const r = resolveDataRefsByPolicy({
            dataRefs: s?.dataRefs,
            dataCatalog: s?.dataCatalog,
            scenario: s,
          });
          refs = (r && typeof r.selected === "object") ? r.selected : null;
        } catch {
          refs = null;
        }
      }
      if (!refs || typeof refs !== "object"){
        refs = {};
      }
      refs = {
        ...refs,
        censusDatasetId: String(refs?.censusDatasetId || s?.dataRefs?.censusDatasetId || "").trim() || null,
        boundarySetId: String(refs?.boundarySetId || s?.dataRefs?.boundarySetId || "").trim() || null,
        crosswalkVersionId: null,
        electionDatasetId: null,
      };
      try{
        const out = buildDistrictIntelPackFromEvidence({
          scenario: s,
          evidence,
          refs,
        });
        if (!out || typeof out !== "object" || !out.pack){
          setDistrictIntelStatus("District-intel generation returned empty pack.", "warn");
          return;
        }
        s.districtIntelPack = out.pack;
        if (!s.dataRefs || typeof s.dataRefs !== "object") s.dataRefs = {};
        if (!s.dataRefs.lastCheckedAt) s.dataRefs.lastCheckedAt = new Date().toISOString();
        if (out.pack.ready){
          setDistrictIntelStatus("District-intel assumptions generated from Census evidence.", "ok");
        } else {
          setDistrictIntelStatus("District-intel generated with warnings; pack is not ready.", "warn");
        }
        commitUIUpdate();
      } catch (err){
        setDistrictIntelStatus(`District-intel generation failed: ${String(err?.message || "unknown error")}`, "bad");
      }
    });
  }

  if (els.intelDataRefBoundarySet){
    els.intelDataRefBoundarySet.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const refs = ensureDataRefShape(s);
      if (!refs) return;
      refs.boundarySetId = cleanDataRefId(els.intelDataRefBoundarySet.value);
      if (s.dataCatalog && typeof s.dataCatalog === "object"){
        s.dataCatalog.activeBoundarySetId = refs.boundarySetId;
      }
      stampDataRefCheck(refs);
      setDataRefStatus("Boundary set updated.", "ok");
      commitUIUpdate();
    });
  }

  if (els.intelDataRefCrosswalkVersion){
    els.intelDataRefCrosswalkVersion.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const refs = ensureDataRefShape(s);
      if (!refs) return;
      refs.crosswalkVersionId = cleanDataRefId(els.intelDataRefCrosswalkVersion.value);
      if (s.dataCatalog && typeof s.dataCatalog === "object"){
        s.dataCatalog.activeCrosswalkVersionId = refs.crosswalkVersionId;
      }
      stampDataRefCheck(refs);
      setDataRefStatus("Crosswalk updated.", "ok");
      commitUIUpdate();
    });
  }

  if (els.intelDataRefCensusDataset){
    els.intelDataRefCensusDataset.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const refs = ensureDataRefShape(s);
      if (!refs) return;
      refs.censusDatasetId = cleanDataRefId(els.intelDataRefCensusDataset.value);
      stampDataRefCheck(refs);
      setDataRefStatus("Census dataset updated.", "ok");
      commitUIUpdate();
    });
  }

  if (els.intelDataRefElectionDataset){
    els.intelDataRefElectionDataset.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const refs = ensureDataRefShape(s);
      if (!refs) return;
      refs.electionDatasetId = cleanDataRefId(els.intelDataRefElectionDataset.value);
      stampDataRefCheck(refs);
      setDataRefStatus("Election dataset updated.", "ok");
      commitUIUpdate();
    });
  }

  if (els.intelDataRefStrictSimilarity){
    els.intelDataRefStrictSimilarity.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const refs = ensureDataRefShape(s);
      if (!refs) return;
      refs.electionStrictSimilarity = !!els.intelDataRefStrictSimilarity.checked;
      stampDataRefCheck(refs);
      setDataRefStatus(
        refs.electionStrictSimilarity
          ? "Strict similarity filter enabled."
          : "Strict similarity filter disabled.",
        "ok"
      );
      commitUIUpdate();
    });
  }

  if (els.intelDataRefMaxYearDelta){
    els.intelDataRefMaxYearDelta.addEventListener("input", () => {
      const s = currentState();
      if (!s) return;
      const refs = ensureDataRefShape(s);
      if (!refs) return;
      refs.electionMaxYearDelta = cleanDataRefNum(els.intelDataRefMaxYearDelta.value, 0, 30);
      stampDataRefCheck(refs);
      setDataRefStatus("Election cycle-gap filter updated.", "ok");
      commitUIUpdate();
    });
  }

  if (els.intelDataRefMinCoveragePct){
    els.intelDataRefMinCoveragePct.addEventListener("input", () => {
      const s = currentState();
      if (!s) return;
      const refs = ensureDataRefShape(s);
      if (!refs) return;
      refs.electionMinCoveragePct = cleanDataRefNum(els.intelDataRefMinCoveragePct.value, 0, 100);
      stampDataRefCheck(refs);
      setDataRefStatus("Election coverage filter updated.", "ok");
      commitUIUpdate();
    });
  }

  if (els.btnIntelDataRefSelectTopElection){
    els.btnIntelDataRefSelectTopElection.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const refs = ensureDataRefShape(s);
      if (!refs) return;
      const top = rankTopCompatibleElection(s);
      const topId = String(top?.dataset?.id || "").trim();
      if (!topId){
        setDataRefStatus("No compatible verified election dataset found.", "warn");
        return;
      }
      refs.electionDatasetId = topId;
      stampDataRefCheck(refs);
      const scoreText = Number.isFinite(Number(top?.score))
        ? ` (score ${Number(top.score).toFixed(2)})`
        : "";
      setDataRefStatus(`Election dataset set to top compatible '${topId}'${scoreText}.`, "ok");
      commitUIUpdate();
    });
  }

  if (els.btnIntelDataRefsPin){
    els.btnIntelDataRefsPin.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      ensureDataRefShape(s);
      const materializePinnedDataRefs = engine?.snapshot?.materializePinnedDataRefs;
      if (typeof materializePinnedDataRefs !== "function"){
        setDataRefStatus("Pinning unavailable: engine snapshot does not expose materializePinnedDataRefs.", "warn");
        return;
      }
      const result = materializePinnedDataRefs({
        dataRefs: s.dataRefs,
        dataCatalog: s.dataCatalog,
        scenario: s,
      });
      if (result?.dataRefs && typeof result.dataRefs === "object"){
        s.dataRefs = result.dataRefs;
        if (!s.dataCatalog || typeof s.dataCatalog !== "object") s.dataCatalog = {};
        s.dataCatalog.activeBoundarySetId = s.dataRefs.boundarySetId || null;
        s.dataCatalog.activeCrosswalkVersionId = s.dataRefs.crosswalkVersionId || null;
      }
      const notes = Array.isArray(result?.notes) ? result.notes.map((x) => String(x || "").trim()).filter(Boolean) : [];
      if (notes.length){
        setDataRefStatus(`Pinned selection updated. ${notes[0]}`, "ok");
      } else {
        setDataRefStatus("Pinned selection updated.", "ok");
      }
      commitUIUpdate();
    });
  }

  const setAutoPullStatus = (msg, kind = "muted") => setStatus(els.intelAutoPullStatus, msg, kind);

  const importDataCatalogPayload = (s, payload) => {
    const normalizeDataCatalog = engine?.snapshot?.normalizeDataCatalog;
    const buildDataSourceRegistry = engine?.snapshot?.buildDataSourceRegistry;
    if (typeof normalizeDataCatalog !== "function"){
      return { applied: false, kind: "warn", message: "Catalog import unavailable: normalizeDataCatalog helper missing." };
    }
    const catalogPayload = (payload && typeof payload === "object" && payload.dataCatalog && typeof payload.dataCatalog === "object")
      ? payload.dataCatalog
      : payload;
    const normalized = normalizeDataCatalog(catalogPayload);
    const boundaryCount = Array.isArray(normalized?.boundarySets) ? normalized.boundarySets.length : 0;
    const crosswalkCount = Array.isArray(normalized?.crosswalks) ? normalized.crosswalks.length : 0;
    const censusCount = Array.isArray(normalized?.censusDatasets) ? normalized.censusDatasets.length : 0;
    const electionCount = Array.isArray(normalized?.electionDatasets) ? normalized.electionDatasets.length : 0;
    const total = boundaryCount + crosswalkCount + censusCount + electionCount;
    if (total === 0){
      return { applied: false, kind: "warn", message: "Catalog import rejected: no boundary/crosswalk/census/election entries found." };
    }
    s.dataCatalog = normalized;
    const refs = ensureDataRefShape(s);
    if (refs) stampDataRefCheck(refs);
    const policy = applyDataRefPolicyRuntime({
      engine,
      scenario: s,
      stageLabel: "Catalog import",
    });
    if (policy?.scenario && typeof policy.scenario === "object"){
      if (policy.scenario.dataCatalog && typeof policy.scenario.dataCatalog === "object"){
        s.dataCatalog = policy.scenario.dataCatalog;
      }
      if (policy.scenario.dataRefs && typeof policy.scenario.dataRefs === "object"){
        s.dataRefs = policy.scenario.dataRefs;
      }
    }
    const policyNote = Array.isArray(policy?.warnings) && policy.warnings.length ? ` ${String(policy.warnings[0])}` : "";
    const registry = typeof buildDataSourceRegistry === "function" ? buildDataSourceRegistry(s.dataCatalog) : null;
    const latestBoundary = Array.isArray(registry?.boundarySets) ? registry.boundarySets.filter((x) => !!x?.isLatest).length : 0;
    const latestCrosswalk = Array.isArray(registry?.crosswalks) ? registry.crosswalks.filter((x) => !!x?.isLatest).length : 0;
    const latestCensus = Array.isArray(registry?.censusDatasets) ? registry.censusDatasets.filter((x) => !!x?.isLatest).length : 0;
    const latestElection = Array.isArray(registry?.electionDatasets) ? registry.electionDatasets.filter((x) => !!x?.isLatest).length : 0;
    const message = `Catalog imported: ${boundaryCount} boundaries, ${crosswalkCount} crosswalks, ${censusCount} census, ${electionCount} election (${latestBoundary}/${latestCrosswalk}/${latestCensus}/${latestElection} latest).${policyNote}`;
    return { applied: true, kind: "ok", message };
  };

  const importCensusManifestPayload = (s, payload) => {
    const normalizeManifest = engine?.snapshot?.normalizeCensusManifest;
    const validateManifest = engine?.snapshot?.validateCensusManifest;
    const toCatalogEntry = engine?.snapshot?.censusManifestToCatalogEntry;
    if (typeof normalizeManifest !== "function" || typeof validateManifest !== "function" || typeof toCatalogEntry !== "function"){
      return { applied: false, kind: "warn", message: "Census manifest helpers unavailable in engine snapshot." };
    }
    const normalized = normalizeManifest(payload);
    const validation = validateManifest(normalized);
    if (!validation?.ok){
      const err = Array.isArray(validation?.errors) && validation.errors.length
        ? validation.errors[0]
        : "manifest validation failed";
      return { applied: false, kind: "warn", message: `Census manifest rejected: ${err}` };
    }
    const entry = toCatalogEntry(normalized);
    const catalog = ensureCatalogLists(s);
    if (!catalog){
      return { applied: false, kind: "warn", message: "Unable to initialize data catalog." };
    }
    const out = upsertCatalogById(catalog.censusDatasets, entry);
    catalog.censusDatasets = out.list;
    const refs = ensureDataRefShape(s);
    if (refs){
      refs.censusDatasetId = String(entry?.id || "").trim() || null;
      if (entry?.boundarySetId && !refs.boundarySetId){
        refs.boundarySetId = String(entry.boundarySetId);
        if (s.dataCatalog && typeof s.dataCatalog === "object"){
          s.dataCatalog.activeBoundarySetId = refs.boundarySetId || null;
        }
      }
      stampDataRefCheck(refs);
    }
    return {
      applied: true,
      kind: "ok",
      message: `Census manifest ${out.mode === "updated" ? "updated" : "imported"}: ${entry.id}.`,
    };
  };

  const importElectionManifestPayload = (s, payload) => {
    const normalizeManifest = engine?.snapshot?.normalizeElectionManifest;
    const validateManifest = engine?.snapshot?.validateElectionManifest;
    const toCatalogEntry = engine?.snapshot?.electionManifestToCatalogEntry;
    if (typeof normalizeManifest !== "function" || typeof validateManifest !== "function" || typeof toCatalogEntry !== "function"){
      return { applied: false, kind: "warn", message: "Election manifest helpers unavailable in engine snapshot." };
    }
    const normalized = normalizeManifest(payload);
    const validation = validateManifest(normalized);
    if (!validation?.ok){
      const err = Array.isArray(validation?.errors) && validation.errors.length
        ? validation.errors[0]
        : "manifest validation failed";
      return { applied: false, kind: "warn", message: `Election manifest rejected: ${err}` };
    }
    const entry = toCatalogEntry(normalized);
    const catalog = ensureCatalogLists(s);
    if (!catalog){
      return { applied: false, kind: "warn", message: "Unable to initialize data catalog." };
    }
    const out = upsertCatalogById(catalog.electionDatasets, entry);
    catalog.electionDatasets = out.list;
    const refs = ensureDataRefShape(s);
    if (refs){
      refs.electionDatasetId = String(entry?.id || "").trim() || null;
      if (entry?.boundarySetId && !refs.boundarySetId){
        refs.boundarySetId = String(entry.boundarySetId);
        if (s.dataCatalog && typeof s.dataCatalog === "object"){
          s.dataCatalog.activeBoundarySetId = refs.boundarySetId || null;
        }
      }
      stampDataRefCheck(refs);
    }
    return {
      applied: true,
      kind: "ok",
      message: `Election manifest ${out.mode === "updated" ? "updated" : "imported"}: ${entry.id}.`,
    };
  };

  const importCrosswalkRowsPayload = (s, payload) => {
    const rows = rowsFromPayload(payload, "crosswalkRows");
    if (!Array.isArray(rows) || !rows.length){
      return { applied: false, kind: "warn", message: "Crosswalk rows must be a non-empty JSON array." };
    }
    const refs = ensureDataRefShape(s);
    const district = ensureDistrictEvidenceContainers(s);
    if (!district){
      return { applied: false, kind: "warn", message: "Unable to initialize district evidence containers." };
    }
    const meta = buildEvidenceImportMeta(s, rows);
    const status = String(meta.validationStatus || "unknown");
    const key = String(refs?.crosswalkVersionId || "").trim();
    if (key){
      district.evidenceStore.crosswalkByVersionId[key] = { rows, meta };
      district.evidenceInputs.crosswalkRows = [];
      district.evidenceInputMeta.crosswalkRows = {};
      markDistrictIntelStale(s, "Crosswalk rows changed; regenerate district-intel assumptions.");
      return {
        applied: true,
        kind: status === "aligned" ? "ok" : "warn",
        message: `Crosswalk rows imported to evidenceStore key '${key}' (${rows.length} rows; area ${status}).`,
      };
    }
    district.evidenceInputs.crosswalkRows = rows;
    district.evidenceInputMeta.crosswalkRows = meta;
    markDistrictIntelStale(s, "Crosswalk rows changed; regenerate district-intel assumptions.");
    return {
      applied: true,
      kind: "warn",
      message: `Crosswalk rows imported inline (${rows.length} rows; area ${status}). Set crosswalk ref to key this data.`,
    };
  };

  const importPrecinctResultsPayload = (s, payload) => {
    const format = String(els.intelPrecinctResultsFormat?.value || "auto").trim().toLowerCase();
    const normalized = normalizeElectionPrecinctPayload(payload, { format });
    const rows = Array.isArray(normalized?.rows) ? normalized.rows : [];
    if (!rows.length){
      return { applied: false, kind: "warn", message: "Precinct results must be a non-empty JSON array." };
    }
    const refs = ensureDataRefShape(s);
    const district = ensureDistrictEvidenceContainers(s);
    if (!district){
      return { applied: false, kind: "warn", message: "Unable to initialize district evidence containers." };
    }
    const meta = buildEvidenceImportMeta(s, rows);
    const status = String(meta.validationStatus || "unknown");
    const suffix = ` (${normalized.outputCount}/${normalized.inputCount} rows via ${normalized.effectiveFormat}; rejected ${normalized.rejectedCount}).`;
    const key = String(refs?.electionDatasetId || "").trim();
    if (key){
      district.evidenceStore.electionByDatasetId[key] = { rows, meta };
      district.evidenceInputs.precinctResults = [];
      district.evidenceInputMeta.precinctResults = {};
      markDistrictIntelStale(s, "Election rows changed; regenerate district-intel assumptions.");
      return {
        applied: true,
        kind: status === "aligned" ? "ok" : "warn",
        message: `Precinct results imported to evidenceStore key '${key}'${suffix} Area ${status}.`,
      };
    }
    district.evidenceInputs.precinctResults = rows;
    district.evidenceInputMeta.precinctResults = meta;
    markDistrictIntelStale(s, "Election rows changed; regenerate district-intel assumptions.");
    return {
      applied: true,
      kind: "warn",
      message: `Precinct results imported inline${suffix} Area ${status}. Set election dataset ref to key this data.`,
    };
  };

  const importCensusGeoRowsPayload = (s, payload) => {
    const rows = rowsFromPayload(payload, "censusGeoRows");
    if (!Array.isArray(rows) || !rows.length){
      return { applied: false, kind: "warn", message: "Census GEO rows must be a non-empty JSON array." };
    }
    const refs = ensureDataRefShape(s);
    const district = ensureDistrictEvidenceContainers(s);
    if (!district){
      return { applied: false, kind: "warn", message: "Unable to initialize district evidence containers." };
    }
    const meta = buildEvidenceImportMeta(s, rows);
    const status = String(meta.validationStatus || "unknown");
    district.censusRowsV2 = rows;
    district.censusRowsV2Meta = meta;
    const key = String(refs?.censusDatasetId || "").trim();
    if (key){
      district.evidenceStore.censusByDatasetId[key] = { rows, meta };
      district.evidenceInputs.censusGeoRows = [];
      district.evidenceInputMeta.censusGeoRows = {};
      markDistrictIntelStale(s, "Census GEO rows changed; regenerate district-intel assumptions.");
      return {
        applied: true,
        kind: status === "aligned" ? "ok" : "warn",
        message: `Census GEO rows imported to evidenceStore key '${key}' (${rows.length} rows; area ${status}).`,
      };
    }
    district.evidenceInputs.censusGeoRows = rows;
    district.evidenceInputMeta.censusGeoRows = meta;
    markDistrictIntelStale(s, "Census GEO rows changed; regenerate district-intel assumptions.");
    return {
      applied: true,
      kind: "warn",
      message: `Census GEO rows imported inline (${rows.length} rows; area ${status}). Set census dataset ref to key this data.`,
    };
  };

  const normalizeRemoteUrl = (v) => String(v || "").trim();
  const validateRemoteUrl = (raw, label) => {
    const value = normalizeRemoteUrl(raw);
    if (!value) return { ok: false, error: `${label} URL is empty.` };
    try{
      const u = new URL(value);
      if (u.protocol !== "https:" && u.protocol !== "http:"){
        return { ok: false, error: `${label} URL must use http/https.` };
      }
      return { ok: true, url: u.toString() };
    } catch (err){
      return { ok: false, error: `${label} URL is invalid: ${String(err?.message || "invalid URL")}` };
    }
  };

  const fetchJsonFromUrl = async (url, label) => {
    if (typeof fetch !== "function"){
      throw new Error("Browser fetch API is unavailable.");
    }
    const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
    if (!res?.ok){
      throw new Error(`${label} request failed (HTTP ${res?.status ?? "?"}).`);
    }
    try{
      return await res.json();
    } catch (err){
      throw new Error(`${label} response is not valid JSON: ${String(err?.message || "parse failed")}`);
    }
  };

  const normalizeCounty3 = (stateFips, countyFips) => {
    const state = cleanDigits(stateFips, 2);
    const county = cleanDigits(countyFips, 5);
    if (!state || !county) return "";
    if (county.length >= 5){
      if (county.slice(0, 2) !== state) return "";
      return county.slice(2, 5);
    }
    if (county.length === 3) return county;
    return "";
  };
  const normalizeDistrictCodeForAreaType = (areaType, districtRaw) => {
    const type = normalizeAreaTypeInput(areaType);
    const digits = cleanDigits(districtRaw, 16);
    const raw = cleanText(districtRaw, 16).toUpperCase();
    if (type === "CD"){
      if (digits) return digits.slice(-2).padStart(2, "0");
      return raw;
    }
    if (type === "SLDU" || type === "SLDL"){
      if (digits) return digits.slice(-3).padStart(3, "0");
      return raw;
    }
    return digits || raw;
  };
  const buildDistrictInClauses = ({ stateFips, areaType, districtCode, resolution }) => {
    const type = normalizeAreaTypeInput(areaType);
    const district = String(districtCode || "").trim();
    const mode = normalizeAreaResolutionInput(resolution);
    if (!district) return [];
    const keys = type === "CD"
      ? ["congressional district"]
      : type === "SLDU"
        ? ["state legislative district (upper chamber)", "state legislative district (upper)", "state senate district"]
        : type === "SLDL"
          ? ["state legislative district (lower chamber)", "state legislative district (lower)", "state house district"]
          : [];
    if (!keys.length) return [];
    return keys.map((key) => ({
      label: `${type} ${district}`,
      inClause: mode === "block_group"
        ? `state:${stateFips} ${key}:${district} tract:*`
        : `state:${stateFips} ${key}:${district}`,
    }));
  };

  const buildAreaGeoAllowSet = (s, area) => {
    const stateFips = cleanDigits(area?.stateFips, 2);
    const resolution = normalizeAreaResolutionInput(area?.resolution);
    const areaType = normalizeAreaTypeInput(area?.type);
    const areaCounty3 = areaType === "COUNTY" ? normalizeCounty3(stateFips, area?.countyFips) : "";
    const areaPlaceFips = areaType === "PLACE" ? cleanDigits(area?.placeFips, 5) : "";
    const areaDistrictCode = normalizeDistrictCodeForAreaType(areaType, area?.district || "");
    if (!stateFips){
      return null;
    }
    const out = new Set();
    const district = ensureGeoDistrict(s);
    const lookup = (district && typeof district.areaAssistLookup === "object") ? district.areaAssistLookup : null;
    if (lookup){
      const lookupState = cleanDigits(lookup.stateFips, 2);
      const lookupResolution = normalizeAreaResolutionInput(lookup.geoResolution || resolution);
      const lookupCounty3 = cleanDigits(lookup.geoCounty3, 3);
      const lookupPlaceFips = cleanDigits(lookup.geoPlaceFips, 5);
      const lookupAreaType = normalizeAreaTypeInput(lookup.geoAreaType || "");
      const lookupDistrictCode = normalizeDistrictCodeForAreaType(areaType, lookup.geoDistrictCode || "");
      const countyScopeOk = !areaCounty3 || !lookupCounty3 || areaCounty3 === lookupCounty3;
      const placeScopeOk = !areaPlaceFips || (lookupPlaceFips && areaPlaceFips === lookupPlaceFips);
      const districtScopeOk = (areaType === "CD" || areaType === "SLDU" || areaType === "SLDL")
        ? (lookupAreaType === areaType && !!areaDistrictCode && lookupDistrictCode === areaDistrictCode)
        : true;
      if (lookupState === stateFips && lookupResolution === resolution && countyScopeOk && placeScopeOk && districtScopeOk){
        const geos = Array.isArray(lookup.geos) ? lookup.geos : [];
        for (const raw of geos){
          const id = normalizeAreaGeoId(raw, resolution);
          if (!id || id.slice(0, 2) !== stateFips) continue;
          out.add(id);
        }
      }
    }
    return out.size ? out : null;
  };

  const rowMatchesArea = (row, area, geoAllowSet = null) => {
    const geoid = cleanDigits(row?.geoid, 16);
    if (geoid.length < 5) return false;
    const normalized = normalizeAreaGeoId(geoid, area?.resolution);
    if (geoAllowSet && geoAllowSet.size){
      return !!normalized && geoAllowSet.has(normalized);
    }
    const areaType = normalizeAreaTypeInput(area?.type);
    const state = cleanDigits(area?.stateFips, 2);
    if (state && geoid.slice(0, 2) !== state) return false;
    const county3 = areaType === "COUNTY" ? normalizeCounty3(state, area?.countyFips) : "";
    if (county3 && geoid.slice(2, 5) !== county3) return false;
    return true;
  };

  const buildAreaMeta = (s) => {
    const geo = ensureGeoPackShape(s);
    const area = (geo && geo.area && typeof geo.area === "object") ? geo.area : {};
    const type = normalizeAreaTypeInput(area?.type);
    const stateFips = cleanDigits(area?.stateFips, 2);
    const district = cleanText(area?.district, 16);
    const countyFips = cleanDigits(area?.countyFips, 5);
    const placeFips = cleanDigits(area?.placeFips, 5);
    const resolution = normalizeAreaResolutionInput(geo?.resolution);
    let areaFingerprint = "";
    const deriveCtx = engine?.snapshot?.deriveAreaResolverContext;
    const buildKey = engine?.snapshot?.buildAreaResolverCacheKey;
    if (typeof deriveCtx === "function"){
      try{
        const out = deriveCtx({ scenario: s });
        areaFingerprint = String(out?.cacheKey || "").trim();
      } catch {
        areaFingerprint = "";
      }
    }
    if (!areaFingerprint && typeof buildKey === "function"){
      try{
        areaFingerprint = String(buildKey({
          area: {
            type,
            stateFips,
            district,
            countyFips,
            placeFips,
            resolution,
            boundarySetId: geo?.boundarySetId || null,
            boundaryVintage: geo?.boundaryVintage || geo?.area?.boundaryVintage || geo?.area?.vintage || null,
          },
        }) || "").trim();
      } catch {
        areaFingerprint = "";
      }
    }
    return {
      type,
      stateFips,
      district,
      countyFips,
      placeFips,
      resolution,
      areaFingerprint,
    };
  };

  const buildEvidenceImportMeta = (s, rows) => {
    const list = Array.isArray(rows) ? rows : [];
    const areaMeta = buildAreaMeta(s);
    const areaGeoAllowSet = buildAreaGeoAllowSet(s, areaMeta);
    let geoidRowCount = 0;
    let matchedGeoidRows = 0;
    for (const row of list){
      const geoid = cleanDigits(row?.geoid, 16);
      if (geoid.length < 5) continue;
      geoidRowCount += 1;
      if (rowMatchesArea({ geoid }, areaMeta, areaGeoAllowSet)) matchedGeoidRows += 1;
    }
    let validationStatus = "unknown";
    if (geoidRowCount > 0){
      if (matchedGeoidRows <= 0){
        validationStatus = "external";
      } else if (matchedGeoidRows < geoidRowCount){
        validationStatus = "partial";
      } else {
        validationStatus = "aligned";
      }
    } else if (areaMeta.areaFingerprint){
      validationStatus = "aligned";
    }
    return {
      areaFingerprint: areaMeta.areaFingerprint || null,
      validationStatus,
      geoidRowCount,
      matchedGeoidRows,
      rowCount: list.length,
      area: {
        type: areaMeta.type,
        stateFips: areaMeta.stateFips,
        district: areaMeta.district,
        countyFips: areaMeta.countyFips,
        placeFips: areaMeta.placeFips,
        resolution: areaMeta.resolution,
      },
    };
  };

  const buildCensusGeoApiUrl = (stateFips, county3, resolution) => {
    const mode = normalizeAreaResolutionInput(resolution);
    const forClause = mode === "block_group" ? "block group:*" : "tract:*";
    const inClause = mode === "block_group"
      ? `state:${stateFips} county:${county3} tract:*`
      : `state:${stateFips} county:${county3}`;
    const params = new URLSearchParams({
      get: "NAME,P1_001N,H1_001N,INTPTLAT,INTPTLON",
      for: forClause,
      in: inClause,
    });
    return `https://api.census.gov/data/2020/dec/pl?${params.toString()}`;
  };

  const buildCensusGeoApiRequestPlan = ({ stateFips, county3, placeFips, areaType, district, resolution }) => {
    const mode = normalizeAreaResolutionInput(resolution);
    const type = normalizeAreaTypeInput(areaType);
    const districtCode = normalizeDistrictCodeForAreaType(type, district);
    const isDistrictArea = type === "CD" || type === "SLDU" || type === "SLDL";
    const requests = [];
    const push = (url, label) => {
      if (!url) return;
      if (requests.some((row) => row.url === url)) return;
      requests.push({ url, label });
    };
    if (isDistrictArea && districtCode){
      const forClause = mode === "block_group" ? "block group:*" : "tract:*";
      const inClauses = buildDistrictInClauses({ stateFips, areaType: type, districtCode, resolution: mode });
      for (const row of inClauses){
        const params = new URLSearchParams({
          get: "NAME,P1_001N,H1_001N,INTPTLAT,INTPTLON",
          for: forClause,
          in: row.inClause,
        });
        push(`https://api.census.gov/data/2020/dec/pl?${params.toString()}`, row.label);
      }
      return requests;
    }
    const isPlaceArea = normalizeAreaTypeInput(areaType) === "PLACE" && placeFips.length === 5;
    if (isPlaceArea){
      const forClause = mode === "block_group" ? "block group:*" : "tract:*";
      const inClause = mode === "block_group"
        ? `state:${stateFips} place:${placeFips} tract:*`
        : `state:${stateFips} place:${placeFips}`;
      const params = new URLSearchParams({
        get: "NAME,P1_001N,H1_001N,INTPTLAT,INTPTLON",
        for: forClause,
        in: inClause,
      });
      push(`https://api.census.gov/data/2020/dec/pl?${params.toString()}`, `place ${placeFips}`);
    }
    if (county3.length === 3){
      push(buildCensusGeoApiUrl(stateFips, county3, mode), `county ${county3}`);
    }
    if (!isPlaceArea && !county3 && placeFips.length === 5){
      const forClause = mode === "block_group" ? "block group:*" : "tract:*";
      const inClause = mode === "block_group"
        ? `state:${stateFips} place:${placeFips} tract:*`
        : `state:${stateFips} place:${placeFips}`;
      const params = new URLSearchParams({
        get: "NAME,P1_001N,H1_001N,INTPTLAT,INTPTLON",
        for: forClause,
        in: inClause,
      });
      push(`https://api.census.gov/data/2020/dec/pl?${params.toString()}`, `place ${placeFips}`);
    }
    return requests;
  };

  const buildGeoLookupRequestPlan = ({ stateFips, county3, placeFips, areaType, district, resolution }) => {
    const mode = normalizeAreaResolutionInput(resolution);
    const type = normalizeAreaTypeInput(areaType);
    const districtCode = normalizeDistrictCodeForAreaType(type, district);
    const isDistrictArea = type === "CD" || type === "SLDU" || type === "SLDL";
    const requests = [];
    const push = (url, label) => {
      if (!url) return;
      if (requests.some((row) => row.url === url)) return;
      requests.push({ url, label });
    };
    const forClause = mode === "block_group" ? "block group:*" : "tract:*";
    if (isDistrictArea && districtCode){
      const inClauses = buildDistrictInClauses({ stateFips, areaType: type, districtCode, resolution: mode });
      for (const row of inClauses){
        const params = new URLSearchParams({
          get: "NAME",
          for: forClause,
          in: row.inClause,
        });
        push(`https://api.census.gov/data/2020/dec/pl?${params.toString()}`, row.label);
      }
      return requests;
    }
    if (type === "PLACE" && placeFips.length === 5){
      const inClause = mode === "block_group"
        ? `state:${stateFips} place:${placeFips} tract:*`
        : `state:${stateFips} place:${placeFips}`;
      const params = new URLSearchParams({
        get: "NAME",
        for: forClause,
        in: inClause,
      });
      push(`https://api.census.gov/data/2020/dec/pl?${params.toString()}`, `place ${placeFips}`);
    }
    if (county3.length === 3){
      const inClause = mode === "block_group"
        ? `state:${stateFips} county:${county3} tract:*`
        : `state:${stateFips} county:${county3}`;
      const params = new URLSearchParams({
        get: "NAME",
        for: forClause,
        in: inClause,
      });
      push(`https://api.census.gov/data/2020/dec/pl?${params.toString()}`, `county ${county3}`);
    }
    if (type !== "PLACE" && !county3 && placeFips.length === 5){
      const inClause = mode === "block_group"
        ? `state:${stateFips} place:${placeFips} tract:*`
        : `state:${stateFips} place:${placeFips}`;
      const params = new URLSearchParams({
        get: "NAME",
        for: forClause,
        in: inClause,
      });
      push(`https://api.census.gov/data/2020/dec/pl?${params.toString()}`, `place ${placeFips}`);
    }
    return requests;
  };

  const parseCensusScopeFromUrl = (rawUrl) => {
    try{
      const u = new URL(String(rawUrl || ""));
      const forClause = String(u.searchParams.get("for") || "").trim();
      const inClause = String(u.searchParams.get("in") || "").trim();
      if (!forClause || !inClause) return null;
      return { forClause, inClause };
    } catch {
      return null;
    }
  };

  const buildAcsGeoApiRequestPlanFromCensusUrl = (rawUrl, preferredYear) => {
    const scope = parseCensusScopeFromUrl(rawUrl);
    if (!scope) return [];
    const requests = [];
    const years = buildAcsYearPreferenceList(preferredYear);
    for (const year of years){
      const params = new URLSearchParams({
        get: ACS5_GEO_ENRICH_GET,
        for: scope.forClause,
        in: scope.inClause,
      });
      requests.push({
        year,
        url: `https://api.census.gov/data/${year}/acs/acs5?${params.toString()}`,
      });
    }
    return requests;
  };

  const normalizeAcsGeoRowsFromApiPayload = (payload, resolution) => {
    if (!Array.isArray(payload) || payload.length < 2) return [];
    const header = Array.isArray(payload[0]) ? payload[0].map((x) => String(x || "").trim()) : [];
    if (!header.length) return [];
    const lower = new Map(header.map((name, i) => [name.toLowerCase(), i]));
    const stateIdx = lower.get("state");
    const countyIdx = lower.get("county");
    const tractIdx = lower.get("tract");
    const blockIdx = lower.get("block group");
    if (!Number.isInteger(stateIdx) || !Number.isInteger(countyIdx) || !Number.isInteger(tractIdx)) return [];
    const reserved = new Set(["name", "state", "county", "tract", "block group"]);
    const valueCols = header
      .map((name, i) => ({ name, i }))
      .filter((row) => row.name && !reserved.has(row.name.toLowerCase()));
    const out = [];
    for (let i = 1; i < payload.length; i += 1){
      const row = Array.isArray(payload[i]) ? payload[i] : [];
      const state = String(row[stateIdx] || "").trim();
      const county = String(row[countyIdx] || "").trim();
      const tract = String(row[tractIdx] || "").trim();
      const blockGroup = Number.isInteger(blockIdx) ? String(row[blockIdx] || "").trim() : "";
      let geoid = "";
      if (resolution === "block_group"){
        if (state.length === 2 && county.length === 3 && tract.length === 6 && blockGroup.length === 1){
          geoid = `${state}${county}${tract}${blockGroup}`;
        }
      } else if (state.length === 2 && county.length === 3 && tract.length === 6){
        geoid = `${state}${county}${tract}`;
      }
      if (!geoid) continue;
      const values = {};
      for (const col of valueCols){
        const n = Number(row[col.i]);
        if (!Number.isFinite(n) || n <= -666666666) continue;
        values[col.name] = n;
      }
      if (!Object.keys(values).length) continue;
      out.push({ geoid, values });
    }
    out.sort((a, b) => String(a?.geoid || "").localeCompare(String(b?.geoid || "")));
    return out;
  };

  const mergeAcsGeoRowsIntoCensusRows = (baseRows, acsRows) => {
    const base = Array.isArray(baseRows) ? baseRows : [];
    const acs = Array.isArray(acsRows) ? acsRows : [];
    if (!base.length || !acs.length){
      return { rows: base.slice(), matchedCount: 0, valueKeys: [] };
    }
    const acsByGeoid = new Map();
    for (const row of acs){
      const geoid = cleanDigits(row?.geoid, 16);
      const values = (row && typeof row.values === "object") ? row.values : {};
      if (!geoid || !Object.keys(values).length) continue;
      acsByGeoid.set(geoid, values);
    }
    if (!acsByGeoid.size){
      return { rows: base.slice(), matchedCount: 0, valueKeys: [] };
    }
    const valueKeySet = new Set();
    const out = [];
    let matchedCount = 0;
    for (const row of base){
      const geoid = cleanDigits(row?.geoid, 16);
      const values = (row && typeof row.values === "object") ? row.values : {};
      const acsValues = geoid ? acsByGeoid.get(geoid) : null;
      if (!acsValues){
        out.push(row);
        continue;
      }
      matchedCount += 1;
      const mergedValues = { ...values, ...acsValues };
      for (const key of Object.keys(acsValues)){
        valueKeySet.add(key);
      }
      out.push({ ...row, values: mergedValues });
    }
    return { rows: out, matchedCount, valueKeys: Array.from(valueKeySet).sort((a, b) => a.localeCompare(b)) };
  };

  const normalizeCensusGeoRowsFromApiPayload = (payload, resolution) => {
    if (!Array.isArray(payload) || payload.length < 2) return [];
    const header = Array.isArray(payload[0]) ? payload[0].map((x) => String(x || "").trim()) : [];
    if (!header.length) return [];
    const idx = new Map(header.map((name, i) => [name, i]));
    const nameIdx = idx.get("NAME");
    const popIdx = idx.get("P1_001N");
    const housingIdx = idx.get("H1_001N");
    const latIdx = idx.get("INTPTLAT");
    const lonIdx = idx.get("INTPTLON");
    const stateIdx = idx.get("state");
    const countyIdx = idx.get("county");
    const tractIdx = idx.get("tract");
    const blockIdx = idx.get("block group");
    if (!Number.isInteger(stateIdx) || !Number.isInteger(countyIdx) || !Number.isInteger(tractIdx)) return [];
    const out = [];
    for (let i = 1; i < payload.length; i += 1){
      const row = Array.isArray(payload[i]) ? payload[i] : [];
      const state = String(row[stateIdx] || "").trim();
      const county = String(row[countyIdx] || "").trim();
      const tract = String(row[tractIdx] || "").trim();
      const blockGroup = Number.isInteger(blockIdx) ? String(row[blockIdx] || "").trim() : "";
      let geoid = "";
      if (resolution === "block_group"){
        if (state.length === 2 && county.length === 3 && tract.length === 6 && blockGroup.length === 1){
          geoid = `${state}${county}${tract}${blockGroup}`;
        }
      } else if (state.length === 2 && county.length === 3 && tract.length === 6){
        geoid = `${state}${county}${tract}`;
      }
      if (!geoid) continue;
      const pop = Number(row[popIdx]);
      const housing = Number(row[housingIdx]);
      const lat = Number(row[latIdx]);
      const lon = Number(row[lonIdx]);
      out.push({
        geoid,
        values: {
          NAME: Number.isInteger(nameIdx) ? String(row[nameIdx] || "").trim() : "",
          P1_001N: Number.isFinite(pop) ? pop : 0,
          H1_001N: Number.isFinite(housing) ? housing : 0,
          INTPTLAT: Number.isFinite(lat) ? lat : null,
          INTPTLON: Number.isFinite(lon) ? lon : null,
          pop: Number.isFinite(pop) ? pop : 0,
          housing_units: Number.isFinite(housing) ? housing : 0,
        },
      });
    }
    out.sort((a, b) => String(a?.geoid || "").localeCompare(String(b?.geoid || "")));
    return out;
  };

  const normalizeCensusCountyLookup = (payload, stateFips) => {
    const rows = Array.isArray(payload) ? payload : [];
    const out = new Map();
    const start = Array.isArray(rows[0]) ? 1 : 0;
    for (let i = start; i < rows.length; i += 1){
      const row = rows[i];
      let name = "";
      let st = "";
      let county3 = "";
      if (Array.isArray(row)){
        name = cleanText(row[0], 160);
        st = cleanDigits(row[1], 2);
        county3 = cleanDigits(row[2], 3);
      } else if (row && typeof row === "object"){
        name = cleanText(row.NAME ?? row.name, 160);
        st = cleanDigits(row.state ?? row.STATE ?? stateFips, 2);
        county3 = cleanDigits(row.county ?? row.COUNTY, 3);
      }
      if (!st) st = stateFips;
      if (st !== stateFips || county3.length !== 3) continue;
      const county5 = `${st}${county3}`;
      const existing = out.get(county5);
      if (!existing){
        out.set(county5, { stateFips: st, county3, county5, name });
      } else if (!existing.name && name){
        existing.name = name;
      }
    }
    return Array.from(out.values()).sort((a, b) => a.county5.localeCompare(b.county5));
  };

  const normalizeCensusPlaceLookup = (payload, stateFips) => {
    const rows = Array.isArray(payload) ? payload : [];
    const out = new Map();
    const start = Array.isArray(rows[0]) ? 1 : 0;
    for (let i = start; i < rows.length; i += 1){
      const row = rows[i];
      let name = "";
      let st = "";
      let placeFips = "";
      if (Array.isArray(row)){
        name = cleanText(row[0], 160);
        st = cleanDigits(row[1], 2);
        placeFips = cleanDigits(row[2], 5);
      } else if (row && typeof row === "object"){
        name = cleanText(row.NAME ?? row.name, 160);
        st = cleanDigits(row.state ?? row.STATE ?? stateFips, 2);
        placeFips = cleanDigits(row.place ?? row.PLACE ?? row.place_fips ?? row.placeFips, 5);
      }
      if (!st) st = stateFips;
      if (st !== stateFips || placeFips.length !== 5) continue;
      const key = `${st}${placeFips}`;
      const existing = out.get(key);
      if (!existing){
        out.set(key, { stateFips: st, placeFips, name });
      } else if (!existing.name && name){
        existing.name = name;
      }
    }
    return Array.from(out.values()).sort((a, b) => a.placeFips.localeCompare(b.placeFips));
  };

  const normalizeCensusGeoLookup = (payload, stateFips, resolution) => {
    const rows = Array.isArray(payload) ? payload : [];
    const out = new Map();
    const mode = String(resolution || "").toLowerCase() === "block_group" ? "block_group" : "tract";
    const header = Array.isArray(rows[0])
      ? rows[0].map((x) => String(x || "").trim().toLowerCase())
      : [];
    const idxState = header.indexOf("state");
    const idxCounty = header.indexOf("county");
    const idxTract = header.indexOf("tract");
    const idxBlockGroup = header.indexOf("block group");
    const start = header.length ? 1 : 0;
    for (let i = start; i < rows.length; i += 1){
      const row = rows[i];
      let st = "";
      let county3 = "";
      let tract6 = "";
      let bg1 = "";
      if (Array.isArray(row)){
        st = cleanDigits(idxState >= 0 ? row[idxState] : row[1], 2);
        county3 = cleanDigits(idxCounty >= 0 ? row[idxCounty] : row[2], 3);
        tract6 = cleanDigits(idxTract >= 0 ? row[idxTract] : row[3], 6);
        bg1 = cleanDigits(idxBlockGroup >= 0 ? row[idxBlockGroup] : row[4], 1);
      } else if (row && typeof row === "object"){
        st = cleanDigits(row.state ?? row.STATE ?? stateFips, 2);
        county3 = cleanDigits(row.county ?? row.COUNTY, 3);
        tract6 = cleanDigits(row.tract ?? row.TRACT, 6);
        bg1 = cleanDigits(row.block_group ?? row["block group"] ?? row.BLOCK_GROUP ?? row.BLOCKGROUP ?? row.BLKGRP, 1);
      }
      if (!st) st = stateFips;
      if (st !== stateFips || county3.length !== 3 || tract6.length !== 6) continue;
      const geoid = mode === "block_group"
        ? `${st}${county3}${tract6}${bg1}`
        : `${st}${county3}${tract6}`;
      if ((mode === "block_group" && geoid.length !== 12) || (mode === "tract" && geoid.length !== 11)) continue;
      out.set(geoid, geoid);
    }
    return Array.from(out.keys()).sort((a, b) => a.localeCompare(b));
  };

  const setUrlInputValue = (el, value) => {
    if (!el) return;
    el.value = String(value || "");
  };
  const setJsonInputValue = (el, value) => {
    if (!el) return;
    if (value == null){
      el.value = "";
      return;
    }
    try{
      el.value = JSON.stringify(value, null, 2);
    } catch {
      el.value = "";
    }
  };

  const applyAutoPullPlanToInputs = (plan) => {
    const urls = plan && typeof plan === "object" ? (plan.urls || {}) : {};
    setUrlInputValue(els.intelCensusManifestUrl, urls.censusManifestUrl || "");
    setUrlInputValue(els.intelElectionManifestUrl, urls.electionManifestUrl || "");
    setUrlInputValue(els.intelCrosswalkRowsUrl, urls.crosswalkRowsUrl || "");
    setUrlInputValue(els.intelPrecinctResultsUrl, urls.precinctResultsUrl || "");
    setUrlInputValue(els.intelCensusGeoRowsUrl, urls.censusGeoRowsUrl || "");
  };

  const writeAutoPullReceipt = (s, payload) => {
    const district = ensureDistrictEvidenceContainers(s);
    if (!district) return;
    const createAutoPullReceipt = engine?.snapshot?.createAutoPullReceipt;
    if (typeof createAutoPullReceipt === "function"){
      district.autoPullReceipt = createAutoPullReceipt(payload);
      return;
    }
    district.autoPullReceipt = {
      ts: new Date().toISOString(),
      mode: String(payload?.mode || "pinned_verified"),
      selected: payload?.selected || {},
      urls: payload?.urls || {},
      requestedCount: Array.isArray(payload?.results) ? payload.results.length : 0,
      successCount: 0,
      warningCount: 0,
      warnings: [],
      status: "warn",
      fingerprint: "",
    };
  };

  const setAutoPullButtonsDisabled = (disabled) => {
    if (els.btnIntelFetchDataCatalog) els.btnIntelFetchDataCatalog.disabled = !!disabled;
    if (els.btnIntelCatalogAutoPull) els.btnIntelCatalogAutoPull.disabled = !!disabled;
    if (els.btnIntelAutoPullAll) els.btnIntelAutoPullAll.disabled = !!disabled;
  };

  const runAutoPullAll = async (s) => {
    if (!s) return;
    if (typeof fetch !== "function"){
      setAutoPullStatus("Auto-pull unavailable: fetch API not supported in this browser.", "warn");
      return;
    }
    const buildAutoPullUrlPlan = engine?.snapshot?.buildAutoPullUrlPlan;
    const evaluateAutoPullPlan = engine?.snapshot?.evaluateAutoPullPlan;
    const resolveAutoPullUrls = engine?.snapshot?.resolveAutoPullUrls;
    const resolveDataRefsByPolicy = engine?.snapshot?.resolveDataRefsByPolicy;
    const planBefore = typeof buildAutoPullUrlPlan === "function"
      ? buildAutoPullUrlPlan({
        dataRefs: s?.dataRefs,
        dataCatalog: s?.dataCatalog,
        scenario: s,
        resolveDataRefsByPolicy,
      })
      : null;
    const manualUrls = {
      censusManifestUrl: normalizeRemoteUrl(els.intelCensusManifestUrl?.value),
      electionManifestUrl: normalizeRemoteUrl(els.intelElectionManifestUrl?.value),
      crosswalkRowsUrl: normalizeRemoteUrl(els.intelCrosswalkRowsUrl?.value),
      precinctResultsUrl: normalizeRemoteUrl(els.intelPrecinctResultsUrl?.value),
      censusGeoRowsUrl: normalizeRemoteUrl(els.intelCensusGeoRowsUrl?.value),
    };
    const mergedUrls = (
      typeof resolveAutoPullUrls === "function" &&
      planBefore &&
      typeof planBefore === "object"
    )
      ? resolveAutoPullUrls({ plan: planBefore, overrides: manualUrls })
      : {
        mode: String(s?.dataRefs?.mode || "pinned_verified"),
        urls: {
          censusManifestUrl: manualUrls.censusManifestUrl || null,
          electionManifestUrl: manualUrls.electionManifestUrl || null,
          crosswalkRowsUrl: manualUrls.crosswalkRowsUrl || null,
          precinctResultsUrl: manualUrls.precinctResultsUrl || null,
          censusGeoRowsUrl: manualUrls.censusGeoRowsUrl || null,
        },
        availableCount: Object.values(manualUrls).filter(Boolean).length,
        missingCount: 5 - Object.values(manualUrls).filter(Boolean).length,
        sourceByKey: {},
      };
    if (typeof evaluateAutoPullPlan === "function"){
      const evalPlan = evaluateAutoPullPlan({ mode: mergedUrls?.mode, urls: mergedUrls?.urls });
      if (!evalPlan?.ready){
        setAutoPullStatus(String(evalPlan?.summaryLine || "Auto-pull blocked: no URL slots available."), "warn");
        return;
      }
    }
    const fillBlank = (el, value) => {
      if (!el) return;
      if (normalizeRemoteUrl(el.value)) return;
      if (!value) return;
      el.value = String(value);
    };
    fillBlank(els.intelCensusManifestUrl, mergedUrls?.urls?.censusManifestUrl);
    fillBlank(els.intelElectionManifestUrl, mergedUrls?.urls?.electionManifestUrl);
    fillBlank(els.intelCrosswalkRowsUrl, mergedUrls?.urls?.crosswalkRowsUrl);
    fillBlank(els.intelPrecinctResultsUrl, mergedUrls?.urls?.precinctResultsUrl);
    fillBlank(els.intelCensusGeoRowsUrl, mergedUrls?.urls?.censusGeoRowsUrl);
    const specs = [
      {
        label: "Census manifest",
        rawUrl: mergedUrls?.urls?.censusManifestUrl,
        importFn: importCensusManifestPayload,
      },
      {
        label: "Election manifest",
        rawUrl: mergedUrls?.urls?.electionManifestUrl,
        importFn: importElectionManifestPayload,
      },
      {
        label: "Crosswalk rows",
        rawUrl: mergedUrls?.urls?.crosswalkRowsUrl,
        importFn: importCrosswalkRowsPayload,
      },
      {
        label: "Precinct results",
        rawUrl: mergedUrls?.urls?.precinctResultsUrl,
        importFn: importPrecinctResultsPayload,
      },
      {
        label: "Census GEO rows",
        rawUrl: mergedUrls?.urls?.censusGeoRowsUrl,
        importFn: importCensusGeoRowsPayload,
      },
    ];
    const activeSpecs = specs
      .map((spec) => ({ ...spec, rawUrl: normalizeRemoteUrl(spec.rawUrl) }))
      .filter((spec) => !!spec.rawUrl);
    if (!activeSpecs.length){
      setAutoPullStatus("No auto-pull URLs provided.", "warn");
      return;
    }
    setAutoPullStatus(`Fetching ${activeSpecs.length} source(s)...`, "muted");
    setAutoPullButtonsDisabled(true);
    let appliedCount = 0;
    let successCount = 0;
    /** @type {string[]} */
    const warnings = [];
    /** @type {Array<{ source: string, url: string | null, ok: boolean, message: string }>} */
    const receiptResults = [];
    try{
      for (const spec of activeSpecs){
        const valid = validateRemoteUrl(spec.rawUrl, spec.label);
        if (!valid.ok){
          warnings.push(valid.error);
          receiptResults.push({
            source: spec.label,
            url: spec.rawUrl,
            ok: false,
            message: valid.error,
          });
          continue;
        }
        try{
          const payload = await fetchJsonFromUrl(valid.url, spec.label);
          const out = spec.importFn(s, payload);
          if (out.applied) appliedCount += 1;
          if (out.kind === "ok"){
            successCount += 1;
            receiptResults.push({
              source: spec.label,
              url: valid.url,
              ok: true,
              message: out.message,
            });
          } else {
            warnings.push(`${spec.label}: ${out.message}`);
            receiptResults.push({
              source: spec.label,
              url: valid.url,
              ok: false,
              message: out.message,
            });
          }
        } catch (err){
          warnings.push(`${spec.label}: ${String(err?.message || "fetch failed")}`);
          receiptResults.push({
            source: spec.label,
            url: valid.url,
            ok: false,
            message: String(err?.message || "fetch failed"),
          });
        }
      }
    } finally {
      setAutoPullButtonsDisabled(false);
    }
    writeAutoPullReceipt(s, {
      nowIso: new Date().toISOString(),
      mode: mergedUrls?.mode || planBefore?.mode || s?.dataRefs?.mode || "pinned_verified",
      selected: planBefore?.selected || {
        boundarySetId: s?.dataRefs?.boundarySetId || null,
        crosswalkVersionId: s?.dataRefs?.crosswalkVersionId || null,
        censusDatasetId: s?.dataRefs?.censusDatasetId || null,
        electionDatasetId: s?.dataRefs?.electionDatasetId || null,
      },
      urls: mergedUrls?.urls || manualUrls,
      results: receiptResults,
    });
    if (appliedCount > 0 || receiptResults.length > 0) commitUIUpdate();
    if (!successCount && warnings.length){
      const msg = `Auto pull failed for ${activeSpecs.length} source(s): ${warnings[0]}`;
      setAutoPullStatus(msg, "warn");
      setIngestStatus(msg, "warn");
      return;
    }
    if (warnings.length){
      const msg = `Auto pull imported ${successCount}/${activeSpecs.length} source(s). ${warnings[0]}`;
      setAutoPullStatus(msg, "warn");
      setIngestStatus(msg, "warn");
      return;
    }
    const msg = `Auto pull imported ${successCount}/${activeSpecs.length} source(s).`;
    setAutoPullStatus(msg, "ok");
    setIngestStatus(msg, "ok");
  };

  if (els.btnIntelImportCensusManifest){
    els.btnIntelImportCensusManifest.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const parsed = parseJsonInput(els.intelCensusManifestJson?.value, "Census manifest");
      if (!parsed.ok){
        setIngestStatus(parsed.error, "warn");
        return;
      }
      const out = importCensusManifestPayload(s, parsed.value);
      setIngestStatus(out.message, out.kind);
      if (out.applied) commitUIUpdate();
    });
  }

  if (els.btnIntelFetchDataCatalog){
    els.btnIntelFetchDataCatalog.addEventListener("click", async () => {
      const s = currentState();
      if (!s) return;
      const valid = validateRemoteUrl(els.intelDataCatalogUrl?.value, "Data catalog");
      if (!valid.ok){
        setAutoPullStatus(valid.error, "warn");
        setIngestStatus(valid.error, "warn");
        return;
      }
      setAutoPullButtonsDisabled(true);
      setAutoPullStatus("Fetching data catalog...", "muted");
      try{
        const district = ensureDistrictEvidenceContainers(s);
        if (district) district.autoPullCatalogUrl = valid.url;
        const payload = await fetchJsonFromUrl(valid.url, "Data catalog");
        const out = importDataCatalogPayload(s, payload);
        setAutoPullStatus(out.message, out.kind);
        setIngestStatus(out.message, out.kind);
        if (out.applied) commitUIUpdate();
      } catch (err){
        const msg = `Data catalog fetch failed: ${String(err?.message || "request failed")}`;
        setAutoPullStatus(msg, "warn");
        setIngestStatus(msg, "warn");
      } finally {
        setAutoPullButtonsDisabled(false);
      }
    });
  }

  if (els.btnIntelCatalogAutoPull){
    els.btnIntelCatalogAutoPull.addEventListener("click", async () => {
      const s = currentState();
      if (!s) return;
      const valid = validateRemoteUrl(els.intelDataCatalogUrl?.value, "Data catalog");
      if (!valid.ok){
        setAutoPullStatus(valid.error, "warn");
        setIngestStatus(valid.error, "warn");
        return;
      }
      setAutoPullButtonsDisabled(true);
      setAutoPullStatus("Fetching data catalog...", "muted");
      try{
        const district = ensureDistrictEvidenceContainers(s);
        if (district) district.autoPullCatalogUrl = valid.url;
        const payload = await fetchJsonFromUrl(valid.url, "Data catalog");
        const out = importDataCatalogPayload(s, payload);
        setAutoPullStatus(out.message, out.kind);
        setIngestStatus(out.message, out.kind);
        if (!out.applied){
          return;
        }
        commitUIUpdate();
      } catch (err){
        const msg = `Data catalog fetch failed: ${String(err?.message || "request failed")}`;
        setAutoPullStatus(msg, "warn");
        setIngestStatus(msg, "warn");
        return;
      } finally {
        setAutoPullButtonsDisabled(false);
      }
      const next = currentState();
      if (!next) return;
      const buildAutoPullUrlPlan = engine?.snapshot?.buildAutoPullUrlPlan;
      const resolveDataRefsByPolicy = engine?.snapshot?.resolveDataRefsByPolicy;
      const resolveAutoPullUrls = engine?.snapshot?.resolveAutoPullUrls;
      const evaluateAutoPullRunNeed = engine?.snapshot?.evaluateAutoPullRunNeed;
      const plan = typeof buildAutoPullUrlPlan === "function"
        ? buildAutoPullUrlPlan({
          dataRefs: next?.dataRefs,
          dataCatalog: next?.dataCatalog,
          scenario: next,
          resolveDataRefsByPolicy,
        })
        : null;
      const manualUrls = {
        censusManifestUrl: normalizeRemoteUrl(els.intelCensusManifestUrl?.value),
        electionManifestUrl: normalizeRemoteUrl(els.intelElectionManifestUrl?.value),
        crosswalkRowsUrl: normalizeRemoteUrl(els.intelCrosswalkRowsUrl?.value),
        precinctResultsUrl: normalizeRemoteUrl(els.intelPrecinctResultsUrl?.value),
        censusGeoRowsUrl: normalizeRemoteUrl(els.intelCensusGeoRowsUrl?.value),
      };
      const merged = (
        typeof resolveAutoPullUrls === "function" &&
        plan &&
        typeof plan === "object"
      )
        ? resolveAutoPullUrls({ plan, overrides: manualUrls })
        : { mode: next?.dataRefs?.mode || "pinned_verified", urls: manualUrls };
      const runNeed = typeof evaluateAutoPullRunNeed === "function"
        ? evaluateAutoPullRunNeed({
          receipt: next?.geoPack?.district?.autoPullReceipt,
          mode: merged?.mode || plan?.mode,
          selected: plan?.selected,
          urls: merged?.urls || manualUrls,
        })
        : null;
      if (runNeed && runNeed.shouldRun === false){
        const msg = String(runNeed.summaryLine || "Auto-pull run skipped: current and successful.");
        setAutoPullStatus(msg, runNeed.status || "ok");
        setIngestStatus(msg, runNeed.status || "ok");
        return;
      }
      await runAutoPullAll(next);
    });
  }

  if (els.btnIntelImportElectionManifest){
    els.btnIntelImportElectionManifest.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const parsed = parseJsonInput(els.intelElectionManifestJson?.value, "Election manifest");
      if (!parsed.ok){
        setIngestStatus(parsed.error, "warn");
        return;
      }
      const out = importElectionManifestPayload(s, parsed.value);
      setIngestStatus(out.message, out.kind);
      if (out.applied) commitUIUpdate();
    });
  }

  if (els.btnIntelImportCrosswalkRows){
    els.btnIntelImportCrosswalkRows.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const parsed = parseJsonInput(els.intelCrosswalkRowsJson?.value, "Crosswalk rows");
      if (!parsed.ok){
        setIngestStatus(parsed.error, "warn");
        return;
      }
      const out = importCrosswalkRowsPayload(s, parsed.value);
      setIngestStatus(out.message, out.kind);
      if (out.applied) commitUIUpdate();
    });
  }

  if (els.btnIntelImportPrecinctResults){
    els.btnIntelImportPrecinctResults.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const parsed = parseJsonInput(els.intelPrecinctResultsJson?.value, "Precinct results");
      if (!parsed.ok){
        setIngestStatus(parsed.error, "warn");
        return;
      }
      const out = importPrecinctResultsPayload(s, parsed.value);
      setIngestStatus(out.message, out.kind);
      if (out.applied) commitUIUpdate();
    });
  }

  if (els.btnIntelFetchCensusGeoRows){
    els.btnIntelFetchCensusGeoRows.addEventListener("click", async () => {
      const s = currentState();
      if (!s) return;
      if (typeof fetch !== "function"){
        setIngestStatus("Census GEO fetch unavailable: browser fetch API is not available.", "warn");
        return;
      }
      const geo = ensureGeoPackShape(s);
      const refs = ensureDataRefShape(s);
      const catalog = ensureCatalogLists(s);
      const district = ensureGeoDistrict(s);
      if (!geo || !refs || !catalog || !district){
        setIngestStatus("Census GEO fetch failed: unable to initialize state containers.", "warn");
        return;
      }
      const acsYearPreference = normalizeAcsYearPreference(district.acsYearPreference || els.intelAcsYearPreference?.value);
      district.acsYearPreference = acsYearPreference;
      const stateFips = cleanDigits(geo?.area?.stateFips || els.intelAreaStateFips?.value, 2);
      const areaType = normalizeAreaTypeInput(geo?.area?.type) || "COUNTY";
      const county3 = normalizeCounty3(stateFips, geo?.area?.countyFips || els.intelAreaCountyFips?.value);
      const placeFips = cleanDigits(geo?.area?.placeFips || els.intelAreaPlaceFips?.value, 5);
      const districtCode = normalizeDistrictCodeForAreaType(areaType, geo?.area?.district || els.intelAreaDistrict?.value);
      const resolution = normalizeAreaResolutionInput(geo?.resolution || els.intelAreaResolution?.value);
      if (stateFips.length !== 2){
        setIngestStatus("Set State first before fetching Census GEO rows.", "warn");
        return;
      }
      const requestPlan = buildCensusGeoApiRequestPlan({
        stateFips,
        county3,
        placeFips,
        areaType,
        district: districtCode,
        resolution,
      });
      if (!requestPlan.length){
        if ((areaType === "CD" || areaType === "SLDU" || areaType === "SLDL") && !districtCode){
          setIngestStatus("Set District code before fetching Census GEO rows for district areas.", "warn");
        } else {
          setIngestStatus("Set County, Place, or District code before fetching Census GEO rows.", "warn");
        }
        return;
      }
      const btn = els.btnIntelFetchCensusGeoRows;
      btn.disabled = true;
      const acsPrefLabel = acsYearPreference === "auto_latest" ? "ACS auto" : `ACS ${acsYearPreference}`;
      setIngestStatus(`Fetching Census GEO rows for state ${stateFips}, ${requestPlan[0].label}, ${resolution} (${acsPrefLabel})...`, "muted");
      try{
        let rows = [];
        let selectedUrl = "";
        let selectedLabel = "";
        let lastErr = "";
        for (const req of requestPlan){
          selectedUrl = req.url;
          selectedLabel = req.label;
          setIngestStatus(`Fetching Census GEO rows for state ${stateFips}, ${req.label}, ${resolution} (${acsPrefLabel})...`, "muted");
          try{
            const payload = await fetchJsonFromUrl(req.url, "Census GEO rows");
            rows = normalizeCensusGeoRowsFromApiPayload(payload, resolution);
            if (rows.length){
              break;
            }
            lastErr = `No rows returned for ${req.label}.`;
          } catch (err){
            lastErr = String(err?.message || "request failed");
          }
        }
        if (!rows.length){
          if (areaType === "PLACE" && placeFips.length === 5 && !county3){
            setIngestStatus(`Census GEO fetch returned no rows for place ${placeFips}. Set county too for county fallback, or switch area type to COUNTY.${lastErr ? ` ${lastErr}` : ""}`, "warn");
          } else {
            setIngestStatus(`Census GEO fetch returned no rows for the selected area/resolution.${lastErr ? ` ${lastErr}` : ""}`, "warn");
          }
          return;
        }
        let acsYear = "";
        let acsUrl = "";
        let acsMatchCount = 0;
        let acsValueKeys = [];
        const acsPlan = buildAcsGeoApiRequestPlanFromCensusUrl(selectedUrl, acsYearPreference);
        for (const req of acsPlan){
          try{
            const payload = await fetchJsonFromUrl(req.url, `ACS5 ${req.year} GEO rows`);
            const acsRows = normalizeAcsGeoRowsFromApiPayload(payload, resolution);
            if (!acsRows.length) continue;
            const merged = mergeAcsGeoRowsIntoCensusRows(rows, acsRows);
            if (!merged.matchedCount) continue;
            rows = merged.rows;
            acsYear = req.year;
            acsUrl = req.url;
            acsMatchCount = merged.matchedCount;
            acsValueKeys = merged.valueKeys;
            break;
          } catch {}
        }
        const activeCensusDatasetId = cleanDataRefId(refs?.censusDatasetId);
        const scopeToken = (areaType === "CD" || areaType === "SLDU" || areaType === "SLDL")
          ? `${stateFips}${areaType.toLowerCase()}${districtCode || "na"}`
          : (county3.length === 3 ? `${stateFips}${county3}` : (placeFips.length === 5 ? `${stateFips}p${placeFips}` : stateFips));
        refs.censusDatasetId = activeCensusDatasetId || `census_api_2020_pl_${scopeToken}_${resolution}`;
        stampDataRefCheck(refs);
        const valueRefs = ["P1_001N", "H1_001N", "INTPTLAT", "INTPTLON"].concat(acsValueKeys);
        const entry = {
          id: refs.censusDatasetId,
          label: `Census API 2020 PL${acsYear ? ` + ACS5 ${acsYear}` : ""} ${selectedLabel || scopeToken} ${resolution}`,
          vintage: acsYear ? `2020+${acsYear}` : "2020",
          boundarySetId: String(refs?.boundarySetId || "").trim() || null,
          stateFips,
          countyFips: county3.length === 3 ? `${stateFips}${county3}` : null,
          placeFips: placeFips.length === 5 ? placeFips : null,
          areaType: areaType || null,
          districtCode: districtCode || null,
          granularity: resolution,
          rowCount: rows.length,
          variableRefs: Array.from(new Set(valueRefs)),
          quality: { coveragePct: 100, isVerified: true },
          source: {
            type: "census_api",
            url: selectedUrl || requestPlan[0].url,
            acsYear: acsYear || null,
            acsUrl: acsUrl || null,
            acsMatchCount: acsMatchCount || 0,
            fetchedAt: new Date().toISOString(),
          },
        };
        upsertCatalogById(catalog.censusDatasets, entry);
        const out = importCensusGeoRowsPayload(s, rows);
        setJsonInputValue(els.intelCensusGeoRowsJson, rows);
        const acsStatus = acsYear
          ? ` + ACS5 ${acsYear} (${acsMatchCount}/${rows.length} GEO matched)`
          : (acsYearPreference === "auto_latest" ? "" : ` + ACS5 ${acsYearPreference} unavailable`);
        setIngestStatus(`${out.message} Source: Census API 2020 PL${acsStatus} (${selectedLabel || "selected area"} · ${rows.length} rows).`, out.kind || "ok");
        if (out.applied){
          commitUIUpdate();
        }
      } catch (err){
        setIngestStatus(`Census GEO fetch failed: ${String(err?.message || "request failed")}`, "warn");
      } finally {
        btn.disabled = false;
      }
    });
  }

  if (els.btnIntelImportCensusGeoRows){
    els.btnIntelImportCensusGeoRows.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const parsed = parseJsonInput(els.intelCensusGeoRowsJson?.value, "Census GEO rows");
      if (!parsed.ok){
        setIngestStatus(parsed.error, "warn");
        return;
      }
      const out = importCensusGeoRowsPayload(s, parsed.value);
      setIngestStatus(out.message, out.kind);
      if (out.applied) commitUIUpdate();
    });
  }

  if (els.btnIntelAutoFillUrls){
    els.btnIntelAutoFillUrls.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const buildAutoPullUrlPlan = engine?.snapshot?.buildAutoPullUrlPlan;
      const resolveDataRefsByPolicy = engine?.snapshot?.resolveDataRefsByPolicy;
      if (typeof buildAutoPullUrlPlan !== "function"){
        setAutoPullStatus("Auto-fill unavailable: engine snapshot does not expose buildAutoPullUrlPlan.", "warn");
        return;
      }
      const plan = buildAutoPullUrlPlan({
        dataRefs: s?.dataRefs,
        dataCatalog: s?.dataCatalog,
        scenario: s,
        resolveDataRefsByPolicy,
      });
      applyAutoPullPlanToInputs(plan);
      const available = Number(plan?.availableCount) || 0;
      const modeLabel = String(plan?.policyLabel || plan?.mode || "policy");
      if (available <= 0){
        const note = Array.isArray(plan?.notes) && plan.notes.length ? ` ${plan.notes[0]}` : "";
        setAutoPullStatus(`No URLs available from ${modeLabel}.${note}`, "warn");
      } else if (Array.isArray(plan?.notes) && plan.notes.length){
        setAutoPullStatus(`Loaded ${available}/5 URL(s) from ${modeLabel}. ${plan.notes[0]}`, "warn");
      } else {
        setAutoPullStatus(`Loaded ${available}/5 URL(s) from ${modeLabel}.`, "ok");
      }
    });
  }

  if (els.btnIntelAutoPullAll){
    els.btnIntelAutoPullAll.addEventListener("click", async () => {
      const s = currentState();
      if (!s) return;
      await runAutoPullAll(s);
    });
  }

  if (els.btnIntelLoadDemoData){
    els.btnIntelLoadDemoData.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const demo = buildDistrictDemoPayload();
      const geo = ensureGeoPackShape(s);
      const district = ensureGeoDistrict(s);
      const refs = ensureDataRefShape(s);
      if (!geo || !district || !refs){
        setIngestStatus("Demo load failed: unable to initialize district containers.", "warn");
        return;
      }

      geo.area.type = normalizeAreaTypeInput(demo?.area?.type);
      geo.area.stateFips = cleanDigits(demo?.area?.stateFips, 2);
      geo.area.district = cleanText(demo?.area?.district, 16);
      geo.area.countyFips = cleanDigits(demo?.area?.countyFips, 5);
      geo.area.placeFips = cleanDigits(demo?.area?.placeFips, 5);
      geo.area.label = cleanText(demo?.area?.label, 120);
      geo.resolution = normalizeAreaResolutionInput(demo?.resolution);
      geo.generatedAt = null;
      district.selectedGeoId = String(demo?.censusGeoRows?.[0]?.geoid || "").trim();
      district.acsYearPreference = normalizeAcsYearPreference(demo?.acsYearPreference || district.acsYearPreference);

      refs.mode = String(demo?.dataRefs?.mode || "pinned_verified").trim() || "pinned_verified";
      refs.boundarySetId = String(demo?.dataRefs?.boundarySetId || "").trim() || null;
      refs.crosswalkVersionId = String(demo?.dataRefs?.crosswalkVersionId || "").trim() || null;
      refs.censusDatasetId = String(demo?.dataRefs?.censusDatasetId || "").trim() || null;
      refs.electionDatasetId = String(demo?.dataRefs?.electionDatasetId || "").trim() || null;
      refs.electionStrictSimilarity = !!demo?.dataRefs?.electionStrictSimilarity;
      refs.electionMaxYearDelta = cleanDataRefNum(demo?.dataRefs?.electionMaxYearDelta, 0, 30);
      refs.electionMinCoveragePct = cleanDataRefNum(demo?.dataRefs?.electionMinCoveragePct, 0, 100);
      stampDataRefCheck(refs);

      const outCatalog = importDataCatalogPayload(s, demo?.dataCatalog);
      const outCensusManifest = importCensusManifestPayload(s, demo?.censusManifest);
      const outElectionManifest = importElectionManifestPayload(s, demo?.electionManifest);
      if (els.intelPrecinctResultsFormat) els.intelPrecinctResultsFormat.value = "canonical";
      const outCrosswalk = importCrosswalkRowsPayload(s, demo?.crosswalkRows);
      const outPrecinct = importPrecinctResultsPayload(s, demo?.precinctResults);
      const outCensusRows = importCensusGeoRowsPayload(s, demo?.censusGeoRows);

      setJsonInputValue(els.intelCensusManifestJson, demo?.censusManifest);
      setJsonInputValue(els.intelElectionManifestJson, demo?.electionManifest);
      setJsonInputValue(els.intelCrosswalkRowsJson, demo?.crosswalkRows);
      setJsonInputValue(els.intelPrecinctResultsJson, demo?.precinctResults);
      setJsonInputValue(els.intelCensusGeoRowsJson, demo?.censusGeoRows);

      if (s.useDistrictIntel){
        s.useDistrictIntel = false;
        if (els.intelUseDistrictToggle) els.intelUseDistrictToggle.checked = false;
        setDistrictIntelStatus("Demo data loaded. District-intel was turned OFF until assumptions are regenerated.", "muted");
      }
      markDistrictIntelStale(s, "Demo district evidence loaded; regenerate district-intel assumptions.");

      const outcomes = [outCatalog, outCensusManifest, outElectionManifest, outCrosswalk, outPrecinct, outCensusRows];
      const bad = outcomes.find((x) => !x?.applied || x?.kind === "warn");
      if (bad){
        setIngestStatus(`Demo loaded with warnings: ${String(bad?.message || "check ingest rows")}`, "warn");
      } else {
        setIngestStatus("Demo district package loaded. Generate district-intel assumptions next.", "ok");
      }
      setDataRefStatus("Demo data refs loaded.", "ok");
      commitUIUpdate();
    });
  }

  const ensureWorkflow = (s) => {
    const wf = getIntelWorkflow(s) || {};
    if (wf.requireCriticalNote == null) wf.requireCriticalNote = true;
    if (wf.requireCriticalEvidence == null) wf.requireCriticalEvidence = true;
    if (!("scenarioLocked" in wf)) wf.scenarioLocked = false;
    if (!("lockReason" in wf)) wf.lockReason = "";
    if (!("lockedAt" in wf)) wf.lockedAt = null;
    if (!("lockedBy" in wf)) wf.lockedBy = "";
    return wf;
  };

  if (els.intelScenarioLocked){
    els.intelScenarioLocked.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const wf = ensureWorkflow(s);
      wf.scenarioLocked = !!els.intelScenarioLocked.checked;
      if (wf.scenarioLocked){
        wf.lockedAt = new Date().toISOString();
      } else {
        wf.lockedAt = null;
      }
      setWorkflowStatus(
        wf.scenarioLocked
          ? "Scenario lock enabled. Planner controls are now read-only."
          : "Scenario lock disabled. Planner controls are editable.",
        wf.scenarioLocked ? "warn" : "ok"
      );
      commitUIUpdate({ allowScenarioLockBypass: true });
    });
  }

  if (els.intelScenarioLockReason){
    els.intelScenarioLockReason.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const wf = ensureWorkflow(s);
      wf.lockReason = String(els.intelScenarioLockReason.value || "").trim();
      setWorkflowStatus("Lock reason updated.", "ok");
      commitUIUpdate({ allowScenarioLockBypass: true });
    });
  }

  if (els.intelRequireCriticalNote){
    els.intelRequireCriticalNote.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const wf = ensureWorkflow(s);
      wf.requireCriticalNote = !!els.intelRequireCriticalNote.checked;
      setWorkflowStatus("Critical note requirement updated.", "ok");
      commitUIUpdate({ allowScenarioLockBypass: true });
    });
  }

  if (els.intelRequireCriticalEvidence){
    els.intelRequireCriticalEvidence.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const wf = ensureWorkflow(s);
      wf.requireCriticalEvidence = !!els.intelRequireCriticalEvidence.checked;
      setWorkflowStatus("Critical evidence requirement updated.", "ok");
      commitUIUpdate({ allowScenarioLockBypass: true });
    });
  }

  if (els.intelCriticalChangeNote){
    const onChange = () => {
      const s = currentState();
      if (!s) return;
      if (!s.ui || typeof s.ui !== "object") s.ui = {};
      s.ui.pendingCriticalNote = String(els.intelCriticalChangeNote.value || "");
      setWorkflowStatus("Pending critical change note saved.", "ok");
      commitUIUpdate({ allowScenarioLockBypass: true });
    };
    els.intelCriticalChangeNote.addEventListener("change", onChange);
    els.intelCriticalChangeNote.addEventListener("blur", onChange);
  }

  if (els.btnIntelBenchmarkSave){
    els.btnIntelBenchmarkSave.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const result = upsertBenchmarkEntry(s, {
        ref: els.intelBenchmarkRef?.value,
        raceType: els.intelBenchmarkRaceType?.value,
        defaultValue: safeNum(els.intelBenchmarkDefault?.value),
        min: safeNum(els.intelBenchmarkMin?.value),
        max: safeNum(els.intelBenchmarkMax?.value),
        warnAbove: safeNum(els.intelBenchmarkWarnAbove?.value),
        hardAbove: safeNum(els.intelBenchmarkHardAbove?.value),
        sourceTitle: els.intelBenchmarkSourceTitle?.value,
        sourceNotes: els.intelBenchmarkSourceNotes?.value,
      });
      if (!result.ok){
        setBenchmarkStatus(result.error || "Benchmark save failed.", "warn");
        return;
      }
      setBenchmarkStatus(result.mode === "created" ? "Benchmark created." : "Benchmark updated.", "ok");
      commitUIUpdate();
    });
  }

  if (els.btnIntelBenchmarkLoadDefaults){
    els.btnIntelBenchmarkLoadDefaults.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const raceType = String(els.intelBenchmarkRaceType?.value || s?.raceType || "all").trim();
      const result = loadDefaultBenchmarksForRaceType(s, raceType);
      if (!result.ok){
        setBenchmarkStatus(result.error || "Failed to load benchmark defaults.", "warn");
        return;
      }
      setBenchmarkStatus(
        `Loaded defaults for '${result.raceType}' (${result.created} new, ${result.updated} updated).`,
        "ok"
      );
      commitUIUpdate();
    });
  }

  if (els.intelBenchmarkTbody){
    els.intelBenchmarkTbody.addEventListener("click", (event) => {
      const target = event?.target;
      if (!(target instanceof HTMLElement)) return;
      const id = target.getAttribute("data-bm-remove");
      if (!id) return;
      const s = currentState();
      if (!s) return;
      const result = removeBenchmarkEntry(s, id);
      if (!result.ok){
        setBenchmarkStatus(result.error || "Benchmark remove failed.", "warn");
        return;
      }
      setBenchmarkStatus("Benchmark removed.", "ok");
      commitUIUpdate();
    });
  }

  if (els.btnIntelEvidenceAttach){
    els.btnIntelEvidenceAttach.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const selectedAuditId = String(els.intelAuditSelect?.value || "").trim();
      const missingRows = listMissingEvidenceAudit(s, { limit: 200 });
      const selectedAudit = missingRows.find((row) => String(row?.id || "").trim() === selectedAuditId) || null;
      const draftNote = String(els.intelEvidenceNotes?.value || "").trim();
      if (missingRows.length > 0 && !selectedAuditId){
        setEvidenceStatus("Select a missing evidence audit item before attaching evidence.", "warn");
        return;
      }
      if (selectedAudit && selectedAudit.requiresNote === true && !String(selectedAudit.note || "").trim() && !draftNote){
        setEvidenceStatus("This audit item also requires a note. Add a short note in Evidence notes before attaching evidence.", "warn");
        return;
      }
      const result = attachEvidenceRecord(s, {
        auditId: selectedAuditId,
        title: els.intelEvidenceTitle?.value,
        source: els.intelEvidenceSource?.value,
        capturedAt: els.intelEvidenceCapturedAt?.value,
        url: els.intelEvidenceUrl?.value,
        notes: els.intelEvidenceNotes?.value,
      });
      if (!result.ok){
        setEvidenceStatus(result.error || "Evidence attach failed.", "warn");
        return;
      }
      if (els.intelEvidenceTitle) els.intelEvidenceTitle.value = "";
      if (els.intelEvidenceSource) els.intelEvidenceSource.value = "";
      if (els.intelEvidenceUrl) els.intelEvidenceUrl.value = "";
      if (els.intelEvidenceNotes) els.intelEvidenceNotes.value = "";
      if (result.resolvedAuditId){
        const updatedAudit = Array.isArray(s?.intelState?.audit)
          ? s.intelState.audit.find((row) => String(row?.id || "").trim() === String(result.resolvedAuditId || "").trim())
          : null;
        if (updatedAudit && String(updatedAudit.status || "").trim() === "missingNote"){
          setEvidenceStatus("Evidence attached. This edit still needs a note to fully resolve governance.", "warn");
        } else {
          setEvidenceStatus("Evidence attached and audit resolved.", "ok");
        }
      } else {
        setEvidenceStatus("Evidence attached.", "ok");
      }
      commitUIUpdate();
    });
  }

  const setCalibrationStatus = (msg, kind = "muted") => {
    setStatus(els.intelCalibrationStatus, msg, kind);
  };
  const setCorrelationStatus = (msg, kind = "muted") => {
    setStatus(els.intelCorrelationStatus, msg, kind);
  };
  const setShockStatus = (msg, kind = "muted") => {
    setStatus(els.intelShockStatus, msg, kind);
  };
  const setObservedStatus = (msg, kind = "muted") => {
    setStatus(els.intelObservedStatus || els.intelCalibrationStatus, msg, kind);
  };
  const setRecommendationStatus = (msg, kind = "muted") => {
    setStatus(els.intelRecommendationStatus || els.intelCalibrationStatus, msg, kind);
  };
  const setWhatIfStatus = (msg, kind = "muted") => {
    setStatus(els.intelWhatIfStatus || els.intelCalibrationStatus, msg, kind);
  };
  const patchValueMatches = (a, b) => {
    if (typeof a === "number" && typeof b === "number"){
      return Math.abs(a - b) <= 1e-9;
    }
    return Object.is(a, b);
  };
  const setDecayStatus = (msg, kind = "muted") => {
    setStatus(els.intelDecayStatus || els.intelCalibrationStatus, msg, kind);
  };
  const knownBriefKinds = new Set(listIntelBriefKinds());
  const selectedBriefKind = () => {
    const raw = String(els.intelBriefKind?.value || "calibrationSources").trim();
    return knownBriefKinds.has(raw) ? raw : "calibrationSources";
  };
  const generateBriefForKind = (s, kind) => {
    if (kind === "scenarioSummary") return generateScenarioSummaryBrief(s);
    if (kind === "scenarioDiff") return generateScenarioDiffBrief(s, { baselineId: "baseline" });
    if (kind === "driftExplanation"){
      const drift = (typeof computeRealityDrift === "function") ? computeRealityDrift() : null;
      return generateDriftExplanationBrief(s, { drift });
    }
    if (kind === "sensitivityInterpretation") return generateSensitivityInterpretationBrief(s);
    return generateCalibrationSourceBrief(s);
  };
  const clampPct100 = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, n));
  };
  const ensureIntelDecayModel = (s) => {
    if (!s.intelState || typeof s.intelState !== "object") s.intelState = { version: "1.0.0" };
    if (!s.intelState.expertToggles || typeof s.intelState.expertToggles !== "object"){
      s.intelState.expertToggles = { capacityDecayEnabled: false, decayModel: { type: "linear", weeklyDecayPct: 0.03, floorPctOfBaseline: 0.70 } };
    }
    if (!s.intelState.expertToggles.decayModel || typeof s.intelState.expertToggles.decayModel !== "object"){
      s.intelState.expertToggles.decayModel = { type: "linear", weeklyDecayPct: 0.03, floorPctOfBaseline: 0.70 };
    }
    return s.intelState.expertToggles.decayModel;
  };

  if (els.btnIntelCalibrationGenerate){
    els.btnIntelCalibrationGenerate.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const kind = selectedBriefKind();
      const result = generateBriefForKind(s, kind);
      if (!result.ok){
        setCalibrationStatus(result.error || `Failed to generate ${intelBriefKindLabel(kind).toLowerCase()} brief.`, "warn");
        return;
      }
      if (els.intelCalibrationBriefContent){
        els.intelCalibrationBriefContent.value = result?.brief?.content || "";
      }
      setCalibrationStatus(`${intelBriefKindLabel(kind)} brief generated.`, "ok");
      commitUIUpdate();
    });
  }

  if (els.btnIntelCalibrationCopy){
    els.btnIntelCalibrationCopy.addEventListener("click", async () => {
      const s = currentState();
      if (!s) return;
      const kind = selectedBriefKind();
      const brief = getLatestBriefByKind(s, kind);
      const content = String(brief?.content || els.intelCalibrationBriefContent?.value || "").trim();
      if (!content){
        setCalibrationStatus(`No ${intelBriefKindLabel(kind).toLowerCase()} brief to copy yet.`, "warn");
        return;
      }
      try{
        if (navigator?.clipboard?.writeText){
          await navigator.clipboard.writeText(content);
          setCalibrationStatus(`${intelBriefKindLabel(kind)} brief copied to clipboard.`, "ok");
        } else {
          throw new Error("Clipboard API unavailable");
        }
      } catch {
        setCalibrationStatus("Clipboard blocked. Copy text manually from the brief box.", "warn");
      }
    });
  }

  if (els.btnIntelGeoInspectorCopy){
    els.btnIntelGeoInspectorCopy.addEventListener("click", async () => {
      const content = String(els.intelGeoInspectorSummary?.value || "").trim();
      if (!content || content === "No selected GEO summary available."){
        setGeoInspectorCopyStatus("No GEO summary available to copy yet.", "warn");
        return;
      }
      try{
        if (navigator?.clipboard?.writeText){
          await navigator.clipboard.writeText(content);
          setGeoInspectorCopyStatus("GEO summary copied to clipboard.", "ok");
        } else {
          throw new Error("Clipboard API unavailable");
        }
      } catch {
        setGeoInspectorCopyStatus("Clipboard blocked. Copy from the GEO summary box manually.", "warn");
      }
    });
  }

  if (els.intelBriefKind){
    els.intelBriefKind.addEventListener("change", () => {
      const kind = selectedBriefKind();
      setCalibrationStatus(`Viewing ${intelBriefKindLabel(kind).toLowerCase()} brief.`, "muted");
      commitUIUpdate({ allowScenarioLockBypass: true });
    });
  }

  if (els.intelMcDistribution){
    els.intelMcDistribution.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      if (!s.intelState || typeof s.intelState !== "object") s.intelState = { version: "1.0.0" };
      if (!s.intelState.simToggles || typeof s.intelState.simToggles !== "object") s.intelState.simToggles = {};
      s.intelState.simToggles.mcDistribution = String(els.intelMcDistribution.value || "triangular");
      if (typeof markMcStale === "function") markMcStale();
      setCalibrationStatus("Distribution updated. Re-run Monte Carlo to apply.", "ok");
      commitUIUpdate();
    });
  }

  if (els.intelCapacityDecayEnabled){
    els.intelCapacityDecayEnabled.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      ensureIntelDecayModel(s);
      s.intelState.expertToggles.capacityDecayEnabled = !!els.intelCapacityDecayEnabled.checked;
      if (typeof markMcStale === "function") markMcStale();
      setDecayStatus("Capacity decay toggle updated. Re-run Monte Carlo to apply.", "ok");
      commitUIUpdate();
    });
  }

  if (els.intelDecayModelType){
    els.intelDecayModelType.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const model = ensureIntelDecayModel(s);
      model.type = String(els.intelDecayModelType.value || "linear");
      if (typeof markMcStale === "function") markMcStale();
      setDecayStatus("Decay model updated. Re-run Monte Carlo to apply.", "ok");
      commitUIUpdate();
    });
  }

  if (els.intelDecayWeeklyPct){
    els.intelDecayWeeklyPct.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const model = ensureIntelDecayModel(s);
      const pct = clampPct100(safeNum(els.intelDecayWeeklyPct.value));
      if (pct == null){
        setDecayStatus("Weekly decay % must be numeric.", "warn");
        return;
      }
      model.weeklyDecayPct = pct / 100;
      if (typeof markMcStale === "function") markMcStale();
      setDecayStatus("Weekly decay updated. Re-run Monte Carlo to apply.", "ok");
      commitUIUpdate();
    });
  }

  if (els.intelDecayFloorPct){
    els.intelDecayFloorPct.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      const model = ensureIntelDecayModel(s);
      const pct = clampPct100(safeNum(els.intelDecayFloorPct.value));
      if (pct == null){
        setDecayStatus("Floor % must be numeric.", "warn");
        return;
      }
      model.floorPctOfBaseline = pct / 100;
      if (typeof markMcStale === "function") markMcStale();
      setDecayStatus("Decay floor updated. Re-run Monte Carlo to apply.", "ok");
      commitUIUpdate();
    });
  }

  if (els.btnIntelAddDefaultCorrelation){
    els.btnIntelAddDefaultCorrelation.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const result = addDefaultCorrelationModel(s);
      if (!result.ok){
        setCorrelationStatus(result.error || "Failed to add default correlation model.", "warn");
        return;
      }
      setCorrelationStatus(
        result.mode === "created" ? "Default correlation model added." : "Default correlation model updated.",
        "ok"
      );
      if (typeof markMcStale === "function") markMcStale();
      commitUIUpdate();
    });
  }

  if (els.btnIntelImportCorrelationJson){
    els.btnIntelImportCorrelationJson.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const result = importCorrelationModelsJson(s, els.intelCorrelationJson?.value || "");
      if (!result.ok){
        setCorrelationStatus(result.error || "Correlation model import failed.", "warn");
        return;
      }
      setCorrelationStatus(
        `Imported correlation models: ${result.created} created, ${result.updated} updated.`,
        "ok"
      );
      if (typeof markMcStale === "function") markMcStale();
      commitUIUpdate();
    });
  }

  if (els.intelCorrelatedShocks){
    els.intelCorrelatedShocks.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      if (!s.intelState || typeof s.intelState !== "object") s.intelState = { version: "1.0.0" };
      if (!s.intelState.simToggles || typeof s.intelState.simToggles !== "object") s.intelState.simToggles = {};
      if (!Array.isArray(s.intelState.correlationModels)) s.intelState.correlationModels = [];

      const turningOn = !!els.intelCorrelatedShocks.checked;
      if (turningOn && s.intelState.correlationModels.length === 0){
        const seed = addDefaultCorrelationModel(s);
        if (!seed.ok){
          setCorrelationStatus(seed.error || "Failed to seed default correlation model.", "warn");
          els.intelCorrelatedShocks.checked = false;
          s.intelState.simToggles.correlatedShocks = false;
          commitUIUpdate();
          return;
        }
      if (!s.intelState.simToggles.correlationMatrixId){
        s.intelState.simToggles.correlationMatrixId = String(seed?.row?.id || "").trim() || null;
      }
      setCorrelationStatus("Correlated shocks enabled. Default correlation model added.", "ok");
    }

      s.intelState.simToggles.correlatedShocks = !!els.intelCorrelatedShocks.checked;
      if (!(turningOn && s.intelState.correlationModels.length > 0)){
        setCorrelationStatus(
          s.intelState.simToggles.correlatedShocks
            ? "Correlated shocks enabled. Re-run Monte Carlo to apply."
            : "Correlated shocks disabled. Selected model is preserved for later use.",
          "ok"
        );
      }
      if (typeof markMcStale === "function") markMcStale();
      commitUIUpdate();
    });
  }

  if (els.intelCorrelationMatrixId){
    els.intelCorrelationMatrixId.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      if (!s.intelState || typeof s.intelState !== "object") s.intelState = { version: "1.0.0" };
      if (!s.intelState.simToggles || typeof s.intelState.simToggles !== "object") s.intelState.simToggles = {};
      const id = String(els.intelCorrelationMatrixId.value || "").trim();
      s.intelState.simToggles.correlationMatrixId = id || null;
      if (typeof markMcStale === "function") markMcStale();
      setCorrelationStatus(
        s.intelState.simToggles.correlatedShocks
          ? "Correlation model updated. Re-run Monte Carlo to apply."
          : "Correlation model selected. Enable Correlated shocks to apply it in Monte Carlo.",
        "ok"
      );
      commitUIUpdate();
    });
  }

  if (els.btnIntelAddDefaultShock){
    els.btnIntelAddDefaultShock.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const result = addDefaultShockScenario(s);
      if (!result.ok){
        setShockStatus(result.error || "Failed to add default shock scenario.", "warn");
        return;
      }
      setShockStatus(
        result.mode === "created" ? "Default shock scenario added." : "Default shock scenario updated.",
        "ok"
      );
      if (typeof markMcStale === "function") markMcStale();
      commitUIUpdate();
    });
  }

  if (els.btnIntelImportShockJson){
    els.btnIntelImportShockJson.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const result = importShockScenariosJson(s, els.intelShockJson?.value || "");
      if (!result.ok){
        setShockStatus(result.error || "Shock scenario import failed.", "warn");
        return;
      }
      setShockStatus(
        `Imported shock scenarios: ${result.created} created, ${result.updated} updated.`,
        "ok"
      );
      if (typeof markMcStale === "function") markMcStale();
      commitUIUpdate();
    });
  }

  if (els.intelShockScenariosEnabled){
    els.intelShockScenariosEnabled.addEventListener("change", () => {
      const s = currentState();
      if (!s) return;
      if (!s.intelState || typeof s.intelState !== "object") s.intelState = { version: "1.0.0" };
      if (!s.intelState.simToggles || typeof s.intelState.simToggles !== "object") s.intelState.simToggles = {};

      const turningOn = !!els.intelShockScenariosEnabled.checked;
      if (turningOn){
        const rows = listShockScenarios(s);
        if (!rows.length){
          const seed = addDefaultShockScenario(s);
          if (!seed.ok){
            els.intelShockScenariosEnabled.checked = false;
            s.intelState.simToggles.shockScenariosEnabled = false;
            setShockStatus(seed.error || "Failed to seed default shock scenario.", "warn");
            commitUIUpdate();
            return;
          }
          setShockStatus("Shock sampling enabled. Default shock scenario added.", "ok");
        } else {
          setShockStatus("Shock sampling enabled. Re-run Monte Carlo to apply.", "ok");
        }
      } else {
        setShockStatus("Shock sampling disabled.", "ok");
      }

      s.intelState.simToggles.shockScenariosEnabled = !!els.intelShockScenariosEnabled.checked;
      if (typeof markMcStale === "function") markMcStale();
      commitUIUpdate();
    });
  }

  if (els.btnIntelCaptureObserved){
    els.btnIntelCaptureObserved.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const drift = (typeof computeRealityDrift === "function") ? computeRealityDrift() : null;
      const result = captureObservedMetricsFromDrift(s, drift, { source: "dailyLog.rolling7", maxEntries: 180 });
      if (!result.ok){
        setObservedStatus(result.error || "Observed metrics capture failed.", "warn");
        return;
      }
      setObservedStatus(
        `Observed metrics captured (${result.created} new, ${result.updated} updated).`,
        "ok"
      );
      commitUIUpdate();
    });
  }

  if (els.btnIntelGenerateRecommendations){
    els.btnIntelGenerateRecommendations.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const drift = (typeof computeRealityDrift === "function") ? computeRealityDrift() : null;
      const metricsResult = captureObservedMetricsFromDrift(s, drift, { source: "dailyLog.rolling7", maxEntries: 180 });
      if (!metricsResult.ok && drift?.hasLog){
        setObservedStatus(metricsResult.error || "Observed metrics capture failed.", "warn");
      }
      const result = refreshDriftRecommendationsFromDrift(s, drift, { maxEntries: 60 });
      if (!result.ok){
        setRecommendationStatus(result.error || "Recommendation generation failed.", "warn");
        return;
      }
      const summary = (result.autoTotal > 0)
        ? `Drift recommendations updated (${result.autoTotal} active).`
        : "No active drift recommendations (rolling metrics are within tolerance).";
      setRecommendationStatus(summary, result.autoTotal > 0 ? "ok" : "muted");
      if (metricsResult.ok){
        setObservedStatus(
          `Observed metrics captured (${metricsResult.created} new, ${metricsResult.updated} updated).`,
          "ok"
        );
      }
      commitUIUpdate();
    });
  }

  if (els.btnIntelParseWhatIf){
    els.btnIntelParseWhatIf.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const text = String(els.intelWhatIfInput?.value || "");
      const result = createWhatIfIntelRequest(s, text, { source: "user.whatIf.v1", maxEntries: 120 });
      if (!result.ok){
        setWhatIfStatus(result.error || "Failed to parse what-if request.", "warn");
        return;
      }
      const unresolved = Number(result.unresolved || 0);
      if (unresolved > 0){
        setWhatIfStatus(
          `Saved what-if request (${result.parsedTargets} parsed, ${unresolved} unresolved segment${unresolved === 1 ? "" : "s"}).`,
          "warn"
        );
      } else {
        setWhatIfStatus(`Saved what-if request (${result.parsedTargets} parsed target${result.parsedTargets === 1 ? "" : "s"}).`, "ok");
      }
      commitUIUpdate({ allowScenarioLockBypass: true });
    });
  }

  if (els.btnIntelApplyTopRecommendation){
    els.btnIntelApplyTopRecommendation.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const recs = Array.isArray(s?.intelState?.recommendations)
        ? s.intelState.recommendations
            .filter((row) => String(row?.source || "").trim() === "auto.realityDrift.v1")
            .slice()
            .sort((a, b) => Number(a?.priority || 99) - Number(b?.priority || 99))
        : [];
      const top = recs[0] || null;
      if (!top){
        setRecommendationStatus("No active drift recommendation to apply.", "warn");
        return;
      }

      const result = applyRecommendationDraftPatch(s, { recommendationId: String(top.id || "") });
      if (!result.ok){
        setRecommendationStatus(result.error || "Failed to apply recommendation patch.", "warn");
        return;
      }
      if (typeof markMcStale === "function") markMcStale();
      commitUIUpdate();

      const linkedAuditIds = [];
      const auditRows = Array.isArray(s?.intelState?.audit) ? s.intelState.audit.slice().reverse() : [];
      if (result.noteMarker){
        for (const row of auditRows){
          if (!row || typeof row !== "object") continue;
          if (!String(row.note || "").includes(result.noteMarker)) continue;
          const id = String(row.id || "").trim();
          if (id && !linkedAuditIds.includes(id)) linkedAuditIds.push(id);
        }
      }
      if (!linkedAuditIds.length && Array.isArray(result.changes) && result.changes.length){
        for (const change of result.changes){
          const match = auditRows.find((row) =>
            row &&
            row.kind === "critical_ref_change" &&
            String(row.source || "") === "ui" &&
            String(row.key || "") === String(change?.key || "") &&
            patchValueMatches(row.after, change?.after)
          );
          const id = String(match?.id || "").trim();
          if (id && !linkedAuditIds.includes(id)) linkedAuditIds.push(id);
        }
      }

      const recRow = Array.isArray(s?.intelState?.recommendations)
        ? s.intelState.recommendations.find((row) => String(row?.id || "").trim() === String(result.recommendationId || "").trim())
        : null;
      if (recRow){
        recRow.appliedAuditIds = linkedAuditIds.slice();
        recRow.updatedAt = new Date().toISOString();
        const unresolved = (Array.isArray(s?.intelState?.audit) ? s.intelState.audit : [])
          .filter((row) => recRow.appliedAuditIds.includes(String(row?.id || "")))
          .filter((row) => String(row?.status || "").toLowerCase() !== "resolved");
        recRow.status = unresolved.length ? "appliedNeedsGovernance" : (result.noop ? "alreadyApplied" : "applied");
      }

      commitUIUpdate({ allowScenarioLockBypass: true });
      if (result.noop){
        setRecommendationStatus(
          `${result.recommendationTitle || "Recommendation"} already matches current assumptions.`,
          "muted"
        );
        return;
      }
      if (recRow?.status === "appliedNeedsGovernance"){
        setRecommendationStatus(
          `Applied ${result.recommendationTitle || "recommendation"} (${result.changes.length} change${result.changes.length === 1 ? "" : "s"}). Governance follow-up required.`,
          "warn"
        );
        return;
      }
      setRecommendationStatus(
        `Applied ${result.recommendationTitle || "recommendation"} (${result.changes.length} change${result.changes.length === 1 ? "" : "s"}).`,
        "ok"
      );
    });
  }
}

/** @param {import("./types").WireEventsCtx} ctx */
export function wireTabAndExportEvents(ctx){
  const {
    els,
    getState,
    persist,
    engine,
    APP_VERSION,
    BUILD_ID,
    getLastResultsSnapshot,
    setLastExportHash,
    downloadText,
  } = ctx || {};
  if (!els || typeof getState !== "function" || typeof persist !== "function") return;

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.getAttribute("data-tab");
      const panel = document.getElementById(`tab-${tab}`);

      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      if (panel){
        const state = getState();
        if (state?.ui) state.ui.activeTab = tab;
        panel.classList.add("active");
      } else {
        const state = getState();
        if (state?.ui) state.ui.activeTab = "win";
        document.getElementById("tab-win")?.classList.add("active");
      }
      persist();
    });
  });

  if (els.btnSaveJson){
    els.btnSaveJson.addEventListener("click", () => {
      const state = getState();
      if (!state || !engine?.snapshot) return;
      const scenarioClone = structuredClone(state);
      const snapshot = {
        modelVersion: engine.snapshot.MODEL_VERSION,
        schemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
        scenarioState: scenarioClone,
        appVersion: APP_VERSION,
        buildId: BUILD_ID
      };
      snapshot.snapshotHash = engine.snapshot.computeSnapshotHash(snapshot);
      if (typeof setLastExportHash === "function") setLastExportHash(snapshot.snapshotHash);
      const payload = engine.snapshot.makeScenarioExport(snapshot);
      if (engine.snapshot.hasNonFiniteNumbers(payload)){
        alert("Export blocked: scenario contains NaN/Infinity.");
        return;
      }
      const filename = engine.snapshot.makeTimestampedFilename("field-path-scenario", "json");
      const text = engine.snapshot.deterministicStringify(payload, 2);
      downloadText(text, filename, "application/json");
    });
  }

  if (els.btnExportCsv){
    els.btnExportCsv.addEventListener("click", () => {
      const snap = (typeof getLastResultsSnapshot === "function") ? getLastResultsSnapshot() : null;
      if (!snap){
        alert("Nothing to export yet. Run a scenario first.");
        return;
      }
      const csv = engine.snapshot.planRowsToCsv(snap);
      if (/NaN|Infinity/.test(csv)){
        alert("CSV export blocked: contains NaN/Infinity.");
        return;
      }
      const filename = engine.snapshot.makeTimestampedFilename("field-path-plan", "csv");
      downloadText(csv, filename, "text/csv");
    });
  }

  if (els.btnCopySummary){
    els.btnCopySummary.addEventListener("click", async () => {
      const snap = (typeof getLastResultsSnapshot === "function") ? getLastResultsSnapshot() : null;
      if (!snap){
        alert("Nothing to copy yet. Run a scenario first.");
        return;
      }
      const text = engine.snapshot.formatSummaryText(snap);
      const r = await engine.snapshot.copyTextToClipboard(text);
      if (!r.ok) alert(r.reason || "Copy failed.");
    });
  }
}

function coerceImportedNumber(raw){
  if (raw == null) return raw;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : raw;
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  const noCommas = trimmed.replace(/,/g, "");
  const noPercent = noCommas.endsWith("%") ? noCommas.slice(0, -1).trim() : noCommas;
  if (!noPercent) return raw;
  const n = Number(noPercent);
  return Number.isFinite(n) ? n : raw;
}

function shouldWarnNumericCoercion(before, after){
  if (before === after) return false;
  const bNum = Number(before);
  if (Number.isFinite(bNum) && Number.isFinite(after) && bNum === after){
    return false; // type-only normalization like "0" -> 0
  }
  if (typeof before === "string"){
    const b = before.trim();
    if (b === String(after)) return false;
  }
  return true;
}

function sanitizeImportedScenarioData(scenario){
  const out = (scenario && typeof scenario === "object") ? structuredClone(scenario) : {};
  const warnings = [];
  const decimalPctFields = new Set([
    "turnoutA","turnoutB","bandWidth","undecidedPct","persuasionPct","earlyVoteExp",
    "supportRatePct","contactRatePct","turnoutReliabilityPct","channelDoorPct","turnoutBaselinePct",
    "universeDemPct","universeRepPct","universeNpaPct","universeOtherPct",
  ]);
  const maybeScalePct = (key, before, after) => {
    if (!decimalPctFields.has(key)) return after;
    if (!Number.isFinite(after)) return after;
    if (!(after > 0 && after <= 1)) return after;
    const fromPercentString = (typeof before === "string") && before.trim().endsWith("%");
    if (fromPercentString) return after;
    const scaled = after * 100;
    warnings.push(`Scaled '${key}' from decimal ${after} to percent ${scaled}.`);
    return scaled;
  };

  const boundedFields = [
    "turnoutA","turnoutB","bandWidth","undecidedPct","persuasionPct","earlyVoteExp",
    "supportRatePct","contactRatePct","turnoutReliabilityPct","channelDoorPct","turnoutBaselinePct",
    "gotvLiftPP","gotvMaxLiftPP","gotvLiftMin","gotvLiftMode","gotvLiftMax","gotvMaxLiftPP2",
    "universeDemPct","universeRepPct","universeNpaPct","universeOtherPct",
  ];
  const nonNegativeFields = [
    "universeSize","goalSupportIds","orgCount","orgHoursPerWeek","volunteerMultBase",
    "doorsPerHour3","callsPerHour3","doorsPerHour","hoursPerShift","shiftsPerVolunteerPerWeek",
    "timelineActiveWeeks","timelineGotvWeeks","timelineStaffCount","timelineStaffHours",
    "timelineVolCount","timelineVolHours","timelineDoorsPerHour","timelineCallsPerHour",
    "timelineTextsPerHour","twCapOverrideHorizonWeeks",
  ];
  const topLevelNumericFields = new Set([...boundedFields, ...nonNegativeFields]);

  for (const key of topLevelNumericFields){
    if (!Object.prototype.hasOwnProperty.call(out, key)) continue;
    const before = out[key];
    let after = coerceImportedNumber(before);
    if (typeof after === "number") after = maybeScalePct(key, before, after);
    if (after !== before){
      out[key] = after;
      if (shouldWarnNumericCoercion(before, after)){
        warnings.push(`Coerced '${key}' from '${before}' to ${after}.`);
      }
    }
  }

  if (Array.isArray(out.candidates)){
    for (const cand of out.candidates){
      if (!cand || typeof cand !== "object") continue;
      if (!Object.prototype.hasOwnProperty.call(cand, "supportPct")) continue;
      const before = cand.supportPct;
      let after = coerceImportedNumber(before);
      if (typeof after === "number" && after > 0 && after <= 1 && !(typeof before === "string" && before.trim().endsWith("%"))){
        const scaled = after * 100;
        warnings.push(`Scaled candidate supportPct from decimal ${after} to percent ${scaled}.`);
        after = scaled;
      }
      if (after !== before){
        cand.supportPct = after;
        if (shouldWarnNumericCoercion(before, after)){
          warnings.push(`Coerced candidate supportPct '${before}' to ${after}.`);
        }
      }
    }
  }

  if (out.userSplit && typeof out.userSplit === "object"){
    for (const key of Object.keys(out.userSplit)){
      const before = out.userSplit[key];
      let after = coerceImportedNumber(before);
      if (typeof after === "number" && after > 0 && after <= 1 && !(typeof before === "string" && before.trim().endsWith("%"))){
        const scaled = after * 100;
        warnings.push(`Scaled userSplit['${key}'] from decimal ${after} to percent ${scaled}.`);
        after = scaled;
      }
      if (after !== before){
        out.userSplit[key] = after;
        if (shouldWarnNumericCoercion(before, after)){
          warnings.push(`Coerced userSplit['${key}'] from '${before}' to ${after}.`);
        }
      }
    }
  }

  const tactics = out?.budget?.tactics;
  if (tactics && typeof tactics === "object"){
    for (const tk of ["doors", "phones", "texts"]){
      const t = tactics[tk];
      if (!t || typeof t !== "object") continue;
      for (const key of ["cpa", "crPct", "srPct"]){
        if (!Object.prototype.hasOwnProperty.call(t, key)) continue;
        const before = t[key];
        const after = coerceImportedNumber(before);
        if (after !== before){
          t[key] = after;
          if (shouldWarnNumericCoercion(before, after)){
            warnings.push(`Coerced budget.tactics.${tk}.${key} from '${before}' to ${after}.`);
          }
        }
      }
    }
  }

  const optimize = out?.budget?.optimize;
  if (optimize && typeof optimize === "object"){
    for (const key of ["budgetAmount", "capacityAttempts", "step"]){
      if (!Object.prototype.hasOwnProperty.call(optimize, key)) continue;
      const before = optimize[key];
      const after = (key === "capacityAttempts") ? coerceImportedNumber(before) : coerceImportedNumber(before);
      if (after !== before){
        optimize[key] = after;
        if (shouldWarnNumericCoercion(before, after)){
          warnings.push(`Coerced budget.optimize.${key} from '${before}' to ${after}.`);
        }
      }
    }
  }

  return { scenario: out, warnings };
}

function normalizeImportWarnings(list){
  const arr = Array.isArray(list) ? list : [];
  const benignUnknownFields = new Set(["buildId", "appVersion", "timestamp"]);
  const seen = new Set();
  const out = [];
  for (const item of arr){
    const text = String(item == null ? "" : item).trim();
    if (!text) continue;
    const m = text.match(/^Unknown field '([^']+)' ignored\.?$/i);
    if (m && benignUnknownFields.has(String(m[1] || "").trim())) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function hideBanner(el){
  if (!el) return;
  el.hidden = true;
  el.textContent = "";
  el.style.display = "none";
}

function showBanner(el, message){
  if (!el) return;
  const text = String(message == null ? "" : message).trim();
  if (!text){
    hideBanner(el);
    return;
  }
  el.hidden = false;
  el.style.removeProperty("display");
  el.textContent = text;
}

/** @param {import("./types").WireEventsCtx} ctx */
export function wireResetImportAndUiToggles(ctx){
  const {
    els,
    getState,
    replaceState,
    makeDefaultState,
    ensureScenarioRegistry,
    ensureDecisionScaffold,
    SCENARIO_BASELINE_ID,
    scenarioInputsFromState,
    scenarioOutputsFromState,
    clearState,
    applyStateToUI,
    rebuildCandidateTable,
    applyThemeFromState,
    render,
    safeCall,
    renderScenarioManagerC1,
    renderDecisionSessionD1,
    persist,
    readJsonFile,
    engine,
    requiredScenarioKeysMissing,
    normalizeLoadedState,
    setText,
    getLastResultsSnapshot,
  } = ctx || {};

  if (!els || typeof getState !== "function" || typeof replaceState !== "function") return;

  if (els.btnResetAll){
    els.btnResetAll.addEventListener("click", () => {
      const ok = confirm("Reset all fields to defaults? This will clear the saved scenario in this browser.");
      if (!ok) return;
      replaceState(makeDefaultState());
      ensureScenarioRegistry();
      ensureDecisionScaffold();
      try{
        const state = getState();
        const b = state?.ui?.scenarios?.[SCENARIO_BASELINE_ID];
        if (b){
          b.inputs = scenarioInputsFromState(state);
          b.outputs = scenarioOutputsFromState(state);
        }
      } catch {}
      clearState();
      const state = getState();
      applyStateToUI();
      rebuildCandidateTable();
      document.body.classList.toggle("training", !!state?.ui?.training);
      applyThemeFromState();
      if (els.explainCard) els.explainCard.hidden = !state?.ui?.training;
      render();
      safeCall(() => { renderScenarioManagerC1(); });
      safeCall(() => { renderDecisionSessionD1(); });
      persist();
    });
  }

  if (els.loadJson){
    els.loadJson.addEventListener("change", async () => {
      const file = els.loadJson.files?.[0];
      if (!file) return;
      hideBanner(els.importWarnBanner);
      hideBanner(els.importHashBanner);

      const loaded = await readJsonFile(file);
      if (!loaded || typeof loaded !== "object"){
        alert("Import failed: invalid JSON.");
        els.loadJson.value = "";
        return;
      }

      // Phase 11 — strict import: block newer schema before migration (optional)
      const curState = getState();
      const prePolicy = engine.snapshot.checkStrictImportPolicy({
        strictMode: !!curState?.ui?.strictImport,
        importedSchemaVersion: loaded.schemaVersion || null,
        currentSchemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
        hashMismatch: false
      });
      if (!prePolicy.ok){
        alert(prePolicy.issues.join(" "));
        els.loadJson.value = "";
        return;
      }

      const mig = engine.snapshot.migrateSnapshot(loaded);
      const importWarnings = normalizeImportWarnings(mig?.warnings);

      const v = engine.snapshot.validateScenarioExport(mig.snapshot, engine.snapshot.MODEL_VERSION);
      if (!v.ok){
        alert(`Import failed: ${v.reason}`);
        els.loadJson.value = "";
        return;
      }

      const sanitized = sanitizeImportedScenarioData(v.scenario);
      if (sanitized.warnings?.length){
        importWarnings.push(...sanitized.warnings);
      }
      let scenarioForImport = sanitized.scenario;
      const hashScenarioForIntegrity = (() => {
        try{
          return (typeof structuredClone === "function") ? structuredClone(scenarioForImport) : JSON.parse(JSON.stringify(scenarioForImport));
        } catch {
          return scenarioForImport;
        }
      })();

      const missing = requiredScenarioKeysMissing(scenarioForImport);
      if (missing.length){
        alert("Import failed: scenario is missing required fields: " + missing.join(", "));
        els.loadJson.value = "";
        return;
      }

      const quality = engine.snapshot.validateImportedScenarioData(scenarioForImport);
      if (!quality.ok){
        const details = quality.errors.map((x) => `- ${x}`).join("\n");
        alert(`Import failed: quality checks failed.\n${details}`);
        els.loadJson.value = "";
        return;
      }
      if (quality.warnings?.length){
        importWarnings.push(...quality.warnings);
      }
      const policyApplied = applyDataRefPolicyRuntime({
        engine,
        scenario: scenarioForImport,
        stageLabel: "Import",
      });
      scenarioForImport = policyApplied.scenario;
      if (Array.isArray(policyApplied.warnings) && policyApplied.warnings.length){
        importWarnings.push(...policyApplied.warnings);
      }
      const districtContract = engine.snapshot.validateDistrictDataContract(scenarioForImport);
      if (!districtContract.ok){
        const details = districtContract.errors.map((x) => `- ${x}`).join("\n");
        alert(`Import failed: district data contract checks failed.\n${details}`);
        els.loadJson.value = "";
        return;
      }
      if (districtContract.warnings?.length){
        importWarnings.push(...districtContract.warnings);
      }
      const normalizedWarnings = normalizeImportWarnings(importWarnings);

      if (els.importWarnBanner){
        if (normalizedWarnings.length){
          const shown = normalizedWarnings.slice(0, 3).join(" • ");
          const extra = normalizedWarnings.length > 3 ? ` (+${normalizedWarnings.length - 3} more)` : "";
          const msg = `${shown}${extra}`.trim();
          showBanner(els.importWarnBanner, msg);
        } else {
          hideBanner(els.importWarnBanner);
        }
      }

      // Phase 9B — snapshot integrity verification (+ Phase 11 strict option)
      try{
        const exportedHash = (loaded && typeof loaded === "object") ? (loaded.snapshotHash || null) : null;
        const recomputed = engine.snapshot.computeSnapshotHash({ modelVersion: v.modelVersion, scenarioState: hashScenarioForIntegrity });
        const hashMismatch = !!(exportedHash && exportedHash !== recomputed);

        if (hashMismatch){
          showBanner(els.importHashBanner, "Snapshot hash differs from exported hash.");
          console.warn("Snapshot hash mismatch", { exportedHash, recomputed });
        } else {
          hideBanner(els.importHashBanner);
        }

        const curState = getState();
        const policy = engine.snapshot.checkStrictImportPolicy({
          strictMode: !!curState?.ui?.strictImport,
          importedSchemaVersion: (mig?.snapshot?.schemaVersion || loaded.schemaVersion || null),
          currentSchemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
          hashMismatch
        });
        if (!policy.ok){
          alert(policy.issues.join(" "));
          els.loadJson.value = "";
          return;
        }
      } catch {
        const curState = getState();
        if (curState?.ui?.strictImport){
          alert("Import blocked: could not verify integrity hash in strict mode.");
          els.loadJson.value = "";
          return;
        }
      }

      // Replace entire state safely (no partial merge with current state)
      replaceState(normalizeLoadedState(scenarioForImport));
      ensureScenarioRegistry();
      ensureDecisionScaffold();
      try{
        const state = getState();
        const b = state?.ui?.scenarios?.[SCENARIO_BASELINE_ID];
        if (b){
          b.inputs = scenarioInputsFromState(state);
          b.outputs = scenarioOutputsFromState(state);
        }
      } catch {}
      const state = getState();
      applyStateToUI();
      rebuildCandidateTable();
      document.body.classList.toggle("training", !!state?.ui?.training);
      applyThemeFromState();
      if (els.explainCard) els.explainCard.hidden = !state?.ui?.training;
      render();
      safeCall(() => { renderDecisionSessionD1(); });
      persist();
      els.loadJson.value = "";
    });
  }

  if (els.toggleTraining){
    els.toggleTraining.addEventListener("change", () => {
      const state = getState();
      if (!state?.ui) return;
      state.ui.training = els.toggleTraining.checked;
      document.body.classList.toggle("training", !!state.ui.training);
      const snap = (typeof getLastResultsSnapshot === "function") ? getLastResultsSnapshot() : null;
      setText(els.snapshotHash, snap?.snapshotHash || "—");
      setText(els.snapshotHashSidebar, snap?.snapshotHash || "—");
      if (els.explainCard) els.explainCard.hidden = !state.ui.training;
      persist();
    });
  }

  if (els.toggleDark){
    els.toggleDark.addEventListener("change", () => {
      const state = getState();
      if (!state) return;
      if (!state.ui) state.ui = {};
      state.ui.themeMode = els.toggleDark.checked ? "dark" : "system";
      applyThemeFromState();
      persist();
    });
  }

  if (els.toggleAdvDiag){
    els.toggleAdvDiag.addEventListener("change", () => {
      const state = getState();
      if (!state?.ui) return;
      state.ui.advDiag = els.toggleAdvDiag.checked;
      if (els.advDiagBox) els.advDiagBox.hidden = !state.ui.advDiag;
      persist();
    });
  }
}

/** @param {import("./types").WireEventsCtx} ctx */
export function wirePrimaryPlannerEvents(ctx){
  const {
    els,
    state: initialState,
    getState,
    safeNum,
    commitUIUpdate,
    schedulePersist,
    applyTemplateDefaultsForRace,
    applyStateToUI,
    refreshAssumptionsProfile,
    uid,
    rebuildCandidateTable,
    rebuildUserSplitInputs,
    markMcStale,
    switchToStage,
    setCanonicalDoorsPerHour,
    canonicalDoorsPerHourFromSnap,
    clamp,
    syncGotvModeUI,
    syncMcModeUI,
    wireSensitivitySurface,
    safeCall,
    runMonteCarloNow,
  } = ctx || {};
  const currentState = () => {
    if (typeof getState === "function"){
      const s = getState();
      return (s && typeof s === "object") ? s : null;
    }
    return (initialState && typeof initialState === "object") ? initialState : null;
  };
  const withState = (fn) => {
    const s = currentState();
    if (!s) return;
    fn(s);
  };

  if (!els || !currentState()) return;

  if (els.scenarioName){
    els.scenarioName.addEventListener("input", () => {
      withState((state) => { state.scenarioName = els.scenarioName.value; });
      schedulePersist();
    });
  }

  if (els.raceType){
    els.raceType.addEventListener("change", () => {
      withState((state) => {
        state.raceType = els.raceType.value;
        applyTemplateDefaultsForRace(state, state.raceType, { force: true });
        if (!state.ui) state.ui = {};
        state.ui.assumptionsProfile = "template";
      });
      applyStateToUI();
      commitUIUpdate();
    });
  }

  if (els.electionDate) els.electionDate.addEventListener("change", () => { withState((state) => { state.electionDate = els.electionDate.value; }); commitUIUpdate(); });
  if (els.weeksRemaining) els.weeksRemaining.addEventListener("input", () => { withState((state) => { state.weeksRemaining = els.weeksRemaining.value; }); commitUIUpdate(); });
  if (els.mode) els.mode.addEventListener("change", () => { withState((state) => { state.mode = els.mode.value; }); schedulePersist(); });

  if (els.universeBasis) els.universeBasis.addEventListener("change", () => { withState((state) => { state.universeBasis = els.universeBasis.value; }); commitUIUpdate(); });
  if (els.universeSize) els.universeSize.addEventListener("input", () => { withState((state) => { state.universeSize = safeNum(els.universeSize.value); }); commitUIUpdate(); });
  if (els.sourceNote) els.sourceNote.addEventListener("input", () => { withState((state) => { state.sourceNote = els.sourceNote.value; }); schedulePersist(); });

  if (els.turnoutA) els.turnoutA.addEventListener("input", () => { withState((state) => { state.turnoutA = safeNum(els.turnoutA.value); }); commitUIUpdate(); });
  if (els.turnoutB) els.turnoutB.addEventListener("input", () => { withState((state) => { state.turnoutB = safeNum(els.turnoutB.value); }); commitUIUpdate(); });
  if (els.bandWidth) els.bandWidth.addEventListener("input", () => {
    withState((state) => { state.bandWidth = safeNum(els.bandWidth.value); });
    refreshAssumptionsProfile();
    commitUIUpdate();
  });

  if (els.btnAddCandidate){
    els.btnAddCandidate.addEventListener("click", () => {
      withState((state) => {
        state.candidates.push({ id: uid(), name: `Candidate ${String.fromCharCode(65 + state.candidates.length)}`, supportPct: 0 });
      });
      rebuildCandidateTable();
      commitUIUpdate();
    });
  }

  if (els.yourCandidate) els.yourCandidate.addEventListener("change", () => { withState((state) => { state.yourCandidateId = els.yourCandidate.value; }); commitUIUpdate(); });
  if (els.undecidedPct) els.undecidedPct.addEventListener("input", () => { withState((state) => { state.undecidedPct = safeNum(els.undecidedPct.value); }); commitUIUpdate(); });

  if (els.undecidedMode){
    els.undecidedMode.addEventListener("change", () => {
      withState((state) => { state.undecidedMode = els.undecidedMode.value; });
      rebuildUserSplitInputs();
      commitUIUpdate();
    });
  }

  if (els.persuasionPct) els.persuasionPct.addEventListener("input", () => {
    withState((state) => { state.persuasionPct = safeNum(els.persuasionPct.value); });
    refreshAssumptionsProfile();
    commitUIUpdate();
  });
  if (els.earlyVoteExp) els.earlyVoteExp.addEventListener("input", () => {
    withState((state) => { state.earlyVoteExp = safeNum(els.earlyVoteExp.value); });
    refreshAssumptionsProfile();
    commitUIUpdate();
  });

  if (els.goalSupportIds) els.goalSupportIds.addEventListener("input", () => { withState((state) => { state.goalSupportIds = els.goalSupportIds.value; }); markMcStale(); commitUIUpdate(); });
  if (els.supportRatePct) els.supportRatePct.addEventListener("input", () => { withState((state) => { state.supportRatePct = safeNum(els.supportRatePct.value); }); markMcStale(); commitUIUpdate(); });
  if (els.contactRatePct) els.contactRatePct.addEventListener("input", () => { withState((state) => { state.contactRatePct = safeNum(els.contactRatePct.value); }); markMcStale(); commitUIUpdate(); });
  if (els.hoursPerShift) els.hoursPerShift.addEventListener("input", () => { withState((state) => { state.hoursPerShift = safeNum(els.hoursPerShift.value); }); commitUIUpdate(); });
  if (els.shiftsPerVolunteerPerWeek) els.shiftsPerVolunteerPerWeek.addEventListener("input", () => { withState((state) => { state.shiftsPerVolunteerPerWeek = safeNum(els.shiftsPerVolunteerPerWeek.value); }); commitUIUpdate(); });
  if (els.universe16Enabled) els.universe16Enabled.addEventListener("change", () => { withState((state) => { state.universeLayerEnabled = !!els.universe16Enabled.checked; }); markMcStale(); commitUIUpdate(); });
  if (els.universe16DemPct) els.universe16DemPct.addEventListener("change", () => { withState((state) => { state.universeDemPct = safeNum(els.universe16DemPct.value); }); markMcStale(); commitUIUpdate(); });
  if (els.universe16RepPct) els.universe16RepPct.addEventListener("change", () => { withState((state) => { state.universeRepPct = safeNum(els.universe16RepPct.value); }); markMcStale(); commitUIUpdate(); });
  if (els.universe16NpaPct) els.universe16NpaPct.addEventListener("change", () => { withState((state) => { state.universeNpaPct = safeNum(els.universe16NpaPct.value); }); markMcStale(); commitUIUpdate(); });
  if (els.universe16OtherPct) els.universe16OtherPct.addEventListener("change", () => { withState((state) => { state.universeOtherPct = safeNum(els.universe16OtherPct.value); }); markMcStale(); commitUIUpdate(); });
  if (els.retentionFactor) els.retentionFactor.addEventListener("change", () => { withState((state) => { state.retentionFactor = safeNum(els.retentionFactor.value); }); markMcStale(); commitUIUpdate(); });

  if (els.orgCount) els.orgCount.addEventListener("input", () => { withState((state) => { state.orgCount = safeNum(els.orgCount.value); }); markMcStale(); commitUIUpdate(); });
  if (els.orgHoursPerWeek) els.orgHoursPerWeek.addEventListener("input", () => { withState((state) => { state.orgHoursPerWeek = safeNum(els.orgHoursPerWeek.value); }); markMcStale(); commitUIUpdate(); });
  if (els.volunteerMultBase) els.volunteerMultBase.addEventListener("input", () => { withState((state) => { state.volunteerMultBase = safeNum(els.volunteerMultBase.value); }); markMcStale(); commitUIUpdate(); });
  if (els.channelDoorPct) els.channelDoorPct.addEventListener("input", () => { withState((state) => { state.channelDoorPct = safeNum(els.channelDoorPct.value); }); markMcStale(); commitUIUpdate(); });
  if (els.doorsPerHour3) els.doorsPerHour3.addEventListener("input", () => {
    withState((state) => {
      setCanonicalDoorsPerHour(state, els.doorsPerHour3.value);
      if (els.doorsPerHour) els.doorsPerHour.value = canonicalDoorsPerHourFromSnap(state) ?? "";
    });
    markMcStale();
    commitUIUpdate();
  });
  if (els.callsPerHour3) els.callsPerHour3.addEventListener("input", () => { withState((state) => { state.callsPerHour3 = safeNum(els.callsPerHour3.value); }); markMcStale(); commitUIUpdate(); });
  if (els.turnoutReliabilityPct) els.turnoutReliabilityPct.addEventListener("input", () => { withState((state) => { state.turnoutReliabilityPct = safeNum(els.turnoutReliabilityPct.value); }); markMcStale(); commitUIUpdate(); });
  if (els.twCapOverrideEnabled) els.twCapOverrideEnabled.addEventListener("change", () => { withState((state) => { state.twCapOverrideEnabled = !!els.twCapOverrideEnabled.checked; }); markMcStale(); commitUIUpdate(); });
  if (els.twCapOverrideMode) els.twCapOverrideMode.addEventListener("change", () => {
    withState((state) => {
      const mode = String(els.twCapOverrideMode.value || "baseline");
      state.twCapOverrideMode = ["baseline", "ramp", "scheduled", "max"].includes(mode) ? mode : "baseline";
    });
    markMcStale();
    commitUIUpdate();
  });
  if (els.twCapOverrideHorizonWeeks) els.twCapOverrideHorizonWeeks.addEventListener("input", () => {
    withState((state) => {
      const n = safeNum(els.twCapOverrideHorizonWeeks.value);
      state.twCapOverrideHorizonWeeks = (n != null && isFinite(n)) ? clamp(n, 4, 52) : 12;
    });
    commitUIUpdate();
  });

  if (els.turnoutEnabled) els.turnoutEnabled.addEventListener("change", () => { withState((state) => { state.turnoutEnabled = !!els.turnoutEnabled.checked; }); markMcStale(); commitUIUpdate(); });
  if (els.turnoutBaselinePct) els.turnoutBaselinePct.addEventListener("input", () => { withState((state) => { state.turnoutBaselinePct = safeNum(els.turnoutBaselinePct.value); }); markMcStale(); commitUIUpdate(); });
  if (els.turnoutTargetOverridePct) els.turnoutTargetOverridePct.addEventListener("input", () => { withState((state) => { state.turnoutTargetOverridePct = els.turnoutTargetOverridePct.value; }); markMcStale(); commitUIUpdate(); });

  if (els.gotvMode) els.gotvMode.addEventListener("change", () => {
    withState((state) => {
      const nextMode = String(els.gotvMode.value || "basic");
      state.gotvMode = nextMode;
    });
    syncGotvModeUI();
    markMcStale();
    commitUIUpdate();
  });

  if (els.gotvLiftPP) els.gotvLiftPP.addEventListener("input", () => { withState((state) => { state.gotvLiftPP = safeNum(els.gotvLiftPP.value); }); markMcStale(); commitUIUpdate(); });
  if (els.gotvMaxLiftPP) els.gotvMaxLiftPP.addEventListener("input", () => { withState((state) => { state.gotvMaxLiftPP = safeNum(els.gotvMaxLiftPP.value); }); markMcStale(); commitUIUpdate(); });
  if (els.gotvDiminishing) els.gotvDiminishing.addEventListener("change", () => {
    withState((state) => {
      state.gotvDiminishing = !!els.gotvDiminishing.checked;
    });
    markMcStale();
    commitUIUpdate();
  });

  if (els.gotvLiftMin) els.gotvLiftMin.addEventListener("input", () => { withState((state) => { state.gotvLiftMin = safeNum(els.gotvLiftMin.value); }); markMcStale(); commitUIUpdate(); });
  if (els.gotvLiftMode) els.gotvLiftMode.addEventListener("input", () => { withState((state) => { state.gotvLiftMode = safeNum(els.gotvLiftMode.value); }); markMcStale(); commitUIUpdate(); });
  if (els.gotvLiftMax) els.gotvLiftMax.addEventListener("input", () => { withState((state) => { state.gotvLiftMax = safeNum(els.gotvLiftMax.value); }); markMcStale(); commitUIUpdate(); });
  if (els.gotvMaxLiftPP2) els.gotvMaxLiftPP2.addEventListener("input", () => { withState((state) => { state.gotvMaxLiftPP2 = safeNum(els.gotvMaxLiftPP2.value); }); markMcStale(); commitUIUpdate(); });

  if (els.mcMode) els.mcMode.addEventListener("change", () => { withState((state) => { state.mcMode = els.mcMode.value; }); syncMcModeUI(); markMcStale(); schedulePersist(); });
  if (els.mcVolatility) els.mcVolatility.addEventListener("change", () => { withState((state) => { state.mcVolatility = els.mcVolatility.value; }); markMcStale(); schedulePersist(); });
  if (els.mcSeed) els.mcSeed.addEventListener("input", () => { withState((state) => { state.mcSeed = els.mcSeed.value; }); markMcStale(); schedulePersist(); });

  const advWatch = (el, key) => {
    if (!el) return;
    el.addEventListener("input", () => {
      withState((state) => { state[key] = safeNum(el.value); });
      markMcStale();
      schedulePersist();
    });
  };
  advWatch(els.mcContactMin, "mcContactMin");
  advWatch(els.mcContactMode, "mcContactMode");
  advWatch(els.mcContactMax, "mcContactMax");
  advWatch(els.mcPersMin, "mcPersMin");
  advWatch(els.mcPersMode, "mcPersMode");
  advWatch(els.mcPersMax, "mcPersMax");
  advWatch(els.mcReliMin, "mcReliMin");
  advWatch(els.mcReliMode, "mcReliMode");
  advWatch(els.mcReliMax, "mcReliMax");
  advWatch(els.mcDphMin, "mcDphMin");
  advWatch(els.mcDphMode, "mcDphMode");
  advWatch(els.mcDphMax, "mcDphMax");
  advWatch(els.mcCphMin, "mcCphMin");
  advWatch(els.mcCphMode, "mcCphMode");
  advWatch(els.mcCphMax, "mcCphMax");

  safeCall(() => { wireSensitivitySurface(); });
  advWatch(els.mcVolMin, "mcVolMin");
  advWatch(els.mcVolMode, "mcVolMode");
  advWatch(els.mcVolMax, "mcVolMax");

  if (els.mcRun) els.mcRun.addEventListener("click", () => runMonteCarloNow());
  if (els.mcRunSidebar) els.mcRunSidebar.addEventListener("click", () => runMonteCarloNow());
  if (els.mcRerun) els.mcRerun.addEventListener("click", () => runMonteCarloNow());
  if (els.mcRerunSidebar) els.mcRerunSidebar.addEventListener("click", () => runMonteCarloNow());
}

/** @param {import("./types").WireEventsCtx} ctx */
export function wireSafetyAndDiagnosticsEvents(ctx){
  const {
    els,
    state: initialState,
    getState,
    setState,
    refreshBackupDropdown,
    restoreBackupByIndex,
    openDiagnostics,
    closeDiagnostics,
    copyDebugBundle,
    exportDailyLog,
    mergeDailyLogIntoState,
    applyRollingRateToAssumption,
    applyAllRollingCalibrations,
    undoLastWeeklyAction,
    safeCall,
  } = ctx || {};
  const currentState = () => {
    if (typeof getState === "function"){
      const s = getState();
      return (s && typeof s === "object") ? s : null;
    }
    return (initialState && typeof initialState === "object") ? initialState : null;
  };

  if (!els || !currentState() || typeof safeCall !== "function") return;

  safeCall(() => {
    if (els.toggleStrictImport){
      const state = currentState();
      els.toggleStrictImport.checked = !!state?.ui?.strictImport;
      document.body.classList.toggle("strict-import", !!state?.ui?.strictImport);
      els.toggleStrictImport.addEventListener("change", () => {
        document.body.classList.toggle("strict-import", !!els.toggleStrictImport.checked);
        setState((s) => { s.ui.strictImport = !!els.toggleStrictImport.checked; });
      });
    }

    if (els.restoreBackup){
      refreshBackupDropdown();
      els.restoreBackup.addEventListener("change", () => {
        const v = els.restoreBackup.value;
        if (!v) return;
        restoreBackupByIndex(v);
        els.restoreBackup.value = "";
      });
    }

    if (els.btnDiagnostics) els.btnDiagnostics.addEventListener("click", openDiagnostics);
    if (els.btnDiagClose) els.btnDiagClose.addEventListener("click", closeDiagnostics);
    if (els.diagModal){
      els.diagModal.addEventListener("click", (e) => {
        const t = e?.target;
        if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeDiagnostics();
      });
    }
    if (els.btnCopyDebug) els.btnCopyDebug.addEventListener("click", () => { safeCall(() => { copyDebugBundle(); }); });

    if (els.dailyLogExportBtn) els.dailyLogExportBtn.addEventListener("click", () => { safeCall(() => { exportDailyLog(); }); });
    if (els.dailyLogImportBtn) els.dailyLogImportBtn.addEventListener("click", () => {
      safeCall(() => {
        const raw = String(els.dailyLogImportText?.value || "").trim();
        if (!raw){
          if (els.dailyLogImportMsg) els.dailyLogImportMsg.textContent = "Paste JSON first";
          return;
        }
        let parsed = null;
        try{
          parsed = JSON.parse(raw);
        } catch {
          if (els.dailyLogImportMsg) els.dailyLogImportMsg.textContent = "Invalid JSON";
          return;
        }
        const r = mergeDailyLogIntoState(parsed);
        if (els.dailyLogImportMsg) els.dailyLogImportMsg.textContent = r.msg;
      });
    });

    if (els.applyRollingCRBtn) els.applyRollingCRBtn.addEventListener("click", () => { safeCall(() => { applyRollingRateToAssumption("contact"); }); });
    if (els.applyRollingSRBtn) els.applyRollingSRBtn.addEventListener("click", () => { safeCall(() => { applyRollingRateToAssumption("support"); }); });
    if (els.applyRollingAPHBtn) els.applyRollingAPHBtn.addEventListener("click", () => { safeCall(() => { applyRollingRateToAssumption("productivity"); }); });
    if (els.applyRollingAllBtn) els.applyRollingAllBtn.addEventListener("click", () => { safeCall(() => { applyAllRollingCalibrations?.(); }); });
    if (els.wkUndoActionBtn) els.wkUndoActionBtn.addEventListener("click", () => { safeCall(() => { undoLastWeeklyAction(); }); });
  });
}
