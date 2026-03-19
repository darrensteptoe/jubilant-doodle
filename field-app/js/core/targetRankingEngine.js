// @ts-check

import { scoreTargetRow } from "./targetModels.js";
import { buildNormalizedTargetComponents } from "./targetFeatureEngine.js";

export const TARGET_PRIORITY_MODEL_IDS = Object.freeze([
  "turnout_opportunity",
  "persuasion_first",
  "field_efficiency",
]);

/**
 * Canonical row scoring pipeline for targeting rankings.
 * The runtime layer should only handle row selection/filtering and presentation.
 */
export function scoreTargetRows({
  rows,
  modelId,
  state,
  config,
  priorityModelIds = TARGET_PRIORITY_MODEL_IDS,
} = {}){
  const list = Array.isArray(rows) ? rows : [];
  const selectedModelId = String(modelId || "turnout_opportunity").trim() || "turnout_opportunity";
  const normalizedConfig = config && typeof config === "object" ? config : {};
  const normalizedState = state && typeof state === "object" ? state : {};
  const componentsList = buildNormalizedTargetComponents(list);
  const minScore = Number.isFinite(Number(normalizedConfig?.minScore))
    ? Math.max(0, Number(normalizedConfig.minScore))
    : 0;

  return list.map((row, idx) => {
    const components = componentsList[idx] || {
      votePotential: 0,
      turnoutOpportunity: 0,
      persuasionIndex: 0,
      fieldEfficiency: 0,
    };
    const selected = scoreTargetRow({
      modelId: selectedModelId,
      components,
      rawSignals: row?.rawSignals,
      config: { ...normalizedConfig, state: normalizedState },
    });
    const scoreByModel = {};
    for (const currentModelId of priorityModelIds){
      const byModel = scoreTargetRow({
        modelId: currentModelId,
        components,
        rawSignals: row?.rawSignals,
        config: { ...normalizedConfig, state: normalizedState, weights: null },
      });
      scoreByModel[currentModelId] = byModel.score;
    }
    return {
      geoid: String(row?.geoid || "").trim(),
      label: String(row?.label || row?.geoid || "").trim(),
      memberCount: Number.isFinite(Number(row?.memberCount)) ? Number(row.memberCount) : 1,
      sourceGeoids: Array.isArray(row?.sourceGeoids) ? row.sourceGeoids.slice() : [String(row?.geoid || "").trim()],
      score: selected.score,
      baseScore: Number.isFinite(Number(selected?.baseScore)) ? Number(selected.baseScore) : null,
      targetScore: Number.isFinite(Number(selected?.score)) ? Number(selected.score) : null,
      expectedNetVoteValue: Number.isFinite(Number(selected?.expectedNetVoteValue)) ? Number(selected.expectedNetVoteValue) : null,
      upliftExpectedMarginalGain: Number.isFinite(Number(selected?.uplift?.expectedMarginalGain))
        ? Number(selected.uplift.expectedMarginalGain)
        : null,
      upliftBestChannel: String(selected?.uplift?.bestChannel || "").trim(),
      componentScores: selected.componentScores,
      reasons: selected.reasons,
      flags: selected.flags,
      explainDrivers: Array.isArray(selected?.explainDrivers) ? selected.explainDrivers : [],
      targetLabel: String(selected?.targetLabel || "").trim(),
      reasonText: Array.isArray(selected?.reasons) ? selected.reasons.join(" ") : "",
      flagText: Array.isArray(selected?.flags) ? selected.flags.join(" ") : "",
      rawSignals: row?.rawSignals && typeof row.rawSignals === "object" ? row.rawSignals : {},
      scoreByModel,
      modelRanks: {
        turnout_opportunity: null,
        persuasion_first: null,
        field_efficiency: null,
      },
      isTurnoutPriority: false,
      isPersuasionPriority: false,
      isEfficiencyPriority: false,
      votesPerOrganizerHour: Number.isFinite(Number(row?.rawSignals?.votesPerOrganizerHour))
        ? Number(row.rawSignals.votesPerOrganizerHour)
        : null,
    };
  }).filter((row) => Number.isFinite(Number(row?.score)) && Number(row.score) >= minScore);
}
