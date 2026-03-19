// @ts-check
import {
  resolveCanonicalCallsPerHour,
  resolveCanonicalDoorsPerHour,
  setCanonicalCallsPerHour,
  setCanonicalDoorsPerHour,
} from "../core/throughput.js";
/**
 * @param {Record<string, any>} snap
 * @param {(v: any) => number | null} safeNum
 * @returns {number | null}
 */
export function canonicalDoorsPerHourFromSnapModule(snap, safeNum){
  return resolveCanonicalDoorsPerHour(snap || {}, { toNumber: safeNum });
}

/**
 * @param {Record<string, any>} target
 * @param {any} value
 * @param {(v: any) => number | null} safeNum
 * @returns {void}
 */
export function setCanonicalDoorsPerHourModule(target, value, safeNum){
  setCanonicalDoorsPerHour(target, value, {
    toNumber: safeNum,
    emptyValue: "",
  });
}

/**
 * @param {Record<string, any>} snap
 * @param {(v: any) => number | null} safeNum
 * @returns {number | null}
 */
export function canonicalCallsPerHourFromSnapModule(snap, safeNum){
  return resolveCanonicalCallsPerHour(snap || {}, { toNumber: safeNum });
}

/**
 * @param {Record<string, any>} target
 * @param {any} value
 * @param {(v: any) => number | null} safeNum
 * @returns {void}
 */
export function setCanonicalCallsPerHourModule(target, value, safeNum){
  setCanonicalCallsPerHour(target, value, {
    toNumber: safeNum,
    emptyValue: "",
  });
}

/**
 * @param {Record<string, any>} scen
 * @returns {string[]}
 */
export function requiredScenarioKeysMissingModule(scen){
  const required = [
    "campaignId","campaignName","officeId",
    "scenarioName","raceType","templateMeta","electionDate","weeksRemaining","mode",
    "universeBasis","universeSize","turnoutA","turnoutB","bandWidth",
    "candidates","undecidedPct","yourCandidateId","undecidedMode","persuasionPct",
    "earlyVoteExp","supportRatePct","contactRatePct","turnoutReliabilityPct",
    "universeLayerEnabled","universeDemPct","universeRepPct","universeNpaPct","universeOtherPct","retentionFactor",
    "mcMode","mcVolatility","mcSeed","budget","timelineEnabled","census","raceFootprint","assumptionsProvenance","footprintCapacity","ui"
  ];
  const missing = [];
  if (!scen || typeof scen !== "object") return required.slice();
  for (const k of required){
    if (!(k in scen)) missing.push(k);
  }
  return missing;
}
