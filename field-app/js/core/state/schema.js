// @ts-check
import { canonicalizeCandidateHistoryOffice } from "../candidateHistoryBaseline.js";

export const CANONICAL_SCHEMA_VERSION = 1;

export const CANONICAL_DOMAINS = Object.freeze([
  "campaign",
  "district",
  "assumptions",
  "ballot",
  "candidateHistory",
  "targeting",
  "census",
  "electionData",
  "outcome",
  "fieldCapacity",
  "weatherRisk",
  "eventCalendar",
  "forecastArchive",
  "recovery",
  "governance",
  "scenarios",
  "audit",
  "ui",
]);

export const ELECTION_DATA_REQUIRED_COLUMNS = Object.freeze([
  "state_fips",
  "county_fips",
  "election_date",
  "office",
  "district_id",
  "precinct_id",
  "candidate",
  "votes",
]);

export const ELECTION_DATA_OPTIONAL_COLUMNS = Object.freeze([
  "party",
  "registered_voters",
  "total_votes_precinct",
  "write_ins",
  "undervotes",
  "overvotes",
  "election_type",
  "cycle_year",
  "ward_id",
  "jurisdiction_key",
  "source",
  "notes",
]);

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function toFinite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value) {
  if (typeof value === "boolean") return value;
  const token = cleanText(value).toLowerCase();
  return token === "true" || token === "1" || token === "yes";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function nowIso(nowDate = new Date()) {
  const next = nowDate instanceof Date ? nowDate : new Date(nowDate);
  if (!Number.isFinite(next.getTime())) {
    return new Date().toISOString();
  }
  return next.toISOString();
}

function slugToken(value, fallback = "") {
  const token = cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return token || fallback;
}

function makeRefId(prefix, value, index = 0) {
  const token = slugToken(value, "");
  if (token) return `${prefix}_${token}`;
  return `${prefix}_${Math.max(1, index + 1)}`;
}

function readFirst(source, keys = []) {
  const src = source && typeof source === "object" ? source : {};
  for (const key of keys) {
    const value = src[key];
    if (value != null && cleanText(value) !== "") {
      return value;
    }
  }
  return "";
}

function normalizeBallotCandidates(rawCandidates, rawUserSplit) {
  const rows = asArray(rawCandidates);
  const userSplit = rawUserSplit && typeof rawUserSplit === "object" ? rawUserSplit : {};
  /** @type {Record<string, any>} */
  const byId = {};
  /** @type {string[]} */
  const order = [];
  /** @type {Record<string, number | null>} */
  const userSplitByCandidateId = {};
  const usedIds = new Set();

  rows.forEach((row, idx) => {
    const srcId = cleanText(row?.id);
    let id = srcId || makeRefId("cand", row?.name, idx);
    if (usedIds.has(id)) {
      id = `${id}_${idx + 1}`;
    }
    usedIds.add(id);
    const supportPct = toFinite(row?.supportPct, null);
    byId[id] = {
      id,
      name: cleanText(row?.name) || `Candidate ${idx + 1}`,
      supportPct,
    };
    order.push(id);
    const splitValue = Object.prototype.hasOwnProperty.call(userSplit, srcId)
      ? userSplit[srcId]
      : userSplit[id];
    userSplitByCandidateId[id] = toFinite(splitValue, null);
  });

  if (!order.length) {
    byId.cand_a = { id: "cand_a", name: "Candidate A", supportPct: 35 };
    byId.cand_b = { id: "cand_b", name: "Candidate B", supportPct: 35 };
    order.push("cand_a", "cand_b");
    userSplitByCandidateId.cand_a = null;
    userSplitByCandidateId.cand_b = null;
  }

  return {
    candidateRefs: { byId, order },
    userSplitByCandidateId,
  };
}

function normalizeCandidateHistoryRecords(rawRecords) {
  return asArray(rawRecords).map((row, idx) => {
    const recordId = cleanText(row?.recordId) || makeRefId("history", row?.office || row?.candidateName, idx);
    return {
      recordId,
      office: canonicalizeCandidateHistoryOffice(row?.office),
      cycleYear: toFinite(row?.cycleYear, null),
      electionType: cleanText(row?.electionType).toLowerCase(),
      candidateId: cleanText(row?.candidateId || row?.candidate_id),
      candidateName: cleanText(row?.candidateName),
      party: cleanText(row?.party),
      incumbencyStatus: cleanText(row?.incumbencyStatus).toLowerCase(),
      voteShare: toFinite(row?.voteShare, null),
      margin: toFinite(row?.margin, null),
      turnoutContext: toFinite(row?.turnoutContext, null),
      repeatCandidate: toBool(row?.repeatCandidate),
      overUnderPerformancePct: toFinite(row?.overUnderPerformancePct, null),
    };
  });
}

function normalizeElectionDataRow(row, index = 0) {
  const src = row && typeof row === "object" ? row : {};
  const stateFips = cleanText(readFirst(src, ["state_fips", "stateFips"]));
  const countyFips = cleanText(readFirst(src, ["county_fips", "countyFips"]));
  const electionDate = cleanText(readFirst(src, ["election_date", "electionDate"]));
  const office = cleanText(readFirst(src, ["office", "office_name"]));
  const districtId = cleanText(readFirst(src, ["district_id", "districtId"]));
  const precinctId = cleanText(readFirst(src, ["precinct_id", "precinctId", "precinct"]));
  const wardId = cleanText(readFirst(src, ["ward_id", "wardId"]));
  const candidateName = cleanText(readFirst(src, ["candidate", "candidateName"]));
  const candidateId = cleanText(readFirst(src, ["candidate_id", "candidateId"]));
  const partyName = cleanText(readFirst(src, ["party", "partyName"]));
  const partyId = cleanText(readFirst(src, ["party_id", "partyId"]));
  const electionType = cleanText(readFirst(src, ["election_type", "electionType"])).toLowerCase();
  const cycleYear = toFinite(readFirst(src, ["cycle_year", "cycleYear"]), null);
  const turnoutTotal = toFinite(readFirst(src, ["total_votes_precinct", "turnoutTotal", "ballots_cast"]), null);
  const registeredVoters = toFinite(readFirst(src, ["registered_voters", "registeredVoters"]), null);
  const voteTotal = toFinite(readFirst(src, ["votes", "voteTotal"]), null);
  const writeIns = toFinite(readFirst(src, ["write_ins", "writeIns"]), null);
  const undervotes = toFinite(readFirst(src, ["undervotes"]), null);
  const overvotes = toFinite(readFirst(src, ["overvotes"]), null);
  const jurisdictionKey = cleanText(readFirst(src, ["jurisdiction_key", "jurisdictionKey"]))
    || [stateFips, countyFips, districtId].filter(Boolean).join("|");
  const geographyId = cleanText(readFirst(src, ["geography_id", "geographyId"]))
    || precinctId
    || wardId
    || districtId;

  return {
    rowId: cleanText(src.rowId) || `row_${index + 1}`,
    jurisdictionKey,
    geographyId,
    stateFips,
    countyFips,
    districtId,
    precinctId,
    wardId,
    office,
    electionDate,
    electionType,
    cycleYear,
    candidateId,
    candidateName,
    partyId,
    partyName,
    registeredVoters,
    turnoutTotal,
    voteTotal,
    writeIns,
    undervotes,
    overvotes,
    source: cleanText(readFirst(src, ["source"])),
    notes: cleanText(readFirst(src, ["notes"])),
    sourceRowNumber: toFinite(readFirst(src, ["source_row", "sourceRowNumber"]), index + 1),
  };
}

function deriveElectionDataRefs(rows) {
  /** @type {Record<string, any>} */
  const geographyById = {};
  /** @type {Record<string, any>} */
  const candidateById = {};
  /** @type {Record<string, any>} */
  const partyById = {};
  /** @type {string[]} */
  const geographyOrder = [];
  /** @type {string[]} */
  const candidateOrder = [];
  /** @type {string[]} */
  const partyOrder = [];

  rows.forEach((row, idx) => {
    const geographyId = cleanText(row?.geographyId) || makeRefId("geo", row?.precinctId || row?.districtId, idx);
    if (!geographyById[geographyId]) {
      geographyById[geographyId] = {
        geographyId,
        precinctId: cleanText(row?.precinctId),
        wardId: cleanText(row?.wardId),
        districtId: cleanText(row?.districtId),
        jurisdictionKey: cleanText(row?.jurisdictionKey),
      };
      geographyOrder.push(geographyId);
    }

    const candidateRefId = cleanText(row?.candidateId) || makeRefId("cand", row?.candidateName, idx);
    if (!candidateById[candidateRefId]) {
      candidateById[candidateRefId] = {
        candidateId: candidateRefId,
        candidateName: cleanText(row?.candidateName),
        partyId: cleanText(row?.partyId),
      };
      candidateOrder.push(candidateRefId);
    }

    const partyRefId = cleanText(row?.partyId) || (cleanText(row?.partyName) ? makeRefId("party", row?.partyName, idx) : "");
    if (partyRefId && !partyById[partyRefId]) {
      partyById[partyRefId] = {
        partyId: partyRefId,
        partyName: cleanText(row?.partyName),
      };
      partyOrder.push(partyRefId);
    }
  });

  return {
    geographyRefs: { byId: geographyById, order: geographyOrder },
    candidateRefs: { byId: candidateById, order: candidateOrder },
    partyRefs: { byId: partyById, order: partyOrder },
  };
}

function summarizeElectionDataTotals(rows) {
  let validVotes = 0;
  let totalVotes = 0;
  let writeIns = 0;
  let undervotes = 0;
  let overvotes = 0;
  let registeredVotersMax = null;
  let turnoutMax = null;

  rows.forEach((row) => {
    const voteTotal = toFinite(row?.voteTotal, null);
    if (voteTotal != null) {
      validVotes += voteTotal;
    }

    const turnoutTotal = toFinite(row?.turnoutTotal, null);
    if (turnoutTotal != null) {
      turnoutMax = turnoutMax == null ? turnoutTotal : Math.max(turnoutMax, turnoutTotal);
    }

    const registeredVoters = toFinite(row?.registeredVoters, null);
    if (registeredVoters != null) {
      registeredVotersMax = registeredVotersMax == null ? registeredVoters : Math.max(registeredVotersMax, registeredVoters);
    }

    writeIns += toFinite(row?.writeIns, 0) || 0;
    undervotes += toFinite(row?.undervotes, 0) || 0;
    overvotes += toFinite(row?.overvotes, 0) || 0;
  });

  if (turnoutMax != null) {
    totalVotes = turnoutMax;
  } else {
    totalVotes = validVotes + writeIns + undervotes + overvotes;
  }

  const turnoutRate = (registeredVotersMax != null && registeredVotersMax > 0)
    ? (totalVotes / registeredVotersMax)
    : null;

  return {
    turnoutTotals: {
      ballotsCast: totalVotes || null,
      registeredVoters: registeredVotersMax,
      turnoutRate,
    },
    voteTotals: {
      totalVotes: totalVotes || null,
      validVotes: validVotes || null,
      writeIns: writeIns || null,
      undervotes: undervotes || null,
      overvotes: overvotes || null,
    },
  };
}

function computeElectionDataQuality(rows, qaState, nowDate = new Date()) {
  const totalRows = rows.length;
  if (!totalRows) {
    return {
      score: null,
      confidenceBand: "unknown",
      completenessRatio: 0,
      warningCount: 0,
      computedAt: nowIso(nowDate),
    };
  }

  let completeRows = 0;
  rows.forEach((row) => {
    const hasGeography = !!cleanText(row?.geographyId);
    const hasCandidate = !!cleanText(row?.candidateName) || !!cleanText(row?.candidateId);
    const hasVotes = toFinite(row?.voteTotal, null) != null;
    if (hasGeography && hasCandidate && hasVotes) {
      completeRows += 1;
    }
  });

  const warnings = [
    ...asArray(qaState?.sourceWarnings),
    ...asArray(qaState?.geographyWarnings),
    ...asArray(qaState?.candidateWarnings),
    ...asArray(qaState?.mappingWarnings),
    ...asArray(qaState?.errors),
  ].filter((value) => cleanText(value));

  const completenessRatio = completeRows / totalRows;
  const warningPenalty = Math.min(0.35, warnings.length * 0.04);
  const scoreRaw = Math.max(0, Math.min(1, completenessRatio - warningPenalty));
  const score = Number(scoreRaw.toFixed(4));
  const confidenceBand = score >= 0.85 ? "high" : score >= 0.6 ? "medium" : "low";

  return {
    score,
    confidenceBand,
    completenessRatio: Number(completenessRatio.toFixed(4)),
    warningCount: warnings.length,
    computedAt: nowIso(nowDate),
  };
}

export function makeDefaultElectionDataDomain(nowDate = new Date()) {
  return {
    revision: 0,
    import: {
      fileName: "",
      fileSize: 0,
      fileHash: "",
      importedAt: "",
      format: "",
      status: "idle",
      statusText: "",
      guideText: "",
      previewMetaText: "",
      precinctFilter: "",
    },
    schemaMapping: {
      status: "unmapped",
      requiredColumns: ELECTION_DATA_REQUIRED_COLUMNS.slice(),
      optionalColumns: ELECTION_DATA_OPTIONAL_COLUMNS.slice(),
      columnMap: {},
      mappedColumns: [],
      unmappedColumns: [],
    },
    rawRows: [],
    normalizedRows: [],
    jurisdictionKeys: [],
    raceMeta: {
      office: "",
      officeLevel: "",
      raceId: "",
      districtId: "",
      electionType: "",
      electionDate: "",
      cycleYear: null,
    },
    geographyRefs: { byId: {}, order: [] },
    candidateRefs: { byId: {}, order: [] },
    partyRefs: { byId: {}, order: [] },
    turnoutTotals: {
      ballotsCast: null,
      registeredVoters: null,
      turnoutRate: null,
    },
    voteTotals: {
      totalVotes: null,
      validVotes: null,
      writeIns: null,
      undervotes: null,
      overvotes: null,
    },
    qa: {
      sourceWarnings: [],
      geographyWarnings: [],
      candidateWarnings: [],
      mappingWarnings: [],
      errors: [],
    },
    quality: {
      score: null,
      confidenceBand: "unknown",
      completenessRatio: 0,
      warningCount: 0,
      computedAt: nowIso(nowDate),
    },
    benchmarks: {
      historicalRaceBenchmarks: [],
      turnoutBaselines: [],
      volatilityBands: [],
      partyBaselineContext: [],
      comparableRacePools: [],
      repeatCandidatePerformance: [],
      precinctPerformanceDistributions: [],
      geographyRollups: [],
      benchmarkSuggestions: [],
      downstreamRecommendations: {
        district: {},
        targeting: {},
        outcome: {},
      },
    },
  };
}

export function normalizeElectionDataSlice(input, { nowDate = new Date() } = {}) {
  const base = makeDefaultElectionDataDomain(nowDate);
  const src = input && typeof input === "object" ? input : {};

  const rawRows = asArray(src.rawRows).map((row) => clone(row));
  const normalizedRowsSource = asArray(src.normalizedRows).length ? src.normalizedRows : rawRows;
  const normalizedRows = asArray(normalizedRowsSource).map((row, idx) => normalizeElectionDataRow(row, idx));

  const refs = deriveElectionDataRefs(normalizedRows);
  const totals = summarizeElectionDataTotals(normalizedRows);
  const qa = {
    sourceWarnings: asArray(src?.qa?.sourceWarnings).map((item) => cleanText(item)).filter(Boolean),
    geographyWarnings: asArray(src?.qa?.geographyWarnings).map((item) => cleanText(item)).filter(Boolean),
    candidateWarnings: asArray(src?.qa?.candidateWarnings).map((item) => cleanText(item)).filter(Boolean),
    mappingWarnings: asArray(src?.qa?.mappingWarnings).map((item) => cleanText(item)).filter(Boolean),
    errors: asArray(src?.qa?.errors).map((item) => cleanText(item)).filter(Boolean),
  };
  const quality = computeElectionDataQuality(normalizedRows, qa, nowDate);

  const jurisdictionKeys = Array.from(new Set(
    normalizedRows
      .map((row) => cleanText(row?.jurisdictionKey))
      .filter(Boolean),
  ));

  const raceMetaSeed = normalizedRows[0] || {};
  const raceMetaInput = src?.raceMeta && typeof src.raceMeta === "object" ? src.raceMeta : {};

  return {
    ...base,
    ...src,
    revision: toFinite(src.revision, 0) || 0,
    import: {
      ...base.import,
      ...(src.import && typeof src.import === "object" ? src.import : {}),
      fileName: cleanText(src?.import?.fileName),
      fileSize: Math.max(0, toFinite(src?.import?.fileSize, 0) || 0),
      fileHash: cleanText(src?.import?.fileHash),
      importedAt: cleanText(src?.import?.importedAt),
      format: cleanText(src?.import?.format).toLowerCase(),
      status: cleanText(src?.import?.status) || "idle",
      statusText: cleanText(src?.import?.statusText),
      guideText: cleanText(src?.import?.guideText),
      previewMetaText: cleanText(src?.import?.previewMetaText),
      precinctFilter: cleanText(src?.import?.precinctFilter),
    },
    schemaMapping: {
      ...base.schemaMapping,
      ...(src.schemaMapping && typeof src.schemaMapping === "object" ? src.schemaMapping : {}),
      status: cleanText(src?.schemaMapping?.status) || "unmapped",
      requiredColumns: asArray(src?.schemaMapping?.requiredColumns).length
        ? asArray(src.schemaMapping.requiredColumns).map((value) => cleanText(value)).filter(Boolean)
        : base.schemaMapping.requiredColumns.slice(),
      optionalColumns: asArray(src?.schemaMapping?.optionalColumns).length
        ? asArray(src.schemaMapping.optionalColumns).map((value) => cleanText(value)).filter(Boolean)
        : base.schemaMapping.optionalColumns.slice(),
      columnMap: src?.schemaMapping?.columnMap && typeof src.schemaMapping.columnMap === "object"
        ? clone(src.schemaMapping.columnMap)
        : {},
      mappedColumns: asArray(src?.schemaMapping?.mappedColumns).map((value) => cleanText(value)).filter(Boolean),
      unmappedColumns: asArray(src?.schemaMapping?.unmappedColumns).map((value) => cleanText(value)).filter(Boolean),
    },
    rawRows,
    normalizedRows,
    jurisdictionKeys,
    raceMeta: {
      ...base.raceMeta,
      ...raceMetaInput,
      office: cleanText(raceMetaInput.office || raceMetaSeed.office),
      officeLevel: cleanText(raceMetaInput.officeLevel),
      raceId: cleanText(raceMetaInput.raceId),
      districtId: cleanText(raceMetaInput.districtId || raceMetaSeed.districtId),
      electionType: cleanText(raceMetaInput.electionType || raceMetaSeed.electionType).toLowerCase(),
      electionDate: cleanText(raceMetaInput.electionDate || raceMetaSeed.electionDate),
      cycleYear: toFinite(raceMetaInput.cycleYear || raceMetaSeed.cycleYear, null),
    },
    geographyRefs: refs.geographyRefs,
    candidateRefs: refs.candidateRefs,
    partyRefs: refs.partyRefs,
    turnoutTotals: totals.turnoutTotals,
    voteTotals: totals.voteTotals,
    qa,
    quality,
    benchmarks: {
      ...base.benchmarks,
      ...(src.benchmarks && typeof src.benchmarks === "object" ? src.benchmarks : {}),
      historicalRaceBenchmarks: asArray(src?.benchmarks?.historicalRaceBenchmarks).map((row) => clone(row)),
      turnoutBaselines: asArray(src?.benchmarks?.turnoutBaselines).map((row) => clone(row)),
      volatilityBands: asArray(src?.benchmarks?.volatilityBands).map((row) => clone(row)),
      partyBaselineContext: asArray(src?.benchmarks?.partyBaselineContext).map((row) => clone(row)),
      comparableRacePools: asArray(src?.benchmarks?.comparableRacePools).map((row) => clone(row)),
      repeatCandidatePerformance: asArray(src?.benchmarks?.repeatCandidatePerformance).map((row) => clone(row)),
      precinctPerformanceDistributions: asArray(src?.benchmarks?.precinctPerformanceDistributions).map((row) => clone(row)),
      geographyRollups: asArray(src?.benchmarks?.geographyRollups).map((row) => clone(row)),
      benchmarkSuggestions: asArray(src?.benchmarks?.benchmarkSuggestions).map((row) => clone(row)),
      downstreamRecommendations: {
        district: clone(src?.benchmarks?.downstreamRecommendations?.district || {}),
        targeting: clone(src?.benchmarks?.downstreamRecommendations?.targeting || {}),
        outcome: clone(src?.benchmarks?.downstreamRecommendations?.outcome || {}),
      },
    },
  };
}

function makeDefaultCampaignDomain() {
  return {
    campaignId: "",
    campaignName: "",
    officeId: "",
    scenarioName: "",
    contextLock: {
      campaign: false,
      office: false,
      scenario: false,
    },
  };
}

function makeDefaultDistrictDomain() {
  return {
    templateProfile: {
      raceType: "state_leg",
      officeLevel: "",
      electionType: "",
      seatContext: "",
      partisanshipMode: "",
      salienceLevel: "",
      appliedTemplateId: "",
      appliedVersion: "",
      benchmarkKey: "",
      overriddenFields: [],
      assumptionsProfile: "template",
    },
    form: {
      electionDate: "",
      weeksRemaining: "",
      mode: "persuasion",
      universeBasis: "registered",
      universeSize: null,
      sourceNote: "",
      turnoutA: null,
      turnoutB: null,
      bandWidth: null,
    },
    universeComposition: {
      enabled: false,
      demPct: null,
      repPct: null,
      npaPct: null,
      otherPct: null,
      retentionFactor: null,
    },
  };
}

function makeDefaultAssumptionsDomain() {
  return {
    persuasionPct: null,
    earlyVoteExp: null,
    goalSupportIds: null,
    supportRatePct: null,
    contactRatePct: null,
    turnoutReliabilityPct: null,
    turnout: {
      enabled: false,
      baselinePct: 55,
      targetOverridePct: null,
      gotvMode: "basic",
      gotvLiftPP: 1,
      gotvMaxLiftPP: null,
      gotvDiminishing: false,
      gotvLiftMin: 0.5,
      gotvLiftMode: 1,
      gotvLiftMax: 2,
      gotvMaxLiftPP2: 10,
    },
  };
}

function makeDefaultBallotDomain() {
  return {
    yourCandidateId: "",
    undecidedPct: 30,
    undecidedMode: "proportional",
    candidateRefs: {
      byId: {
        cand_a: { id: "cand_a", name: "Candidate A", supportPct: 35 },
        cand_b: { id: "cand_b", name: "Candidate B", supportPct: 35 },
      },
      order: ["cand_a", "cand_b"],
    },
    userSplitByCandidateId: {
      cand_a: null,
      cand_b: null,
    },
  };
}

function makeDefaultCandidateHistoryDomain() {
  return {
    records: [],
    coverageBand: "none",
    confidenceBand: "missing",
    matchedRecordCount: 0,
  };
}

function makeDefaultTargetingDomain() {
  return {
    config: {
      presetId: "turnout_opportunity",
      geoLevel: "block_group",
      modelId: "turnout_opportunity",
      topN: 50,
      minHousingUnits: 50,
      minPopulation: 120,
      minScore: 0.35,
      onlyRaceFootprint: true,
      controlsLocked: false,
    },
    criteria: {
      prioritizeYoung: true,
      prioritizeRenters: true,
      avoidHighMultiUnit: false,
      densityFloor: "medium",
    },
    weights: {
      votePotential: 0.3,
      turnoutOpportunity: 0.5,
      persuasionIndex: 0.1,
      fieldEfficiency: 0.1,
    },
    runtime: {
      statusText: "Run targeting to generate ranked GEOs.",
      meta: {},
      rows: [],
      lastRunAt: "",
    },
  };
}

function makeDefaultCensusDomain() {
  return {
    config: {
      year: "2024",
      resolution: "tract",
      metricSet: "core",
      stateFips: "",
      countyFips: "",
      placeFips: "",
      geoSearch: "",
      tractFilter: "",
      selectionSetDraftName: "",
      selectedSelectionSetKey: "",
      applyAdjustedAssumptions: false,
      mapQaVtdOverlay: false,
      apiKey: "",
      geoPaste: "",
    },
    selection: {
      geoOptions: [],
      selectedGeoids: [],
      rowsByGeoid: {},
      activeRowsKey: "",
      loadedRowCount: 0,
      stateOptions: [],
      countyOptions: [],
      placeOptions: [],
      tractFilterOptions: [],
      selectionSetOptions: [],
      geoSelectOptions: [],
    },
    runtime: {
      statusText: "Ready.",
      errorText: "",
      lastFetchAt: "",
      aggregateRows: [],
      advisoryRows: [],
      mapStatusText: "",
      mapQaVtdZipStatusText: "",
    },
  };
}

function makeDefaultOutcomeDomain() {
  return {
    controls: {
      mcMode: "basic",
      mcVolatility: "med",
      mcSeed: "",
      turnoutReliabilityPct: null,
      mcContactMin: null,
      mcContactMode: null,
      mcContactMax: null,
      mcPersMin: null,
      mcPersMode: null,
      mcPersMax: null,
      mcReliMin: null,
      mcReliMode: null,
      mcReliMax: null,
      mcDphMin: null,
      mcDphMode: null,
      mcDphMax: null,
      mcCphMin: null,
      mcCphMode: null,
      mcCphMax: null,
      mcVolMin: null,
      mcVolMode: null,
      mcVolMax: null,
    },
    cache: {
      mcLast: null,
      mcLastHash: "",
      sensitivityRows: [],
      surfaceInputs: {
        surfaceLever: "volunteerMultiplier",
        surfaceMode: "fast",
        surfaceMin: "",
        surfaceMax: "",
        surfaceSteps: "21",
        surfaceTarget: "70",
      },
      surfaceRows: [],
      surfaceStatusText: "",
      surfaceSummaryText: "",
    },
  };
}

function makeDefaultFieldCapacityDomain() {
  return {
    orgCount: 2,
    orgHoursPerWeek: 40,
    volunteerMultBase: 1,
    channelDoorPct: null,
    doorsPerHour3: null,
    callsPerHour3: null,
    doorsPerHourLegacy: 30,
    hoursPerShift: 3,
    shiftsPerVolunteerPerWeek: 2,
    timeline: {
      enabled: false,
      activeWeeks: null,
      gotvWeeks: null,
      staffCount: 0,
      staffHours: 40,
      volCount: 0,
      volHours: 4,
      rampEnabled: false,
      rampMode: "",
      doorsPerHour: 30,
      callsPerHour: 20,
      textsPerHour: 120,
    },
  };
}

function makeDefaultWeatherRiskDomain() {
  return {
    officeZip: "",
    overrideZip: "",
    useOverrideZip: false,
    selectedZip: "",
    status: "idle",
    error: "",
    fetchedAt: "",
    current: null,
    forecast3d: [],
    fieldExecutionRisk: "low",
    electionDayTurnoutRisk: "low",
    recommendedAction: "Set a ZIP to load weather context.",
    precipSignal: 0,
    adjustment: {
      enabled: false,
      mode: "observe_only",
      date: "",
      zip: "",
      modifiers: {
        doorEfficiencyMultiplier: 1,
        volunteerShowRateMultiplier: 1,
        electionDayTurnoutRiskBump: 0,
      },
      appliedAt: "",
      log: [],
    },
  };
}

function makeDefaultEventCalendarDomain() {
  return {
    version: "18.75.0",
    filters: {
      date: "",
      category: "all",
      includeInactive: false,
      appliedOnly: false,
    },
    draft: {
      eventId: "",
      eventType: "day_of_action",
      title: "",
      category: "campaign",
      date: "",
      startTime: "",
      endTime: "",
      notes: "",
      createdBy: "",
      createdAt: "",
      applyToModel: false,
      status: "scheduled",
      attendees: "",
      meetingType: "",
      followUpOwner: "",
      followUpDate: "",
      expectedVolunteers: 0,
      expectedPaidCanvassers: 0,
      expectedShiftHours: 0,
      officeLocation: "",
      fieldGoalNotes: "",
      channelFocus: "",
    },
    events: [],
    statusSummary: {
      totalEvents: 0,
      appliedEvents: 0,
      openFollowUps: 0,
    },
  };
}

function makeDefaultForecastArchiveDomain() {
  return {
    selectedHash: "",
    entries: [],
    summary: {
      total: 0,
      staleCount: 0,
      latestAt: "",
    },
  };
}

function makeDefaultRecoveryDomain() {
  return {
    strictImport: false,
    usbConnected: false,
    lastBackupRestoreAt: "",
    lastImportFileName: "",
    lastWarning: "",
    lastHashBanner: "",
  };
}

function makeDefaultGovernanceDomain() {
  return {
    snapshot: null,
    confidenceBand: "",
    topWarning: "",
    learningRecommendation: "",
  };
}

function makeDefaultScenariosDomain() {
  return {
    activeScenarioId: "baseline",
    selectedScenarioId: "baseline",
    records: {},
    decisionSessions: {},
  };
}

function makeDefaultAuditDomain() {
  return {
    validationSnapshot: null,
    realismSnapshot: null,
    diagnosticsSnapshot: null,
    contractFindings: [],
  };
}

function makeDefaultUiDomain() {
  return {
    activeStage: "district",
    activeTab: "win",
    playbookEnabled: false,
    trainingEnabled: false,
    assumptionsProfile: "template",
    themeMode: "system",
    dark: false,
    advDiag: false,
    rightRailMode: "results",
  };
}

export function makeCanonicalState({ nowDate = new Date() } = {}) {
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    revision: 0,
    updatedAt: nowIso(nowDate),
    domains: {
      campaign: makeDefaultCampaignDomain(),
      district: makeDefaultDistrictDomain(),
      assumptions: makeDefaultAssumptionsDomain(),
      ballot: makeDefaultBallotDomain(),
      candidateHistory: makeDefaultCandidateHistoryDomain(),
      targeting: makeDefaultTargetingDomain(),
      census: makeDefaultCensusDomain(),
      electionData: makeDefaultElectionDataDomain(nowDate),
      outcome: makeDefaultOutcomeDomain(),
      fieldCapacity: makeDefaultFieldCapacityDomain(),
      weatherRisk: makeDefaultWeatherRiskDomain(),
      eventCalendar: makeDefaultEventCalendarDomain(),
      forecastArchive: makeDefaultForecastArchiveDomain(),
      recovery: makeDefaultRecoveryDomain(),
      governance: makeDefaultGovernanceDomain(),
      scenarios: makeDefaultScenariosDomain(),
      audit: makeDefaultAuditDomain(),
      ui: makeDefaultUiDomain(),
    },
  };
}

