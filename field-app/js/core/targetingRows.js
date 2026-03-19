// @ts-check

import { coerceFiniteNumber, roundWholeNumberByMode } from "./utils.js";

const safeNum = coerceFiniteNumber;

function normalizeRowList(rows){
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row && typeof row === "object");
}

/**
 * Resolve canonical score value from a targeting row.
 * Prefers `targetScore`, then falls back to `score`.
 *
 * @param {unknown} row
 * @returns {number | null}
 */
export function targetRowScoreValue(row){
  const src = row && typeof row === "object" ? row : {};
  const targetScore = safeNum(src?.targetScore);
  if (targetScore != null){
    return targetScore;
  }
  return safeNum(src?.score);
}

/**
 * Resolve canonical rank value from a targeting row.
 *
 * @param {unknown} row
 * @returns {number | null}
 */
export function targetRowRankValue(row){
  const src = row && typeof row === "object" ? row : {};
  return safeNum(src?.rank);
}

/**
 * Deterministically sort targeting rows for top-target selection.
 * Rank wins when both rows have finite rank, otherwise score descending.
 *
 * @param {unknown[]} rows
 * @returns {any[]}
 */
export function sortTargetingRowsByPriority(rows){
  return normalizeRowList(rows).slice().sort((a, b) => {
    const ar = targetRowRankValue(a);
    const br = targetRowRankValue(b);
    if (ar != null && br != null) return ar - br;
    if (ar != null && br == null) return -1;
    if (ar == null && br != null) return 1;
    const as = targetRowScoreValue(a);
    const bs = targetRowScoreValue(b);
    if (as == null && bs == null) return 0;
    if (as == null) return 1;
    if (bs == null) return -1;
    return bs - as;
  });
}

/**
 * Canonical top-target selector from ranking rows.
 *
 * @param {unknown[]} rows
 * @param {unknown} topN
 * @param {{ fallbackTopN?: number }=} options
 * @returns {any[]}
 */
export function selectTopTargetingRows(rows, topN, options = {}){
  const list = sortTargetingRowsByPriority(rows);
  const fallbackTopN = Number.isFinite(Number(options?.fallbackTopN))
    ? Math.max(1, roundWholeNumberByMode(options.fallbackTopN, { mode: "floor", fallback: 25 }) ?? 25)
    : 25;
  const resolvedTopN = safeNum(topN);
  const limit = Math.max(1, roundWholeNumberByMode(resolvedTopN ?? fallbackTopN, { mode: "floor", fallback: fallbackTopN }) ?? fallbackTopN);
  return list.slice(0, limit);
}

/**
 * Count rows marked as top targets.
 *
 * @param {unknown[]} rows
 * @returns {number}
 */
export function countTopTargetRows(rows){
  let topCount = 0;
  for (const row of normalizeRowList(rows)){
    if (!!row?.isTopTarget){
      topCount += 1;
    }
  }
  return topCount;
}

/**
 * Canonical targeting-row summary for archive/reporting layers.
 *
 * @param {unknown[]} rows
 * @param {{ topListLimit?: number }=} options
 * @returns {{
 *   rowCount: number,
 *   topTargetCount: number,
 *   turnoutPriorityCount: number,
 *   persuasionPriorityCount: number,
 *   efficiencyPriorityCount: number,
 *   meanScore: number | null,
 *   topMeanScore: number | null,
 *   expectedNetVoteValueTotal: number | null,
 *   topExpectedNetVoteValueTotal: number | null,
 *   topGeoids: string[],
 *   topLabels: string[],
 * }}
 */
export function summarizeTargetingRows(rows, options = {}){
  const list = normalizeRowList(rows);
  const topListLimit = Number.isFinite(Number(options?.topListLimit))
    ? Math.max(0, roundWholeNumberByMode(options.topListLimit, { mode: "floor", fallback: 20 }) ?? 20)
    : 20;

  let topTargetCount = 0;
  let turnoutPriorityCount = 0;
  let persuasionPriorityCount = 0;
  let efficiencyPriorityCount = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let topScoreSum = 0;
  let topScoreCount = 0;
  let expectedNetVoteValueTotal = 0;
  let expectedNetVoteValueCount = 0;
  let topExpectedNetVoteValueTotal = 0;
  let topExpectedNetVoteValueCount = 0;
  const topGeoids = [];
  const topLabels = [];

  for (const row of list){
    const score = targetRowScoreValue(row);
    if (score != null){
      scoreSum += score;
      scoreCount += 1;
    }
    const expectedNetVoteValue = safeNum(row?.expectedNetVoteValue);
    if (expectedNetVoteValue != null){
      expectedNetVoteValueTotal += expectedNetVoteValue;
      expectedNetVoteValueCount += 1;
    }
    if (!!row?.isTurnoutPriority){
      turnoutPriorityCount += 1;
    }
    if (!!row?.isPersuasionPriority){
      persuasionPriorityCount += 1;
    }
    if (!!row?.isEfficiencyPriority){
      efficiencyPriorityCount += 1;
    }
    if (!!row?.isTopTarget){
      topTargetCount += 1;
      if (score != null){
        topScoreSum += score;
        topScoreCount += 1;
      }
      if (expectedNetVoteValue != null){
        topExpectedNetVoteValueTotal += expectedNetVoteValue;
        topExpectedNetVoteValueCount += 1;
      }
      const geoid = String(row?.geoid || "").trim();
      if (geoid && topGeoids.length < topListLimit){
        topGeoids.push(geoid);
      }
      const label = String(row?.label || "").trim();
      if (label && topLabels.length < topListLimit){
        topLabels.push(label);
      }
    }
  }

  return {
    rowCount: list.length,
    topTargetCount,
    turnoutPriorityCount,
    persuasionPriorityCount,
    efficiencyPriorityCount,
    meanScore: scoreCount > 0 ? (scoreSum / scoreCount) : null,
    topMeanScore: topScoreCount > 0 ? (topScoreSum / topScoreCount) : null,
    expectedNetVoteValueTotal: expectedNetVoteValueCount > 0 ? expectedNetVoteValueTotal : null,
    topExpectedNetVoteValueTotal: topExpectedNetVoteValueCount > 0 ? topExpectedNetVoteValueTotal : null,
    topGeoids,
    topLabels,
  };
}
