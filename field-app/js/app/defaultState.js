// @ts-check
import { makeDefaultIntelState } from "../core/intelState.js";
import {
  makeDefaultCensusState,
  makeDefaultRaceFootprint,
  makeDefaultAssumptionProvenance,
} from "../core/censusModule.js";
import { makeDefaultFeatureFlags } from "./featureFlags.js";

/** @param {import("./types").DefaultStateCtx} ctx */
export function makeDefaultStateModule(ctx){
  const { defaultsByTemplate, uid } = ctx || {};
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
    bandWidth: defaultsByTemplate["state_leg"].bandWidth,
    candidates: [
      { id: uid(), name: "Candidate A", supportPct: 35 },
      { id: uid(), name: "Candidate B", supportPct: 35 },
    ],
    undecidedPct: 30,
    yourCandidateId: null,
    undecidedMode: "proportional",
    userSplit: {},
    persuasionPct: defaultsByTemplate["state_leg"].persuasionPct,
    earlyVoteExp: defaultsByTemplate["state_leg"].earlyVoteExp,

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
    raceFootprint: makeDefaultRaceFootprint(),
    assumptionsProvenance: makeDefaultAssumptionProvenance(),
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
    }
  };
}
