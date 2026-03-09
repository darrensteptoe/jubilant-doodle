// @ts-check
import { makeDefaultIntelState, normalizeIntelState } from "../core/intelState.js";
import { makeDefaultCensusState, normalizeCensusState } from "../core/censusModule.js";
import { makeDefaultFeatureFlags, syncFeatureFlagsFromState } from "./featureFlags.js";

export const DEFAULTS_BY_TEMPLATE = {
  federal: { bandWidth: 4, persuasionPct: 28, earlyVoteExp: 45 },
  state_leg: { bandWidth: 4, persuasionPct: 30, earlyVoteExp: 38 },
  municipal: { bandWidth: 5, persuasionPct: 35, earlyVoteExp: 35 },
  county: { bandWidth: 4, persuasionPct: 30, earlyVoteExp: 40 },
};

function defaultCreateId(){
  return Math.random().toString(16).slice(2, 10);
}

/**
 * @typedef {Record<string, any>} AnyState
 * @typedef {{ createId?: (() => string) }} StateFactoryOptions
 */

/**
 * @param {StateFactoryOptions=} options
 * @returns {AnyState}
 */
export function makeDefaultState({ createId = defaultCreateId } = {}){
  return {
    scenarioName: "",
    raceType: "state_leg",
    electionDate: "",
    weeksRemaining: "",
    mode: "persuasion",
    universeBasis: "registered",
    universeSize: "",
    sourceNote: "",
    turnoutA: "",
    turnoutB: "",
    bandWidth: DEFAULTS_BY_TEMPLATE.state_leg.bandWidth,
    candidates: [
      { id: createId(), name: "Candidate A", supportPct: 35 },
      { id: createId(), name: "Candidate B", supportPct: 35 },
    ],
    undecidedPct: 30,
    yourCandidateId: null,
    undecidedMode: "proportional",
    userSplit: {},
    persuasionPct: DEFAULTS_BY_TEMPLATE.state_leg.persuasionPct,
    earlyVoteExp: DEFAULTS_BY_TEMPLATE.state_leg.earlyVoteExp,

    goalSupportIds: "",
    supportRatePct: 55,
    contactRatePct: 22,
    doorsPerHour: 30,
    hoursPerShift: 3,
    shiftsPerVolunteerPerWeek: 2,

    orgCount: 2,
    orgHoursPerWeek: 40,
    volunteerMultBase: 1.0,
    channelDoorPct: 70,
    doorsPerHour3: 30,
    callsPerHour3: 20,
    turnoutReliabilityPct: 80,

    turnoutEnabled: false,
    turnoutBaselinePct: 55,
    turnoutTargetOverridePct: "",
    gotvMode: "basic",
    gotvLiftPP: 1.0,
    gotvMaxLiftPP: 10,
    gotvDiminishing: false,
    gotvLiftMin: 0.5,
    gotvLiftMode: 1.0,
    gotvLiftMax: 2.0,
    gotvMaxLiftPP2: 10,

    timelineEnabled: false,
    timelineActiveWeeks: "",
    timelineGotvWeeks: 2,
    timelineStaffCount: 0,
    timelineStaffHours: 40,
    timelineVolCount: 0,
    timelineVolHours: 4,
    timelineRampEnabled: false,
    timelineRampMode: "linear",
    timelineDoorsPerHour: 30,
    timelineCallsPerHour: 20,
    timelineTextsPerHour: 120,

    mcMode: "basic",
    mcVolatility: "med",
    mcSeed: "",

    budget: {
      overheadAmount: 0,
      includeOverhead: false,
      tactics: {
        doors: { enabled: true, cpa: 0.18, kind: "persuasion" },
        phones: { enabled: true, cpa: 0.03, kind: "persuasion" },
        texts: { enabled: false, cpa: 0.02, kind: "persuasion" },
      },
      optimize: {
        mode: "budget",
        budgetAmount: 10000,
        capacityAttempts: "",
        step: 25,
        useDecay: false,
        objective: "net",
        tlConstrainedEnabled: false,
        tlConstrainedObjective: "max_net",
      },
    },

    mcContactMin: "",
    mcContactMode: "",
    mcContactMax: "",
    mcPersMin: "",
    mcPersMode: "",
    mcPersMax: "",
    mcReliMin: "",
    mcReliMode: "",
    mcReliMax: "",
    mcDphMin: "",
    mcDphMode: "",
    mcDphMax: "",
    mcCphMin: "",
    mcCphMode: "",
    mcCphMax: "",
    mcVolMin: "",
    mcVolMode: "",
    mcVolMax: "",

    mcLast: null,
    mcLastHash: "",
    census: makeDefaultCensusState(),
    intelState: makeDefaultIntelState(),
    features: makeDefaultFeatureFlags(),
    ui: {
      training: false,
      dark: false,
      advDiag: false,
      activeTab: "win",
      decision: { sessions: {}, activeSessionId: null },
      mcMeta: null,
    },
  };
}

