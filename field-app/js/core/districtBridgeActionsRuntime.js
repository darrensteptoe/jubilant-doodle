// @ts-check

/**
 * @param {Record<string, unknown>} deps
 */
export function createDistrictBridgeActionsRuntime(deps = {}){
  const call = (fn, ...args) => (typeof fn === "function" ? fn(...args) : undefined);

  const getState = () => {
    const value = call(deps.getState);
    return value && typeof value === "object" ? value : {};
  };
  const mutateState = (...args) => call(deps.mutateState, ...args);
  const isScenarioLockedForEdits = (...args) => call(deps.isScenarioLockedForEdits, ...args);
  const districtBridgeCombinedView = (...args) => call(deps.districtBridgeCombinedView, ...args);
  const districtBridgeApplyDomainAction = (...args) => call(deps.districtBridgeApplyDomainAction, ...args);
  const applyTemplateDefaultsForRace = (...args) => call(deps.applyTemplateDefaultsForRace, ...args);
  const deriveAssumptionsProfileFromState = (...args) => call(deps.deriveAssumptionsProfileFromState, ...args);
  const updateDistrictTemplateFieldAction = (...args) => call(deps.updateDistrictTemplateFieldAction, ...args);
  const updateDistrictFormFieldAction = (...args) => call(deps.updateDistrictFormFieldAction, ...args);
  const updateDistrictUniverseFieldAction = (...args) => call(deps.updateDistrictUniverseFieldAction, ...args);
  const setBallotUndecidedAction = (...args) => call(deps.setBallotUndecidedAction, ...args);
  const setBallotYourCandidateAction = (...args) => call(deps.setBallotYourCandidateAction, ...args);
  const addBallotCandidateAction = (...args) => call(deps.addBallotCandidateAction, ...args);
  const updateBallotCandidateAction = (...args) => call(deps.updateBallotCandidateAction, ...args);
  const updateBallotUserSplitAction = (...args) => call(deps.updateBallotUserSplitAction, ...args);
  const removeBallotCandidateAction = (...args) => call(deps.removeBallotCandidateAction, ...args);
  const normalizeCandidateHistoryRecords = (...args) => call(deps.normalizeCandidateHistoryRecords, ...args) || [];
  const canonicalizeCandidateHistoryOffice = (...args) => {
    const canonical = call(deps.canonicalizeCandidateHistoryOffice, ...args);
    const next = canonical != null ? canonical : args[0];
    return cleanText(next);
  };
  const addCandidateHistoryRecordAction = (...args) => call(deps.addCandidateHistoryRecordAction, ...args);
  const updateCandidateHistoryRecordAction = (...args) => call(deps.updateCandidateHistoryRecordAction, ...args);
  const removeCandidateHistoryRecordAction = (...args) => call(deps.removeCandidateHistoryRecordAction, ...args);
  const uid = (...args) => call(deps.uid, ...args);
  const safeNum = (...args) => call(deps.safeNum, ...args);
  const cleanText = (...args) => call(deps.cleanText, ...args);
  const normalizeTargetingState = (...args) => call(deps.normalizeTargetingState, ...args);
  const applyTargetingFieldPatch = (...args) => call(deps.applyTargetingFieldPatch, ...args);
  const applyTargetModelPreset = (...args) => call(deps.applyTargetModelPreset, ...args);
  const resetTargetingWeightsToPreset = (...args) => call(deps.resetTargetingWeightsToPreset, ...args);
  const getCensusRowsForState = (...args) => call(deps.getCensusRowsForState, ...args) || {};
  const getTargetingRuntimeModule = () => {
    const runtime = deps.targetingRuntimeModule;
    return runtime && typeof runtime === "object" ? runtime : null;
  };
  const runTargetRankingRuntime = (...args) => call(deps.runTargetRankingRuntime, ...args);
  const applyTargetingRunResult = (...args) => call(deps.applyTargetingRunResult, ...args) || {};
  const applyTargetingRunResultAction = (...args) => call(deps.applyTargetingRunResultAction, ...args);
  const targetingStatusLoadRowsFirst = String(deps.targetingStatusLoadRowsFirst || "Load census rows first.");
  const buildTargetRankingExportFilename = (...args) => call(deps.buildTargetRankingExportFilename, ...args) || "";
  const buildTargetRankingCsv = (...args) => call(deps.buildTargetRankingCsv, ...args) || "";
  const buildTargetRankingPayload = (...args) => call(deps.buildTargetRankingPayload, ...args) || {};
  const buildTargetRankingPayloadConfig = (...args) => call(deps.buildTargetRankingPayloadConfig, ...args) || {};
  const districtBridgeSyncTargetingCanonicalField = (...args) => call(deps.districtBridgeSyncTargetingCanonicalField, ...args);
  const districtBridgeSyncTargetingCanonicalState = (...args) => call(deps.districtBridgeSyncTargetingCanonicalState, ...args);
  const districtBridgeSyncCensusCanonicalField = (...args) => call(deps.districtBridgeSyncCensusCanonicalField, ...args);
  const districtBridgeSyncCensusSelectionCanonicalState = (...args) => call(deps.districtBridgeSyncCensusSelectionCanonicalState, ...args);
  const districtBridgeCallCensusRuntime = (...args) => call(deps.districtBridgeCallCensusRuntime, ...args);
  const districtBridgePatchCensusBridgeField = (...args) => call(deps.districtBridgePatchCensusBridgeField, ...args);
  const districtBridgePatchCensusGeoSelection = (...args) => call(deps.districtBridgePatchCensusGeoSelection, ...args);

  const getDocumentRef = () => {
    if (deps.documentRef && typeof deps.documentRef === "object"){
      return deps.documentRef;
    }
    return typeof document !== "undefined" ? document : null;
  };
  const getUrlRef = () => {
    if (deps.urlRef && typeof deps.urlRef === "object"){
      return deps.urlRef;
    }
    return typeof URL !== "undefined" ? URL : null;
  };
  const getBlobCtor = () => {
    if (typeof deps.blobCtor === "function"){
      return deps.blobCtor;
    }
    return typeof Blob !== "undefined" ? Blob : null;
  };

  function districtBridgeEnsureTargetingState(srcState = getState()){
    if (!srcState || typeof srcState !== "object"){
      return null;
    }
    srcState.targeting = normalizeTargetingState(srcState.targeting);
    return srcState.targeting;
  }

  function districtBridgeTemplateDimensionsFromState(srcState, overrides = {}){
    const meta = srcState?.templateMeta && typeof srcState.templateMeta === "object" ? srcState.templateMeta : {};
    const officeLevel = cleanText(overrides.officeLevel ?? meta.officeLevel);
    const electionType = cleanText(overrides.electionType ?? meta.electionType);
    const seatContext = cleanText(overrides.seatContext ?? meta.seatContext);
    const partisanshipMode = cleanText(overrides.partisanshipMode ?? meta.partisanshipMode);
    const salienceLevel = cleanText(overrides.salienceLevel ?? meta.salienceLevel);
    return {
      officeLevel,
      electionType,
      seatContext,
      partisanshipMode,
      salienceLevel,
    };
  }

  function districtBridgeTemplateProfileFromState(srcState, overrides = {}){
    const meta = srcState?.templateMeta && typeof srcState.templateMeta === "object" ? srcState.templateMeta : {};
    const ui = srcState?.ui && typeof srcState.ui === "object" ? srcState.ui : {};
    const raceType = cleanText(overrides.raceTypeValue ?? meta.appliedTemplateId ?? srcState?.raceType);
    const overriddenFields = Array.isArray(meta.overriddenFields)
      ? meta.overriddenFields.map((field) => cleanText(field)).filter(Boolean)
      : [];
    return {
      raceType,
      officeLevel: cleanText(overrides.officeLevel ?? meta.officeLevel),
      electionType: cleanText(overrides.electionType ?? meta.electionType),
      seatContext: cleanText(overrides.seatContext ?? meta.seatContext),
      partisanshipMode: cleanText(overrides.partisanshipMode ?? meta.partisanshipMode),
      salienceLevel: cleanText(overrides.salienceLevel ?? meta.salienceLevel),
      appliedTemplateId: cleanText(meta.appliedTemplateId),
      appliedVersion: cleanText(meta.appliedVersion),
      benchmarkKey: cleanText(meta.benchmarkKey),
      assumptionsProfile: cleanText(overrides.assumptionsProfile ?? ui.assumptionsProfile) || "template",
      overriddenFields,
    };
  }

  function districtBridgeApplyTemplateDefaults(mode = "all"){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: districtBridgeCombinedView() };
    }
    const requestedMode = cleanText(mode);
    let applyResult = { ok: false, code: "unknown" };
    mutateState((next) => {
      const syncAction = (actionFn, payload, actionName) => {
        districtBridgeApplyDomainAction(next, actionFn, payload, actionName);
      };
      const requestedDims = districtBridgeTemplateDimensionsFromState(next);
      applyResult = applyTemplateDefaultsForRace(next, next.raceType, {
        mode: requestedMode || "all",
        ...requestedDims,
      });
      if (!next.ui || typeof next.ui !== "object") next.ui = {};
      next.ui.assumptionsProfile = deriveAssumptionsProfileFromState(next);
      const profile = districtBridgeTemplateProfileFromState(next);
      syncAction(updateDistrictTemplateFieldAction, { field: "raceType", value: profile.raceType }, "districtBridge.template.raceType");
      syncAction(updateDistrictTemplateFieldAction, { field: "officeLevel", value: profile.officeLevel }, "districtBridge.template.officeLevel");
      syncAction(updateDistrictTemplateFieldAction, { field: "electionType", value: profile.electionType }, "districtBridge.template.electionType");
      syncAction(updateDistrictTemplateFieldAction, { field: "seatContext", value: profile.seatContext }, "districtBridge.template.seatContext");
      syncAction(updateDistrictTemplateFieldAction, { field: "partisanshipMode", value: profile.partisanshipMode }, "districtBridge.template.partisanshipMode");
      syncAction(updateDistrictTemplateFieldAction, { field: "salienceLevel", value: profile.salienceLevel }, "districtBridge.template.salienceLevel");
      syncAction(updateDistrictTemplateFieldAction, { field: "appliedTemplateId", value: profile.appliedTemplateId }, "districtBridge.template.appliedTemplateId");
      syncAction(updateDistrictTemplateFieldAction, { field: "appliedVersion", value: profile.appliedVersion }, "districtBridge.template.appliedVersion");
      syncAction(updateDistrictTemplateFieldAction, { field: "benchmarkKey", value: profile.benchmarkKey }, "districtBridge.template.benchmarkKey");
      syncAction(updateDistrictTemplateFieldAction, { field: "assumptionsProfile", value: profile.assumptionsProfile }, "districtBridge.template.assumptionsProfile");
      syncAction(updateDistrictTemplateFieldAction, { field: "overriddenFields", value: profile.overriddenFields }, "districtBridge.template.overriddenFields");
      syncAction(updateDistrictFormFieldAction, { field: "electionDate", value: next.electionDate }, "districtBridge.form.electionDate");
      syncAction(updateDistrictFormFieldAction, { field: "weeksRemaining", value: next.weeksRemaining }, "districtBridge.form.weeksRemaining");
      syncAction(updateDistrictFormFieldAction, { field: "mode", value: next.mode }, "districtBridge.form.mode");
      syncAction(updateDistrictFormFieldAction, { field: "universeSize", value: next.universeSize }, "districtBridge.form.universeSize");
      syncAction(updateDistrictFormFieldAction, { field: "universeBasis", value: next.universeBasis }, "districtBridge.form.universeBasis");
      syncAction(updateDistrictFormFieldAction, { field: "sourceNote", value: next.sourceNote }, "districtBridge.form.sourceNote");
      syncAction(updateDistrictFormFieldAction, { field: "turnoutA", value: next.turnoutA }, "districtBridge.form.turnoutA");
      syncAction(updateDistrictFormFieldAction, { field: "turnoutB", value: next.turnoutB }, "districtBridge.form.turnoutB");
      syncAction(updateDistrictFormFieldAction, { field: "bandWidth", value: next.bandWidth }, "districtBridge.form.bandWidth");
      syncAction(updateDistrictUniverseFieldAction, { field: "enabled", value: !!next.universeLayerEnabled }, "districtBridge.universe.enabled");
      syncAction(updateDistrictUniverseFieldAction, { field: "demPct", value: next.universeDemPct }, "districtBridge.universe.demPct");
      syncAction(updateDistrictUniverseFieldAction, { field: "repPct", value: next.universeRepPct }, "districtBridge.universe.repPct");
      syncAction(updateDistrictUniverseFieldAction, { field: "npaPct", value: next.universeNpaPct }, "districtBridge.universe.npaPct");
      syncAction(updateDistrictUniverseFieldAction, { field: "otherPct", value: next.universeOtherPct }, "districtBridge.universe.otherPct");
      syncAction(updateDistrictUniverseFieldAction, { field: "retentionFactor", value: next.retentionFactor }, "districtBridge.universe.retentionFactor");
    });
    if (!applyResult || applyResult.ok !== true){
      return {
        ok: false,
        code: String(applyResult?.code || "apply_failed"),
        view: districtBridgeCombinedView(),
      };
    }
    return {
      ok: true,
      code: "applied",
      mode: String(applyResult.mode || requestedMode || "untouched"),
      updatedFields: Array.isArray(applyResult.updatedFields) ? applyResult.updatedFields.slice() : [],
      skippedFields: Array.isArray(applyResult.skippedFields) ? applyResult.skippedFields.slice() : [],
      templateId: String(applyResult.templateId || "").trim(),
      view: districtBridgeCombinedView(),
    };
  }

  function districtBridgeSetFormField(field, rawValue){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: districtBridgeCombinedView() };
    }
    const key = cleanText(field);
    if (!key){
      return { ok: false, code: "missing_field", view: districtBridgeCombinedView() };
    }

    let applied = false;
    mutateState((next) => {
      const syncAction = (actionFn, payload, actionName) => {
        districtBridgeApplyDomainAction(next, actionFn, payload, actionName);
      };
      const syncTemplateField = (templateField, value) => {
        syncAction(
          updateDistrictTemplateFieldAction,
          { field: templateField, value },
          `districtBridge.template.${templateField}`,
        );
      };
      const syncTemplateProfile = (profileOverrides = {}) => {
        const profile = districtBridgeTemplateProfileFromState(next, profileOverrides);
        syncTemplateField("raceType", profile.raceType);
        syncTemplateField("officeLevel", profile.officeLevel);
        syncTemplateField("electionType", profile.electionType);
        syncTemplateField("seatContext", profile.seatContext);
        syncTemplateField("partisanshipMode", profile.partisanshipMode);
        syncTemplateField("salienceLevel", profile.salienceLevel);
        syncTemplateField("appliedTemplateId", profile.appliedTemplateId);
        syncTemplateField("appliedVersion", profile.appliedVersion);
        syncTemplateField("benchmarkKey", profile.benchmarkKey);
        syncTemplateField("assumptionsProfile", profile.assumptionsProfile);
        syncAction(
          updateDistrictTemplateFieldAction,
          { field: "overriddenFields", value: profile.overriddenFields },
          "districtBridge.template.overriddenFields",
        );
      };
      const syncFormField = (formField, value) => {
        syncAction(
          updateDistrictFormFieldAction,
          { field: formField, value },
          `districtBridge.form.${formField}`,
        );
      };
      const syncUniverseField = (universeField, value) => {
        syncAction(
          updateDistrictUniverseFieldAction,
          { field: universeField, value },
          `districtBridge.universe.${universeField}`,
        );
      };
      const syncUndecided = () => {
        syncAction(
          setBallotUndecidedAction,
          {
            undecidedPct: safeNum(next.undecidedPct),
            undecidedMode: String(next.undecidedMode || "proportional").trim() || "proportional",
          },
          "districtBridge.ballot.undecided",
        );
      };
      const templateDims = districtBridgeTemplateDimensionsFromState(next);
      const applyTemplateDimension = (overrides = {}) => {
        applyTemplateDefaultsForRace(next, next.raceType, {
          mode: "untouched",
          ...templateDims,
          ...overrides,
        });
        if (!next.ui || typeof next.ui !== "object") next.ui = {};
        next.ui.assumptionsProfile = deriveAssumptionsProfileFromState(next);
        syncTemplateProfile();
      };

      if (key === "raceType"){
        const templateId = cleanText(rawValue);
        if (!templateId) return;
        applyTemplateDefaultsForRace(next, next.raceType, {
          templateId,
          mode: "untouched",
        });
        if (!next.ui || typeof next.ui !== "object") next.ui = {};
        next.ui.assumptionsProfile = deriveAssumptionsProfileFromState(next);
        syncTemplateProfile({ raceTypeValue: templateId });
        applied = true;
        return;
      }
      if (key === "officeLevel"){
        const value = cleanText(rawValue);
        if (!value) return;
        applyTemplateDimension({ officeLevel: value });
        applied = true;
        return;
      }
      if (key === "electionType"){
        const value = cleanText(rawValue);
        if (!value) return;
        applyTemplateDimension({ electionType: value });
        applied = true;
        return;
      }
      if (key === "seatContext"){
        const value = cleanText(rawValue);
        if (!value) return;
        applyTemplateDimension({ seatContext: value });
        applied = true;
        return;
      }
      if (key === "partisanshipMode"){
        const value = cleanText(rawValue);
        if (!value) return;
        applyTemplateDimension({ partisanshipMode: value });
        applied = true;
        return;
      }
      if (key === "salienceLevel"){
        const value = cleanText(rawValue);
        if (!value) return;
        applyTemplateDimension({ salienceLevel: value });
        applied = true;
        return;
      }
      if (key === "electionDate"){
        next.electionDate = String(rawValue == null ? "" : rawValue);
        syncFormField("electionDate", next.electionDate);
        applied = true;
        return;
      }
      if (key === "weeksRemaining"){
        next.weeksRemaining = String(rawValue == null ? "" : rawValue);
        syncFormField("weeksRemaining", next.weeksRemaining);
        applied = true;
        return;
      }
      if (key === "mode"){
        const value = cleanText(rawValue);
        if (!value) return;
        next.mode = value;
        syncFormField("mode", next.mode);
        applied = true;
        return;
      }
      if (key === "universeSize"){
        next.universeSize = safeNum(rawValue);
        syncFormField("universeSize", next.universeSize);
        applied = true;
        return;
      }
      if (key === "universeBasis"){
        const value = cleanText(rawValue);
        if (!value) return;
        next.universeBasis = value;
        syncFormField("universeBasis", next.universeBasis);
        applied = true;
        return;
      }
      if (key === "sourceNote"){
        next.sourceNote = String(rawValue == null ? "" : rawValue);
        syncFormField("sourceNote", next.sourceNote);
        applied = true;
        return;
      }
      if (key === "yourCandidate"){
        next.yourCandidateId = String(rawValue == null ? "" : rawValue);
        syncAction(
          setBallotYourCandidateAction,
          { candidateId: next.yourCandidateId },
          "districtBridge.ballot.yourCandidateId",
        );
        applied = true;
        return;
      }
      if (key === "undecidedPct"){
        next.undecidedPct = safeNum(rawValue);
        syncUndecided();
        applied = true;
        return;
      }
      if (key === "undecidedMode"){
        next.undecidedMode = String(rawValue == null ? "" : rawValue) || "proportional";
        syncUndecided();
        applied = true;
        return;
      }
      if (key === "turnoutA"){
        next.turnoutA = safeNum(rawValue);
        syncFormField("turnoutA", next.turnoutA);
        applied = true;
        return;
      }
      if (key === "turnoutB"){
        next.turnoutB = safeNum(rawValue);
        syncFormField("turnoutB", next.turnoutB);
        applied = true;
        return;
      }
      if (key === "bandWidth"){
        next.bandWidth = safeNum(rawValue);
        syncFormField("bandWidth", next.bandWidth);
        applied = true;
        return;
      }
      if (key === "universe16Enabled"){
        next.universeLayerEnabled = !!rawValue;
        syncUniverseField("enabled", next.universeLayerEnabled);
        applied = true;
        return;
      }
      if (key === "universe16DemPct"){
        next.universeDemPct = safeNum(rawValue);
        syncUniverseField("demPct", next.universeDemPct);
        applied = true;
        return;
      }
      if (key === "universe16RepPct"){
        next.universeRepPct = safeNum(rawValue);
        syncUniverseField("repPct", next.universeRepPct);
        applied = true;
        return;
      }
      if (key === "universe16NpaPct"){
        next.universeNpaPct = safeNum(rawValue);
        syncUniverseField("npaPct", next.universeNpaPct);
        applied = true;
        return;
      }
      if (key === "universe16OtherPct"){
        next.universeOtherPct = safeNum(rawValue);
        syncUniverseField("otherPct", next.universeOtherPct);
        applied = true;
        return;
      }
      if (key === "retentionFactor"){
        next.retentionFactor = safeNum(rawValue);
        syncUniverseField("retentionFactor", next.retentionFactor);
        applied = true;
      }
    });

    if (applied) {
      if (key === "bandWidth") {
        call(deps.refreshAssumptionsProfile);
      }
      if (
        key === "universe16Enabled"
        || key === "universe16DemPct"
        || key === "universe16RepPct"
        || key === "universe16NpaPct"
        || key === "universe16OtherPct"
        || key === "retentionFactor"
      ) {
        call(deps.markMcStale);
      }
    }

    return { ok: applied, view: districtBridgeCombinedView() };
  }

  function districtBridgeAddCandidate(){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: districtBridgeCombinedView() };
    }
    mutateState((next) => {
      if (!Array.isArray(next.candidates)) next.candidates = [];
      const labelChar = String.fromCharCode(65 + next.candidates.length);
      const candidate = { id: uid(), name: `Candidate ${labelChar}`, supportPct: 0 };
      next.candidates.push(candidate);
      districtBridgeApplyDomainAction(
        next,
        addBallotCandidateAction,
        {
          candidateId: candidate.id,
          name: candidate.name,
          supportPct: candidate.supportPct,
        },
        "districtBridge.ballot.addCandidate",
      );
    });
    return { ok: true, view: districtBridgeCombinedView() };
  }

  function districtBridgeUpdateCandidate(candidateId, field, rawValue){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: districtBridgeCombinedView() };
    }
    const id = cleanText(candidateId);
    const key = cleanText(field);
    if (!id || !key){
      return { ok: false, code: "missing_candidate_field", view: districtBridgeCombinedView() };
    }

    let applied = false;
    mutateState((next) => {
      if (!Array.isArray(next.candidates)) return;
      const candidate = next.candidates.find((row) => cleanText(row?.id) === id);
      if (!candidate) return;
      if (key === "name"){
        candidate.name = String(rawValue == null ? "" : rawValue);
        if (!next.userSplit || typeof next.userSplit !== "object") next.userSplit = {};
        if (next.userSplit[candidate.id] == null) next.userSplit[candidate.id] = 0;
        districtBridgeApplyDomainAction(
          next,
          updateBallotCandidateAction,
          { candidateId: id, field: "name", value: candidate.name },
          "districtBridge.ballot.candidate.name",
        );
        districtBridgeApplyDomainAction(
          next,
          updateBallotUserSplitAction,
          { candidateId: id, value: next.userSplit[candidate.id] },
          "districtBridge.ballot.userSplit.ensure",
        );
        applied = true;
        return;
      }
      if (key === "supportPct"){
        candidate.supportPct = safeNum(rawValue);
        districtBridgeApplyDomainAction(
          next,
          updateBallotCandidateAction,
          { candidateId: id, field: "supportPct", value: candidate.supportPct },
          "districtBridge.ballot.candidate.supportPct",
        );
        applied = true;
      }
    });

    return { ok: applied, view: districtBridgeCombinedView() };
  }

  function districtBridgeRemoveCandidate(candidateId){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: districtBridgeCombinedView() };
    }
    const id = cleanText(candidateId);
    if (!id){
      return { ok: false, code: "missing_candidate", view: districtBridgeCombinedView() };
    }

    let applied = false;
    mutateState((next) => {
      if (!Array.isArray(next.candidates) || next.candidates.length <= 2) return;
      const remaining = next.candidates.filter((row) => cleanText(row?.id) !== id);
      if (remaining.length === next.candidates.length || remaining.length < 2) return;
      next.candidates = remaining;
      if (next.userSplit && typeof next.userSplit === "object") {
        delete next.userSplit[id];
      }
      if (cleanText(next.yourCandidateId) === id){
        next.yourCandidateId = next.candidates[0]?.id || null;
      }
      districtBridgeApplyDomainAction(
        next,
        removeBallotCandidateAction,
        { candidateId: id },
        "districtBridge.ballot.removeCandidate",
      );
      applied = true;
    });

    return { ok: applied, view: districtBridgeCombinedView() };
  }

  function districtBridgeSetUserSplit(candidateId, rawValue){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: districtBridgeCombinedView() };
    }
    const id = cleanText(candidateId);
    if (!id){
      return { ok: false, code: "missing_candidate", view: districtBridgeCombinedView() };
    }

    let applied = false;
    mutateState((next) => {
      if (!next.userSplit || typeof next.userSplit !== "object") next.userSplit = {};
      next.userSplit[id] = safeNum(rawValue);
      districtBridgeApplyDomainAction(
        next,
        updateBallotUserSplitAction,
        { candidateId: id, value: next.userSplit[id] },
        "districtBridge.ballot.userSplit",
      );
      applied = true;
    });

    return { ok: applied, view: districtBridgeCombinedView() };
  }

  function districtBridgeCandidateHistoryRecordPatch(record, key, rawValue){
    if (!record || typeof record !== "object") return false;
    const field = cleanText(key);
    if (!field) return false;
    if (field === "office"){
      record.office = canonicalizeCandidateHistoryOffice(rawValue);
      return true;
    }
    if (field === "cycleYear"){
      record.cycleYear = safeNum(rawValue);
      return true;
    }
    if (field === "electionType"){
      record.electionType = cleanText(rawValue).toLowerCase();
      return true;
    }
    if (field === "candidateName"){
      record.candidateName = String(rawValue == null ? "" : rawValue);
      return true;
    }
    if (field === "party"){
      record.party = String(rawValue == null ? "" : rawValue);
      return true;
    }
    if (field === "incumbencyStatus"){
      record.incumbencyStatus = cleanText(rawValue).toLowerCase();
      return true;
    }
    if (field === "voteShare"){
      record.voteShare = safeNum(rawValue);
      return true;
    }
    if (field === "margin"){
      record.margin = safeNum(rawValue);
      return true;
    }
    if (field === "turnoutContext"){
      record.turnoutContext = safeNum(rawValue);
      return true;
    }
    if (field === "repeatCandidate"){
      record.repeatCandidate = !!rawValue;
      return true;
    }
    if (field === "overUnderPerformancePct"){
      record.overUnderPerformancePct = safeNum(rawValue);
      return true;
    }
    return false;
  }

  function resolveCandidateHistoryOfficeSeed(srcState){
    const state = srcState && typeof srcState === "object" ? srcState : {};
    const templateMeta = state?.templateMeta && typeof state.templateMeta === "object"
      ? state.templateMeta
      : {};
    const candidates = [
      templateMeta?.appliedTemplateId,
      templateMeta?.officeLevel,
      state?.officeId,
      state?.campaignName,
      state?.raceType,
    ];
    for (const token of candidates){
      const canonical = canonicalizeCandidateHistoryOffice(token);
      if (canonical){
        return canonical;
      }
    }
    return "";
  }

  function districtBridgeAddCandidateHistoryRecord(){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: districtBridgeCombinedView() };
    }

    mutateState((next) => {
      const current = normalizeCandidateHistoryRecords(next.candidateHistory, { uidFn: uid });
      const record = {
        recordId: `ch_${uid()}`,
        office: resolveCandidateHistoryOfficeSeed(next),
        cycleYear: null,
        electionType: String(next?.templateMeta?.electionType || "general").trim().toLowerCase() || "general",
        candidateName: "",
        party: "",
        incumbencyStatus: "",
        voteShare: null,
        margin: null,
        turnoutContext: null,
        repeatCandidate: false,
        overUnderPerformancePct: null,
      };
      current.push(record);
      next.candidateHistory = normalizeCandidateHistoryRecords(current, { uidFn: uid });
      districtBridgeApplyDomainAction(
        next,
        addCandidateHistoryRecordAction,
        record,
        "districtBridge.candidateHistory.addRecord",
      );
    });
    return { ok: true, view: districtBridgeCombinedView() };
  }

  function districtBridgeUpdateCandidateHistoryRecord(recordId, field, rawValue){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: districtBridgeCombinedView() };
    }
    const id = cleanText(recordId);
    const key = cleanText(field);
    if (!id || !key){
      return { ok: false, code: "missing_candidate_history_field", view: districtBridgeCombinedView() };
    }

    let applied = false;
    mutateState((next) => {
      const rows = normalizeCandidateHistoryRecords(next.candidateHistory, { uidFn: uid });
      const target = rows.find((row) => cleanText(row?.recordId) === id);
      if (!target) return;
      applied = districtBridgeCandidateHistoryRecordPatch(target, key, rawValue) || applied;
      if (applied){
        districtBridgeApplyDomainAction(
          next,
          updateCandidateHistoryRecordAction,
          { recordId: id, field: key, value: target[key] },
          `districtBridge.candidateHistory.${key}`,
        );
      }
      next.candidateHistory = normalizeCandidateHistoryRecords(rows, { uidFn: uid });
    });
    return { ok: applied, view: districtBridgeCombinedView() };
  }

  function districtBridgeRemoveCandidateHistoryRecord(recordId){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: districtBridgeCombinedView() };
    }
    const id = cleanText(recordId);
    if (!id){
      return { ok: false, code: "missing_candidate_history_id", view: districtBridgeCombinedView() };
    }

    let applied = false;
    mutateState((next) => {
      const rows = normalizeCandidateHistoryRecords(next.candidateHistory, { uidFn: uid });
      const remaining = rows.filter((row) => cleanText(row?.recordId) !== id);
      if (remaining.length === rows.length) return;
      next.candidateHistory = normalizeCandidateHistoryRecords(remaining, { uidFn: uid });
      districtBridgeApplyDomainAction(
        next,
        removeCandidateHistoryRecordAction,
        { recordId: id },
        "districtBridge.candidateHistory.removeRecord",
      );
      applied = true;
    });
    return { ok: applied, view: districtBridgeCombinedView() };
  }

  function districtBridgeDownloadTextFile(text, filename, mime){
    const documentRef = getDocumentRef();
    const urlRef = getUrlRef();
    const BlobCtor = getBlobCtor();
    if (!documentRef || !urlRef || typeof BlobCtor !== "function"){
      return false;
    }
    const blob = new BlobCtor([String(text == null ? "" : text)], { type: mime || "text/plain" });
    const url = urlRef.createObjectURL(blob);
    const link = documentRef.createElement("a");
    link.href = url;
    link.download = filename || "download.txt";
    documentRef.body.appendChild(link);
    link.click();
    link.remove();
    urlRef.revokeObjectURL(url);
    return true;
  }

  function districtBridgeSetTargetingField(field, rawValue){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: districtBridgeCombinedView() };
    }
    const key = cleanText(field);
    if (!key){
      return { ok: false, code: "missing_field", view: districtBridgeCombinedView() };
    }

    let applied = false;
    mutateState((next) => {
      const targeting = districtBridgeEnsureTargetingState(next);
      if (!targeting){
        return;
      }
      const fieldApplied = applyTargetingFieldPatch(targeting, key, rawValue) || false;
      if (fieldApplied){
        districtBridgeSyncTargetingCanonicalField(next, key, targeting);
        applied = true;
      }
    });

    if (!applied){
      return { ok: false, code: "ignored", view: districtBridgeCombinedView() };
    }
    return { ok: true, view: districtBridgeCombinedView() };
  }

  function districtBridgeApplyTargetingPreset(modelId){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: districtBridgeCombinedView() };
    }
    const nextModelId = cleanText(modelId);
    if (!nextModelId){
      return { ok: false, code: "missing_model", view: districtBridgeCombinedView() };
    }

    mutateState((next) => {
      const targeting = districtBridgeEnsureTargetingState(next);
      if (!targeting){
        return;
      }
      applyTargetModelPreset(targeting, nextModelId);
      districtBridgeSyncTargetingCanonicalState(next, targeting);
    });
    return { ok: true, view: districtBridgeCombinedView() };
  }

  function districtBridgeResetTargetingWeights(){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: districtBridgeCombinedView() };
    }

    mutateState((next) => {
      const targeting = districtBridgeEnsureTargetingState(next);
      if (!targeting){
        return;
      }
      resetTargetingWeightsToPreset(targeting, cleanText(targeting.presetId) || cleanText(targeting.modelId));
      districtBridgeSyncTargetingCanonicalState(next, targeting);
    });
    return { ok: true, view: districtBridgeCombinedView() };
  }

  function districtBridgeRunTargeting(){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: districtBridgeCombinedView() };
    }
    const runtimeRows = getCensusRowsForState(state?.census);
    const loadedCount = Object.keys(runtimeRows && typeof runtimeRows === "object" ? runtimeRows : {}).length;
    if (!loadedCount){
      mutateState((next) => {
        if (!next.census || typeof next.census !== "object") next.census = {};
        next.census.status = targetingStatusLoadRowsFirst;
        next.census.error = next.census.status;
      });
      return { ok: false, code: "no_rows", view: districtBridgeCombinedView() };
    }

    let runResult = null;
    let appliedRuntime = null;
    let runError = null;
    let runErrorMessage = "";
    mutateState((next) => {
      try {
        const targeting = districtBridgeEnsureTargetingState(next);
        if (!targeting){
          return;
        }
        if (!next.census || typeof next.census !== "object") next.census = {};
        const targetingRuntime = getTargetingRuntimeModule();
        const runTargetRankingFn = (
          targetingRuntime
          && typeof targetingRuntime.runTargetRanking === "function"
        )
          ? targetingRuntime.runTargetRanking
          : (
            typeof runTargetRankingRuntime === "function"
              ? runTargetRankingRuntime
              : (
                typeof globalThis === "object"
                && globalThis
                && globalThis.__FPE_TARGETING_RUNTIME__
                && typeof globalThis.__FPE_TARGETING_RUNTIME__.runTargetRanking === "function"
                  ? globalThis.__FPE_TARGETING_RUNTIME__.runTargetRanking
                  : null
              )
          );
        if (typeof runTargetRankingFn !== "function"){
          throw new Error("runTargetRanking unavailable in runtime bundle.");
        }
        runResult = runTargetRankingFn({
          state: next,
          censusState: next.census,
          rowsByGeoid: runtimeRows,
        });
        appliedRuntime = applyTargetingRunResult(targeting, runResult, { locale: "en-US" });
        if (!appliedRuntime.hasRows){
          next.census.status = appliedRuntime.statusText;
          next.census.error = "";
          return;
        }
        next.census.status = appliedRuntime.statusText;
        next.census.error = "";
        districtBridgeSyncTargetingCanonicalState(next, targeting);
        districtBridgeApplyDomainAction(
          next,
          applyTargetingRunResultAction,
          {
            rows: Array.isArray(targeting?.lastRows) ? targeting.lastRows : [],
            statusText: String(appliedRuntime?.statusText || "").trim(),
            meta: targeting?.lastMeta && typeof targeting.lastMeta === "object" ? targeting.lastMeta : {},
            lastRunAt: String(targeting?.lastRun || "").trim(),
          },
          "districtBridge.targeting.runtime.applyResult",
        );
      } catch (err) {
        runError = err;
        if (!next.census || typeof next.census !== "object") next.census = {};
        runErrorMessage = cleanText(err?.message) || "Targeting run failed.";
        next.census.status = runErrorMessage;
        next.census.error = next.census.status;
      }
    });

    if (runError){
      return {
        ok: false,
        code: "run_failed",
        message: runErrorMessage || "Targeting run failed.",
        view: districtBridgeCombinedView(),
      };
    }
    return { ok: true, view: districtBridgeCombinedView() };
  }

  function districtBridgeExportTargetingCsv(){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: districtBridgeCombinedView() };
    }
    const targeting = districtBridgeEnsureTargetingState(state);
    const rows = Array.isArray(targeting?.lastRows) ? targeting.lastRows : [];
    if (!rows.length){
      return { ok: false, code: "no_rows", view: districtBridgeCombinedView() };
    }
    const file = buildTargetRankingExportFilename({
      presetId: cleanText(targeting?.presetId),
      modelId: cleanText(targeting?.modelId),
      extension: "csv",
    });
    const csv = buildTargetRankingCsv(rows);
    const ok = districtBridgeDownloadTextFile(csv, file, "text/csv");
    return { ok, code: ok ? "exported" : "export_failed", view: districtBridgeCombinedView() };
  }

  function districtBridgeExportTargetingJson(){
    const state = getState();
    if (isScenarioLockedForEdits(state)){
      return { ok: false, code: "locked", view: districtBridgeCombinedView() };
    }
    const targeting = districtBridgeEnsureTargetingState(state);
    const rows = Array.isArray(targeting?.lastRows) ? targeting.lastRows : [];
    if (!rows.length){
      return { ok: false, code: "no_rows", view: districtBridgeCombinedView() };
    }
    const payload = buildTargetRankingPayload({
      rows,
      meta: targeting?.lastMeta,
      config: buildTargetRankingPayloadConfig(targeting),
    });
    const file = buildTargetRankingExportFilename({
      presetId: cleanText(targeting?.presetId),
      modelId: cleanText(targeting?.modelId),
      extension: "json",
    });
    const ok = districtBridgeDownloadTextFile(JSON.stringify(payload, null, 2), file, "application/json");
    return { ok, code: ok ? "exported" : "export_failed", view: districtBridgeCombinedView() };
  }

  function districtBridgeSetCensusField(field, rawValue){
    const key = cleanText(field);
    if (!key){
      return { ok: false, code: "missing_field", view: districtBridgeCombinedView() };
    }
    const syncCanonicalCensusField = (value) => {
      mutateState((next) => {
        districtBridgeSyncCensusCanonicalField(next, key, value);
        districtBridgeSyncCensusSelectionCanonicalState(next);
      });
    };
    const runtimeResult = districtBridgeCallCensusRuntime("setField", key, rawValue);
    if (runtimeResult && typeof runtimeResult === "object"){
      if (runtimeResult.ok === true){
        syncCanonicalCensusField(rawValue);
        return { ok: true, code: "updated_runtime", view: districtBridgeCombinedView() };
      }
      const bridgePatched = districtBridgePatchCensusBridgeField(key, rawValue);
      if (bridgePatched){
        syncCanonicalCensusField(rawValue);
        return {
          ok: true,
          code: cleanText(runtimeResult.code) || "runtime_unavailable_fallback",
          view: districtBridgeCombinedView(),
        };
      }
      return {
        ok: false,
        code: cleanText(runtimeResult.code) || "runtime_unavailable",
        view: districtBridgeCombinedView(),
      };
    }
    const bridgePatched = districtBridgePatchCensusBridgeField(key, rawValue);
    if (bridgePatched){
      syncCanonicalCensusField(rawValue);
      return { ok: true, code: "updated_bridge_state", view: districtBridgeCombinedView() };
    }
    return { ok: false, code: "runtime_unavailable", view: districtBridgeCombinedView() };
  }

  function districtBridgeSetCensusGeoSelection(values){
    const syncSelection = () => {
      mutateState((next) => {
        districtBridgeSyncCensusSelectionCanonicalState(next);
      });
    };
    const runtimeResult = districtBridgeCallCensusRuntime("setGeoSelection", values);
    if (runtimeResult && typeof runtimeResult === "object"){
      if (runtimeResult.ok === true){
        syncSelection();
        return { ok: true, code: "updated_runtime", view: districtBridgeCombinedView() };
      }
      const patched = districtBridgePatchCensusGeoSelection(values);
      if (patched){
        syncSelection();
        return {
          ok: true,
          code: cleanText(runtimeResult.code) || "runtime_unavailable_fallback",
          view: districtBridgeCombinedView(),
        };
      }
      return {
        ok: false,
        code: cleanText(runtimeResult.code) || "runtime_unavailable",
        view: districtBridgeCombinedView(),
      };
    }
    const patched = districtBridgePatchCensusGeoSelection(values);
    if (patched){
      syncSelection();
      return { ok: true, code: "updated_bridge_state", view: districtBridgeCombinedView() };
    }
    return { ok: false, code: "runtime_unavailable", view: districtBridgeCombinedView() };
  }

  function districtBridgeSetCensusFile(field, filesLike){
    const key = cleanText(field);
    if (!key){
      return { ok: false, code: "missing_field", view: districtBridgeCombinedView() };
    }
    const runtimeResult = districtBridgeCallCensusRuntime("setFile", key, filesLike);
    if (runtimeResult && typeof runtimeResult === "object"){
      if (runtimeResult.ok === true){
        return { ok: true, code: "updated_runtime", view: districtBridgeCombinedView() };
      }
      return {
        ok: false,
        code: cleanText(runtimeResult.code) || "runtime_unavailable",
        view: districtBridgeCombinedView(),
      };
    }
    return { ok: false, code: "runtime_unavailable", view: districtBridgeCombinedView() };
  }

  function districtBridgeTriggerCensusAction(action){
    const syncSelection = () => {
      mutateState((next) => {
        districtBridgeSyncCensusSelectionCanonicalState(next);
      });
    };
    const runtimeResult = districtBridgeCallCensusRuntime("triggerAction", action);
    if (runtimeResult && typeof runtimeResult === "object"){
      if (runtimeResult.ok === true){
        syncSelection();
        return { ok: true, code: "triggered_runtime", view: districtBridgeCombinedView() };
      }
      return {
        ok: false,
        code: cleanText(runtimeResult.code) || "runtime_unavailable",
        view: districtBridgeCombinedView(),
      };
    }
    return { ok: false, code: "runtime_unavailable", view: districtBridgeCombinedView() };
  }

  return {
    districtBridgeEnsureTargetingState,
    districtBridgeTemplateDimensionsFromState,
    districtBridgeApplyTemplateDefaults,
    districtBridgeSetFormField,
    districtBridgeAddCandidate,
    districtBridgeUpdateCandidate,
    districtBridgeRemoveCandidate,
    districtBridgeSetUserSplit,
    districtBridgeCandidateHistoryRecordPatch,
    districtBridgeAddCandidateHistoryRecord,
    districtBridgeUpdateCandidateHistoryRecord,
    districtBridgeRemoveCandidateHistoryRecord,
    districtBridgeDownloadTextFile,
    districtBridgeSetTargetingField,
    districtBridgeApplyTargetingPreset,
    districtBridgeResetTargetingWeights,
    districtBridgeRunTargeting,
    districtBridgeExportTargetingCsv,
    districtBridgeExportTargetingJson,
    districtBridgeSetCensusField,
    districtBridgeSetCensusGeoSelection,
    districtBridgeSetCensusFile,
    districtBridgeTriggerCensusAction,
  };
}
