// @ts-check
import { makeDefaultIntelState } from "../core/intelState.js";
import {
  makeDefaultCensusState,
  makeDefaultRaceFootprint,
  makeDefaultAssumptionProvenance,
  makeDefaultFootprintCapacity,
} from "../core/censusModule.js";
import { makeDefaultFeatureFlags } from "./featureFlags.js";
import { makeDefaultTargetingState } from "./targetingRuntime.js";
import { resolveActiveContext } from "./activeContext.js";
import { applyTemplateDefaultsToState } from "./templateResolver.js";

/** @param {import("./types").DefaultStateCtx} ctx */
export function makeDefaultStateModule(ctx){
  const { uid, activeContext } = ctx || {};
  const context = resolveActiveContext(activeContext || {});
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
      { id: uid(), name: "Candidate A", supportPct: 35 },
      { id: uid(), name: "Candidate B", supportPct: 35 },
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

    crmEnabled: false,
    scheduleEnabled: false,
    twCapOverrideEnabled: false,
    twCapOverrideMode: "baseline",
    twCapOverrideHorizonWeeks: 12,

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
      }
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
    targeting: makeDefaultTargetingState(),
    raceFootprint: makeDefaultRaceFootprint(),
    assumptionsProvenance: makeDefaultAssumptionProvenance(),
    footprintCapacity: makeDefaultFootprintCapacity(),
    intelState: makeDefaultIntelState(),
    features: makeDefaultFeatureFlags(),
    ui: {
      training: false,
      dark: false,
      advDiag: false,
      activeTab: "win",
      assumptionsProfile: "template",
      decision: { sessions: {}, activeSessionId: null },
      mcMeta: null,
      modelAudit: null,
    }
  };

  applyTemplateDefaultsToState(out, { raceType: out.raceType, mode: "all" });
  return out;
}
