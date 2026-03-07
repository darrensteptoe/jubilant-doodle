// @ts-check
// District data source registry helpers (pure, no DOM, no network).
// Purpose: normalize catalog records and resolve latest/verified selections deterministically.

import { normalizeDataCatalog, normalizeDataRefs } from "./districtData.js";

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
function isObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function str(v){
  return String(v == null ? "" : v).trim();
}

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function strOrNull(v){
  const s = str(v);
  return s ? s : null;
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function numOrNull(v){
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} v
 * @returns {number}
 */
function boolRank(v){
  return v ? 1 : 0;
}

/**
 * @param {unknown} v
 * @returns {number}
 */
function dateRank(v){
  const s = str(v);
  if (!s) return -1;
  const ms = new Date(s).getTime();
  return Number.isFinite(ms) ? ms : -1;
}

/**
 * @param {unknown} v
 * @returns {number}
 */
function vintageRank(v){
  const s = str(v);
  if (!s) return -1;
  const n = Number(s);
  if (Number.isFinite(n)) return n;
  const m = s.match(/\d{4}/);
  if (!m) return -1;
  const y = Number(m[0]);
  return Number.isFinite(y) ? y : -1;
}

/**
 * @param {number} n
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(n, min, max){
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function toYearOrNull(v){
  const n = numOrNull(v);
  if (n != null){
    const y = Math.trunc(n);
    if (y >= 1900 && y <= 2100) return y;
  }
  const s = str(v);
  if (!s) return null;
  const m = s.match(/\b(19|20)\d{2}\b/);
  if (!m) return null;
  const y = Number(m[0]);
  return Number.isFinite(y) ? y : null;
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function normalizeRaceType(v){
  const raw = str(v).toLowerCase().replace(/[\s/-]+/g, "_");
  if (!raw) return "";
  if (raw === "state_leg" || raw === "state_legislative") return "state_leg";
  if (raw.includes("federal") || raw.includes("us_house") || raw.includes("congress")) return "federal";
  if (raw.includes("state_house") || raw.includes("state_senate") || raw.includes("sldl") || raw.includes("sldu")) return "state_leg";
  if (raw.includes("county")) return "county";
  if (raw.includes("municipal") || raw.includes("local") || raw.includes("place") || raw.includes("city") || raw.includes("ward")) return "municipal";
  return raw;
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function normalizeOfficeType(v){
  const raw = str(v).toLowerCase().replace(/[\s/-]+/g, "_");
  if (!raw) return "";
  if (raw.includes("us_house") || raw.includes("congress") || raw === "cd") return "us_house";
  if (raw.includes("state_senate") || raw.includes("sldu")) return "state_senate";
  if (raw.includes("state_house") || raw.includes("state_assembly") || raw.includes("sldl")) return "state_house";
  if (raw.includes("county")) return "county";
  if (raw.includes("municipal") || raw.includes("city") || raw.includes("ward") || raw.includes("place")) return "municipal";
  return raw;
}

/**
 * @param {string} officeType
 * @returns {string}
 */
function officeFamily(officeType){
  const x = normalizeOfficeType(officeType);
  if (!x) return "";
  if (x === "state_senate" || x === "state_house") return "state_leg";
  return x;
}

/**
 * @param {unknown} scenario
 * @returns {string}
 */
function deriveTargetRaceType(scenario){
  if (!isObject(scenario)) return "";
  return normalizeRaceType(scenario.raceType);
}

/**
 * @param {unknown} scenario
 * @returns {string}
 */
function deriveTargetOfficeType(scenario){
  if (!isObject(scenario)) return "";
  const areaType = str(scenario?.geoPack?.area?.type).toUpperCase();
  if (areaType === "CD") return "us_house";
  if (areaType === "SLDU") return "state_senate";
  if (areaType === "SLDL") return "state_house";
  if (areaType === "COUNTY") return "county";
  if (areaType === "PLACE") return "municipal";
  const fromExplicit = normalizeOfficeType(scenario.officeType);
  if (fromExplicit) return fromExplicit;
  const raceType = deriveTargetRaceType(scenario);
  if (raceType === "federal") return "us_house";
  if (raceType === "state_leg") return "state_house";
  if (raceType === "county") return "county";
  if (raceType === "municipal") return "municipal";
  return "";
}

/**
 * @param {unknown} scenario
 * @returns {number | null}
 */
function deriveTargetElectionYear(scenario){
  if (!isObject(scenario)) return null;
  return toYearOrNull(scenario.electionDate);
}

/**
 * @param {{
 *   filters?: unknown,
 *   scenario?: unknown
 * }} args
 * @returns {{
 *   strictOfficeMatch: boolean,
 *   strictRaceMatch: boolean,
 *   requireBoundaryMatch: boolean,
 *   maxYearDelta: number | null,
 *   minCoveragePct: number | null
 * }}
 */
function normalizeElectionCompatibilityFilters(args){
  const explicit = isObject(args?.filters) ? args.filters : {};
  const scenario = isObject(args?.scenario) ? args.scenario : {};
  const refs = isObject(scenario?.dataRefs) ? scenario.dataRefs : {};
  const strictSimilarity = explicit.strictSimilarity != null
    ? !!explicit.strictSimilarity
    : !!refs.electionStrictSimilarity;

  const maxYearRaw = numOrNull(explicit.maxYearDelta);
  const maxYearFromRefs = numOrNull(refs.electionMaxYearDelta);
  const maxYearDelta = maxYearRaw != null
    ? clamp(Math.round(maxYearRaw), 0, 30)
    : maxYearFromRefs != null
      ? clamp(Math.round(maxYearFromRefs), 0, 30)
      : null;

  const minCovRaw = numOrNull(explicit.minCoveragePct);
  const minCovFromRefs = numOrNull(refs.electionMinCoveragePct);
  const minCoveragePct = minCovRaw != null
    ? clamp(minCovRaw, 0, 100)
    : minCovFromRefs != null
      ? clamp(minCovFromRefs, 0, 100)
      : null;

  return {
    strictOfficeMatch: explicit.strictOfficeMatch != null ? !!explicit.strictOfficeMatch : strictSimilarity,
    strictRaceMatch: explicit.strictRaceMatch != null ? !!explicit.strictRaceMatch : strictSimilarity,
    requireBoundaryMatch: explicit.requireBoundaryMatch != null ? !!explicit.requireBoundaryMatch : false,
    maxYearDelta,
    minCoveragePct,
  };
}

/**
 * @param {Array<Record<string, any>>} rows
 * @param {(row: Record<string, any>) => string} groupKeyFn
 * @returns {Array<Record<string, any>>}
 */
function materializeLatestFlags(rows, groupKeyFn){
  const next = rows.map((r) => ({ ...r, isLatest: !!r.isLatest }));
  const byGroup = new Map();
  for (const row of next){
    const k = groupKeyFn(row);
    const bucket = byGroup.get(k) || [];
    bucket.push(row);
    byGroup.set(k, bucket);
  }
  for (const bucket of byGroup.values()){
    if (bucket.some((r) => !!r.isLatest)) continue;
    let winner = null;
    for (const row of bucket){
      if (!winner){
        winner = row;
        continue;
      }
      const scoreA = [
        boolRank(row.isVerified),
        dateRank(row.refreshedAt),
        vintageRank(row.vintage),
        str(row.id),
      ];
      const scoreB = [
        boolRank(winner.isVerified),
        dateRank(winner.refreshedAt),
        vintageRank(winner.vintage),
        str(winner.id),
      ];
      if (scoreA[0] > scoreB[0]) { winner = row; continue; }
      if (scoreA[0] < scoreB[0]) { continue; }
      if (scoreA[1] > scoreB[1]) { winner = row; continue; }
      if (scoreA[1] < scoreB[1]) { continue; }
      if (scoreA[2] > scoreB[2]) { winner = row; continue; }
      if (scoreA[2] < scoreB[2]) { continue; }
      if (scoreA[3] > scoreB[3]) { winner = row; }
    }
    if (winner) winner.isLatest = true;
  }
  return next;
}

/**
 * @param {Array<Record<string, any>>} rows
 * @returns {Record<string, Record<string, any>>}
 */
function toIdMap(rows){
  const out = Object.create(null);
  for (const row of rows){
    const id = str(row?.id);
    if (!id) continue;
    out[id] = row;
  }
  return out;
}

/**
 * @param {Array<Record<string, any>>} rows
 * @param {(row: Record<string, any>) => boolean=} predicate
 * @returns {Record<string, any> | null}
 */
function pickLatestVerified(rows, predicate){
  const filtered = rows.filter((r) => (!!r.isVerified) && (!predicate || predicate(r)));
  if (!filtered.length) return null;
  const latest = filtered.find((r) => !!r.isLatest);
  if (latest) return latest;
  const sorted = filtered.slice().sort((a, b) => {
    const da = dateRank(a.refreshedAt);
    const db = dateRank(b.refreshedAt);
    if (db !== da) return db - da;
    const va = vintageRank(a.vintage);
    const vb = vintageRank(b.vintage);
    if (vb !== va) return vb - va;
    return str(b.id).localeCompare(str(a.id));
  });
  return sorted[0] || null;
}

/**
 * Score a single election dataset against scenario context.
 * Higher score means better "similar-race" compatibility for planning evidence selection.
 *
 * @param {{
 *   dataset: unknown,
 *   scenario?: unknown,
 *   boundarySetId?: unknown,
 *   requireVerified?: boolean
 *   filters?: unknown
 * }} args
 * @returns {{
 *   eligible: boolean,
 *   score: number,
 *   scoreBreakdown: Record<string, number>,
 *   reasons: string[],
 *   datasetId: string,
 *   target: {
 *     raceType: string,
 *     officeType: string,
 *     electionYear: number | null,
 *     boundarySetId: string
 *   }
 * }}
 */
export function scoreElectionDatasetCompatibility(args){
  const row = isObject(args?.dataset) ? args.dataset : {};
  const scenario = isObject(args?.scenario) ? args.scenario : {};
  const datasetId = str(row.id);
  const datasetBoundary = str(row.boundarySetId);
  const datasetOffice = normalizeOfficeType(row.officeType);
  const datasetRace = normalizeRaceType(row.raceType);
  const datasetYear = toYearOrNull(row.cycleYear) ?? toYearOrNull(row.electionDate) ?? toYearOrNull(row.vintage);
  const coveragePct = clamp(numOrNull(row.coveragePct) ?? 0, 0, 100);
  const requireVerified = args?.requireVerified !== false;
  const targetBoundary = str(args?.boundarySetId || scenario?.dataRefs?.boundarySetId || scenario?.geoPack?.boundarySetId);
  const targetOffice = deriveTargetOfficeType(scenario);
  const targetRace = deriveTargetRaceType(scenario);
  const targetYear = deriveTargetElectionYear(scenario);
  const filters = normalizeElectionCompatibilityFilters({
    filters: args?.filters,
    scenario,
  });
  const reasons = [];

  if (requireVerified && !row.isVerified){
    return {
      eligible: false,
      score: -1,
      scoreBreakdown: {},
      reasons: ["dataset_not_verified"],
      datasetId,
      target: {
        raceType: targetRace,
        officeType: targetOffice,
        electionYear: targetYear,
        boundarySetId: targetBoundary,
      },
    };
  }

  if (filters.minCoveragePct != null && coveragePct < filters.minCoveragePct){
    return {
      eligible: false,
      score: -1,
      scoreBreakdown: {},
      reasons: ["coverage_below_filter"],
      datasetId,
      target: {
        raceType: targetRace,
        officeType: targetOffice,
        electionYear: targetYear,
        boundarySetId: targetBoundary,
      },
    };
  }

  if (filters.requireBoundaryMatch && targetBoundary && datasetBoundary && targetBoundary !== datasetBoundary){
    return {
      eligible: false,
      score: -1,
      scoreBreakdown: {},
      reasons: ["boundary_filter_mismatch"],
      datasetId,
      target: {
        raceType: targetRace,
        officeType: targetOffice,
        electionYear: targetYear,
        boundarySetId: targetBoundary,
      },
    };
  }

  if (filters.strictOfficeMatch && targetOffice && datasetOffice && targetOffice !== datasetOffice){
    return {
      eligible: false,
      score: -1,
      scoreBreakdown: {},
      reasons: ["office_filter_mismatch"],
      datasetId,
      target: {
        raceType: targetRace,
        officeType: targetOffice,
        electionYear: targetYear,
        boundarySetId: targetBoundary,
      },
    };
  }

  if (filters.strictRaceMatch && targetRace && datasetRace && targetRace !== datasetRace){
    return {
      eligible: false,
      score: -1,
      scoreBreakdown: {},
      reasons: ["race_filter_mismatch"],
      datasetId,
      target: {
        raceType: targetRace,
        officeType: targetOffice,
        electionYear: targetYear,
        boundarySetId: targetBoundary,
      },
    };
  }

  if (filters.maxYearDelta != null && targetYear != null && datasetYear != null){
    const diff = Math.abs(targetYear - datasetYear);
    if (diff > filters.maxYearDelta){
      return {
        eligible: false,
        score: -1,
        scoreBreakdown: {},
        reasons: ["year_filter_out_of_range"],
        datasetId,
        target: {
          raceType: targetRace,
          officeType: targetOffice,
          electionYear: targetYear,
          boundarySetId: targetBoundary,
        },
      };
    }
  }

  const scoreBreakdown = {
    boundary: 0,
    office: 0,
    race: 0,
    year: 0,
    coverage: 0,
    latest: 0,
  };

  if (targetBoundary && datasetBoundary){
    if (targetBoundary === datasetBoundary){
      scoreBreakdown.boundary = 40;
      reasons.push("boundary_match");
    } else {
      scoreBreakdown.boundary = -15;
      reasons.push("boundary_mismatch");
    }
  } else if (!targetBoundary){
    scoreBreakdown.boundary = 5;
    reasons.push("boundary_unspecified");
  }

  if (targetOffice && datasetOffice){
    if (targetOffice === datasetOffice){
      scoreBreakdown.office = 30;
      reasons.push("office_exact_match");
    } else if (officeFamily(targetOffice) && officeFamily(targetOffice) === officeFamily(datasetOffice)){
      scoreBreakdown.office = 16;
      reasons.push("office_family_match");
    } else {
      scoreBreakdown.office = -8;
      reasons.push("office_mismatch");
    }
  } else if (!datasetOffice){
    reasons.push("office_missing");
  }

  if (targetRace && datasetRace){
    if (targetRace === datasetRace){
      scoreBreakdown.race = 14;
      reasons.push("race_match");
    } else {
      scoreBreakdown.race = -5;
      reasons.push("race_mismatch");
    }
  } else if (!datasetRace){
    reasons.push("race_missing");
  }

  if (targetYear != null && datasetYear != null){
    const diff = Math.abs(targetYear - datasetYear);
    scoreBreakdown.year = Math.max(0, 18 - (diff * 3));
    if (diff <= 2) reasons.push("year_close");
  } else if (datasetYear != null){
    scoreBreakdown.year = 4;
    reasons.push("year_present");
  }

  scoreBreakdown.coverage = coveragePct / 25; // up to +4 points.
  if (row.isLatest) scoreBreakdown.latest = 2;

  const score = Object.values(scoreBreakdown).reduce((sum, v) => sum + (Number(v) || 0), 0);
  return {
    eligible: true,
    score,
    scoreBreakdown,
    reasons,
    datasetId,
    target: {
      raceType: targetRace,
      officeType: targetOffice,
      electionYear: targetYear,
      boundarySetId: targetBoundary,
    },
  };
}

/**
 * Deterministically rank election datasets by scenario compatibility.
 *
 * @param {{
 *   dataCatalog?: unknown,
 *   registry?: ReturnType<typeof buildDataSourceRegistry>,
 *   scenario?: unknown,
 *   boundarySetId?: unknown,
 *   requireVerified?: boolean
 *   filters?: unknown
 * }} args
 * @returns {Array<{
 *   dataset: Record<string, any>,
 *   score: number,
 *   scoreBreakdown: Record<string, number>,
 *   reasons: string[]
 * }>}
 */
export function rankElectionDatasetsForScenario(args){
  const registry = args?.registry && typeof args.registry === "object"
    ? args.registry
    : buildDataSourceRegistry(args?.dataCatalog);
  const rows = Array.isArray(registry?.electionDatasets) ? registry.electionDatasets : [];
  const ranked = [];
  for (const dataset of rows){
    const score = scoreElectionDatasetCompatibility({
      dataset,
      scenario: args?.scenario,
      boundarySetId: args?.boundarySetId,
      requireVerified: args?.requireVerified,
      filters: args?.filters,
    });
    if (!score.eligible) continue;
    ranked.push({
      dataset,
      score: score.score,
      scoreBreakdown: score.scoreBreakdown,
      reasons: score.reasons,
    });
  }
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const latestDelta = boolRank(b.dataset?.isLatest) - boolRank(a.dataset?.isLatest);
    if (latestDelta !== 0) return latestDelta;
    const dateDelta = dateRank(b.dataset?.refreshedAt) - dateRank(a.dataset?.refreshedAt);
    if (dateDelta !== 0) return dateDelta;
    const vintageDelta = vintageRank(b.dataset?.vintage) - vintageRank(a.dataset?.vintage);
    if (vintageDelta !== 0) return vintageDelta;
    return str(a.dataset?.id).localeCompare(str(b.dataset?.id));
  });
  return ranked;
}