function coerceLegacyElectionPreviewRows(censusState) {
  const census = censusState && typeof censusState === "object" ? censusState : {};
  const previewRows = asArray(census.bridgeElectionPreviewRows)
    .map((row, idx) => {
      const cells = asArray(row);
      return normalizeElectionDataRow({
        precinct_id: cleanText(cells[0]),
        candidate: cleanText(cells[1]),
        votes: toFinite(cells[2], null),
        total_votes_precinct: toFinite(cells[3], null),
        source_row: idx + 1,
      }, idx);
    })
    .filter((row) => cleanText(row.precinctId) || cleanText(row.candidateName));

  return {
    import: {
      status: cleanText(census.bridgeElectionCsvDryRunStatusText) ? "ready" : "idle",
      statusText: cleanText(census.bridgeElectionCsvDryRunStatusText),
      guideText: cleanText(census.bridgeElectionCsvGuideStatusText),
      previewMetaText: cleanText(census.bridgeElectionCsvPreviewMetaText),
      precinctFilter: cleanText(census.bridgeElectionCsvPrecinctFilter),
    },
    normalizedRows: previewRows,
  };
}

export function migrateLegacyStateToCanonical(legacyState, { nowDate = new Date() } = {}) {
  const src = legacyState && typeof legacyState === "object" ? legacyState : {};

  if (
    Number(src.schemaVersion) === CANONICAL_SCHEMA_VERSION
    && src.domains
    && typeof src.domains === "object"
  ) {
    const next = makeCanonicalState({ nowDate });
    next.revision = toFinite(src.revision, 0) || 0;
    next.updatedAt = cleanText(src.updatedAt) || nowIso(nowDate);
    CANONICAL_DOMAINS.forEach((domain) => {
      if (domain === "electionData") {
        next.domains.electionData = normalizeElectionDataSlice(src.domains.electionData, { nowDate });
      } else {
        const incoming = src.domains?.[domain];
        if (incoming && typeof incoming === "object") {
          next.domains[domain] = {
            ...next.domains[domain],
            ...clone(incoming),
          };
        }
      }
    });
    return next;
  }

  const next = makeCanonicalState({ nowDate });
  const ui = src.ui && typeof src.ui === "object" ? src.ui : {};
  const census = src.census && typeof src.census === "object" ? src.census : {};
  const targeting = src.targeting && typeof src.targeting === "object" ? src.targeting : {};
  const templateMeta = src.templateMeta && typeof src.templateMeta === "object" ? src.templateMeta : {};
  const warRoom = src.warRoom && typeof src.warRoom === "object" ? src.warRoom : {};
  const weather = warRoom.weather && typeof warRoom.weather === "object" ? warRoom.weather : {};
  const weatherAdjustment = warRoom.weatherAdjustment && typeof warRoom.weatherAdjustment === "object"
    ? warRoom.weatherAdjustment
    : {};
  const eventCalendar = warRoom.eventCalendar && typeof warRoom.eventCalendar === "object"
    ? warRoom.eventCalendar
    : {};

  next.domains.campaign = {
    ...next.domains.campaign,
    campaignId: cleanText(src.campaignId),
    campaignName: cleanText(src.campaignName),
    officeId: cleanText(src.officeId),
    scenarioName: cleanText(src.scenarioName),
  };

  next.domains.district = {
    ...next.domains.district,
    templateProfile: {
      ...next.domains.district.templateProfile,
      raceType: cleanText(src.raceType) || next.domains.district.templateProfile.raceType,
      officeLevel: cleanText(templateMeta.officeLevel),
      electionType: cleanText(templateMeta.electionType),
      seatContext: cleanText(templateMeta.seatContext),
      partisanshipMode: cleanText(templateMeta.partisanshipMode),
      salienceLevel: cleanText(templateMeta.salienceLevel),
      appliedTemplateId: cleanText(templateMeta.appliedTemplateId),
      appliedVersion: cleanText(templateMeta.appliedVersion),
      benchmarkKey: cleanText(templateMeta.benchmarkKey),
      overriddenFields: asArray(templateMeta.overriddenFields).map((field) => cleanText(field)).filter(Boolean),
      assumptionsProfile: cleanText(ui.assumptionsProfile) || "template",
    },
    form: {
      ...next.domains.district.form,
      electionDate: cleanText(src.electionDate),
      weeksRemaining: cleanText(src.weeksRemaining),
      mode: cleanText(src.mode) || "persuasion",
      universeBasis: cleanText(src.universeBasis) || "registered",
      universeSize: toFinite(src.universeSize, null),
      sourceNote: cleanText(src.sourceNote),
      turnoutA: toFinite(src.turnoutA, null),
      turnoutB: toFinite(src.turnoutB, null),
      bandWidth: toFinite(src.bandWidth, null),
    },
    universeComposition: {
      ...next.domains.district.universeComposition,
      enabled: toBool(src.universeLayerEnabled),
      demPct: toFinite(src.universeDemPct, null),
      repPct: toFinite(src.universeRepPct, null),
      npaPct: toFinite(src.universeNpaPct, null),
      otherPct: toFinite(src.universeOtherPct, null),
      retentionFactor: toFinite(src.retentionFactor, null),
    },
  };

  next.domains.assumptions = {
    ...next.domains.assumptions,
    persuasionPct: toFinite(src.persuasionPct, null),
    earlyVoteExp: toFinite(src.earlyVoteExp, null),
    goalSupportIds: toFinite(src.goalSupportIds, null),
    supportRatePct: toFinite(src.supportRatePct, null),
    contactRatePct: toFinite(src.contactRatePct, null),
    turnoutReliabilityPct: toFinite(src.turnoutReliabilityPct, null),
    turnout: {
      ...next.domains.assumptions.turnout,
      enabled: toBool(src.turnoutEnabled),
      baselinePct: toFinite(src.turnoutBaselinePct, 55) || 55,
      targetOverridePct: toFinite(src.turnoutTargetOverridePct, null),
      gotvMode: cleanText(src.gotvMode) || "basic",
      gotvLiftPP: toFinite(src.gotvLiftPP, 1) || 1,
      gotvMaxLiftPP: toFinite(src.gotvMaxLiftPP, null),
      gotvDiminishing: toBool(src.gotvDiminishing),
      gotvLiftMin: toFinite(src.gotvLiftMin, 0.5) || 0.5,
      gotvLiftMode: toFinite(src.gotvLiftMode, 1) || 1,
      gotvLiftMax: toFinite(src.gotvLiftMax, 2) || 2,
      gotvMaxLiftPP2: toFinite(src.gotvMaxLiftPP2, 10) || 10,
    },
  };

  const normalizedBallot = normalizeBallotCandidates(src.candidates, src.userSplit);
  next.domains.ballot = {
    ...next.domains.ballot,
    yourCandidateId: cleanText(src.yourCandidateId) || normalizedBallot.candidateRefs.order[0] || "",
    undecidedPct: toFinite(src.undecidedPct, 30) || 30,
    undecidedMode: cleanText(src.undecidedMode) || "proportional",
    candidateRefs: normalizedBallot.candidateRefs,
    userSplitByCandidateId: normalizedBallot.userSplitByCandidateId,
  };

  const historyRecords = normalizeCandidateHistoryRecords(src.candidateHistory);
  next.domains.candidateHistory = {
    ...next.domains.candidateHistory,
    records: historyRecords,
    matchedRecordCount: historyRecords.length,
  };

  next.domains.targeting = {
    ...next.domains.targeting,
    config: {
      ...next.domains.targeting.config,
      presetId: cleanText(targeting.presetId || targeting.modelId) || next.domains.targeting.config.presetId,
      geoLevel: cleanText(targeting.geoLevel) || next.domains.targeting.config.geoLevel,
      modelId: cleanText(targeting.modelId) || next.domains.targeting.config.modelId,
      topN: toFinite(targeting.topN, next.domains.targeting.config.topN) || next.domains.targeting.config.topN,
      minHousingUnits: toFinite(targeting.minHousingUnits, next.domains.targeting.config.minHousingUnits)
        || next.domains.targeting.config.minHousingUnits,
      minPopulation: toFinite(targeting.minPopulation, next.domains.targeting.config.minPopulation)
        || next.domains.targeting.config.minPopulation,
      minScore: toFinite(targeting.minScore, next.domains.targeting.config.minScore)
        || next.domains.targeting.config.minScore,
      onlyRaceFootprint: toBool(targeting.onlyRaceFootprint),
      controlsLocked: toBool(targeting.controlsLocked),
    },
    criteria: {
      ...next.domains.targeting.criteria,
      prioritizeYoung: toBool(targeting?.criteria?.prioritizeYoung),
      prioritizeRenters: toBool(targeting?.criteria?.prioritizeRenters),
      avoidHighMultiUnit: toBool(targeting?.criteria?.avoidHighMultiUnit),
      densityFloor: cleanText(targeting?.criteria?.densityFloor) || next.domains.targeting.criteria.densityFloor,
    },
    weights: {
      ...next.domains.targeting.weights,
      votePotential: toFinite(targeting?.weights?.votePotential, next.domains.targeting.weights.votePotential)
        || next.domains.targeting.weights.votePotential,
      turnoutOpportunity: toFinite(targeting?.weights?.turnoutOpportunity, next.domains.targeting.weights.turnoutOpportunity)
        || next.domains.targeting.weights.turnoutOpportunity,
      persuasionIndex: toFinite(targeting?.weights?.persuasionIndex, next.domains.targeting.weights.persuasionIndex)
        || next.domains.targeting.weights.persuasionIndex,
      fieldEfficiency: toFinite(targeting?.weights?.fieldEfficiency, next.domains.targeting.weights.fieldEfficiency)
        || next.domains.targeting.weights.fieldEfficiency,
    },
    runtime: {
      statusText: cleanText(census.status) || next.domains.targeting.runtime.statusText,
      meta: clone(targeting.lastMeta || {}),
      rows: asArray(targeting.lastRows).map((row) => clone(row)),
      lastRunAt: cleanText(targeting.lastRun || targeting?.lastMeta?.ranAt),
    },
  };

  next.domains.census = {
    ...next.domains.census,
    config: {
      ...next.domains.census.config,
      year: cleanText(census.year) || next.domains.census.config.year,
      resolution: cleanText(census.resolution) || next.domains.census.config.resolution,
      metricSet: cleanText(census.metricSet) || next.domains.census.config.metricSet,
      stateFips: cleanText(census.stateFips),
      countyFips: cleanText(census.countyFips),
      placeFips: cleanText(census.placeFips),
      geoSearch: cleanText(census.geoSearch),
      tractFilter: cleanText(census.tractFilter),
      selectionSetDraftName: cleanText(census.selectionSetDraftName),
      selectedSelectionSetKey: cleanText(census.selectedSelectionSetKey),
      applyAdjustedAssumptions: toBool(census.applyAdjustedAssumptions),
      mapQaVtdOverlay: toBool(census.mapQaVtdOverlay),
      apiKey: cleanText(census.bridgeApiKey),
      geoPaste: cleanText(census.bridgeGeoPaste),
    },
    selection: {
      ...next.domains.census.selection,
      geoOptions: asArray(census.geoOptions).map((row) => clone(row)),
      selectedGeoids: asArray(census.selectedGeoids).map((id) => cleanText(id)).filter(Boolean),
      rowsByGeoid: clone(census.rowsByGeoid || {}),
      activeRowsKey: cleanText(census.activeRowsKey),
      loadedRowCount: toFinite(census.loadedRowCount, 0) || 0,
      stateOptions: asArray(census.bridgeStateOptions).map((row) => clone(row)),
      countyOptions: asArray(census.bridgeCountyOptions).map((row) => clone(row)),
      placeOptions: asArray(census.bridgePlaceOptions).map((row) => clone(row)),
      tractFilterOptions: asArray(census.bridgeTractFilterOptions).map((row) => clone(row)),
      selectionSetOptions: asArray(census.bridgeSelectionSetOptions).map((row) => clone(row)),
      geoSelectOptions: asArray(census.bridgeGeoSelectOptions).map((row) => clone(row)),
    },
    runtime: {
      ...next.domains.census.runtime,
      statusText: cleanText(census.status) || "Ready.",
      errorText: cleanText(census.error),
      lastFetchAt: cleanText(census.lastFetchAt),
      aggregateRows: asArray(census.bridgeAggregateRows).map((row) => clone(row)),
      advisoryRows: asArray(census.bridgeAdvisoryRows).map((row) => clone(row)),
      mapStatusText: cleanText(census.bridgeMapStatusText),
      mapQaVtdZipStatusText: cleanText(census.bridgeMapQaVtdZipStatusText),
    },
  };

  const legacyElectionData = src.electionData && typeof src.electionData === "object"
    ? src.electionData
    : coerceLegacyElectionPreviewRows(census);
  next.domains.electionData = normalizeElectionDataSlice(legacyElectionData, { nowDate });

  next.domains.outcome = {
    ...next.domains.outcome,
    controls: {
      ...next.domains.outcome.controls,
      mcMode: cleanText(src.mcMode) || next.domains.outcome.controls.mcMode,
      mcVolatility: cleanText(src.mcVolatility) || next.domains.outcome.controls.mcVolatility,
      mcSeed: cleanText(src.mcSeed),
      turnoutReliabilityPct: toFinite(src.turnoutReliabilityPct, null),
      mcContactMin: toFinite(src.mcContactMin, null),
      mcContactMode: toFinite(src.mcContactMode, null),
      mcContactMax: toFinite(src.mcContactMax, null),
      mcPersMin: toFinite(src.mcPersMin, null),
      mcPersMode: toFinite(src.mcPersMode, null),
      mcPersMax: toFinite(src.mcPersMax, null),
      mcReliMin: toFinite(src.mcReliMin, null),
      mcReliMode: toFinite(src.mcReliMode, null),
      mcReliMax: toFinite(src.mcReliMax, null),
      mcDphMin: toFinite(src.mcDphMin, null),
      mcDphMode: toFinite(src.mcDphMode, null),
      mcDphMax: toFinite(src.mcDphMax, null),
      mcCphMin: toFinite(src.mcCphMin, null),
      mcCphMode: toFinite(src.mcCphMode, null),
      mcCphMax: toFinite(src.mcCphMax, null),
      mcVolMin: toFinite(src.mcVolMin, null),
      mcVolMode: toFinite(src.mcVolMode, null),
      mcVolMax: toFinite(src.mcVolMax, null),
    },
    cache: {
      ...next.domains.outcome.cache,
      mcLast: clone(src.mcLast || null),
      mcLastHash: cleanText(src.mcLastHash),
      sensitivityRows: asArray(ui.lastOutcomeSensitivityRows).map((row) => clone(row)),
      surfaceInputs: {
        ...next.domains.outcome.cache.surfaceInputs,
        ...(ui.outcomeSurfaceInputs && typeof ui.outcomeSurfaceInputs === "object" ? ui.outcomeSurfaceInputs : {}),
      },
      surfaceRows: asArray(ui.lastOutcomeSurfaceRows).map((row) => clone(row)),
      surfaceStatusText: cleanText(ui.lastOutcomeSurfaceStatus),
      surfaceSummaryText: cleanText(ui.lastOutcomeSurfaceSummary),
    },
  };

  next.domains.fieldCapacity = {
    ...next.domains.fieldCapacity,
    orgCount: toFinite(src.orgCount, next.domains.fieldCapacity.orgCount) || next.domains.fieldCapacity.orgCount,
    orgHoursPerWeek: toFinite(src.orgHoursPerWeek, next.domains.fieldCapacity.orgHoursPerWeek)
      || next.domains.fieldCapacity.orgHoursPerWeek,
    volunteerMultBase: toFinite(src.volunteerMultBase, next.domains.fieldCapacity.volunteerMultBase)
      || next.domains.fieldCapacity.volunteerMultBase,
    channelDoorPct: toFinite(src.channelDoorPct, null),
    doorsPerHour3: toFinite(src.doorsPerHour3, null),
    callsPerHour3: toFinite(src.callsPerHour3, null),
    doorsPerHourLegacy: toFinite(src.doorsPerHour, next.domains.fieldCapacity.doorsPerHourLegacy)
      || next.domains.fieldCapacity.doorsPerHourLegacy,
    hoursPerShift: toFinite(src.hoursPerShift, next.domains.fieldCapacity.hoursPerShift)
      || next.domains.fieldCapacity.hoursPerShift,
    shiftsPerVolunteerPerWeek: toFinite(src.shiftsPerVolunteerPerWeek, next.domains.fieldCapacity.shiftsPerVolunteerPerWeek)
      || next.domains.fieldCapacity.shiftsPerVolunteerPerWeek,
    timeline: {
      ...next.domains.fieldCapacity.timeline,
      enabled: toBool(src.timelineEnabled),
      activeWeeks: toFinite(src.timelineActiveWeeks, null),
      gotvWeeks: toFinite(src.timelineGotvWeeks, null),
      staffCount: toFinite(src.timelineStaffCount, 0) || 0,
      staffHours: toFinite(src.timelineStaffHours, 40) || 40,
      volCount: toFinite(src.timelineVolCount, 0) || 0,
      volHours: toFinite(src.timelineVolHours, 4) || 4,
      rampEnabled: toBool(src.timelineRampEnabled),
      rampMode: cleanText(src.timelineRampMode),
      doorsPerHour: toFinite(src.timelineDoorsPerHour, 30) || 30,
      callsPerHour: toFinite(src.timelineCallsPerHour, 20) || 20,
      textsPerHour: toFinite(src.timelineTextsPerHour, 120) || 120,
    },
  };

  next.domains.weatherRisk = {
    ...next.domains.weatherRisk,
    officeZip: cleanText(weather.officeZip),
    overrideZip: cleanText(weather.overrideZip),
    useOverrideZip: toBool(weather.useOverrideZip),
    selectedZip: cleanText(weather.selectedZip),
    status: cleanText(weather.status) || "idle",
    error: cleanText(weather.error),
    fetchedAt: cleanText(weather.fetchedAt),
    current: clone(weather.current || null),
    forecast3d: asArray(weather.forecast3d).map((row) => clone(row)),
    fieldExecutionRisk: cleanText(weather.fieldExecutionRisk) || "low",
    electionDayTurnoutRisk: cleanText(weather.electionDayTurnoutRisk) || "low",
    recommendedAction: cleanText(weather.recommendedAction),
    precipSignal: toFinite(weather.precipSignal, 0) || 0,
    adjustment: {
      ...next.domains.weatherRisk.adjustment,
      enabled: toBool(weatherAdjustment.enabled),
      mode: cleanText(weatherAdjustment.mode) || "observe_only",
      date: cleanText(weatherAdjustment.date),
      zip: cleanText(weatherAdjustment.zip),
      modifiers: {
        ...next.domains.weatherRisk.adjustment.modifiers,
        ...(weatherAdjustment.modifiers && typeof weatherAdjustment.modifiers === "object" ? weatherAdjustment.modifiers : {}),
      },
      appliedAt: cleanText(weatherAdjustment.appliedAt),
      log: asArray(warRoom.weatherAdjustmentLog).map((row) => clone(row)),
    },
  };

  next.domains.eventCalendar = {
    ...next.domains.eventCalendar,
    version: cleanText(eventCalendar.version) || next.domains.eventCalendar.version,
    filters: {
      ...next.domains.eventCalendar.filters,
      ...(eventCalendar.filters && typeof eventCalendar.filters === "object" ? eventCalendar.filters : {}),
    },
    draft: {
      ...next.domains.eventCalendar.draft,
      ...(eventCalendar.draft && typeof eventCalendar.draft === "object" ? eventCalendar.draft : {}),
    },
    events: asArray(eventCalendar.events).map((row) => clone(row)),
    statusSummary: {
      totalEvents: asArray(eventCalendar.events).length,
      appliedEvents: asArray(eventCalendar.events).filter((row) => toBool(row?.applyToModel)).length,
      openFollowUps: asArray(eventCalendar.events).filter((row) => cleanText(row?.status) !== "closed").length,
    },
  };

  next.domains.forecastArchive = {
    ...next.domains.forecastArchive,
    selectedHash: cleanText(ui.forecastArchiveSelectedHash),
    entries: asArray(src?.forecastArchive?.entries).map((row) => clone(row)),
    summary: {
      ...next.domains.forecastArchive.summary,
      ...(src?.forecastArchive?.summary && typeof src.forecastArchive.summary === "object" ? src.forecastArchive.summary : {}),
    },
  };

  next.domains.recovery = {
    ...next.domains.recovery,
    strictImport: toBool(ui.strictImport),
    lastImportFileName: cleanText(ui.lastImportFileName),
    lastWarning: cleanText(ui.lastImportWarning),
    lastHashBanner: cleanText(ui.lastImportHashBanner),
  };

  next.domains.governance = {
    ...next.domains.governance,
    snapshot: clone(ui.lastGovernanceSnapshot || null),
    confidenceBand: cleanText(ui?.lastGovernanceSnapshot?.confidenceBand),
    topWarning: cleanText(ui?.lastGovernanceSnapshot?.topWarning),
    learningRecommendation: cleanText(ui?.lastGovernanceSnapshot?.learningRecommendation),
  };

  next.domains.scenarios = {
    ...next.domains.scenarios,
    activeScenarioId: cleanText(ui.activeScenarioId) || "baseline",
    selectedScenarioId: cleanText(ui.scenarioUiSelectedId) || cleanText(ui.activeScenarioId) || "baseline",
    records: clone(ui.scenarios || {}),
    decisionSessions: clone(ui?.decision?.sessions || {}),
  };

  next.domains.audit = {
    ...next.domains.audit,
    validationSnapshot: clone(ui.lastValidationSnapshot || null),
    realismSnapshot: clone(ui.lastRealismSnapshot || null),
    diagnosticsSnapshot: clone(ui.lastDiagnostics || null),
    contractFindings: asArray(ui.contractFindings).map((row) => clone(row)),
  };

  next.domains.ui = {
    ...next.domains.ui,
    activeStage: cleanText(ui.activeStage) || next.domains.ui.activeStage,
    activeTab: cleanText(ui.activeTab) || next.domains.ui.activeTab,
    playbookEnabled: toBool(ui.playbook),
    trainingEnabled: toBool(ui.training),
    assumptionsProfile: cleanText(ui.assumptionsProfile) || next.domains.ui.assumptionsProfile,
    themeMode: cleanText(ui.themeMode) || next.domains.ui.themeMode,
    dark: toBool(ui.dark),
    advDiag: toBool(ui.advDiag),
    rightRailMode: cleanText(ui.rightRailMode) || next.domains.ui.rightRailMode,
  };

  next.revision = toFinite(src.revision, 0) || 0;
  next.updatedAt = nowIso(nowDate);
  return next;
}

