// @ts-check
import { makeDefaultIntelState, normalizeIntelState } from "../core/intelState.js";
import {
  makeDefaultCensusState,
  normalizeCensusState,
  makeDefaultRaceFootprint,
  normalizeRaceFootprint,
  makeDefaultAssumptionProvenance,
  normalizeAssumptionProvenance,
  makeDefaultFootprintCapacity,
  normalizeFootprintCapacity,
} from "../core/censusModule.js";
import { makeDefaultVoterDataState, normalizeVoterDataState } from "../core/voterDataLayer.js";
import { makeDefaultFeatureFlags, syncFeatureFlagsFromState } from "./featureFlags.js";
import { makeDefaultTargetingState, normalizeTargetingState } from "./targetingRuntime.js";
import { applyContextToState, resolveActiveContext } from "./activeContext.js";
import { normalizeOptimizationObjective } from "../core/turnout.js";
import {
  applyTemplateDefaultsToState,
  deriveAssumptionsProfileFromState as deriveTemplateAssumptionsProfile,
  syncTemplateMetaFromState,
} from "./templateResolver.js";

function defaultCreateId(){
  return Math.random().toString(16).slice(2, 10);
}

/**
 * @typedef {Record<string, any>} AnyState
 * @typedef {{
 *   createId?: (() => string),
 *   context?: {
 *     campaignId?: string,
 *     campaignName?: string,
 *     officeId?: string,
 *     scenarioId?: string,
 *     search?: string,
 *   },
 * }} StateFactoryOptions
 */

/**
 * @param {StateFactoryOptions=} options
 * @returns {AnyState}
 */
export function makeDefaultState({ createId = defaultCreateId, context: contextInput } = {}){
  const context = resolveActiveContext(contextInput || {});
  const out = {
    campaignId: context.campaignId,
    campaignName: context.campaignName,
    officeId: context.officeId,
    scenarioName: "",
    raceType: "state_leg",
    templateMeta: null,
    electionDate: "",
    weeksRemaining: "",
    mode: "persuasion",
    universeBasis: "registered",
    universeSize: "",
    sourceNote: "",
    turnoutA: "",
    turnoutB: "",
    bandWidth: "",
    candidates: [
      { id: createId(), name: "Candidate A", supportPct: 35 },
      { id: createId(), name: "Candidate B", supportPct: 35 },
    ],
    undecidedPct: 30,
    yourCandidateId: null,
    undecidedMode: "proportional",
    userSplit: {},
    persuasionPct: "",
    earlyVoteExp: "",

    goalSupportIds: "",
    supportRatePct: "",
    contactRatePct: "",
    doorsPerHour: 30,
    hoursPerShift: 3,
    shiftsPerVolunteerPerWeek: 2,

    orgCount: 2,
    orgHoursPerWeek: 40,
    volunteerMultBase: 1.0,
    channelDoorPct: "",
    doorsPerHour3: "",
    callsPerHour3: "",
    turnoutReliabilityPct: "",

    turnoutEnabled: false,
    turnoutBaselinePct: 55,
    turnoutTargetOverridePct: "",
    gotvMode: "basic",
    gotvLiftPP: 1.0,
    gotvMaxLiftPP: "",
    gotvDiminishing: false,
    gotvLiftMin: 0.5,
    gotvLiftMode: 1.0,
    gotvLiftMax: 2.0,
    gotvMaxLiftPP2: 10,

    timelineEnabled: false,
    timelineActiveWeeks: "",
    timelineGotvWeeks: "",
    timelineStaffCount: 0,
    timelineStaffHours: 40,
    timelineVolCount: 0,
    timelineVolHours: 4,
    timelineRampEnabled: false,
    timelineRampMode: "",
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
        litDrop: { enabled: false, cpa: 0.11, kind: "persuasion" },
        mail: { enabled: false, cpa: 0.65, kind: "persuasion" },
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
    voterData: makeDefaultVoterDataState(),
    targeting: makeDefaultTargetingState(),
    raceFootprint: makeDefaultRaceFootprint(),
    assumptionsProvenance: makeDefaultAssumptionProvenance(),
    footprintCapacity: makeDefaultFootprintCapacity(),
    intelState: makeDefaultIntelState(),
    features: makeDefaultFeatureFlags(),
    ui: {
      playbook: false,
      training: false,
      dark: false,
      advDiag: false,
      activeTab: "win",
      assumptionsProfile: "template",
      decision: { sessions: {}, activeSessionId: null },
      mcMeta: null,
      modelAudit: null,
    },
  };
  applyTemplateDefaultsToState(out, { raceType: out.raceType, mode: "all" });
  applyContextToState(out, context);
  return out;
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
      litDrop: { ...baseBudget.tactics.litDrop, ...(srcTactics.litDrop || {}) },
      mail: { ...baseBudget.tactics.mail, ...(srcTactics.mail || {}) },
    },
    optimize: {
      ...baseBudget.optimize,
      ...srcOptimize,
    },
  };
  target.budget.optimize.objective = normalizeOptimizationObjective(target?.budget?.optimize?.objective, "net");
  return target.budget;
}