/**
 * @param {unknown} dataCatalog
 * @returns {{
 *   version: string,
 *   generatedAt: string,
 *   boundarySets: Array<{
 *     id: string,
 *     label: string,
 *     geographyType: string,
 *     source: string | null,
 *     vintage: string | null,
 *     refreshedAt: string | null,
 *     hash: string | null,
 *     isVerified: boolean,
 *     isLatest: boolean
 *   }>,
 *   crosswalks: Array<{
 *     id: string,
 *     fromBoundarySetId: string,
 *     toBoundarySetId: string,
 *     unit: string,
 *     method: string,
 *     source: string | null,
 *     vintage: string | null,
 *     refreshedAt: string | null,
 *     hash: string | null,
 *     coveragePct: number | null,
 *     unmatchedPct: number | null,
 *     weightDriftPct: number | null,
 *     isVerified: boolean,
 *     isLatest: boolean
 *   }>,
 *   censusDatasets: Array<{
 *     id: string,
 *     label: string,
 *     source: string | null,
 *     vintage: string | null,
 *     boundarySetId: string | null,
 *     granularity: string,
 *     refreshedAt: string | null,
 *     hash: string | null,
 *     coveragePct: number | null,
 *     isVerified: boolean,
 *     isLatest: boolean
 *   }>,
 *   electionDatasets: Array<{
 *     id: string,
 *     label: string,
 *     source: string | null,
 *     vintage: string | null,
 *     electionDate: string | null,
 *     officeType: string | null,
 *     raceType: string | null,
 *     cycleYear: number | null,
 *     boundarySetId: string | null,
 *     granularity: string,
 *     refreshedAt: string | null,
 *     hash: string | null,
 *     coveragePct: number | null,
 *     isVerified: boolean,
 *     isLatest: boolean
 *   }>,
 *   byId: {
 *     boundarySets: Record<string, Record<string, any>>,
 *     crosswalks: Record<string, Record<string, any>>,
 *     censusDatasets: Record<string, Record<string, any>>,
 *     electionDatasets: Record<string, Record<string, any>>
 *   }
 * }}
 */