export const FIELD_OWNERSHIP_REGISTRY = Object.freeze([
  { field: "campaign.campaignId", domain: "campaign" },
  { field: "campaign.campaignName", domain: "campaign" },
  { field: "campaign.officeId", domain: "campaign" },
  { field: "campaign.scenarioName", domain: "campaign" },

  { field: "district.templateProfile.raceType", domain: "district" },
  { field: "district.templateProfile.officeLevel", domain: "district" },
  { field: "district.templateProfile.electionType", domain: "district" },
  { field: "district.templateProfile.seatContext", domain: "district" },
  { field: "district.templateProfile.partisanshipMode", domain: "district" },
  { field: "district.templateProfile.salienceLevel", domain: "district" },
  { field: "district.form.electionDate", domain: "district" },
  { field: "district.form.weeksRemaining", domain: "district" },
  { field: "district.form.mode", domain: "district" },
  { field: "district.form.universeBasis", domain: "district" },
  { field: "district.form.universeSize", domain: "district" },
  { field: "district.form.sourceNote", domain: "district" },
  { field: "district.form.turnoutA", domain: "district" },
  { field: "district.form.turnoutB", domain: "district" },
  { field: "district.form.bandWidth", domain: "district" },

  { field: "assumptions.persuasionPct", domain: "assumptions" },
  { field: "assumptions.earlyVoteExp", domain: "assumptions" },
  { field: "assumptions.goalSupportIds", domain: "assumptions" },
  { field: "assumptions.supportRatePct", domain: "assumptions" },
  { field: "assumptions.contactRatePct", domain: "assumptions" },
  { field: "assumptions.turnout.enabled", domain: "assumptions" },
  { field: "assumptions.turnout.baselinePct", domain: "assumptions" },
  { field: "assumptions.turnout.targetOverridePct", domain: "assumptions" },
  { field: "assumptions.turnout.gotvMode", domain: "assumptions" },

  { field: "ballot.yourCandidateId", domain: "ballot" },
  { field: "ballot.undecidedPct", domain: "ballot" },
  { field: "ballot.undecidedMode", domain: "ballot" },
  { field: "ballot.candidateRefs", domain: "ballot" },
  { field: "ballot.userSplitByCandidateId", domain: "ballot" },

  { field: "candidateHistory.records", domain: "candidateHistory" },

  { field: "targeting.config", domain: "targeting" },
  { field: "targeting.criteria", domain: "targeting" },
  { field: "targeting.weights", domain: "targeting" },
  { field: "targeting.runtime.rows", domain: "targeting" },

  { field: "census.config", domain: "census" },
  { field: "census.selection", domain: "census" },
  { field: "census.runtime", domain: "census" },

  { field: "electionData.import.fileName", domain: "electionData" },
  { field: "electionData.import.fileSize", domain: "electionData" },
  { field: "electionData.import.fileHash", domain: "electionData" },
  { field: "electionData.import.importedAt", domain: "electionData" },
  { field: "electionData.import.format", domain: "electionData" },
  { field: "electionData.schemaMapping.columnMap", domain: "electionData" },
  { field: "electionData.rawRows", domain: "electionData" },
  { field: "electionData.normalizedRows", domain: "electionData" },
  { field: "electionData.jurisdictionKeys", domain: "electionData" },
  { field: "electionData.geographyRefs", domain: "electionData" },
  { field: "electionData.raceMeta", domain: "electionData" },
  { field: "electionData.candidateRefs", domain: "electionData" },
  { field: "electionData.partyRefs", domain: "electionData" },
  { field: "electionData.turnoutTotals", domain: "electionData" },
  { field: "electionData.voteTotals", domain: "electionData" },
  { field: "electionData.qa", domain: "electionData" },
  { field: "electionData.quality", domain: "electionData" },
  { field: "electionData.benchmarks.historicalRaceBenchmarks", domain: "electionData" },
  { field: "electionData.benchmarks.turnoutBaselines", domain: "electionData" },
  { field: "electionData.benchmarks.volatilityBands", domain: "electionData" },
  { field: "electionData.benchmarks.partyBaselineContext", domain: "electionData" },
  { field: "electionData.benchmarks.comparableRacePools", domain: "electionData" },
  { field: "electionData.benchmarks.repeatCandidatePerformance", domain: "electionData" },
  { field: "electionData.benchmarks.precinctPerformanceDistributions", domain: "electionData" },
  { field: "electionData.benchmarks.geographyRollups", domain: "electionData" },
  { field: "electionData.benchmarks.benchmarkSuggestions", domain: "electionData" },
  { field: "electionData.benchmarks.downstreamRecommendations", domain: "electionData" },

  { field: "outcome.controls", domain: "outcome" },
  { field: "outcome.cache", domain: "outcome" },

  { field: "fieldCapacity.orgCount", domain: "fieldCapacity" },
  { field: "fieldCapacity.orgHoursPerWeek", domain: "fieldCapacity" },
  { field: "fieldCapacity.volunteerMultBase", domain: "fieldCapacity" },
  { field: "fieldCapacity.channelDoorPct", domain: "fieldCapacity" },
  { field: "fieldCapacity.doorsPerHour3", domain: "fieldCapacity" },
  { field: "fieldCapacity.callsPerHour3", domain: "fieldCapacity" },
  { field: "fieldCapacity.timeline", domain: "fieldCapacity" },

  { field: "weatherRisk", domain: "weatherRisk" },
  { field: "eventCalendar", domain: "eventCalendar" },
  { field: "forecastArchive", domain: "forecastArchive" },
  { field: "recovery", domain: "recovery" },
  { field: "governance", domain: "governance" },
  { field: "scenarios", domain: "scenarios" },
  { field: "audit", domain: "audit" },
  { field: "ui", domain: "ui" },
]);