/**
 * @param {AnyState} s
 * @param {StateFactoryOptions=} options
 * @returns {AnyState}
 */
export function normalizeLoadedState(s, { createId = defaultCreateId, context: contextInput } = {}){
  const base = makeDefaultState({ createId, context: contextInput });
  const out = { ...base, ...s };
  const src = (s && typeof s === "object") ? s : {};
  out.candidates = Array.isArray(s?.candidates) ? s.candidates : base.candidates;
  out.userSplit = (s?.userSplit && typeof s.userSplit === "object") ? s.userSplit : {};
  out.intelState = normalizeIntelState(s?.intelState);
  out.census = normalizeCensusState(s?.census, { resetRuntime: true });
  out.voterData = normalizeVoterDataState(s?.voterData);
  out.targeting = normalizeTargetingState(s?.targeting);
  out.raceFootprint = normalizeRaceFootprint(s?.raceFootprint);
  out.assumptionsProvenance = normalizeAssumptionProvenance(s?.assumptionsProvenance);
  out.footprintCapacity = normalizeFootprintCapacity(s?.footprintCapacity);
  out.templateMeta = s?.templateMeta;
  out.ui = { ...base.ui, ...(s?.ui || {}) };

  ensureBudgetShape(out, { createId });

  if (!out.yourCandidateId && out.candidates[0]) out.yourCandidateId = out.candidates[0].id;
  if ((out.gotvDiminishing == null) && Object.prototype.hasOwnProperty.call(src, "gotvDiminishing2")){
    out.gotvDiminishing = !!src.gotvDiminishing2;
  }
  delete out.gotvDiminishing2;
  syncFeatureFlagsFromState(out, { preferFeatures: !!(src && typeof src.features === "object" && !Array.isArray(src.features)) });
  syncTemplateMetaFromState(out);
  applyContextToState(out, resolveActiveContext({ ...(contextInput || {}), fallback: out }));
  out.ui.assumptionsProfile = deriveTemplateAssumptionsProfile(out);
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
    "campaignId", "campaignName", "officeId",
    "scenarioName", "raceType", "electionDate", "weeksRemaining", "mode",
    "universeBasis", "universeSize", "turnoutA", "turnoutB", "bandWidth",
    "candidates", "undecidedPct", "yourCandidateId", "undecidedMode", "persuasionPct",
    "earlyVoteExp", "supportRatePct", "contactRatePct", "turnoutReliabilityPct",
    "universeLayerEnabled", "universeDemPct", "universeRepPct", "universeNpaPct", "universeOtherPct", "retentionFactor",
    "mcMode", "mcVolatility", "mcSeed", "budget", "timelineEnabled", "census", "voterData", "raceFootprint", "assumptionsProvenance", "footprintCapacity", "ui",
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
