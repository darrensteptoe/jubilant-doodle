// @ts-check
import {
  benchmarkRefLabel,
  addDefaultShockScenario,
  addDefaultCorrelationModel,
  attachEvidenceRecord,
  captureObservedAndRefreshDriftRecommendations,
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
  listBenchmarkRefs,
  listShockScenarios,
  getIntelWorkflow,
  listMissingEvidenceAudit,
  applyTopDriftRecommendation,
  removeBenchmarkEntry,
  upsertBenchmarkEntry,
} from "./intelControlsRuntime.js";
import { ensureBudgetShape } from "./state.js";
import { normalizeOptimizationObjective } from "../core/turnout.js";
import { pctOverrideToDecimal } from "../core/voteProduction.js";
import {
  buildControlsNoActiveRecommendationStatus,
  buildControlsObservedCaptureStatus,
  buildControlsRecommendationRefreshStatus,
  buildControlsWhatIfSavedStatus,
} from "../core/controlsView.js";
import {
  benchmarkScopeToBenchmarkKey,
  benchmarkScopeToRaceType,
  listBenchmarkScopeOptions,
} from "../core/benchmarkProfiles.js";
import { setCanonicalCallsPerHour } from "../core/throughput.js";

let censusWireModulePromise = null;
let censusWireModule = null;
let censusWireLoadFailed = false;