export function buildDataSourceRegistry(dataCatalog){
  const catalog = normalizeDataCatalog(dataCatalog);
  const boundarySets = materializeLatestFlags(
    catalog.boundarySets.map((r) => ({
      id: str(r.id),
      label: str(r.label),
      geographyType: str(r.geographyType),
      source: strOrNull(r.source),
      vintage: strOrNull(r.vintage),
      refreshedAt: strOrNull(r.refreshedAt),
      hash: strOrNull(r.hash),
      isVerified: r.isVerified == null ? true : !!r.isVerified,
      isLatest: !!r.isLatest,
    })),
    (r) => `b:${str(r.geographyType)}`
  );

  const crosswalks = materializeLatestFlags(
    catalog.crosswalks.map((r) => ({
      id: str(r.id),
      fromBoundarySetId: str(r.fromBoundarySetId),
      toBoundarySetId: str(r.toBoundarySetId),
      unit: str(r.unit),
      method: str(r.method),
      source: strOrNull(r.source),
      vintage: strOrNull(r.vintage),
      refreshedAt: strOrNull(r.refreshedAt),
      hash: strOrNull(r.hash),
      coveragePct: numOrNull(r.quality?.coveragePct),
      unmatchedPct: numOrNull(r.quality?.unmatchedPct),
      weightDriftPct: numOrNull(r.quality?.weightDriftPct),
      isVerified: !!r.quality?.isVerified,
      isLatest: !!r.isLatest,
    })),
    (r) => `x:${str(r.fromBoundarySetId)}>${str(r.toBoundarySetId)}:${str(r.unit)}:${str(r.method)}`
  );

  const censusDatasets = materializeLatestFlags(
    catalog.censusDatasets.map((r) => ({
      id: str(r.id),
      label: str(r.label),
      source: strOrNull(r.source),
      vintage: strOrNull(r.vintage),
      boundarySetId: strOrNull(r.boundarySetId),
      granularity: str(r.granularity),
      refreshedAt: strOrNull(r.refreshedAt),
      hash: strOrNull(r.hash),
      coveragePct: numOrNull(r.quality?.coveragePct),
      isVerified: !!r.quality?.isVerified,
      isLatest: !!r.isLatest,
    })),
    (r) => `c:${str(r.boundarySetId)}:${str(r.granularity)}`
  );

  const electionDatasets = materializeLatestFlags(
    catalog.electionDatasets.map((r) => ({
      id: str(r.id),
      label: str(r.label),
      source: strOrNull(r.source),
      vintage: strOrNull(r.vintage),
      electionDate: strOrNull(r.electionDate),
      officeType: strOrNull(r.officeType),
      raceType: strOrNull(r.raceType),
      cycleYear: toYearOrNull(r.cycleYear) ?? toYearOrNull(r.electionDate) ?? toYearOrNull(r.vintage),
      boundarySetId: strOrNull(r.boundarySetId),
      granularity: str(r.granularity),
      refreshedAt: strOrNull(r.refreshedAt),
      hash: strOrNull(r.hash),
      coveragePct: numOrNull(r.quality?.coveragePct),
      isVerified: !!r.quality?.isVerified,
      isLatest: !!r.isLatest,
    })),
    (r) => `e:${str(r.boundarySetId)}:${str(r.granularity)}`
  );

  return {
    version: str(catalog.version) || "0.1.0",
    generatedAt: new Date().toISOString(),
    boundarySets,
    crosswalks,
    censusDatasets,
    electionDatasets,
    byId: {
      boundarySets: toIdMap(boundarySets),
      crosswalks: toIdMap(crosswalks),
      censusDatasets: toIdMap(censusDatasets),
      electionDatasets: toIdMap(electionDatasets),
    }
  };
}

