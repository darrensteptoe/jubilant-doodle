// @ts-check

import { asArray, cleanText, toFinite } from "./_core.js";
import { ensureCanonicalState } from "./_core.js";
import {
  createFallbackGuardContext,
  guardRequiredSelectorInputs,
} from "../state/fallbackGuards.js";
import { selectTargetingCanonicalView } from "./targetingCanonical.js";

const targetingDerivedGuard = createFallbackGuardContext({
  moduleName: "selectTargetingDerivedView",
});

function normalizeGeoidToken(value) {
  return cleanText(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function asConfidenceWeight(confidenceBand) {
  const token = cleanText(confidenceBand).toLowerCase();
  if (token === "high") return 1;
  if (token === "medium") return 0.8;
  if (token === "low") return 0.6;
  if (token === "critical") return 0.45;
  return 0.7;
}

export function selectTargetingDerivedView(state, options = {}) {
  const canonical = ensureCanonicalState(state, options);
  guardRequiredSelectorInputs(targetingDerivedGuard, {
    selectorName: "selectTargetingDerivedView",
    input: canonical,
    requiredPaths: [
      "domains.targeting.config",
      "domains.district.form",
      "domains.census.config",
      "domains.electionData.import",
    ],
  });
  const targeting = canonical.domains?.targeting || {};
  const district = canonical.domains?.district || {};
  const census = canonical.domains?.census || {};
  const electionData = canonical.domains?.electionData || {};
  const targetingCanonical = selectTargetingCanonicalView(canonical, options);
  const targetingConfig = targetingCanonical.config || {};
  const upstreamDistrict = targetingCanonical.upstreamInputs?.district || {};
  const upstreamCensus = targetingCanonical.upstreamInputs?.census || {};
  const upstreamElectionData = targetingCanonical.upstreamInputs?.electionData || {};
  const rows = asArray(targeting?.runtime?.rows);
  const topTargetCount = rows.filter((row) => row?.isTopTarget === true).length;
  const scoreValues = rows.map((row) => toFinite(row?.score, null)).filter((n) => n != null);
  const bestScore = scoreValues.length ? Math.max(...scoreValues) : null;
  const averageScore = scoreValues.length
    ? scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length
    : null;
  const turnoutBoostGeoids = asArray(upstreamElectionData.turnoutBoostGeoids);
  const boostTokenSet = new Set(turnoutBoostGeoids.map((token) => normalizeGeoidToken(token)).filter(Boolean));
  const turnoutBoostCoverageCount = rows.filter((row) => {
    const geoid = normalizeGeoidToken(row?.geoid || row?.geographyId || row?.id || "");
    return geoid && boostTokenSet.has(geoid);
  }).length;
  const turnoutBoostCoverageRatio = rows.length
    ? Number((turnoutBoostCoverageCount / rows.length).toFixed(6))
    : null;
  const districtRevision = Number(district.revision || 0);
  const censusRevision = Number(census.revision || 0);
  const electionDataRevision = Number(electionData.revision || 0);
  const targetingRevision = Number(targeting.revision || 0);
  const maxUpstreamRevision = Math.max(districtRevision, censusRevision, electionDataRevision);
  const staleSinceUpstreamChange = maxUpstreamRevision > targetingRevision;
  const upstreamRevisionToken = `${districtRevision}:${censusRevision}:${electionDataRevision}`;
  const selectedGeoidCount = Math.max(0, Math.trunc(toFinite(upstreamCensus.selectedGeoidCount, 0) || 0));
  const loadedRowCount = Math.max(0, Math.trunc(toFinite(upstreamCensus.loadedRowCount, 0) || 0));
  const electionNormalizedRowCount = Math.max(0, Math.trunc(toFinite(upstreamElectionData.normalizedRowCount, 0) || 0));
  const districtInputReady = Boolean(
    cleanText(upstreamDistrict.weeksRemaining)
    || toFinite(upstreamDistrict.turnoutA, null) != null
    || toFinite(upstreamDistrict.turnoutB, null) != null,
  );
  const censusInputReady = selectedGeoidCount > 0 || loadedRowCount > 0;
  const electionInputReady = electionNormalizedRowCount > 0;
  const qualityScore = toFinite(upstreamElectionData.qualityScore, null);
  const confidenceBand = cleanText(upstreamElectionData.confidenceBand) || "unknown";
  const confidenceWeight = asConfidenceWeight(confidenceBand);
  const currentMinScore = toFinite(targetingConfig.minScore, null);
  const qualityAdjustment = qualityScore == null
    ? 0
    : ((qualityScore - 0.5) * 0.06);
  const recommendedMinScore = currentMinScore == null
    ? null
    : Number(Math.max(0, Math.min(1, currentMinScore - qualityAdjustment)).toFixed(6));
  const explanationBits = [];
  if (electionInputReady) {
    explanationBits.push(
      `Election priors: ${electionNormalizedRowCount} normalized row(s), confidence ${confidenceBand.toUpperCase()}`,
    );
  } else {
    explanationBits.push("Election priors unavailable");
  }
  if (censusInputReady) {
    explanationBits.push(`Census scope: ${selectedGeoidCount} selected GEO(s), ${loadedRowCount} loaded row(s)`);
  } else {
    explanationBits.push("Census scope not loaded");
  }
  explanationBits.push(
    staleSinceUpstreamChange
      ? "Upstream inputs changed after last targeting revision"
      : "Targeting revision is aligned with upstream inputs",
  );

  return {
    status: {
      statusText: targeting?.runtime?.statusText || "",
      lastRunAt: targeting?.runtime?.lastRunAt || "",
      rowCount: rows.length,
      topTargetCount,
      staleSinceUpstreamChange,
      upstreamRevisionToken,
    },
    performance: {
      bestScore: bestScore == null ? null : Number(bestScore.toFixed(6)),
      averageScore: averageScore == null ? null : Number(averageScore.toFixed(6)),
      minScoreThreshold: toFinite(targetingConfig.minScore, null),
      modelId: targetingConfig.modelId || "",
      geoLevel: targetingConfig.geoLevel || "",
      recommendedMinScore,
    },
    composition: {
      scoreAboveThresholdCount: rows.filter(
        (row) => toFinite(row?.score, null) != null && toFinite(row?.score, 0) >= toFinite(targetingConfig.minScore, 0),
      ).length,
      withReachEstimateCount: rows.filter((row) => toFinite(row?.reachableVoters, null) != null).length,
      withEfficiencyScoreCount: rows.filter((row) => toFinite(row?.fieldEfficiency, null) != null).length,
    },
    upstream: {
      districtInputReady,
      censusInputReady,
      electionInputReady,
      districtRevision,
      censusRevision,
      electionDataRevision,
      selectedGeoidCount,
      loadedRowCount,
      electionNormalizedRowCount,
      confidenceBand,
      qualityScore,
      confidenceWeight,
    },
    electionInfluence: {
      turnoutBoostGeoidCount: turnoutBoostGeoids.length,
      turnoutBoostCoverageCount,
      turnoutBoostCoverageRatio,
      explanationText: explanationBits.join(" | "),
    },
  };
}