export function findDuplicateFieldOwnership(registry = FIELD_OWNERSHIP_REGISTRY) {
  const seen = new Map();
  /** @type {Array<{ field: string, domains: string[] }>} */
  const duplicates = [];

  asArray(registry).forEach((row) => {
    const field = cleanText(row?.field);
    const domain = cleanText(row?.domain);
    if (!field || !domain) return;

    if (!seen.has(field)) {
      seen.set(field, new Set([domain]));
      return;
    }

    const domains = seen.get(field);
    domains.add(domain);
  });

  for (const [field, domains] of seen.entries()) {
    if (domains.size > 1) {
      duplicates.push({ field, domains: Array.from(domains).sort() });
    }
  }

  duplicates.sort((a, b) => a.field.localeCompare(b.field));
  return duplicates;
}

export function summarizeDomainOwnership(registry = FIELD_OWNERSHIP_REGISTRY) {
  /** @type {Record<string, string[]>} */
  const map = {};
  CANONICAL_DOMAINS.forEach((domain) => {
    map[domain] = [];
  });

  asArray(registry).forEach((row) => {
    const field = cleanText(row?.field);
    const domain = cleanText(row?.domain);
    if (!field || !domain) return;
    if (!map[domain]) map[domain] = [];
    map[domain].push(field);
  });

  Object.keys(map).forEach((domain) => {
    map[domain] = Array.from(new Set(map[domain])).sort();
  });
  return map;
}