/**
 * @param {{
 *   dataRefs: unknown,
 *   dataCatalog: unknown,
 *   scenario?: unknown
 * }} args
 * @returns {{
 *   mode: "pinned_verified" | "latest_verified" | "manual",
 *   selected: {
 *     boundarySetId: string | null,
 *     crosswalkVersionId: string | null,
 *     censusDatasetId: string | null,
 *     electionDatasetId: string | null
 *   },
 *   usedFallbacks: boolean,
 *   notes: string[]
 * }}
 */
export function resolveDataRefsByPolicy(args){
  const refs = normalizeDataRefs(args?.dataRefs);
  const registry = buildDataSourceRegistry(args?.dataCatalog);
  const notes = [];
  let usedFallbacks = false;
  const selected = {
    boundarySetId: refs.boundarySetId,
    crosswalkVersionId: refs.crosswalkVersionId,
    censusDatasetId: refs.censusDatasetId,
    electionDatasetId: refs.electionDatasetId,
  };

  const byId = registry.byId;
  const missingNotes = [];
  /**
   * @param {"boundarySetId"|"crosswalkVersionId"|"censusDatasetId"|"electionDatasetId"} key
   * @param {Record<string, Record<string, any>>} map
   * @returns {boolean}
   */
  const isMissing = (key, map) => {
    const id = selected[key];
    if (!id) return false;
    if (map[id]) return false;
    missingNotes.push(`${key} '${id}' missing from registry.`);
    return true;
  };
  const missingBoundary = isMissing("boundarySetId", byId.boundarySets);
  const missingCrosswalk = isMissing("crosswalkVersionId", byId.crosswalks);
  const missingCensus = isMissing("censusDatasetId", byId.censusDatasets);
  const missingElection = isMissing("electionDatasetId", byId.electionDatasets);

  if (refs.mode === "manual" || refs.mode === "pinned_verified"){
    if (missingNotes.length) notes.push(...missingNotes);
    return { mode: refs.mode, selected, usedFallbacks, notes };
  }

  /**
   * @param {"boundarySetId"|"crosswalkVersionId"|"censusDatasetId"|"electionDatasetId"} key
   * @param {boolean} missing
   */
  const clearIfMissing = (key, missing) => {
    if (!missing) return;
    const id = selected[key];
    selected[key] = null;
    usedFallbacks = true;
    notes.push(`${key} '${id}' missing; resolved via latest_verified fallback.`);
  };
  clearIfMissing("boundarySetId", missingBoundary);
  clearIfMissing("crosswalkVersionId", missingCrosswalk);
  clearIfMissing("censusDatasetId", missingCensus);
  clearIfMissing("electionDatasetId", missingElection);

  // latest_verified: keep valid verified pins; otherwise fallback to latest verified.
  if (!selected.boundarySetId || !byId.boundarySets[selected.boundarySetId]?.isVerified){
    const nextBoundary = pickLatestVerified(registry.boundarySets);
    if (nextBoundary){
      if (selected.boundarySetId !== nextBoundary.id){
        notes.push(`boundarySetId resolved to latest verified '${nextBoundary.id}'.`);
        usedFallbacks = true;
      }
      selected.boundarySetId = nextBoundary.id;
    } else {
      selected.boundarySetId = null;
    }
  }

  const boundaryId = selected.boundarySetId;
  const boundaryFilter = boundaryId
    ? /** @param {Record<string, any>} row */ (row) => str(row.boundarySetId) === str(boundaryId)
    : undefined;
  const crosswalkFilter = boundaryId
    ? /** @param {Record<string, any>} row */ (row) => str(row.fromBoundarySetId) === str(boundaryId) || str(row.toBoundarySetId) === str(boundaryId)
    : undefined;

  if (!selected.censusDatasetId || !byId.censusDatasets[selected.censusDatasetId]?.isVerified){
    const picked = pickLatestVerified(registry.censusDatasets, boundaryFilter) || pickLatestVerified(registry.censusDatasets);
    if (picked){
      if (selected.censusDatasetId !== picked.id){
        notes.push(`censusDatasetId resolved to latest verified '${picked.id}'.`);
        usedFallbacks = true;
      }
      selected.censusDatasetId = picked.id;
    } else {
      selected.censusDatasetId = null;
    }
  }

  if (!selected.electionDatasetId || !byId.electionDatasets[selected.electionDatasetId]?.isVerified){
    const ranked = rankElectionDatasetsForScenario({
      registry,
      scenario: args?.scenario,
      boundarySetId: boundaryId,
      requireVerified: true,
      filters: {
        strictSimilarity: !!refs.electionStrictSimilarity,
        maxYearDelta: refs.electionMaxYearDelta,
        minCoveragePct: refs.electionMinCoveragePct,
      },
    });
    const picked = ranked[0]?.dataset || pickLatestVerified(registry.electionDatasets, boundaryFilter) || pickLatestVerified(registry.electionDatasets);
    if (picked){
      if (selected.electionDatasetId !== picked.id){
        const scoreNote = Number.isFinite(ranked[0]?.score)
          ? ` (compatibility score ${Number(ranked[0].score).toFixed(2)})`
          : "";
        notes.push(`electionDatasetId resolved to latest verified '${picked.id}'${scoreNote}.`);
        usedFallbacks = true;
      }
      selected.electionDatasetId = picked.id;
    } else {
      selected.electionDatasetId = null;
    }
  }

  if (!selected.crosswalkVersionId || !byId.crosswalks[selected.crosswalkVersionId]?.isVerified){
    const picked = pickLatestVerified(registry.crosswalks, crosswalkFilter) || pickLatestVerified(registry.crosswalks);
    if (picked){
      if (selected.crosswalkVersionId !== picked.id){
        notes.push(`crosswalkVersionId resolved to latest verified '${picked.id}'.`);
        usedFallbacks = true;
      }
      selected.crosswalkVersionId = picked.id;
    } else {
      selected.crosswalkVersionId = null;
    }
  }

  return { mode: refs.mode, selected, usedFallbacks, notes };
}