function loadCensusWireModule(){
  if (censusWireModule) return Promise.resolve(censusWireModule);
  if (censusWireLoadFailed) return Promise.resolve(null);
  if (!censusWireModulePromise){
    censusWireModulePromise = import("./censusPhase1.js")
      .then((mod) => {
        const fn = (mod && typeof mod.wireCensusPhase1EventsModule === "function")
          ? mod.wireCensusPhase1EventsModule
          : null;
        censusWireModule = fn;
        if (!fn){
          censusWireLoadFailed = true;
        }
        return fn;
      })
      .catch((err) => {
        censusWireLoadFailed = true;
        console.error("[wireEvents] failed to load census wiring module", err);
        return null;
      });
  }
  return censusWireModulePromise;
}

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
  watchOpt(els.optObjective, (state) => {
    state.budget.optimize.objective = normalizeOptimizationObjective(els.optObjective.value, "net");
  }, "change");
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

  const setStatus = (el, msg, kind = "muted") => {
    if (!el) return;
    el.classList.remove("ok", "warn", "bad", "muted");
    el.classList.add(kind);
    el.textContent = String(msg || "Ready.");
  };
  const setBenchmarkStatus = (msg, kind = "muted") => setStatus(els.intelBenchmarkStatus, msg, kind);
  const setEvidenceStatus = (msg, kind = "muted") => setStatus(els.intelEvidenceStatus, msg, kind);
  const setWorkflowStatus = (msg, kind = "muted") => setStatus(els.intelWorkflowStatus, msg, kind);

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

  if (els.intelBenchmarkRef instanceof HTMLSelectElement){
    const refs = listBenchmarkRefs();
    if (refs.length){
      const current = String(els.intelBenchmarkRef.value || "").trim();
      els.intelBenchmarkRef.innerHTML = "";
      for (const ref of refs){
        const opt = document.createElement("option");
        opt.value = ref;
        opt.textContent = benchmarkRefLabel(ref);
        els.intelBenchmarkRef.appendChild(opt);
      }
      els.intelBenchmarkRef.value = refs.includes(current) ? current : refs[0];
    }
  }

  if (els.intelBenchmarkRaceType instanceof HTMLSelectElement){
    const scopes = listBenchmarkScopeOptions();
    if (scopes.length){
      const current = String(els.intelBenchmarkRaceType.value || "").trim();
      const currentKey = benchmarkScopeToBenchmarkKey(current);
      els.intelBenchmarkRaceType.innerHTML = "";
      for (const scope of scopes){
        const opt = document.createElement("option");
        opt.value = String(scope?.value || "default");
        opt.textContent = String(scope?.label || scope?.value || "default");
        els.intelBenchmarkRaceType.appendChild(opt);
      }
      const optionsByValue = new Set(scopes.map((scope) => String(scope?.value || "")));
      els.intelBenchmarkRaceType.value = optionsByValue.has(currentKey) ? currentKey : "default";
    }
  }

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
      const selectedScope = String(els.intelBenchmarkRaceType?.value || "default").trim() || "default";
      const result = upsertBenchmarkEntry(s, {
        ref: els.intelBenchmarkRef?.value,
        raceType: benchmarkScopeToRaceType(selectedScope),
        benchmarkKey: benchmarkScopeToBenchmarkKey(selectedScope),
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
      const selectedScope = String(els.intelBenchmarkRaceType?.value || s?.templateMeta?.benchmarkKey || s?.raceType || "default").trim();
      const result = loadDefaultBenchmarksForRaceType(s, {
        raceType: benchmarkScopeToRaceType(selectedScope),
        benchmarkKey: benchmarkScopeToBenchmarkKey(selectedScope),
      });
      if (!result.ok){
        setBenchmarkStatus(result.error || "Failed to load benchmark defaults.", "warn");
        return;
      }
      setBenchmarkStatus(
        `Loaded defaults for '${result.benchmarkKey || result.raceType}' (${result.created} new, ${result.updated} updated).`,
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
      model.weeklyDecayPct = pctOverrideToDecimal(pct, model.weeklyDecayPct) ?? model.weeklyDecayPct;
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
      model.floorPctOfBaseline = pctOverrideToDecimal(pct, model.floorPctOfBaseline) ?? model.floorPctOfBaseline;
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
      const result = captureObservedMetricsFromDrift(s, drift);
      if (!result.ok){
        setObservedStatus(result.error || "Observed metrics capture failed.", "warn");
        return;
      }
      setObservedStatus(
        buildControlsObservedCaptureStatus(result.created, result.updated),
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
      const refresh = captureObservedAndRefreshDriftRecommendations(s, { drift });
      const metricsResult = refresh.metricsResult;
      if (!metricsResult.ok && drift?.hasLog){
        setObservedStatus(metricsResult.error || "Observed metrics capture failed.", "warn");
      }
      const result = refresh.recommendationResult;
      if (!result.ok){
        setRecommendationStatus(result.error || "Recommendation generation failed.", "warn");
        return;
      }
      const summary = buildControlsRecommendationRefreshStatus(result.autoTotal);
      setRecommendationStatus(summary, result.autoTotal > 0 ? "ok" : "muted");
      if (metricsResult.ok){
        setObservedStatus(
          buildControlsObservedCaptureStatus(metricsResult.created, metricsResult.updated),
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
      setWhatIfStatus(
        buildControlsWhatIfSavedStatus(Number(result.parsedTargets || 0), unresolved),
        unresolved > 0 ? "warn" : "ok"
      );
      commitUIUpdate({ allowScenarioLockBypass: true });
    });
  }

  if (els.btnIntelApplyTopRecommendation){
    els.btnIntelApplyTopRecommendation.addEventListener("click", () => {
      const s = currentState();
      if (!s) return;
      const result = applyTopDriftRecommendation(s);
      if (!result.ok){
        const missingTop = String(result.code || "") === "missing_recommendation";
        setRecommendationStatus(
          missingTop ? buildControlsNoActiveRecommendationStatus() : (result.error || "Failed to apply recommendation patch."),
          "warn"
        );
        return;
      }
      if (typeof markMcStale === "function") markMcStale();
      commitUIUpdate();

      commitUIUpdate({ allowScenarioLockBypass: true });
      if (result.noop){
        setRecommendationStatus(
          `${result.recommendationTitle || "Recommendation"} already matches current assumptions.`,
          "muted"
        );
        return;
      }
      if (result.needsGovernance){
        setRecommendationStatus(
          `Applied ${result.recommendationTitle || "recommendation"} (${result.changesCount} change${result.changesCount === 1 ? "" : "s"}). Governance follow-up required.`,
          "warn"
        );
        return;
      }
      setRecommendationStatus(
        `Applied ${result.recommendationTitle || "recommendation"} (${result.changesCount} change${result.changesCount === 1 ? "" : "s"}).`,
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

function shouldScaleFractionalPercents(values, maxTotal = 1.25){
  const nums = Array.isArray(values)
    ? values.filter((v) => Number.isFinite(Number(v)) && Number(v) >= 0).map((v) => Number(v))
    : [];
  if (nums.length < 2) return false;
  let max = 0;
  let sum = 0;
  let positiveCount = 0;
  for (const n of nums){
    if (n > max) max = n;
    sum += n;
    if (n > 0) positiveCount += 1;
  }
  if (!positiveCount) return false;
  if (max > 1) return false;
  return sum > 0 && sum <= maxTotal;
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
    const candidateRows = [];
    for (const cand of out.candidates){
      if (!cand || typeof cand !== "object") continue;
      if (!Object.prototype.hasOwnProperty.call(cand, "supportPct")) continue;
      const before = cand.supportPct;
      const after = coerceImportedNumber(before);
      candidateRows.push({
        cand,
        before,
        after,
        fromPercentString: (typeof before === "string" && before.trim().endsWith("%")),
      });
    }
    const scaleCandidates = !candidateRows.some((row) => row.fromPercentString)
      && shouldScaleFractionalPercents(candidateRows.map((row) => row.after));
    for (const row of candidateRows){
      let after = row.after;
      if (scaleCandidates && typeof after === "number"){
        const scaled = after * 100;
        warnings.push(`Scaled candidate supportPct from decimal ${after} to percent ${scaled}.`);
        after = scaled;
      }
      if (after !== row.before){
        row.cand.supportPct = after;
        if (shouldWarnNumericCoercion(row.before, after)){
          warnings.push(`Coerced candidate supportPct '${row.before}' to ${after}.`);
        }
      }
    }
  }

  if (out.userSplit && typeof out.userSplit === "object"){
    const splitRows = Object.keys(out.userSplit).map((key) => {
      const before = out.userSplit[key];
      return {
        key,
        before,
        after: coerceImportedNumber(before),
        fromPercentString: (typeof before === "string" && before.trim().endsWith("%")),
      };
    });
    const scaleUserSplit = !splitRows.some((row) => row.fromPercentString)
      && shouldScaleFractionalPercents(splitRows.map((row) => row.after));
    for (const row of splitRows){
      let after = row.after;
      if (scaleUserSplit && typeof after === "number"){
        const scaled = after * 100;
        warnings.push(`Scaled userSplit['${row.key}'] from decimal ${after} to percent ${scaled}.`);
        after = scaled;
      }
      if (after !== row.before){
        out.userSplit[row.key] = after;
        if (shouldWarnNumericCoercion(row.before, after)){
          warnings.push(`Coerced userSplit['${row.key}'] from '${row.before}' to ${after}.`);
        }
      }
    }
  }

  const tactics = out?.budget?.tactics;
  if (tactics && typeof tactics === "object"){
    for (const tk of ["doors", "phones", "texts", "litDrop", "mail"]){
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

  loadCensusWireModule().then((wireModule) => {
    if (typeof wireModule !== "function") return;
    const wireCensus = () => wireModule({
      els,
      state: initialState,
      getState,
      commitUIUpdate,
    });
    if (typeof safeCall === "function"){
      safeCall(wireCensus, { label: "wire.censusPhase1" });
      return;
    }
    try {
      wireCensus();
    } catch (err) {
      console.error("[wireEvents] census wiring failed", err);
    }
  });

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
        applyTemplateDefaultsForRace(state, state.raceType, { mode: "untouched" });
        refreshAssumptionsProfile();
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
  if (els.supportRatePct) els.supportRatePct.addEventListener("input", () => {
    withState((state) => { state.supportRatePct = safeNum(els.supportRatePct.value); });
    refreshAssumptionsProfile();
    markMcStale();
    commitUIUpdate();
  });
  if (els.contactRatePct) els.contactRatePct.addEventListener("input", () => {
    withState((state) => { state.contactRatePct = safeNum(els.contactRatePct.value); });
    refreshAssumptionsProfile();
    markMcStale();
    commitUIUpdate();
  });
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
  if (els.channelDoorPct) els.channelDoorPct.addEventListener("input", () => {
    withState((state) => { state.channelDoorPct = safeNum(els.channelDoorPct.value); });
    refreshAssumptionsProfile();
    markMcStale();
    commitUIUpdate();
  });
  if (els.doorsPerHour3) els.doorsPerHour3.addEventListener("input", () => {
    withState((state) => {
      setCanonicalDoorsPerHour(state, els.doorsPerHour3.value);
      if (els.doorsPerHour) els.doorsPerHour.value = canonicalDoorsPerHourFromSnap(state) ?? "";
    });
    refreshAssumptionsProfile();
    markMcStale();
    commitUIUpdate();
  });
  if (els.callsPerHour3) els.callsPerHour3.addEventListener("input", () => {
    withState((state) => {
      setCanonicalCallsPerHour(state, els.callsPerHour3.value, { toNumber: safeNum, emptyValue: "" });
    });
    refreshAssumptionsProfile();
    markMcStale();
    commitUIUpdate();
  });
  if (els.turnoutReliabilityPct) els.turnoutReliabilityPct.addEventListener("input", () => {
    withState((state) => { state.turnoutReliabilityPct = safeNum(els.turnoutReliabilityPct.value); });
    refreshAssumptionsProfile();
    markMcStale();
    commitUIUpdate();
  });
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
  if (els.gotvMaxLiftPP) els.gotvMaxLiftPP.addEventListener("input", () => {
    withState((state) => { state.gotvMaxLiftPP = safeNum(els.gotvMaxLiftPP.value); });
    refreshAssumptionsProfile();
    markMcStale();
    commitUIUpdate();
  });
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
