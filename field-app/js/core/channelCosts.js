// @ts-check

import { clampFiniteNumber, coerceFiniteNumber } from "./utils.js";
import { pctOverrideToDecimal } from "./voteProduction.js";

const EPS = 1e-9;

const safeNum = coerceFiniteNumber;
const clamp = clampFiniteNumber;

export const CHANNEL_COST_REGISTRY = Object.freeze({
  doors: Object.freeze({
    id: "doors",
    label: "Doors",
    defaultCostPerAttempt: 0.18,
    defaultContactRate: 0.22,
    expectedLiftType: "persuasion",
    laborDependency: "field-heavy",
    laborProductivity: Object.freeze({ paid: 1.0, volunteer: 0.82 }),
  }),
  phones: Object.freeze({
    id: "phones",
    label: "Phones",
    defaultCostPerAttempt: 0.03,
    defaultContactRate: 0.16,
    expectedLiftType: "persuasion",
    laborDependency: "mixed",
    laborProductivity: Object.freeze({ paid: 0.95, volunteer: 0.86 }),
  }),
  texts: Object.freeze({
    id: "texts",
    label: "Texts",
    defaultCostPerAttempt: 0.02,
    defaultContactRate: 0.05,
    expectedLiftType: "turnout",
    laborDependency: "low",
    laborProductivity: Object.freeze({ paid: 1.0, volunteer: 1.05 }),
  }),
  litDrop: Object.freeze({
    id: "litDrop",
    label: "Lit Drop",
    defaultCostPerAttempt: 0.11,
    defaultContactRate: 0.10,
    expectedLiftType: "turnout",
    laborDependency: "field-heavy",
    laborProductivity: Object.freeze({ paid: 1.0, volunteer: 0.85 }),
  }),
  mail: Object.freeze({
    id: "mail",
    label: "Mail",
    defaultCostPerAttempt: 0.65,
    defaultContactRate: 0.45,
    expectedLiftType: "persuasion",
    laborDependency: "vendor",
    laborProductivity: Object.freeze({ paid: 1.0, volunteer: 1.0 }),
  }),
});

export const CHANNEL_COST_ORDER = Object.freeze([
  "doors",
  "phones",
  "texts",
  "litDrop",
  "mail",
]);

function workforceShares(workforce){
  const w = workforce && typeof workforce === "object" ? workforce : {};
  const organizer = Math.max(0, Number(w.organizerCount || 0));
  const paidCanvassers = Math.max(0, Number(w.paidCanvasserCount || 0));
  const volunteers = Math.max(0, Number(w.activeVolunteerCount || 0));
  const paid = organizer + paidCanvassers;
  const total = paid + volunteers;
  if (total <= 0){
    return { paidShare: 0.65, volunteerShare: 0.35 };
  }
  return {
    paidShare: clamp(paid / total, 0, 1),
    volunteerShare: clamp(volunteers / total, 0, 1),
  };
}

export function resolveChannelCostAssumption(channelId, { tactic = {}, workforce = null } = {}){
  const key = String(channelId || "").trim();
  const registry = CHANNEL_COST_REGISTRY[key] || CHANNEL_COST_REGISTRY.doors;
  const shares = workforceShares(workforce);
  const laborProductivity = registry.laborProductivity || { paid: 1, volunteer: 1 };
  const laborMultiplier = clamp(
    (shares.paidShare * (safeNum(laborProductivity.paid) ?? 1)) +
    (shares.volunteerShare * (safeNum(laborProductivity.volunteer) ?? 1)),
    0.6,
    1.2,
  );

  const explicitCost = safeNum(tactic?.cpa);
  const defaultCost = safeNum(registry.defaultCostPerAttempt) ?? 0;
  const costPerAttempt = Math.max(0, (explicitCost != null ? explicitCost : defaultCost) / Math.max(EPS, laborMultiplier));
  const contactRate = clamp(
    pctOverrideToDecimal(tactic?.crPct, safeNum(registry.defaultContactRate) ?? 0) ?? 0,
    0,
    1,
  );
  const costPerContact = contactRate > EPS ? (costPerAttempt / contactRate) : null;

  return {
    channelId: registry.id,
    label: registry.label,
    expectedLiftType: String(tactic?.kind || registry.expectedLiftType || "persuasion"),
    laborDependency: registry.laborDependency || "mixed",
    laborMultiplier,
    costPerAttempt,
    contactRate,
    costPerContact,
  };
}

export function computeChannelCostMetrics({
  channelId,
  assumption,
  netVotesPerAttempt,
  turnoutAdjustedNetVotesPerAttempt,
} = {}){
  const resolved = assumption || resolveChannelCostAssumption(channelId);
  const cpa = safeNum(resolved?.costPerAttempt);
  const contactRate = safeNum(resolved?.contactRate);
  const perContact = safeNum(resolved?.costPerContact);
  const baseNet = safeNum(netVotesPerAttempt);
  const turnoutNet = safeNum(turnoutAdjustedNetVotesPerAttempt);
  const baseCostPerVote = (cpa != null && baseNet != null && Math.abs(baseNet) > EPS) ? (cpa / Math.abs(baseNet)) : null;
  const turnoutCostPerVote = (cpa != null && turnoutNet != null && Math.abs(turnoutNet) > EPS) ? (cpa / Math.abs(turnoutNet)) : null;
  return {
    channelId: resolved?.channelId || String(channelId || ""),
    costPerAttempt: cpa,
    contactRate,
    costPerContact: perContact,
    costPerExpectedVote: baseCostPerVote,
    costPerExpectedNetVote: turnoutCostPerVote ?? baseCostPerVote,
  };
}