/**
 * Materialize a pinned dataRef set from policy resolution.
 * - If mode is `latest_verified`, this returns a `pinned_verified` object using resolved IDs.
 * - If mode is already `pinned_verified` or `manual`, IDs are preserved and mode is unchanged.
 *
 * @param {{
 *   dataRefs: unknown,
 *   dataCatalog: unknown,
 *   scenario?: unknown,
 *   nowIso?: string
 * }} args
 * @returns {{
 *   dataRefs: {
 *     version: string,
 *     mode: "pinned_verified" | "latest_verified" | "manual",
 *     censusDatasetId: string | null,
 *     electionDatasetId: string | null,
 *     boundarySetId: string | null,
 *     crosswalkVersionId: string | null,
 *     electionStrictSimilarity: boolean,
 *     electionMaxYearDelta: number | null,
 *     electionMinCoveragePct: number | null,
 *     pinnedAt: string | null,
 *     lastCheckedAt: string | null
 *   },
 *   changed: boolean,
 *   notes: string[]
 * }}
 */
export function materializePinnedDataRefs(args){
  const refs = normalizeDataRefs(args?.dataRefs);
  const resolution = resolveDataRefsByPolicy({
    dataRefs: refs,
    dataCatalog: args?.dataCatalog,
    scenario: args?.scenario,
  });
  const nowIso = str(args?.nowIso) || new Date().toISOString();
  const selected = resolution.selected || {};
  const out = {
    ...refs,
    mode: refs.mode,
    boundarySetId: selected.boundarySetId ?? refs.boundarySetId ?? null,
    crosswalkVersionId: selected.crosswalkVersionId ?? refs.crosswalkVersionId ?? null,
    censusDatasetId: selected.censusDatasetId ?? refs.censusDatasetId ?? null,
    electionDatasetId: selected.electionDatasetId ?? refs.electionDatasetId ?? null,
    pinnedAt: refs.pinnedAt,
    lastCheckedAt: nowIso,
  };

  let changed = false;
  const notes = Array.isArray(resolution.notes) ? resolution.notes.slice() : [];
  if (refs.mode === "latest_verified"){
    out.mode = "pinned_verified";
    out.pinnedAt = nowIso;
    changed = true;
    notes.push("latest_verified selection materialized to pinned_verified.");
  }

  if (
    out.boundarySetId !== refs.boundarySetId ||
    out.crosswalkVersionId !== refs.crosswalkVersionId ||
    out.censusDatasetId !== refs.censusDatasetId ||
    out.electionDatasetId !== refs.electionDatasetId
  ){
    changed = true;
  }

  return { dataRefs: out, changed, notes };
}

