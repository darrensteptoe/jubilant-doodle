#!/usr/bin/env node
import { makeDefaultStateModule } from "../js/app/defaultState.js";
import { normalizeLoadedStateModule } from "../js/app/normalizeLoadedState.js";
import { applyTemplateDefaultsToState, deriveAssumptionsProfileFromState } from "../js/app/templateResolver.js";
import {
  canonicalDoorsPerHourFromSnapModule,
  setCanonicalDoorsPerHourModule,
} from "../js/app/stateNormalizationHelpers.js";
import { safeNum, clamp } from "../js/core/utils.js";
import { selectDistrictCanonicalView } from "../js/core/selectors/districtCanonical.js";
import {
  updateDistrictFormField,
  updateDistrictTemplateField,
} from "../js/core/actions/district.js";
import { loadState, makeStateStorageKey, persistStateSnapshot } from "../js/storage.js";

class MemoryStorage {
  #map = new Map();

  get length() {
    return this.#map.size;
  }

  key(index) {
    return Array.from(this.#map.keys())[index] ?? null;
  }

  getItem(key) {
    return this.#map.has(key) ? this.#map.get(key) : null;
  }

  setItem(key, value) {
    this.#map.set(String(key), String(value));
  }

  removeItem(key) {
    this.#map.delete(String(key));
  }
}

function createUidFactory() {
  let seq = 0;
  return () => `trace_${String(++seq).padStart(4, "0")}`;
}

function buildLegacyRuntimeState() {
  const uid = createUidFactory();
  return makeDefaultStateModule({
    uid,
    activeContext: {
      campaignId: "trace-campaign",
      campaignName: "Trace Campaign",
      officeId: "trace-office",
      scenarioId: "baseline",
    },
  });
}

function applyDomainActionFromBridge(state, actionFn, payload, actionName) {
  const outcome = actionFn(state, payload, {
    actionName,
    sourceModule: "trace.district.bridge",
    sourceSurface: "district",
  });
  const canonicalState = outcome?.state && typeof outcome.state === "object"
    ? outcome.state
    : null;
  if (canonicalState?.domains && typeof canonicalState.domains === "object") {
    state.schemaVersion = canonicalState.schemaVersion;
    state.revision = Number.isFinite(Number(canonicalState.revision))
      ? Number(canonicalState.revision)
      : 0;
    state.updatedAt = String(canonicalState.updatedAt || "");
    state.domains = canonicalState.domains;
  }
  return outcome;
}

function projectBridgeCanonical(state) {
  const canonical = selectDistrictCanonicalView(state);
  const templateRaceType = String(canonical?.templateProfile?.raceType || "").trim();
  const formUniverseSize = Number.isFinite(Number(canonical?.form?.universeSize))
    ? Number(canonical.form.universeSize)
    : null;
  return {
    template: {
      raceType: templateRaceType,
    },
    form: {
      raceType: templateRaceType,
      universeSize: formUniverseSize,
    },
  };
}

function normalizeForPersistence(state) {
  const storage = new MemoryStorage();
  const context = {
    campaignId: String(state?.campaignId || "").trim(),
    campaignName: String(state?.campaignName || "").trim(),
    officeId: String(state?.officeId || "").trim(),
    scenarioId: "baseline",
  };
  const write = persistStateSnapshot(state, {
    storageOverride: storage,
    ...context,
  });
  const stateKey = makeStateStorageKey(context);
  const raw = storage.getItem(stateKey);
  const parsed = raw ? JSON.parse(raw) : null;
  const loaded = loadState({
    storageOverride: storage,
    ...context,
  });
  const normalized = normalizeLoadedStateModule(loaded, {
    makeDefaultState: () => {
      const uid = createUidFactory();
      return makeDefaultStateModule({ uid, activeContext: context });
    },
    safeNum,
    clamp,
    canonicalDoorsPerHourFromSnap: (snap) => canonicalDoorsPerHourFromSnapModule(snap, safeNum),
    setCanonicalDoorsPerHour: (target, value) => setCanonicalDoorsPerHourModule(target, value, safeNum),
    deriveAssumptionsProfileFromState,
    activeContext: context,
  });
  return {
    write,
    key: stateKey,
    persisted: parsed,
    loaded,
    normalized,
  };
}

function evaluateTrace(steps, expectedByStep) {
  const annotated = steps.map((step) => {
    const expected = expectedByStep[step.step];
    const ok = step.value === expected;
    return {
      ...step,
      expected,
      ok,
    };
  });
  const firstCorrect = annotated.find((step) => step.ok) || null;
  const firstWrongAfterCorrect = firstCorrect
    ? annotated.find((step) => step.order > firstCorrect.order && step.ok === false) || null
    : annotated.find((step) => step.ok === false) || null;
  return {
    steps: annotated,
    firstCorrect,
    firstWrongAfterCorrect,
  };
}

function traceRaceTemplate() {
  const state = buildLegacyRuntimeState();
  const domValue = "county";

  const bridgeActionInput = {
    field: "raceType",
    rawValue: domValue,
  };

  const normalizedValue = String(domValue == null ? "" : domValue).trim();
  state.raceType = normalizedValue;
  applyTemplateDefaultsToState(state, { raceType: normalizedValue, mode: "untouched" });

  const domainActionPayload = {
    field: "raceType",
    value: normalizedValue,
  };
  applyDomainActionFromBridge(state, updateDistrictTemplateField, domainActionPayload, "trace.district.form.raceType");

  const canonicalAfterAction = selectDistrictCanonicalView(state);
  const persistence = normalizeForPersistence(state);
  const canonicalAfterRehydrate = selectDistrictCanonicalView(persistence.normalized);
  const bridgeCanonicalAfterWrite = projectBridgeCanonical(state);
  const controlResyncValue = String(
    bridgeCanonicalAfterWrite?.template?.raceType
    || bridgeCanonicalAfterWrite?.form?.raceType
    || "",
  );

  const steps = [
    { order: 1, step: "dom_change", value: domValue },
    { order: 2, step: "action_input", value: bridgeActionInput.rawValue },
    { order: 3, step: "canonical_after_action", value: String(canonicalAfterAction?.templateProfile?.raceType || "").trim() },
    {
      order: 4,
      step: "persisted_payload",
      value: String(persistence?.persisted?.domains?.district?.templateProfile?.raceType || "").trim(),
    },
    {
      order: 5,
      step: "rehydrate_normalize_after_write",
      value: String(canonicalAfterRehydrate?.templateProfile?.raceType || "").trim(),
    },
    {
      order: 6,
      step: "bridge_canonical_after_write",
      value: String(bridgeCanonicalAfterWrite?.template?.raceType || "").trim(),
    },
    {
      order: 7,
      step: "control_resync_blur_refresh",
      value: controlResyncValue,
    },
  ];

  const expectedByStep = {
    dom_change: domValue,
    action_input: domValue,
    canonical_after_action: domValue,
    persisted_payload: domValue,
    rehydrate_normalize_after_write: domValue,
    bridge_canonical_after_write: domValue,
    control_resync_blur_refresh: domValue,
  };

  return {
    field: "raceTemplate",
    domId: "v3DistrictV2RaceType",
    bridgeActionInput,
    domainActionPayload,
    canonicalAfterAction: {
      templateRaceType: String(canonicalAfterAction?.templateProfile?.raceType || "").trim(),
      mirrorTopLevelRaceType: String(state?.raceType || "").trim(),
    },
    persistence: {
      result: persistence.write,
      key: persistence.key,
      persistedTemplateRaceType: String(persistence?.persisted?.domains?.district?.templateProfile?.raceType || "").trim(),
      persistedTopLevelRaceType: String(persistence?.persisted?.raceType || "").trim(),
    },
    rehydrate: {
      loadedTopLevelRaceType: String(persistence?.loaded?.raceType || "").trim(),
      normalizedTopLevelRaceType: String(persistence?.normalized?.raceType || "").trim(),
      normalizedTemplateRaceType: String(
        canonicalAfterRehydrate?.templateProfile?.raceType || "",
      ).trim(),
    },
    bridgeCanonicalAfterWrite,
    controlResync: {
      source: "syncSelectOptions(v3DistrictV2RaceType, ...)",
      value: controlResyncValue,
    },
    evaluation: evaluateTrace(steps, expectedByStep),
  };
}

function traceUniverseSize() {
  const state = buildLegacyRuntimeState();
  const domValue = "123456";

  const bridgeActionInput = {
    field: "universeSize",
    rawValue: domValue,
  };

  state.universeSize = safeNum(domValue);

  const domainActionPayload = {
    field: "universeSize",
    value: state.universeSize,
  };
  applyDomainActionFromBridge(state, updateDistrictFormField, domainActionPayload, "trace.district.form.universeSize");

  const canonicalAfterAction = selectDistrictCanonicalView(state);
  const persistence = normalizeForPersistence(state);
  const canonicalAfterRehydrate = selectDistrictCanonicalView(persistence.normalized);
  const bridgeCanonicalAfterWrite = projectBridgeCanonical(state);
  const controlResyncValue = bridgeCanonicalAfterWrite?.form?.universeSize == null
    ? ""
    : String(bridgeCanonicalAfterWrite.form.universeSize);

  const numericExpected = 123456;
  const steps = [
    { order: 1, step: "dom_change", value: domValue },
    { order: 2, step: "action_input", value: bridgeActionInput.rawValue },
    { order: 3, step: "canonical_after_action", value: Number(canonicalAfterAction?.form?.universeSize) },
    {
      order: 4,
      step: "persisted_payload",
      value: Number(persistence?.persisted?.domains?.district?.form?.universeSize),
    },
    {
      order: 5,
      step: "rehydrate_normalize_after_write",
      value: Number(canonicalAfterRehydrate?.form?.universeSize),
    },
    {
      order: 6,
      step: "bridge_canonical_after_write",
      value: Number(bridgeCanonicalAfterWrite?.form?.universeSize),
    },
    {
      order: 7,
      step: "control_resync_blur_refresh",
      value: controlResyncValue,
    },
  ];

  const expectedByStep = {
    dom_change: domValue,
    action_input: domValue,
    canonical_after_action: numericExpected,
    persisted_payload: numericExpected,
    rehydrate_normalize_after_write: numericExpected,
    bridge_canonical_after_write: numericExpected,
    control_resync_blur_refresh: String(numericExpected),
  };

  return {
    field: "universeSize",
    domId: "v3DistrictV2UniverseSize",
    bridgeActionInput,
    domainActionPayload,
    canonicalAfterAction: {
      formUniverseSize: Number(canonicalAfterAction?.form?.universeSize),
      mirrorTopLevelUniverseSize: Number(state?.universeSize),
    },
    persistence: {
      result: persistence.write,
      key: persistence.key,
      persistedFormUniverseSize: Number(persistence?.persisted?.domains?.district?.form?.universeSize),
      persistedTopLevelUniverseSize: Number(persistence?.persisted?.universeSize),
    },
    rehydrate: {
      loadedTopLevelUniverseSize: Number(persistence?.loaded?.universeSize),
      normalizedTopLevelUniverseSize: Number(persistence?.normalized?.universeSize),
      normalizedFormUniverseSize: Number(canonicalAfterRehydrate?.form?.universeSize),
    },
    bridgeCanonicalAfterWrite,
    controlResync: {
      source: "syncInputValueFromRaw(v3DistrictV2UniverseSize, ...)",
      value: controlResyncValue,
    },
    evaluation: evaluateTrace(steps, expectedByStep),
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  traceMode: "store-runtime-simulation",
  raceTemplate: traceRaceTemplate(),
  universeSize: traceUniverseSize(),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