/**
 * @param {AnyState} target
 * @param {StateFactoryOptions=} options
 * @returns {AnyState | null}
 */
export function ensureBudgetShape(target, { createId = defaultCreateId } = {}){
  if (!target || typeof target !== "object") return null;
  const baseBudget = makeDefaultState({ createId }).budget;
  const srcBudget = (target.budget && typeof target.budget === "object") ? target.budget : {};
  const srcTactics = (srcBudget.tactics && typeof srcBudget.tactics === "object") ? srcBudget.tactics : {};
  const srcOptimize = (srcBudget.optimize && typeof srcBudget.optimize === "object") ? srcBudget.optimize : {};

  target.budget = {
    ...baseBudget,
    ...srcBudget,
    tactics: {
      ...baseBudget.tactics,
      ...srcTactics,
      doors: { ...baseBudget.tactics.doors, ...(srcTactics.doors || {}) },
      phones: { ...baseBudget.tactics.phones, ...(srcTactics.phones || {}) },
      texts: { ...baseBudget.tactics.texts, ...(srcTactics.texts || {}) },
    },
    optimize: {
      ...baseBudget.optimize,
      ...srcOptimize,
    },
  };
  return target.budget;
}

/**
 * @param {AnyState} s
 * @param {StateFactoryOptions=} options
 * @returns {AnyState}
 */
export function normalizeLoadedState(s, { createId = defaultCreateId } = {}){
  const base = makeDefaultState({ createId });
  const out = { ...base, ...s };
  const src = (s && typeof s === "object") ? s : {};
  out.candidates = Array.isArray(s?.candidates) ? s.candidates : base.candidates;
  out.userSplit = (s?.userSplit && typeof s.userSplit === "object") ? s.userSplit : {};
  out.intelState = normalizeIntelState(s?.intelState);
  out.census = normalizeCensusState(s?.census, { resetRuntime: true });
  out.ui = { ...base.ui, ...(s?.ui || {}) };

  ensureBudgetShape(out, { createId });

  if (!out.yourCandidateId && out.candidates[0]) out.yourCandidateId = out.candidates[0].id;
  if ((out.gotvDiminishing == null) && Object.prototype.hasOwnProperty.call(src, "gotvDiminishing2")){
    out.gotvDiminishing = !!src.gotvDiminishing2;
  }
  delete out.gotvDiminishing2;
  syncFeatureFlagsFromState(out, { preferFeatures: !!(src && typeof src.features === "object" && !Array.isArray(src.features)) });
  out.ui.themeMode = "system";
  out.ui.dark = false;
  return out;
}

/**
 * @param {AnyState} scen
 * @returns {string[]}
 */
export function requiredScenarioKeysMissing(scen){
  const required = [
    "scenarioName", "raceType", "electionDate", "weeksRemaining", "mode",
    "universeBasis", "universeSize", "turnoutA", "turnoutB", "bandWidth",
    "candidates", "undecidedPct", "yourCandidateId", "undecidedMode", "persuasionPct",
    "earlyVoteExp", "supportRatePct", "contactRatePct", "turnoutReliabilityPct",
    "universeLayerEnabled", "universeDemPct", "universeRepPct", "universeNpaPct", "universeOtherPct", "retentionFactor",
    "mcMode", "mcVolatility", "mcSeed", "budget", "timelineEnabled", "census", "ui",
  ];
  const missing = [];
  if (!scen || typeof scen !== "object") return required.slice();
  for (const k of required){
    if (!(k in scen)) missing.push(k);
  }
  return missing;
}

/**
 * @param {AnyState} prevState
 * @param {(next: AnyState) => void} patchFn
 * @returns {AnyState}
 */
export function applyUiStatePatch(prevState, patchFn){
  const next = { ...prevState, ui: structuredClone(prevState.ui) };
  patchFn(next);
  return next;
}

/**
 * @param {AnyState} state
 * @returns {AnyState}
 */
export function cloneStateSnapshot(state){
  try{
    return JSON.parse(JSON.stringify(state));
  } catch {
    return { ...state };
  }
}