/**
 * Deterministic diagnostics for selected data refs and their compatibility.
 * Pure metadata check; does not mutate refs or model math.
 *
 * @param {{
 *   dataRefs: unknown,
 *   dataCatalog: unknown,
 *   scenario?: unknown,
 *   nowIso?: unknown
 * }} args
 * @returns {{
 *   status: "ok" | "warn" | "bad",
 *   summary: string,
 *   warnings: string[],
 *   details: {
 *     mode: "pinned_verified" | "latest_verified" | "manual",
 *     selected: {
 *       boundarySetId: string | null,
 *       crosswalkVersionId: string | null,
 *       censusDatasetId: string | null,
 *       electionDatasetId: string | null
 *     },
 *     targetElectionYear: number | null,
 *     electionCycleYear: number | null,
 *     electionYearGap: number | null,
 *     censusCoveragePct: number | null,
 *     electionCoveragePct: number | null,
 *     crosswalkCoveragePct: number | null,
 *     selectedMeta: {
 *       boundary: { id: string | null, vintage: string | null, refreshedAt: string | null, isLatest: boolean, isVerified: boolean, ageDays: number | null },
 *       crosswalk: { id: string | null, vintage: string | null, refreshedAt: string | null, isLatest: boolean, isVerified: boolean, ageDays: number | null },
 *       census: { id: string | null, vintage: string | null, refreshedAt: string | null, isLatest: boolean, isVerified: boolean, ageDays: number | null },
 *       election: { id: string | null, vintage: string | null, refreshedAt: string | null, isLatest: boolean, isVerified: boolean, ageDays: number | null }
 *     }
 *   }
 * }}
 */
