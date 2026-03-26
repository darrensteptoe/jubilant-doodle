// @ts-check
import { normalizeCandidateHistoryRecords } from "./candidateHistoryBaseline.js";
import { canonicalizeCandidateHistoryOffice } from "./candidateHistoryBaseline.js";

/**
 * @param {unknown} v
 * @returns {number|null}
 */
function defaultToNum(v){
  if (v == null) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function resolveModelInputOffice(snapshot){
  const s = snapshot && typeof snapshot === "object" ? snapshot : {};
  const templateMeta = s?.templateMeta && typeof s.templateMeta === "object" ? s.templateMeta : {};
  const candidates = [
    templateMeta?.appliedTemplateId,
    templateMeta?.officeLevel,
    s?.officeId,
    s?.campaignName,
    s?.raceType,
  ];
  for (const token of candidates){
    const canonical = canonicalizeCandidateHistoryOffice(token);
    if (canonical){
      return canonical;
    }
  }
  return cleanText(s?.officeId || s?.campaignName || s?.raceType || "");
}

/**
 * @param {Record<string, any>} snapshot
 * @param {(v: unknown) => number|null=} toNumFn
 * @returns {import("./types").ModelInput}
 */
export function buildModelInputFromSnapshot(snapshot, toNumFn){
  const s = snapshot || {};
  const toNum = (typeof toNumFn === "function") ? toNumFn : defaultToNum;
  const candidates = Array.isArray(s.candidates) ? s.candidates : [];
  const candidateHistory = normalizeCandidateHistoryRecords(s.candidateHistory);
  const electionType = String(
    s?.templateMeta?.electionType
    || s?.electionType
    || "",
  ).trim().toLowerCase();

  return {
    office: resolveModelInputOffice(s),
    electionType,
    universeSize: toNum(s.universeSize),
    turnoutA: toNum(s.turnoutA),
    turnoutB: toNum(s.turnoutB),
    bandWidth: toNum(s.bandWidth),
    candidates: candidates.map((c) => ({
      id: c?.id,
      name: c?.name,
      supportPct: toNum(c?.supportPct),
    })),
    undecidedPct: toNum(s.undecidedPct),
    yourCandidateId: s.yourCandidateId,
    undecidedMode: s.undecidedMode,
    userSplit: s.userSplit,
    candidateHistory,
    persuasionPct: toNum(s.persuasionPct),
    earlyVoteExp: toNum(s.earlyVoteExp),
  };
}