export function diagnoseDataRefAlignment(args){
  const refs = normalizeDataRefs(args?.dataRefs);
  const registry = buildDataSourceRegistry(args?.dataCatalog);
  const resolution = resolveDataRefsByPolicy({
    dataRefs: refs,
    dataCatalog: args?.dataCatalog,
    scenario: args?.scenario,
  });
  const selected = resolution.selected || {};
  const byId = registry.byId || {};
  const boundary = selected.boundarySetId ? byId?.boundarySets?.[selected.boundarySetId] || null : null;
  const crosswalk = selected.crosswalkVersionId ? byId?.crosswalks?.[selected.crosswalkVersionId] || null : null;
  const census = selected.censusDatasetId ? byId?.censusDatasets?.[selected.censusDatasetId] || null : null;
  const election = selected.electionDatasetId ? byId?.electionDatasets?.[selected.electionDatasetId] || null : null;
  const nowMs = dateRank(args?.nowIso || new Date().toISOString());
  const staleWarnDays = 730;
  /**
   * @param {Record<string, any> | null} row
   * @returns {{ id: string | null, vintage: string | null, refreshedAt: string | null, isLatest: boolean, isVerified: boolean, ageDays: number | null }}
   */
  const rowMeta = (row) => {
    if (!row) return { id: null, vintage: null, refreshedAt: null, isLatest: false, isVerified: false, ageDays: null };
    const refreshedAt = strOrNull(row.refreshedAt);
    const refreshedMs = dateRank(refreshedAt);
    const ageDays = (refreshedMs >= 0 && nowMs >= 0)
      ? Math.max(0, Math.floor((nowMs - refreshedMs) / 86400000))
      : null;
    return {
      id: strOrNull(row.id),
      vintage: strOrNull(row.vintage),
      refreshedAt,
      isLatest: !!row.isLatest,
      isVerified: !!row.isVerified,
      ageDays,
    };
  };
  const boundaryMeta = rowMeta(boundary);
  const crosswalkMeta = rowMeta(crosswalk);
  const censusMeta = rowMeta(census);
  const electionMeta = rowMeta(election);

  const warnings = [];
  const missing = [];
  if (!boundary) missing.push("boundary");
  if (!crosswalk) missing.push("crosswalk");
  if (!census) missing.push("census");
  if (!election) missing.push("election");
  if (missing.length){
    warnings.push(`Missing selected refs: ${missing.join(", ")}.`);
  }

  const boundaryId = str(boundary?.id || selected?.boundarySetId);
  if (crosswalk && boundaryId){
    const fromId = str(crosswalk.fromBoundarySetId);
    const toId = str(crosswalk.toBoundarySetId);
    if (boundaryId !== fromId && boundaryId !== toId){
      warnings.push(`Crosswalk '${crosswalk.id}' does not reference boundary set '${boundaryId}'.`);
    }
  }
  if (census && boundaryId){
    const censusBoundaryId = str(census.boundarySetId);
    if (censusBoundaryId && censusBoundaryId !== boundaryId){
      warnings.push(`Census dataset '${census.id}' boundary '${censusBoundaryId}' differs from selected boundary '${boundaryId}'.`);
    }
  }
  if (election && boundaryId){
    const electionBoundaryId = str(election.boundarySetId);
    if (electionBoundaryId && electionBoundaryId !== boundaryId){
      warnings.push(`Election dataset '${election.id}' boundary '${electionBoundaryId}' differs from selected boundary '${boundaryId}'.`);
    }
  }

  if (resolution.mode === "latest_verified"){
    if (boundary && !boundaryMeta.isLatest) warnings.push(`Boundary '${boundary.id}' is verified but not latest.`);
    if (crosswalk && !crosswalkMeta.isLatest) warnings.push(`Crosswalk '${crosswalk.id}' is verified but not latest.`);
    if (census && !censusMeta.isLatest) warnings.push(`Census dataset '${census.id}' is verified but not latest.`);
    if (election && !electionMeta.isLatest) warnings.push(`Election dataset '${election.id}' is verified but not latest.`);
  }
  if (boundary && boundaryMeta.refreshedAt == null) warnings.push(`Boundary '${boundary.id}' has no refreshed timestamp.`);
  if (crosswalk && crosswalkMeta.refreshedAt == null) warnings.push(`Crosswalk '${crosswalk.id}' has no refreshed timestamp.`);
  if (census && censusMeta.refreshedAt == null) warnings.push(`Census dataset '${census.id}' has no refreshed timestamp.`);
  if (election && electionMeta.refreshedAt == null) warnings.push(`Election dataset '${election.id}' has no refreshed timestamp.`);
  if (boundaryMeta.ageDays != null && boundaryMeta.ageDays > staleWarnDays) warnings.push(`Boundary '${boundaryMeta.id || "selected"}' is stale (${boundaryMeta.ageDays} days old).`);
  if (crosswalkMeta.ageDays != null && crosswalkMeta.ageDays > staleWarnDays) warnings.push(`Crosswalk '${crosswalkMeta.id || "selected"}' is stale (${crosswalkMeta.ageDays} days old).`);
  if (censusMeta.ageDays != null && censusMeta.ageDays > staleWarnDays) warnings.push(`Census dataset '${censusMeta.id || "selected"}' is stale (${censusMeta.ageDays} days old).`);
  if (electionMeta.ageDays != null && electionMeta.ageDays > staleWarnDays) warnings.push(`Election dataset '${electionMeta.id || "selected"}' is stale (${electionMeta.ageDays} days old).`);

  const targetYear = deriveTargetElectionYear(args?.scenario);
  const electionYear = toYearOrNull(election?.cycleYear) ?? toYearOrNull(election?.electionDate) ?? toYearOrNull(election?.vintage);
  const electionYearGap = (targetYear != null && electionYear != null) ? Math.abs(targetYear - electionYear) : null;
  const maxYearGap = numOrNull(refs.electionMaxYearDelta);
  if (maxYearGap != null && electionYearGap != null && electionYearGap > maxYearGap){
    warnings.push(`Election cycle gap ${electionYearGap} exceeds filter ${Math.round(maxYearGap)}.`);
  }

  const crosswalkCoveragePct = numOrNull(crosswalk?.coveragePct);
  const censusCoveragePct = numOrNull(census?.coveragePct);
  const electionCoveragePct = numOrNull(election?.coveragePct);
  const minCoverage = numOrNull(refs.electionMinCoveragePct);
  if (minCoverage != null && electionCoveragePct != null && electionCoveragePct < minCoverage){
    warnings.push(`Election coverage ${electionCoveragePct.toFixed(1)}% is below filter ${minCoverage.toFixed(1)}%.`);
  }
  if (crosswalkCoveragePct != null && crosswalkCoveragePct < 95){
    warnings.push(`Crosswalk coverage is low (${crosswalkCoveragePct.toFixed(1)}%).`);
  }
  if (censusCoveragePct != null && censusCoveragePct < 95){
    warnings.push(`Census coverage is low (${censusCoveragePct.toFixed(1)}%).`);
  }
  if (electionCoveragePct != null && electionCoveragePct < 95){
    warnings.push(`Election coverage is low (${electionCoveragePct.toFixed(1)}%).`);
  }

  let status = "ok";
  if (missing.length){
    status = "bad";
  } else if (warnings.length){
    status = "warn";
  }

  const summaryParts = [];
  if (resolution.mode) summaryParts.push(`Mode ${resolution.mode}`);
  if (boundaryId) summaryParts.push(`Boundary ${boundaryId}`);
  if (selected.crosswalkVersionId) summaryParts.push(`Crosswalk ${selected.crosswalkVersionId}`);
  if (selected.censusDatasetId) summaryParts.push(`Census ${selected.censusDatasetId}`);
  if (selected.electionDatasetId) summaryParts.push(`Election ${selected.electionDatasetId}`);
  if (electionYearGap != null) summaryParts.push(`Year gap ${electionYearGap}`);
  if (Number.isFinite(electionMeta.ageDays)) summaryParts.push(`Election age ${Math.round(Number(electionMeta.ageDays))}d`);
  const summary = summaryParts.join(" · ") || "No active data refs selected.";

  return {
    status,
    summary,
    warnings,
    details: {
      mode: resolution.mode,
      selected: {
        boundarySetId: selected.boundarySetId || null,
        crosswalkVersionId: selected.crosswalkVersionId || null,
        censusDatasetId: selected.censusDatasetId || null,
        electionDatasetId: selected.electionDatasetId || null,
      },
      targetElectionYear: targetYear,
      electionCycleYear: electionYear,
      electionYearGap,
      censusCoveragePct,
      electionCoveragePct,
      crosswalkCoveragePct,
      selectedMeta: {
        boundary: boundaryMeta,
        crosswalk: crosswalkMeta,
        census: censusMeta,
        election: electionMeta,
      },
    },
  };
}
