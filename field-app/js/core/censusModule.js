export const CENSUS_LOCAL_KEY = "fpe.census.apiKey";
export const CENSUS_DEFAULT_API_KEY = "a59d216d186bced9d252633906350432d2805c74";

const ELECTION_CSV_BASE_COLUMNS = [
  "state_fips",
  "county_fips",
  "election_date",
  "office",
  "district_id",
  "precinct_id",
];

const ELECTION_CSV_LONG_COLUMNS = [
  ...ELECTION_CSV_BASE_COLUMNS,
  "candidate",
  "votes",
];

const ELECTION_CSV_OPTIONAL_COLUMNS = [
  "party",
  "total_votes_precinct",
  "registered_voters",
  "source",
  "notes",
];

function canonicalCsvKey(value){
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const ELECTION_CSV_ALIAS_GROUPS = {
  state_fips: ["state_fips", "statefips"],
  county_fips: ["county_fips", "countyfips"],
  election_date: ["election_date", "electiondate"],
  office: ["office", "contestname"],
  district_id: ["district_id", "districtid", "eiscontestid", "contestid"],
  precinct_id: ["precinct_id", "precinctid", "precinctname"],
  candidate: ["candidate", "candidatename"],
  votes: ["votes", "votecount"],
  party: ["party", "partyname"],
  total_votes_precinct: ["total_votes_precinct", "totalvotesprecinct"],
  registered_voters: ["registered_voters", "registeredvoters", "registered", "registration"],
  source: ["source"],
  notes: ["notes"],
  ignored_meta: ["jurisdictionid", "juriscontainerid", "jurisname", "eiscandidateid", "eispartyid"],
};

const ELECTION_CSV_ALIAS_CANONICAL = Object.fromEntries(
  Object.entries(ELECTION_CSV_ALIAS_GROUPS).map(([key, values]) => [key, values.map((value) => canonicalCsvKey(value))]),
);

const ELECTION_CSV_RESERVED_CANONICAL_COLUMNS = new Set(
  Object.values(ELECTION_CSV_ALIAS_CANONICAL).flat(),
);

const YEARS_FLOOR = 2016;

const RESOLUTION_OPTIONS = [
  { id: "place", label: "Place" },
  { id: "tract", label: "Tract" },
  { id: "block_group", label: "Block group" },
];

const METRIC_SET_OPTIONS = [
  { id: "core", label: "Core" },
  { id: "demographics", label: "Demographics" },
  { id: "housing", label: "Housing" },
  { id: "income", label: "Income" },
  { id: "education", label: "Education" },
  { id: "language", label: "Language" },
  { id: "all", label: "All bundles" },
];

const METRICS = {
  population_total: {
    id: "population_total",
    label: "Population",
    kind: "sum",
    vars: ["B01003_001E"],
    sumVars: ["B01003_001E"],
    format: "int",
  },
  households_total: {
    id: "households_total",
    label: "Households",
    kind: "sum",
    vars: ["B11001_001E"],
    sumVars: ["B11001_001E"],
    format: "int",
  },
  housing_units_total: {
    id: "housing_units_total",
    label: "Housing units",
    kind: "sum",
    vars: ["B25001_001E"],
    sumVars: ["B25001_001E"],
    format: "int",
  },
  owner_occupied_share: {
    id: "owner_occupied_share",
    label: "Owner-occupied share",
    kind: "ratio",
    vars: ["B25003_002E", "B25003_001E"],
    numeratorVars: ["B25003_002E"],
    denominatorVars: ["B25003_001E"],
    format: "pct1",
  },
  renter_share: {
    id: "renter_share",
    label: "Renter share",
    kind: "ratio",
    vars: ["B25003_003E", "B25003_001E"],
    numeratorVars: ["B25003_003E"],
    denominatorVars: ["B25003_001E"],
    format: "pct1",
  },
  median_household_income_est: {
    id: "median_household_income_est",
    label: "Median HH income (est.)",
    kind: "weighted_mean",
    vars: ["B19013_001E", "B11001_001E"],
    valueVar: "B19013_001E",
    weightVar: "B11001_001E",
    format: "currency0",
  },
  white_share: {
    id: "white_share",
    label: "White share",
    kind: "ratio",
    vars: ["B02001_002E", "B02001_001E"],
    numeratorVars: ["B02001_002E"],
    denominatorVars: ["B02001_001E"],
    format: "pct1",
  },
  black_share: {
    id: "black_share",
    label: "Black share",
    kind: "ratio",
    vars: ["B02001_003E", "B02001_001E"],
    numeratorVars: ["B02001_003E"],
    denominatorVars: ["B02001_001E"],
    format: "pct1",
  },
  hispanic_share: {
    id: "hispanic_share",
    label: "Hispanic share",
    kind: "ratio",
    vars: ["B03003_003E", "B03003_001E"],
    numeratorVars: ["B03003_003E"],
    denominatorVars: ["B03003_001E"],
    format: "pct1",
  },
  ba_plus_share: {
    id: "ba_plus_share",
    label: "BA+ share",
    kind: "ratio",
    vars: [
      "B15003_022E",
      "B15003_023E",
      "B15003_024E",
      "B15003_025E",
      "B15003_001E",
    ],
    numeratorVars: ["B15003_022E", "B15003_023E", "B15003_024E", "B15003_025E"],
    denominatorVars: ["B15003_001E"],
    format: "pct1",
  },
  limited_english_share: {
    id: "limited_english_share",
    label: "Limited-English share",
    kind: "ratio",
    vars: ["C16002_004E", "C16002_007E", "C16002_010E", "C16002_013E", "C16002_001E"],
    numeratorVars: ["C16002_004E", "C16002_007E", "C16002_010E", "C16002_013E"],
    denominatorVars: ["C16002_001E"],
    format: "pct1",
  },
  multi_unit_share: {
    id: "multi_unit_share",
    label: "Multi-unit share",
    kind: "ratio",
    vars: [
      "B25024_003E",
      "B25024_004E",
      "B25024_005E",
      "B25024_006E",
      "B25024_007E",
      "B25024_008E",
      "B25024_009E",
      "B25024_010E",
      "B25024_011E",
      "B25024_001E",
    ],
    numeratorVars: [
      "B25024_003E",
      "B25024_004E",
      "B25024_005E",
      "B25024_006E",
      "B25024_007E",
      "B25024_008E",
      "B25024_009E",
      "B25024_010E",
      "B25024_011E",
    ],
    denominatorVars: ["B25024_001E"],
    format: "pct1",
  },
};

const METRIC_SET_MAP = {
  core: ["population_total", "households_total", "housing_units_total", "owner_occupied_share", "renter_share"],
  demographics: ["population_total", "white_share", "black_share", "hispanic_share"],
  housing: ["housing_units_total", "owner_occupied_share", "renter_share", "multi_unit_share"],
  income: ["median_household_income_est"],
  education: ["ba_plus_share"],
  language: ["limited_english_share"],
  all: Object.keys(METRICS),
};

const ALWAYS_ACS_VARIABLES = ["B01003_001E"];

const TIGER_BOUNDARY_LAYERS = {
  tract: [{ service: "Tracts_Blocks", layer: 10, field: "GEOID" }],
  block_group: [{ service: "Tracts_Blocks", layer: 11, field: "GEOID" }],
  place: [
    { service: "Places_CouSub_ConCity_SubMCD", layer: 4, field: "GEOID" },
    { service: "Places_CouSub_ConCity_SubMCD", layer: 5, field: "GEOID" },
  ],
};

const TIGER_BASE_URL = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb";
const TIGER_SERVICE_CATALOG_URL = `${TIGER_BASE_URL}?f=pjson`;
let tigerVtdLayerCache = null;

export function listResolutionOptions(){
  return RESOLUTION_OPTIONS.map((x) => ({ ...x }));
}

export function listMetricSetOptions(){
  return METRIC_SET_OPTIONS.map((x) => ({ ...x }));
}

export function listAcsYears(nowYear = new Date().getFullYear()){
  const max = Math.max(YEARS_FLOOR, Number(nowYear) - 2);
  const out = [];
  for (let y = max; y >= YEARS_FLOOR; y -= 1){
    out.push(String(y));
  }
  return out;
}

export function getMetricIdsForSet(metricSetId){
  const id = String(metricSetId || "core").trim();
  return Array.isArray(METRIC_SET_MAP[id]) ? METRIC_SET_MAP[id].slice() : METRIC_SET_MAP.core.slice();
}

export function getMetricsForSet(metricSetId){
  return getMetricIdsForSet(metricSetId)
    .map((id) => METRICS[id])
    .filter((row) => !!row)
    .map((row) => ({ ...row }));
}

export function getVariablesForMetricSet(metricSetId){
  const ids = getMetricIdsForSet(metricSetId);
  const uniq = new Set();
  for (const v of ALWAYS_ACS_VARIABLES){
    uniq.add(String(v));
  }
  for (const id of ids){
    const spec = METRICS[id];
    if (!spec) continue;
    for (const v of spec.vars || []) uniq.add(String(v));
  }
  return Array.from(uniq);
}

function cleanText(v){
  return String(v == null ? "" : v).trim();
}

function fips(v, len){
  const digits = cleanText(v).replace(/\D+/g, "");
  if (!digits) return "";
  return digits.padStart(len, "0").slice(-len);
}

function defaultYear(){
  const years = listAcsYears();
  return years[0] || "2024";
}

function normalizeGeoidsForResolutionInternal(geoids, resolution){
  const targetLen = geoidLengthForResolution(resolution);
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(geoids) ? geoids : []){
    const digits = cleanText(raw).replace(/\D+/g, "");
    if (digits.length !== targetLen || seen.has(digits)) continue;
    seen.add(digits);
    out.push(digits);
  }
  return out;
}

function normalizeSelectionSets(input){
  const rows = Array.isArray(input) ? input : [];
  const out = [];
  for (const raw of rows){
    const row = raw && typeof raw === "object" ? raw : null;
    if (!row) continue;
    const resolution = ["place", "tract", "block_group"].includes(String(row.resolution || "")) ? String(row.resolution) : "tract";
    const name = cleanText(row.name);
    const geoids = normalizeGeoidsForResolutionInternal(row.geoids, resolution);
    if (!name || !geoids.length) continue;
    out.push({
      name,
      resolution,
      stateFips: fips(row.stateFips, 2),
      countyFips: fips(row.countyFips, 3),
      placeFips: fips(row.placeFips, 5),
      geoids,
      updatedAt: cleanText(row.updatedAt),
    });
    if (out.length >= 50) break;
  }
  return out;
}

export function makeDefaultRaceFootprint(){
  return {
    source: "",
    year: "",
    resolution: "",
    metricSet: "",
    stateFips: "",
    countyFips: "",
    placeFips: "",
    geoids: [],
    rowCount: 0,
    rowsKey: "",
    fingerprint: "",
    updatedAt: "",
  };
}

export function normalizeRaceFootprint(input){
  const base = makeDefaultRaceFootprint();
  const src = input && typeof input === "object" ? input : {};
  const out = { ...base, ...src };
  out.source = cleanText(out.source);
  out.year = cleanText(out.year);
  const resolution = cleanText(out.resolution);
  out.resolution = ["place", "tract", "block_group"].includes(resolution) ? resolution : "";
  out.metricSet = METRIC_SET_MAP[String(out.metricSet || "")] ? String(out.metricSet) : "";
  out.stateFips = fips(out.stateFips, 2);
  out.countyFips = out.resolution === "place" ? "" : fips(out.countyFips, 3);
  out.placeFips = out.resolution === "place" ? fips(out.placeFips, 5) : "";
  out.geoids = out.resolution
    ? normalizeGeoidsForResolutionInternal(out.geoids, out.resolution).sort((a, b) => a.localeCompare(b))
    : [];
  out.rowCount = Number.isFinite(Number(out.rowCount)) ? Math.max(0, Math.floor(Number(out.rowCount))) : 0;
  out.rowsKey = cleanText(out.rowsKey);
  out.fingerprint = cleanText(out.fingerprint);
  out.updatedAt = cleanText(out.updatedAt);
  return out;
}

export function computeRaceFootprintFingerprint(input){
  const out = normalizeRaceFootprint(input);
  if (!out.resolution || !out.stateFips || !out.geoids.length) return "";
  return [
    out.year,
    out.resolution,
    out.metricSet,
    out.stateFips,
    out.countyFips,
    out.placeFips,
    out.geoids.join(","),
  ].join("|");
}

export function makeDefaultAssumptionProvenance(){
  return {
    source: "",
    raceFootprintFingerprint: "",
    censusRowsKey: "",
    acsYear: "",
    metricSet: "",
    generatedAt: "",
  };
}

export function normalizeAssumptionProvenance(input){
  const base = makeDefaultAssumptionProvenance();
  const src = input && typeof input === "object" ? input : {};
  const out = { ...base, ...src };
  out.source = cleanText(out.source);
  out.raceFootprintFingerprint = cleanText(out.raceFootprintFingerprint);
  out.censusRowsKey = cleanText(out.censusRowsKey);
  out.acsYear = cleanText(out.acsYear);
  out.metricSet = METRIC_SET_MAP[String(out.metricSet || "")] ? String(out.metricSet) : "";
  out.generatedAt = cleanText(out.generatedAt);
  return out;
}

export function makeDefaultFootprintCapacity(){
  return {
    source: "",
    population: null,
    year: "",
    metricSet: "",
    raceFootprintFingerprint: "",
    censusRowsKey: "",
    updatedAt: "",
  };
}

export function normalizeFootprintCapacity(input){
  const base = makeDefaultFootprintCapacity();
  const src = input && typeof input === "object" ? input : {};
  const out = { ...base, ...src };
  out.source = cleanText(out.source);
  const populationRaw = Number(out.population);
  out.population = Number.isFinite(populationRaw) && populationRaw >= 0 ? populationRaw : null;
  out.year = cleanText(out.year);
  out.metricSet = METRIC_SET_MAP[String(out.metricSet || "")] ? String(out.metricSet) : "";
  out.raceFootprintFingerprint = cleanText(out.raceFootprintFingerprint);
  out.censusRowsKey = cleanText(out.censusRowsKey);
  out.updatedAt = cleanText(out.updatedAt);
  return out;
}

export function buildRaceFootprintFromCensusSelection(censusState){
  const s = censusState && typeof censusState === "object" ? censusState : {};
  const resolution = cleanText(s.resolution);
  const geoids = ["place", "tract", "block_group"].includes(resolution)
    ? normalizeGeoidsForResolutionInternal(s.selectedGeoids, resolution).sort((a, b) => a.localeCompare(b))
    : [];
  const out = normalizeRaceFootprint({
    source: "census_phase1",
    year: cleanText(s.year),
    resolution,
    metricSet: cleanText(s.metricSet),
    stateFips: cleanText(s.stateFips),
    countyFips: cleanText(s.countyFips),
    placeFips: cleanText(s.placeFips),
    geoids,
    rowCount: Number.isFinite(Number(s.loadedRowCount)) ? Number(s.loadedRowCount) : 0,
    rowsKey: cleanText(s.activeRowsKey),
  });
  out.fingerprint = computeRaceFootprintFingerprint(out);
  return out;
}

export function assessRaceFootprintAlignment({ censusState, raceFootprint, assumptionsProvenance } = {}){
  const census = normalizeCensusState(censusState);
  const live = buildRaceFootprintFromCensusSelection(census);
  const storedRaw = normalizeRaceFootprint(raceFootprint);
  const stored = {
    ...storedRaw,
    fingerprint: cleanText(storedRaw.fingerprint) || computeRaceFootprintFingerprint(storedRaw),
  };
  const provenance = normalizeAssumptionProvenance(assumptionsProvenance);
  const footprintDefined = !!stored.fingerprint && Array.isArray(stored.geoids) && stored.geoids.length > 0;
  const selectionHasContext = !!live.fingerprint;
  const selectionMatches = footprintDefined && selectionHasContext && live.fingerprint === stored.fingerprint;
  const activeRowsKey = cleanText(census?.activeRowsKey) || cleanText(live.rowsKey) || cleanText(stored.rowsKey);
  const activeYear = cleanText(census?.year) || cleanText(live.year) || cleanText(stored.year);
  const activeMetricSet = cleanText(census?.metricSet) || cleanText(live.metricSet) || cleanText(stored.metricSet);
  const provenanceHasFingerprint = !!provenance.raceFootprintFingerprint;
  const provenanceHasRowsKey = !!provenance.censusRowsKey;
  const provenanceHasYear = !!provenance.acsYear;
  const provenanceHasMetricSet = !!provenance.metricSet;
  const provenanceFingerprintMatches = provenanceHasFingerprint && provenance.raceFootprintFingerprint === stored.fingerprint;
  const provenanceRowsKeyMatches = provenanceHasRowsKey && provenance.censusRowsKey === activeRowsKey;
  const provenanceYearMatches = provenanceHasYear && provenance.acsYear === activeYear;
  const provenanceMetricSetMatches = provenanceHasMetricSet && provenance.metricSet === activeMetricSet;
  const provenanceAligned = footprintDefined
    && provenanceFingerprintMatches
    && provenanceRowsKeyMatches
    && provenanceYearMatches
    && provenanceMetricSetMatches;
  let reason = "ready";
  if (!footprintDefined){
    reason = "footprint_not_set";
  } else if (!selectionHasContext){
    reason = "selection_context_missing";
  } else if (!selectionMatches){
    reason = "selection_mismatch";
  } else if (!provenanceHasFingerprint){
    reason = "provenance_not_set";
  } else if (!provenanceHasRowsKey){
    reason = "provenance_rows_not_set";
  } else if (!provenanceHasYear){
    reason = "provenance_year_not_set";
  } else if (!provenanceHasMetricSet){
    reason = "provenance_metric_set_not_set";
  } else if (!provenanceFingerprintMatches){
    reason = "provenance_footprint_mismatch";
  } else if (!provenanceRowsKeyMatches){
    reason = "provenance_rows_mismatch";
  } else if (!provenanceYearMatches){
    reason = "provenance_year_mismatch";
  } else if (!provenanceMetricSetMatches){
    reason = "provenance_metric_set_mismatch";
  }
  return {
    reason,
    readyForAssumptions: reason === "ready",
    footprintDefined,
    selectionHasContext,
    selectionMatches,
    provenanceAligned,
    live,
    stored,
    provenance,
  };
}

export function evaluateFootprintFeasibility({ state, res } = {}){
  const alignment = assessRaceFootprintAlignment({
    censusState: state?.census,
    raceFootprint: state?.raceFootprint,
    assumptionsProvenance: state?.assumptionsProvenance,
  });
  const capacity = normalizeFootprintCapacity(state?.footprintCapacity);
  const out = [];
  if (!alignment.footprintDefined){
    out.push({ kind: "warn", code: "footprint_not_set", text: "Race footprint not set. Use Census card to set canonical race boundary." });
    return { alignment, capacity, issues: out };
  }
  if (!alignment.selectionHasContext){
    out.push({ kind: "warn", code: "selection_context_missing", text: "Race footprint set, but Census selection context is missing." });
  } else if (!alignment.selectionMatches){
    out.push({ kind: "warn", code: "selection_mismatch", text: "Census selection differs from race footprint." });
  }
  if (!alignment.provenanceAligned){
    out.push({ kind: "warn", code: "provenance_stale", text: "Assumption provenance is stale or missing for current footprint." });
  }
  const pop = Number(capacity.population);
  const hasPopulation = Number.isFinite(pop) && pop > 0;
  const capacityStale = (
    (capacity.raceFootprintFingerprint && capacity.raceFootprintFingerprint !== alignment.stored.fingerprint) ||
    (capacity.censusRowsKey && capacity.censusRowsKey !== cleanText(state?.census?.activeRowsKey)) ||
    (capacity.year && capacity.year !== cleanText(state?.census?.year)) ||
    (capacity.metricSet && capacity.metricSet !== cleanText(state?.census?.metricSet))
  );
  if (!hasPopulation){
    out.push({ kind: "warn", code: "capacity_population_missing", text: "Footprint population capacity is missing. Re-set race footprint after ACS fetch." });
    return { alignment, capacity, issues: out };
  }
  if (capacityStale){
    out.push({ kind: "warn", code: "capacity_stale", text: "Footprint capacity is stale for current ACS year/bundle context." });
  }
  const universe = Number(res?.raw?.universeSize);
  if (Number.isFinite(universe) && universe > pop){
    out.push({ kind: "bad", code: "universe_exceeds_population", text: `Universe size (${Math.round(universe).toLocaleString("en-US")}) exceeds footprint population (${Math.round(pop).toLocaleString("en-US")}).` });
  }
  const turnoutVotes = Number(res?.expected?.turnoutVotes);
  if (Number.isFinite(turnoutVotes) && turnoutVotes > pop){
    out.push({ kind: "bad", code: "turnout_exceeds_population", text: `Turnout votes (${Math.round(turnoutVotes).toLocaleString("en-US")}) exceed footprint population (${Math.round(pop).toLocaleString("en-US")}).` });
  }
  const winThreshold = Number(res?.expected?.winThreshold);
  if (Number.isFinite(winThreshold) && winThreshold > pop){
    out.push({ kind: "bad", code: "threshold_exceeds_population", text: `Win threshold (${Math.round(winThreshold).toLocaleString("en-US")}) exceeds footprint population (${Math.round(pop).toLocaleString("en-US")}).` });
  }
  const needVotes = Number(res?.expected?.persuasionNeed);
  if (Number.isFinite(needVotes) && needVotes > pop){
    out.push({ kind: "bad", code: "need_exceeds_population", text: `Persuasion need (${Math.round(needVotes).toLocaleString("en-US")}) exceeds footprint population (${Math.round(pop).toLocaleString("en-US")}).` });
  }
  return { alignment, capacity, issues: out };
}

export function summarizeFootprintFeasibilityIssues(issues){
  const rows = Array.isArray(issues) ? issues : [];
  for (const row of rows){
    const text = cleanText(row?.text);
    if (!text) continue;
    if (cleanText(row?.kind) === "bad"){
      return { level: "bad", text };
    }
  }
  for (const row of rows){
    const text = cleanText(row?.text);
    if (!text) continue;
    return { level: "warn", text };
  }
  return { level: "ok", text: "" };
}

export function getElectionCsvUploadGuide(){
  const requiredColumns = ELECTION_CSV_LONG_COLUMNS.slice();
  const optionalColumns = ELECTION_CSV_OPTIONAL_COLUMNS.slice();
  const sampleRow = {
    state_fips: "17",
    county_fips: "031",
    election_date: "2024-11-05",
    office: "US House",
    district_id: "IL-07",
    precinct_id: "17-031-001A",
    candidate: "Candidate Name",
    party: "DEM",
    votes: "1245",
    total_votes_precinct: "3140",
    registered_voters: "4120",
    source: "County certified results",
    notes: "",
  };
  const wideSampleRow = {
    state_fips: "17",
    county_fips: "031",
    election_date: "2024-11-05",
    office: "US House",
    district_id: "IL-07",
    precinct_id: "17-031-001A",
    "Jane Candidate": "1245",
    "John Candidate": "1830",
    total_votes_precinct: "3140",
    registered_voters: "4120",
    source: "County certified results",
    notes: "",
  };
  return {
    schemaVersion: "election_results_csv.v1",
    baseColumns: ELECTION_CSV_BASE_COLUMNS.slice(),
    requiredColumns,
    optionalColumns,
    acceptedFormats: [
      {
        id: "long",
        label: "Long format",
        requiredColumns: ELECTION_CSV_LONG_COLUMNS.slice(),
      },
      {
        id: "wide",
        label: "Wide format",
        requiredColumns: ELECTION_CSV_BASE_COLUMNS.slice(),
        candidateColumnsRule: "One or more candidate-name columns, each containing non-negative integer vote counts.",
      },
    ],
    sampleRow,
    wideSampleRow,
    notes: [
      "Use either long format (candidate + votes columns) or wide format (candidate names as columns).",
      "All base columns must be present with exact names.",
      "votes, total_votes_precinct, and registered_voters must be non-negative integers.",
      "Long format accepts extra columns and ignores them.",
      "Wide format treats non-reserved columns as candidate columns; non-numeric values are skipped with warnings.",
      "Rows with invalid keys or values fail validation and are rejected.",
      "Import should run in dry-run mode first before commit.",
    ],
  };
}

function csvCell(value){
  const text = cleanText(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

export function parseCsvText(text, { maxRows = 250000 } = {}){
  const raw = String(text == null ? "" : text).replace(/^\uFEFF/, "");
  const errors = [];
  const warnings = [];
  if (!cleanText(raw)){
    return {
      ok: false,
      headers: [],
      rows: [],
      errors: ["CSV is empty."],
      warnings,
    };
  }
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let idx = 0;
  while (idx < raw.length){
    const ch = raw[idx];
    if (inQuotes){
      if (ch === "\""){
        const next = raw[idx + 1];
        if (next === "\""){
          field += "\"";
          idx += 2;
          continue;
        }
        inQuotes = false;
        idx += 1;
        continue;
      }
      field += ch;
      idx += 1;
      continue;
    }
    if (ch === "\""){
      inQuotes = true;
      idx += 1;
      continue;
    }
    if (ch === ","){
      row.push(field);
      field = "";
      idx += 1;
      continue;
    }
    if (ch === "\n" || ch === "\r"){
      row.push(field);
      rows.push(row);
      if (rows.length > maxRows){
        errors.push(`CSV exceeds max row limit (${Math.floor(Number(maxRows))}).`);
        break;
      }
      row = [];
      field = "";
      if (ch === "\r" && raw[idx + 1] === "\n"){
        idx += 2;
      } else {
        idx += 1;
      }
      continue;
    }
    field += ch;
    idx += 1;
  }
  if (inQuotes){
    errors.push("CSV parse error: unmatched quote.");
  } else if (field.length > 0 || row.length > 0){
    row.push(field);
    rows.push(row);
  }
  while (rows.length){
    const last = rows[rows.length - 1];
    if (Array.isArray(last) && last.every((value) => cleanText(value) === "")){
      rows.pop();
      continue;
    }
    break;
  }
  if (!rows.length){
    errors.push("CSV has no rows.");
    return { ok: false, headers: [], rows: [], errors, warnings };
  }
  const headerRaw = Array.isArray(rows[0]) ? rows[0] : [];
  const headers = headerRaw.map((value, colIdx) => {
    const key = cleanText(value);
    if (!key) return `__col_${colIdx + 1}`;
    return key;
  });
  const lowerSeen = new Set();
  const duplicateHeaders = [];
  for (const key of headers){
    const lower = canonicalCsvKey(key);
    if (lowerSeen.has(lower)){
      duplicateHeaders.push(key);
      continue;
    }
    lowerSeen.add(lower);
  }
  if (duplicateHeaders.length){
    errors.push(`CSV has duplicate header(s): ${duplicateHeaders.join(", ")}.`);
  }
  const outRows = [];
  for (let i = 1; i < rows.length; i += 1){
    const sourceRow = Array.isArray(rows[i]) ? rows[i] : [];
    if (sourceRow.every((value) => cleanText(value) === "")) continue;
    if (sourceRow.length > headers.length){
      const extra = sourceRow.slice(headers.length).some((value) => cleanText(value) !== "");
      if (extra){
        errors.push(`Row ${i}: has more columns than header.`);
        continue;
      }
    }
    const record = {};
    for (let col = 0; col < headers.length; col += 1){
      record[headers[col]] = sourceRow[col] == null ? "" : String(sourceRow[col]);
    }
    outRows.push(record);
  }
  if (!outRows.length && !errors.length){
    warnings.push("CSV has header but no data rows.");
  }
  return {
    ok: errors.length === 0,
    headers,
    rows: outRows,
    errors,
    warnings,
  };
}

export function buildElectionCsvTemplate(){
  const guide = getElectionCsvUploadGuide();
  const columns = [...guide.requiredColumns, ...guide.optionalColumns];
  const row = columns.map((key) => csvCell(guide.sampleRow?.[key]));
  return `${columns.map(csvCell).join(",")}\n${row.join(",")}\n`;
}

export function buildElectionCsvWideTemplate(){
  const guide = getElectionCsvUploadGuide();
  const wideKeys = Object.keys(guide.wideSampleRow || {});
  const columns = [...guide.baseColumns, ...wideKeys.filter((k) => !ELECTION_CSV_BASE_COLUMNS.includes(k))];
  const row = columns.map((key) => csvCell(guide.wideSampleRow?.[key]));
  return `${columns.map(csvCell).join(",")}\n${row.join(",")}\n`;
}

export function detectElectionCsvFormat(headers){
  const rawHeaders = Array.isArray(headers) ? headers : [];
  const normalized = [];
  const seen = new Set();
  const originalByCanonical = {};
  for (const raw of rawHeaders){
    const original = cleanText(raw);
    const canonical = canonicalCsvKey(original);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    normalized.push(canonical);
    originalByCanonical[canonical] = original;
  }
  const pick = (key) => {
    const aliases = ELECTION_CSV_ALIAS_CANONICAL[key] || [canonicalCsvKey(key)];
    for (const alias of aliases){
      if (seen.has(alias)) return alias;
    }
    return "";
  };
  const resolvedColumns = {};
  const canonicalKeys = [
    ...ELECTION_CSV_BASE_COLUMNS,
    "candidate",
    "votes",
    "party",
    "total_votes_precinct",
    "registered_voters",
    "source",
    "notes",
  ];
  for (const key of canonicalKeys){
    resolvedColumns[key] = pick(key);
  }
  const missingBaseColumns = ELECTION_CSV_BASE_COLUMNS.filter((key) => !resolvedColumns[key]);
  const hasLongColumns = !!resolvedColumns.candidate && !!resolvedColumns.votes;
  const candidateColumns = normalized.filter((key) => !ELECTION_CSV_RESERVED_CANONICAL_COLUMNS.has(key));
  let format = "invalid";
  if (hasLongColumns){
    format = "long";
  } else if (candidateColumns.length){
    format = "wide";
  }
  return {
    format,
    headers: normalized,
    originalByCanonical,
    resolvedColumns,
    candidateColumns,
    missingBaseColumns,
  };
}

function parseCsvNonNegativeInteger(value){
  const text = cleanText(value);
  if (!text) return null;
  const normalized = text.replace(/,/g, "");
  if (!/^\d+$/.test(normalized)) return Number.NaN;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return Number.NaN;
  return n;
}

function rowLookup(row){
  const src = row && typeof row === "object" ? row : {};
  const out = {};
  for (const [rawKey, rawValue] of Object.entries(src)){
    const key = canonicalCsvKey(rawKey);
    if (!key || Object.prototype.hasOwnProperty.call(out, key)) continue;
    out[key] = rawValue;
  }
  return out;
}

export function normalizeElectionCsvRows(rows, { headers, context } = {}){
  const list = Array.isArray(rows) ? rows : [];
  const headerList = Array.isArray(headers) && headers.length
    ? headers
    : (list.length ? Object.keys(list[0] || {}) : []);
  const detected = detectElectionCsvFormat(headerList);
  const contextRow = rowLookup(context && typeof context === "object" ? context : {});
  const errors = [];
  const warnings = [];
  const records = [];
  const MAX_DIAGNOSTICS = 200;
  let errorOverflow = 0;
  let warningOverflow = 0;
  const pushError = (msg) => {
    if (errors.length < MAX_DIAGNOSTICS){
      errors.push(msg);
    } else {
      errorOverflow += 1;
    }
  };
  const pushWarning = (msg) => {
    if (warnings.length < MAX_DIAGNOSTICS){
      warnings.push(msg);
    } else {
      warningOverflow += 1;
    }
  };
  const contextValue = (key) => {
    const aliases = ELECTION_CSV_ALIAS_CANONICAL[key] || [canonicalCsvKey(key)];
    for (const alias of aliases){
      const value = cleanText(contextRow[alias]);
      if (value) return value;
    }
    return "";
  };
  if (detected.format === "invalid"){
    if (!detected.resolvedColumns.candidate && !detected.candidateColumns.length){
      pushError("Schema requires candidate+votes columns (long) or candidate-name columns (wide).");
    } else {
      pushError("Could not detect election CSV format.");
    }
    return { ok: false, format: detected.format, detected, records, errors, warnings };
  }
  const missingBaseAfterContext = ELECTION_CSV_BASE_COLUMNS.filter((key) => !detected.resolvedColumns[key] && !contextValue(key));
  if (missingBaseAfterContext.length){
    pushError(`Missing required base columns: ${missingBaseAfterContext.join(", ")}.`);
    return { ok: false, format: detected.format, detected, records, errors, warnings };
  }
  let skippedSummaryRows = 0;
  const wideColumnStats = {};
  for (const key of detected.candidateColumns || []){
    wideColumnStats[key] = { numeric: 0, invalid: 0 };
  }
  let wideRowsWithoutVotes = 0;
  for (let i = 0; i < list.length; i += 1){
    const row = rowLookup(list[i]);
    const rowNum = i + 1;
    if (detected.format === "long"){
      const candidateProbe = cleanText(row[detected.resolvedColumns.candidate]);
      const officeProbe = cleanText(row[detected.resolvedColumns.office]);
      const districtProbe = cleanText(row[detected.resolvedColumns.district_id]);
      const districtIsEmptyOrZero = !districtProbe || /^0+$/.test(districtProbe);
      const officeIsEmptyOrZero = !officeProbe || /^0+$/.test(officeProbe);
      if (!candidateProbe && officeIsEmptyOrZero && districtIsEmptyOrZero){
        skippedSummaryRows += 1;
        continue;
      }
    }
    const common = {};
    let rowHasError = false;
    for (const key of ELECTION_CSV_BASE_COLUMNS){
      const rowValue = detected.resolvedColumns[key] ? row[detected.resolvedColumns[key]] : "";
      const value = cleanText(rowValue || contextValue(key));
      if (!value){
        pushError(`Row ${rowNum}: missing ${key}.`);
        rowHasError = true;
      }
      common[key] = value;
    }
    const party = cleanText(row[detected.resolvedColumns.party]);
    const source = cleanText(row[detected.resolvedColumns.source]);
    const notes = cleanText(row[detected.resolvedColumns.notes]);
    const totalVotesPrecinct = parseCsvNonNegativeInteger(row[detected.resolvedColumns.total_votes_precinct]);
    if (Number.isNaN(totalVotesPrecinct)){
      pushError(`Row ${rowNum}: total_votes_precinct must be a non-negative integer.`);
      rowHasError = true;
    }
    const registeredVoters = parseCsvNonNegativeInteger(row[detected.resolvedColumns.registered_voters]);
    if (Number.isNaN(registeredVoters)){
      pushError(`Row ${rowNum}: registered_voters must be a non-negative integer.`);
      rowHasError = true;
    }
    if (rowHasError) continue;
    if (detected.format === "long"){
      const candidate = cleanText(row[detected.resolvedColumns.candidate]);
      const votes = parseCsvNonNegativeInteger(row[detected.resolvedColumns.votes]);
      if (!candidate){
        pushWarning(`Row ${rowNum}: missing candidate; row skipped.`);
        continue;
      }
      if (votes == null || Number.isNaN(votes)){
        pushError(`Row ${rowNum}: votes must be a non-negative integer.`);
        continue;
      }
      records.push({
        ...common,
        candidate,
        party,
        votes,
        total_votes_precinct: totalVotesPrecinct,
        registered_voters: registeredVoters,
        source,
        notes,
      });
      continue;
    }
    const staged = [];
    for (const key of detected.candidateColumns){
      const parsedVotes = parseCsvNonNegativeInteger(row[key]);
      if (parsedVotes == null) continue;
      if (Number.isNaN(parsedVotes)){
        if (wideColumnStats[key]){
          wideColumnStats[key].invalid += 1;
        }
        continue;
      }
      if (wideColumnStats[key]){
        wideColumnStats[key].numeric += 1;
      }
      staged.push({
        ...common,
        candidate: cleanText(detected.originalByCanonical[key]) || key,
        party,
        votes: parsedVotes,
        total_votes_precinct: totalVotesPrecinct,
        registered_voters: registeredVoters,
        source,
        notes,
      });
    }
    if (rowHasError) continue;
    if (!staged.length){
      wideRowsWithoutVotes += 1;
      continue;
    }
    records.push(...staged);
  }
  if (detected.format === "wide"){
    for (const key of detected.candidateColumns){
      const stats = wideColumnStats[key] || { numeric: 0, invalid: 0 };
      if (!stats.invalid) continue;
      const label = cleanText(detected.originalByCanonical[key]) || key;
      if (!stats.numeric){
        pushWarning(`${label}: no numeric vote values found; column skipped (${stats.invalid.toLocaleString("en-US")} non-numeric cell(s)).`);
      } else {
        pushWarning(`${label}: ${stats.invalid.toLocaleString("en-US")} non-numeric cell(s) skipped.`);
      }
    }
    if (wideRowsWithoutVotes > 0){
      pushWarning(`${wideRowsWithoutVotes.toLocaleString("en-US")} row(s) had no numeric candidate vote values and were skipped.`);
    }
  }
  if (skippedSummaryRows > 0){
    pushWarning(`Skipped ${skippedSummaryRows.toLocaleString("en-US")} summary row(s) with no candidate/contest fields.`);
  }
  if (errorOverflow > 0){
    errors.push(`${errorOverflow.toLocaleString("en-US")} additional error(s) omitted.`);
  }
  if (warningOverflow > 0){
    warnings.push(`${warningOverflow.toLocaleString("en-US")} additional warning(s) omitted.`);
  }
  return {
    ok: errors.length === 0,
    format: detected.format,
    detected,
    records,
    errors,
    warnings,
    skippedSummaryRows,
  };
}

export function makeDefaultCensusState(){
  return {
    year: defaultYear(),
    resolution: "tract",
    metricSet: "core",
    stateFips: "",
    countyFips: "",
    placeFips: "",
    geoSearch: "",
    tractFilter: "",
    geoOptions: [],
    selectedGeoids: [],
    rowsByGeoid: {},
    activeRowsKey: "",
    loadedRowCount: 0,
    loadingGeo: false,
    loadingRows: false,
    status: "Ready.",
    error: "",
    lastFetchAt: "",
    variableCatalogYear: "",
    variableCatalogCount: 0,
    mapQaVtdOverlay: false,
    selectionSets: [],
    selectionSetDraftName: "",
    selectedSelectionSetKey: "",
    requestSeq: 0,
  };
}

export function normalizeCensusState(input, { resetRuntime = false } = {}){
  const base = makeDefaultCensusState();
  const src = input && typeof input === "object" ? input : {};
  const out = { ...base, ...src };
  const years = new Set(listAcsYears());
  out.year = years.has(String(out.year || "")) ? String(out.year) : base.year;
  const resolution = String(out.resolution || "");
  out.resolution = ["place", "tract", "block_group"].includes(resolution) ? resolution : "tract";
  out.metricSet = METRIC_SET_MAP[String(out.metricSet || "")] ? String(out.metricSet) : "core";
  out.stateFips = fips(out.stateFips, 2);
  out.countyFips = fips(out.countyFips, 3);
  out.placeFips = fips(out.placeFips, 5);
  out.geoSearch = cleanText(out.geoSearch);
  out.tractFilter = fips(out.tractFilter, 6);
  out.geoOptions = Array.isArray(out.geoOptions) ? out.geoOptions.map((row) => ({ ...row })) : [];
  out.selectedGeoids = Array.isArray(out.selectedGeoids)
    ? out.selectedGeoids.map((v) => cleanText(v)).filter((v) => !!v)
    : [];
  out.rowsByGeoid = {};
  out.activeRowsKey = resetRuntime ? "" : cleanText(out.activeRowsKey);
  out.loadedRowCount = resetRuntime
    ? 0
    : (Number.isFinite(Number(out.loadedRowCount)) ? Math.max(0, Math.floor(Number(out.loadedRowCount))) : 0);
  out.loadingGeo = !!out.loadingGeo;
  out.loadingRows = !!out.loadingRows;
  out.status = cleanText(out.status) || "Ready.";
  out.error = cleanText(out.error);
  out.lastFetchAt = cleanText(out.lastFetchAt);
  out.variableCatalogYear = cleanText(out.variableCatalogYear);
  out.variableCatalogCount = Number.isFinite(Number(out.variableCatalogCount)) ? Number(out.variableCatalogCount) : 0;
  out.mapQaVtdOverlay = !!out.mapQaVtdOverlay;
  out.selectionSets = normalizeSelectionSets(out.selectionSets);
  out.selectionSetDraftName = cleanText(out.selectionSetDraftName);
  out.selectedSelectionSetKey = cleanText(out.selectedSelectionSetKey);
  out.requestSeq = Number.isFinite(Number(out.requestSeq)) ? Number(out.requestSeq) : 0;
  if (out.resolution === "place"){
    out.countyFips = "";
    out.tractFilter = "";
  }
  if (!out.stateFips){
    out.countyFips = "";
    out.placeFips = "";
    out.geoSearch = "";
    out.tractFilter = "";
    out.geoOptions = [];
    out.selectedGeoids = [];
    out.rowsByGeoid = {};
  }
  return out;
}

function encodeGetVars(vars){
  const deduped = [];
  const seen = new Set();
  for (const v of vars || []){
    const key = cleanText(v);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(key);
  }
  if (!deduped.includes("NAME")) deduped.unshift("NAME");
  return deduped.join(",");
}

export function buildAcsQueryUrl({ year, getVars, forClause, inClauses = [], key, dataset = "acs/acs5" }){
  const y = cleanText(year);
  const vars = encodeGetVars(getVars || []);
  const forPart = cleanText(forClause);
  const inParts = Array.isArray(inClauses)
    ? inClauses.map((v) => cleanText(v)).filter((v) => !!v)
    : [];
  const token = cleanText(key);
  const params = [];
  params.push(`get=${encodeURIComponent(vars)}`);
  params.push(`for=${encodeURIComponent(forPart)}`);
  for (const part of inParts){
    params.push(`in=${encodeURIComponent(part)}`);
  }
  if (token) params.push(`key=${encodeURIComponent(token)}`);
  return `https://api.census.gov/data/${encodeURIComponent(y)}/${dataset}?${params.join("&")}`;
}

export function buildGeoLookupUrl({ stateFips, scope, year = "2020", key }){
  const state = fips(stateFips, 2);
  const token = cleanText(key);
  const forClause = scope === "state" ? "state:*" : scope === "county" ? "county:*" : "place:*";
  const inClauses = scope === "state" ? [] : [`state:${state}`];
  const params = [];
  params.push(`get=${encodeURIComponent("NAME")}`);
  params.push(`for=${encodeURIComponent(forClause)}`);
  for (const part of inClauses){
    params.push(`in=${encodeURIComponent(part)}`);
  }
  if (token) params.push(`key=${encodeURIComponent(token)}`);
  return `https://api.census.gov/data/${encodeURIComponent(cleanText(year))}/dec/pl?${params.join("&")}`;
}

async function fetchJson(url, fetchImpl = globalThis.fetch){
  if (typeof fetchImpl !== "function"){
    throw new Error("Fetch is unavailable.");
  }
  const res = await fetchImpl(url);
  if (!res || !res.ok){
    const status = res?.status ?? "";
    const text = res?.statusText || "Request failed";
    throw new Error(`Census request failed (${status}): ${text}`);
  }
  const json = await res.json();
  if (!Array.isArray(json)){
    throw new Error("Unexpected Census response format.");
  }
  return json;
}

async function fetchBlockGroupTable({ year, getVars, stateFips, countyFips, key, fetchImpl } = {}){
  const inClauses = [`state:${fips(stateFips, 2)}`, `county:${fips(countyFips, 3)}`, "tract:*"];
  const wildcardUrl = buildAcsQueryUrl({
    year,
    getVars,
    forClause: "block group:*",
    inClauses,
    key,
  });
  try{
    return await fetchJson(wildcardUrl, fetchImpl);
  } catch (wildcardErr){
    const tractUrl = buildAcsQueryUrl({
      year,
      getVars: ["NAME"],
      forClause: "tract:*",
      inClauses: [`state:${fips(stateFips, 2)}`, `county:${fips(countyFips, 3)}`],
      key,
    });
    const tractJson = await fetchJson(tractUrl, fetchImpl);
    const tracts = parseCensusTable(tractJson)
      .map((row) => fips(row?.tract, 6))
      .filter((v) => !!v);
    let headers = null;
    const bodyRows = [];
    for (const tract of tracts){
      const url = buildAcsQueryUrl({
        year,
        getVars,
        forClause: "block group:*",
        inClauses: [`state:${fips(stateFips, 2)}`, `county:${fips(countyFips, 3)}`, `tract:${tract}`],
        key,
      });
      const json = await fetchJson(url, fetchImpl);
      if (!Array.isArray(json) || !Array.isArray(json[0])) continue;
      if (!headers) headers = json[0].slice();
      for (let i = 1; i < json.length; i += 1){
        bodyRows.push(json[i]);
      }
    }
    if (!headers) throw wildcardErr;
    return [headers, ...bodyRows];
  }
}

export function parseCensusTable(table){
  if (!Array.isArray(table) || table.length < 1 || !Array.isArray(table[0])){
    return [];
  }
  const headers = table[0].map((v) => cleanText(v));
  const out = [];
  for (let i = 1; i < table.length; i += 1){
    const row = Array.isArray(table[i]) ? table[i] : [];
    const item = {};
    for (let j = 0; j < headers.length; j += 1){
      item[headers[j]] = row[j];
    }
    out.push(item);
  }
  return out;
}

function extractName(row){
  return cleanText(row?.NAME || row?.name || "");
}

function geoidFromRow(row, resolution){
  const state = fips(row?.state, 2);
  if (resolution === "place"){
    const place = fips(row?.place, 5);
    return state && place ? `${state}${place}` : "";
  }
  if (resolution === "tract"){
    const county = fips(row?.county, 3);
    const tract = fips(row?.tract, 6);
    return state && county && tract ? `${state}${county}${tract}` : "";
  }
  const county = fips(row?.county, 3);
  const tract = fips(row?.tract, 6);
  const blockGroup = fips(row?.["block group"], 1);
  return state && county && tract && blockGroup ? `${state}${county}${tract}${blockGroup}` : "";
}

function geoLabel(name, geoid){
  if (name && geoid) return `${name} (${geoid})`;
  if (name) return name;
  return geoid;
}

export function optionFromRow(row, resolution){
  const geoid = geoidFromRow(row, resolution);
  const name = extractName(row);
  return {
    geoid,
    label: geoLabel(name, geoid),
    name,
    state: fips(row?.state, 2),
    county: fips(row?.county, 3),
    place: fips(row?.place, 5),
    tract: fips(row?.tract, 6),
    blockGroup: fips(row?.["block group"], 1),
  };
}

export async function fetchStateOptions({ key, fetchImpl } = {}){
  const url = buildGeoLookupUrl({ scope: "state", key });
  const json = await fetchJson(url, fetchImpl);
  const rows = parseCensusTable(json).map((row) => ({
    fips: fips(row?.state, 2),
    name: extractName(row),
  }));
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export async function fetchCountyOptions({ stateFips, key, fetchImpl } = {}){
  const state = fips(stateFips, 2);
  if (!state) return [];
  const url = buildGeoLookupUrl({ scope: "county", stateFips: state, key });
  const json = await fetchJson(url, fetchImpl);
  const rows = parseCensusTable(json).map((row) => ({
    fips: fips(row?.county, 3),
    name: extractName(row),
  }));
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

export async function fetchPlaceOptions({ stateFips, key, fetchImpl } = {}){
  const state = fips(stateFips, 2);
  if (!state) return [];
  const url = buildGeoLookupUrl({ scope: "place", stateFips: state, key });
  const json = await fetchJson(url, fetchImpl);
  const rows = parseCensusTable(json).map((row) => ({
    fips: fips(row?.place, 5),
    name: extractName(row),
  }));
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

function geoForClause(resolution){
  if (resolution === "place") return "place:*";
  if (resolution === "tract") return "tract:*";
  return "block group:*";
}

function geoInClauses({ resolution, stateFips, countyFips }){
  const state = fips(stateFips, 2);
  const county = fips(countyFips, 3);
  if (resolution === "place"){
    return [`state:${state}`];
  }
  if (resolution === "tract"){
    return [`state:${state}`, `county:${county}`];
  }
  return [`state:${state}`, `county:${county}`, "tract:*"];
}

function requiredForResolution(resolution, stateFips, countyFips){
  const state = fips(stateFips, 2);
  const county = fips(countyFips, 3);
  if (!state) return false;
  if (resolution === "place") return true;
  return !!county;
}

export async function fetchGeoOptions({ year, resolution, stateFips, countyFips, key, fetchImpl } = {}){
  if (!requiredForResolution(resolution, stateFips, countyFips)) return [];
  const vars = ["NAME"];
  const json = resolution === "block_group"
    ? await fetchBlockGroupTable({ year, getVars: vars, stateFips, countyFips, key, fetchImpl })
    : await fetchJson(buildAcsQueryUrl({
      year,
      getVars: vars,
      forClause: geoForClause(resolution),
      inClauses: geoInClauses({ resolution, stateFips, countyFips }),
      key,
    }), fetchImpl);
  const rows = parseCensusTable(json)
    .map((row) => optionFromRow(row, resolution))
    .filter((row) => !!row.geoid)
    .sort((a, b) => a.label.localeCompare(b.label));
  return rows;
}

function parseEstimate(raw){
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}

function rowToData(row, resolution, variableIds){
  const option = optionFromRow(row, resolution);
  const values = {};
  for (const variableId of variableIds){
    values[variableId] = parseEstimate(row?.[variableId]);
  }
  return {
    ...option,
    values,
  };
}

export async function fetchAcsRows({ year, resolution, stateFips, countyFips, metricSet, key, fetchImpl } = {}){
  if (!requiredForResolution(resolution, stateFips, countyFips)) return {};
  const variableIds = getVariablesForMetricSet(metricSet);
  const json = resolution === "block_group"
    ? await fetchBlockGroupTable({ year, getVars: ["NAME", ...variableIds], stateFips, countyFips, key, fetchImpl })
    : await fetchJson(buildAcsQueryUrl({
      year,
      getVars: ["NAME", ...variableIds],
      forClause: geoForClause(resolution),
      inClauses: geoInClauses({ resolution, stateFips, countyFips }),
      key,
    }), fetchImpl);
  const rows = parseCensusTable(json)
    .map((row) => rowToData(row, resolution, variableIds))
    .filter((row) => !!row.geoid);
  const out = {};
  for (const row of rows){
    out[row.geoid] = row;
  }
  return out;
}

export async function fetchVariableCatalog({ year, key, fetchImpl } = {}){
  const token = cleanText(key);
  const url = `https://api.census.gov/data/${encodeURIComponent(cleanText(year))}/acs/acs5/variables.json${token ? `?key=${encodeURIComponent(token)}` : ""}`;
  const fetcher = typeof fetchImpl === "function" ? fetchImpl : globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("Fetch is unavailable.");
  const res = await fetcher(url);
  if (!res || !res.ok){
    const status = res?.status ?? "";
    const text = res?.statusText || "Request failed";
    throw new Error(`Variable catalog request failed (${status}): ${text}`);
  }
  const json = await res.json();
  const vars = json?.variables && typeof json.variables === "object" ? Object.keys(json.variables) : [];
  return vars;
}

function geoidLengthForResolution(resolution){
  if (resolution === "place") return 7;
  if (resolution === "tract") return 11;
  return 12;
}

export function normalizeGeoidsForResolution(geoids, resolution){
  return normalizeGeoidsForResolutionInternal(geoids, resolution);
}

export function parseGeoidInput(text, resolution){
  const raw = cleanText(text);
  if (!raw) return [];
  return normalizeGeoidsForResolutionInternal(raw.split(/[\s,;|]+/g), resolution);
}

function chunk(values, size){
  const out = [];
  for (let i = 0; i < values.length; i += size){
    out.push(values.slice(i, i + size));
  }
  return out;
}

export function buildTigerBoundaryQueryUrls({ resolution, geoids, chunkSize = 60 } = {}){
  const type = String(resolution || "").trim();
  const layers = Array.isArray(TIGER_BOUNDARY_LAYERS[type]) ? TIGER_BOUNDARY_LAYERS[type] : [];
  if (!layers.length) return [];
  const normalizedGeoids = normalizeGeoidsForResolutionInternal(geoids, type);
  if (!normalizedGeoids.length) return [];
  const chunkLen = Number.isFinite(Number(chunkSize)) && Number(chunkSize) > 0 ? Number(chunkSize) : 60;
  const inChunks = chunk(normalizedGeoids, chunkLen);
  const urls = [];
  for (const layer of layers){
    for (const inChunk of inChunks){
      const where = `${layer.field} IN (${inChunk.map((id) => `'${id}'`).join(",")})`;
      const params = [];
      params.push(`where=${encodeURIComponent(where)}`);
      params.push(`outFields=${encodeURIComponent("GEOID,NAME")}`);
      params.push("returnGeometry=true");
      params.push(`outSR=${encodeURIComponent("4326")}`);
      params.push(`f=${encodeURIComponent("geojson")}`);
      urls.push(`https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/${layer.service}/MapServer/${layer.layer}/query?${params.join("&")}`);
    }
  }
  return urls;
}

async function fetchGeoJson(url, fetchImpl = globalThis.fetch){
  if (typeof fetchImpl !== "function"){
    throw new Error("Fetch is unavailable.");
  }
  const res = await fetchImpl(url);
  if (!res || !res.ok){
    const status = res?.status ?? "";
    const text = res?.statusText || "Request failed";
    throw new Error(`Boundary request failed (${status}): ${text}`);
  }
  const json = await res.json();
  if (!json || typeof json !== "object" || !Array.isArray(json.features)){
    throw new Error("Unexpected boundary response format.");
  }
  return json;
}

async function fetchObjectJson(url, fetchImpl = globalThis.fetch, label = "request"){
  if (typeof fetchImpl !== "function"){
    throw new Error("Fetch is unavailable.");
  }
  const res = await fetchImpl(url);
  if (!res || !res.ok){
    const status = res?.status ?? "";
    const text = res?.statusText || "Request failed";
    throw new Error(`${label} failed (${status}): ${text}`);
  }
  const json = await res.json();
  if (!json || typeof json !== "object" || Array.isArray(json)){
    throw new Error(`Unexpected ${label} response format.`);
  }
  return json;
}

function pickFieldName(fields, aliases){
  const list = Array.isArray(fields) ? fields : [];
  const wanted = new Set((aliases || []).map((value) => canonicalCsvKey(value)));
  for (const field of list){
    const name = cleanText(field?.name);
    if (!name) continue;
    if (wanted.has(canonicalCsvKey(name))){
      return name;
    }
  }
  return "";
}

function safeLayerId(layer){
  const n = Number(layer?.id);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function scoreVtdLayerCandidate(layer){
  const name = cleanText(layer?.name).toLowerCase();
  const geometryType = cleanText(layer?.geometryType).toLowerCase();
  let score = 0;
  if (/vtd|voting/.test(name)) score += 5;
  if (/district/.test(name)) score += 1;
  if (/polygon/.test(geometryType)) score += 1;
  return score;
}

function buildServiceUrl(serviceName, suffix = ""){
  const service = cleanText(serviceName);
  const tail = cleanText(suffix);
  if (!service) return "";
  if (!tail) return `${TIGER_BASE_URL}/${service}`;
  return `${TIGER_BASE_URL}/${service}/${tail}`;
}

function serviceNameScore(serviceName){
  const name = cleanText(serviceName).toLowerCase();
  let score = 0;
  if (/vtd/.test(name)) score += 6;
  if (/voting/.test(name)) score += 4;
  if (/district/.test(name)) score += 1;
  return score;
}

export async function discoverTigerVtdLayer({ fetchImpl } = {}){
  if (tigerVtdLayerCache && typeof tigerVtdLayerCache === "object"){
    return { ...tigerVtdLayerCache, fields: { ...(tigerVtdLayerCache.fields || {}) } };
  }
  const catalog = await fetchObjectJson(TIGER_SERVICE_CATALOG_URL, fetchImpl, "Tiger service catalog request");
  const services = Array.isArray(catalog.services) ? catalog.services : [];
  const mapServices = services
    .filter((row) => cleanText(row?.type).toLowerCase() === "mapserver")
    .map((row) => cleanText(row?.name))
    .filter((name) => !!name)
    .sort((a, b) => serviceNameScore(b) - serviceNameScore(a));
  for (const serviceName of mapServices.slice(0, 48)){
    const mapUrl = `${buildServiceUrl(serviceName, "MapServer")}?f=pjson`;
    let mapMeta = null;
    try{
      mapMeta = await fetchObjectJson(mapUrl, fetchImpl, "Tiger map metadata request");
    } catch {
      continue;
    }
    const layers = (Array.isArray(mapMeta.layers) ? mapMeta.layers : [])
      .map((layer) => ({ ...layer, _score: scoreVtdLayerCandidate(layer) }))
      .sort((a, b) => Number(b._score) - Number(a._score));
    for (const layer of layers){
      if (Number(layer._score) < 1) continue;
      const layerId = safeLayerId(layer);
      if (layerId == null) continue;
      const layerUrl = `${buildServiceUrl(serviceName, `MapServer/${layerId}`)}?f=pjson`;
      let layerMeta = null;
      try{
        layerMeta = await fetchObjectJson(layerUrl, fetchImpl, "Tiger layer metadata request");
      } catch {
        continue;
      }
      const fields = Array.isArray(layerMeta.fields) ? layerMeta.fields : [];
      const stateField = pickFieldName(fields, ["statefp20", "statefp", "state"]);
      const countyField = pickFieldName(fields, ["countyfp20", "countyfp", "county"]);
      const geoidField = pickFieldName(fields, ["geoid20", "geoidfp20", "geoid", "geoidfp", "vtdst20", "vtdi"]);
      if (!stateField && !geoidField) continue;
      if (!countyField && !geoidField) continue;
      const nameField = pickFieldName(fields, ["name20", "name", "namelsad20", "namelsad", "label"]);
      const config = {
        serviceName,
        layerId,
        layerName: cleanText(layer?.name),
        fields: {
          state: stateField,
          county: countyField,
          geoid: geoidField,
          name: nameField,
        },
      };
      tigerVtdLayerCache = config;
      return { ...config, fields: { ...config.fields } };
    }
  }
  throw new Error("VTD overlay layer not found on Tigerweb.");
}

export function buildTigerVtdBoundaryQueryUrl({ layerConfig, stateFips, countyFips } = {}){
  const cfg = layerConfig && typeof layerConfig === "object" ? layerConfig : {};
  const serviceName = cleanText(cfg.serviceName);
  const layerIdRaw = Number(cfg.layerId);
  const layerId = Number.isFinite(layerIdRaw) ? Math.floor(layerIdRaw) : null;
  const state = fips(stateFips, 2);
  const county = fips(countyFips, 3);
  if (!serviceName || layerId == null || !state || !county) return "";
  const stateField = cleanText(cfg?.fields?.state);
  const countyField = cleanText(cfg?.fields?.county);
  const geoidField = cleanText(cfg?.fields?.geoid);
  const nameField = cleanText(cfg?.fields?.name);
  let where = "";
  if (stateField && countyField){
    where = `${stateField}='${state}' AND ${countyField}='${county}'`;
  } else if (geoidField){
    where = `${geoidField} LIKE '${state}${county}%'`;
  } else if (stateField){
    where = `${stateField}='${state}'`;
  }
  if (!where) return "";
  const outFields = [];
  const seen = new Set();
  for (const field of [geoidField, nameField, stateField, countyField]){
    const name = cleanText(field);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    outFields.push(name);
  }
  const params = [];
  params.push(`where=${encodeURIComponent(where)}`);
  params.push(`outFields=${encodeURIComponent(outFields.length ? outFields.join(",") : "*")}`);
  params.push("returnGeometry=true");
  params.push(`outSR=${encodeURIComponent("4326")}`);
  params.push(`f=${encodeURIComponent("geojson")}`);
  return `${buildServiceUrl(serviceName, `MapServer/${layerId}/query`)}?${params.join("&")}`;
}

function readFeatureProperty(feature, fieldName){
  const key = cleanText(fieldName);
  if (!key) return "";
  const props = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
  if (Object.prototype.hasOwnProperty.call(props, key)){
    return props[key];
  }
  const lower = key.toLowerCase();
  for (const [propKey, propValue] of Object.entries(props)){
    if (String(propKey).toLowerCase() === lower){
      return propValue;
    }
  }
  return "";
}

function featureGeoid(feature){
  const raw = feature?.properties?.GEOID ?? feature?.properties?.geoid ?? feature?.id;
  return cleanText(raw).replace(/\D+/g, "");
}

export async function fetchTigerBoundaryGeojson({ resolution, geoids, chunkSize = 60, fetchImpl } = {}){
  const type = String(resolution || "").trim();
  const normalizedGeoids = normalizeGeoidsForResolutionInternal(geoids, type);
  const urls = buildTigerBoundaryQueryUrls({ resolution: type, geoids: normalizedGeoids, chunkSize });
  if (!urls.length){
    return {
      featureCollection: { type: "FeatureCollection", features: [] },
      requestedGeoids: normalizedGeoids,
      matchedGeoids: [],
      missingGeoids: normalizedGeoids.slice(),
    };
  }
  const deduped = new Map();
  for (const url of urls){
    const geo = await fetchGeoJson(url, fetchImpl);
    for (const feature of geo.features){
      const geoid = featureGeoid(feature);
      const key = geoid || `${deduped.size + 1}`;
      if (!deduped.has(key)){
        deduped.set(key, feature);
      }
    }
  }
  const matched = new Set();
  for (const key of deduped.keys()){
    if (key) matched.add(key);
  }
  return {
    featureCollection: { type: "FeatureCollection", features: Array.from(deduped.values()) },
    requestedGeoids: normalizedGeoids,
    matchedGeoids: Array.from(matched),
    missingGeoids: normalizedGeoids.filter((id) => !matched.has(id)),
  };
}

export async function fetchTigerVtdBoundaryGeojson({ stateFips, countyFips, fetchImpl } = {}){
  const state = fips(stateFips, 2);
  const county = fips(countyFips, 3);
  if (!state || !county){
    throw new Error("VTD overlay requires state and county context.");
  }
  const layerConfig = await discoverTigerVtdLayer({ fetchImpl });
  const queryUrl = buildTigerVtdBoundaryQueryUrl({ layerConfig, stateFips: state, countyFips: county });
  if (!queryUrl){
    throw new Error("Could not build VTD overlay query for this context.");
  }
  const geo = await fetchGeoJson(queryUrl, fetchImpl);
  const deduped = new Map();
  for (const feature of geo.features){
    const geoidRaw = readFeatureProperty(feature, layerConfig?.fields?.geoid);
    const geoid = cleanText(geoidRaw).replace(/\D+/g, "") || featureGeoid(feature);
    const key = geoid || `${deduped.size + 1}`;
    if (!deduped.has(key)){
      deduped.set(key, feature);
    }
  }
  const features = Array.from(deduped.values());
  return {
    featureCollection: { type: "FeatureCollection", features },
    serviceName: cleanText(layerConfig.serviceName),
    layerId: Number.isFinite(Number(layerConfig.layerId)) ? Math.floor(Number(layerConfig.layerId)) : null,
    stateFips: state,
    countyFips: county,
    featureCount: features.length,
  };
}

function sumVars(rowValues, variableIds){
  let total = 0;
  let count = 0;
  for (const id of variableIds || []){
    const n = Number(rowValues?.[id]);
    if (!Number.isFinite(n)) continue;
    total += n;
    count += 1;
  }
  return { total, count };
}

export function aggregateRowsForSelection({ rowsByGeoid, selectedGeoids, metricSet } = {}){
  const rows = rowsByGeoid && typeof rowsByGeoid === "object" ? rowsByGeoid : {};
  const geos = Array.isArray(selectedGeoids) && selectedGeoids.length
    ? selectedGeoids.map((v) => cleanText(v)).filter((v) => !!v)
    : [];
  const metricIds = getMetricIdsForSet(metricSet);
  const metrics = {};

  for (const metricId of metricIds){
    const spec = METRICS[metricId];
    if (!spec) continue;
    if (spec.kind === "sum"){
      let total = 0;
      let seen = 0;
      for (const geoid of geos){
        const row = rows[geoid];
        if (!row) continue;
        const part = sumVars(row.values, spec.sumVars);
        total += part.total;
        seen += part.count;
      }
      metrics[metricId] = {
        id: metricId,
        label: spec.label,
        format: spec.format,
        value: seen > 0 && Number.isFinite(total) ? total : null,
      };
      continue;
    }

    if (spec.kind === "ratio"){
      let numerator = 0;
      let denominator = 0;
      for (const geoid of geos){
        const row = rows[geoid];
        if (!row) continue;
        numerator += sumVars(row.values, spec.numeratorVars).total;
        denominator += sumVars(row.values, spec.denominatorVars).total;
      }
      const value = denominator > 0 ? numerator / denominator : null;
      metrics[metricId] = {
        id: metricId,
        label: spec.label,
        format: spec.format,
        value,
        numerator,
        denominator,
      };
      continue;
    }

    if (spec.kind === "weighted_mean"){
      let weighted = 0;
      let weightSum = 0;
      for (const geoid of geos){
        const row = rows[geoid];
        if (!row) continue;
        const value = Number(row.values?.[spec.valueVar]);
        const weight = Number(row.values?.[spec.weightVar]);
        if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) continue;
        weighted += value * weight;
        weightSum += weight;
      }
      const value = weightSum > 0 ? weighted / weightSum : null;
      metrics[metricId] = {
        id: metricId,
        label: spec.label,
        format: spec.format,
        value,
        weight: weightSum,
      };
    }
  }

  return {
    selectedGeoCount: geos.length,
    selectedGeoids: geos,
    metrics,
  };
}

export function filterGeoOptions(options, { search = "", tractFilter = "" } = {}){
  const rows = Array.isArray(options) ? options : [];
  const term = cleanText(search).toLowerCase();
  const tract = fips(tractFilter, 6);
  return rows.filter((row) => {
    if (tract && cleanText(row?.tract) !== tract) return false;
    if (!term) return true;
    const label = cleanText(row?.label).toLowerCase();
    const geoid = cleanText(row?.geoid).toLowerCase();
    const name = cleanText(row?.name).toLowerCase();
    return label.includes(term) || geoid.includes(term) || name.includes(term);
  });
}

function formatInt(value){
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return Math.round(n).toLocaleString("en-US");
}

function formatPct1(value){
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(1)}%`;
}

function formatCurrency0(value){
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function formatMetricValue(value, format){
  if (format === "pct1") return formatPct1(value);
  if (format === "currency0") return formatCurrency0(value);
  return formatInt(value);
}

export function buildAggregateTableRows(aggregate, metricSet){
  const metricIds = getMetricIdsForSet(metricSet);
  const metrics = aggregate?.metrics && typeof aggregate.metrics === "object" ? aggregate.metrics : {};
  return metricIds
    .map((id) => metrics[id])
    .filter((row) => !!row)
    .map((row) => ({
      id: row.id,
      label: row.label,
      value: row.value,
      valueText: formatMetricValue(row.value, row.format),
      format: row.format,
    }));
}

function clampRange(value, min, max){
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function metricNum(metrics, id){
  const value = Number(metrics?.[id]?.value);
  return Number.isFinite(value) ? value : null;
}

function rowVarNum(rowValues, variableId){
  const value = Number(rowValues?.[variableId]);
  return Number.isFinite(value) ? value : null;
}

function ratioFromRow(rowValues, numeratorVars, denominatorVars, fallback){
  let numerator = 0;
  let denominator = 0;
  let denominatorSeen = false;
  for (const id of numeratorVars || []){
    const value = rowVarNum(rowValues, id);
    if (value == null) continue;
    numerator += value;
  }
  for (const id of denominatorVars || []){
    const value = rowVarNum(rowValues, id);
    if (value == null) continue;
    denominator += value;
    denominatorSeen = true;
  }
  if (!denominatorSeen || denominator <= 0) return fallback;
  return clampRange(numerator / denominator, 0, 1);
}

function computeAdvisoryIndices({ renterShare, multiUnitShare, limitedEnglishShare, baPlusShare, medianIncome, densityRatio } = {}){
  const renter = clampRange(Number(renterShare), 0, 1);
  const multi = clampRange(Number(multiUnitShare), 0, 1);
  const limitedEnglish = clampRange(Number(limitedEnglishShare), 0, 1);
  const baPlus = clampRange(Number(baPlusShare), 0, 1);
  const income = Number.isFinite(Number(medianIncome)) ? Number(medianIncome) : 65000;
  const density = clampRange(Number(densityRatio), 0.2, 0.9);
  const incomeNorm = clampRange((income - 35000) / 65000, 0, 1);
  const densityNorm = clampRange((density - 0.25) / 0.45, 0, 1);
  const fieldSpeed = clampRange(
    1
      + (0.22 * densityNorm)
      + (0.12 * multi)
      + (0.06 * renter)
      - (0.14 * limitedEnglish),
    0.75,
    1.30,
  );
  const persuasionEnvironment = clampRange(
    1
      + (0.16 * baPlus)
      + (0.08 * renter)
      + (0.10 * incomeNorm)
      - (0.08 * limitedEnglish),
    0.80,
    1.30,
  );
  const turnoutElasticity = clampRange(
    1
      + (0.20 * renter)
      + (0.12 * limitedEnglish)
      + (0.08 * (1 - baPlus))
      - (0.06 * incomeNorm),
    0.80,
    1.35,
  );
  const fieldDifficulty = clampRange(
    1
      + (0.20 * limitedEnglish)
      + (0.10 * multi)
      + (0.08 * (1 - densityNorm))
      - (0.05 * renter),
    0.80,
    1.40,
  );
  return {
    fieldSpeed,
    persuasionEnvironment,
    turnoutElasticity,
    fieldDifficulty,
  };
}

function weightedQuantile(samples, q){
  const rows = Array.isArray(samples) ? samples.slice() : [];
  if (!rows.length) return null;
  const percentile = clampRange(Number(q), 0, 1);
  rows.sort((a, b) => Number(a.value) - Number(b.value));
  let totalWeight = 0;
  for (const row of rows){
    const weight = Number(row?.weight);
    totalWeight += Number.isFinite(weight) && weight > 0 ? weight : 1;
  }
  if (totalWeight <= 0) return null;
  const target = totalWeight * percentile;
  let seen = 0;
  for (const row of rows){
    const weight = Number(row?.weight);
    seen += Number.isFinite(weight) && weight > 0 ? weight : 1;
    if (seen >= target){
      const value = Number(row?.value);
      return Number.isFinite(value) ? value : null;
    }
  }
  const last = rows[rows.length - 1];
  const value = Number(last?.value);
  return Number.isFinite(value) ? value : null;
}

function advisoryMultiplierBand({
  rowsByGeoid,
  selectedGeoids,
  fallbackMultiplier,
  fallbackSignals,
} = {}){
  const rows = rowsByGeoid && typeof rowsByGeoid === "object" ? rowsByGeoid : {};
  const geos = Array.isArray(selectedGeoids) ? selectedGeoids.map((v) => cleanText(v)).filter((v) => !!v) : [];
  const fallback = Number.isFinite(Number(fallbackMultiplier)) ? clampRange(Number(fallbackMultiplier), 0.70, 1.30) : 1;
  const renterFallback = clampRange(Number(fallbackSignals?.renterShare), 0, 1);
  const multiFallback = clampRange(Number(fallbackSignals?.multiUnitShare), 0, 1);
  const limitedEnglishFallback = clampRange(Number(fallbackSignals?.limitedEnglishShare), 0, 1);
  const baPlusFallback = clampRange(Number(fallbackSignals?.baPlusShare), 0, 1);
  const incomeFallback = Number.isFinite(Number(fallbackSignals?.medianIncome)) ? Number(fallbackSignals?.medianIncome) : 65000;
  const densityFallback = clampRange(Number(fallbackSignals?.densityRatio), 0.2, 0.9);
  const samples = [];
  for (const geoid of geos){
    const row = rows[geoid];
    if (!row || typeof row !== "object") continue;
    const values = row?.values && typeof row.values === "object" ? row.values : {};
    const renterShare = ratioFromRow(values, ["B25003_003E"], ["B25003_001E"], renterFallback);
    const multiUnitShare = ratioFromRow(
      values,
      ["B25024_003E", "B25024_004E", "B25024_005E", "B25024_006E", "B25024_007E", "B25024_008E", "B25024_009E", "B25024_010E", "B25024_011E"],
      ["B25024_001E"],
      multiFallback,
    );
    const limitedEnglishShare = ratioFromRow(values, ["C16002_004E", "C16002_007E", "C16002_010E", "C16002_013E"], ["C16002_001E"], limitedEnglishFallback);
    const baPlusShare = ratioFromRow(values, ["B15003_022E", "B15003_023E", "B15003_024E", "B15003_025E"], ["B15003_001E"], baPlusFallback);
    const medianIncome = (() => {
      const value = rowVarNum(values, "B19013_001E");
      return value != null && value > 0 ? value : incomeFallback;
    })();
    const densityRatio = (() => {
      const population = rowVarNum(values, "B01003_001E");
      const housingUnits = rowVarNum(values, "B25001_001E");
      if (population != null && population > 0 && housingUnits != null && housingUnits > 0){
        return clampRange(housingUnits / population, 0.2, 0.9);
      }
      return densityFallback;
    })();
    const indices = computeAdvisoryIndices({
      renterShare,
      multiUnitShare,
      limitedEnglishShare,
      baPlusShare,
      medianIncome,
      densityRatio,
    });
    const multiplier = clampRange(indices.fieldSpeed / indices.fieldDifficulty, 0.70, 1.30);
    const populationWeight = rowVarNum(values, "B01003_001E");
    const weight = populationWeight != null && populationWeight > 0 ? populationWeight : 1;
    samples.push({ value: multiplier, weight });
  }
  if (!samples.length){
    return {
      low: fallback,
      mid: fallback,
      high: fallback,
      sampleCount: 0,
    };
  }
  const low = weightedQuantile(samples, 0.25);
  const mid = weightedQuantile(samples, 0.50);
  const high = weightedQuantile(samples, 0.75);
  const lowValue = Number.isFinite(Number(low)) ? clampRange(Number(low), 0.70, 1.30) : fallback;
  const midValue = Number.isFinite(Number(mid)) ? clampRange(Number(mid), 0.70, 1.30) : fallback;
  const highValue = Number.isFinite(Number(high)) ? clampRange(Number(high), 0.70, 1.30) : fallback;
  return {
    low: Math.min(lowValue, midValue, highValue),
    mid: midValue,
    high: Math.max(lowValue, midValue, highValue),
    sampleCount: samples.length,
  };
}

function advisoryBand(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n >= 1.08) return "High";
  if (n <= 0.92) return "Low";
  return "Moderate";
}

export function buildCensusAssumptionAdvisory({ aggregate, doorShare, doorsPerHour, callsPerHour, rowsByGeoid, selectedGeoids } = {}){
  const selectedIds = Array.isArray(selectedGeoids) && selectedGeoids.length
    ? selectedGeoids.map((v) => cleanText(v)).filter((v) => !!v)
    : (Array.isArray(aggregate?.selectedGeoids) ? aggregate.selectedGeoids.map((v) => cleanText(v)).filter((v) => !!v) : []);
  const selectedGeoCount = selectedIds.length > 0
    ? selectedIds.length
    : (Number.isFinite(Number(aggregate?.selectedGeoCount))
      ? Math.max(0, Math.floor(Number(aggregate.selectedGeoCount)))
      : 0);
  const metrics = aggregate?.metrics && typeof aggregate.metrics === "object" ? aggregate.metrics : {};

  let availableSignals = 0;
  const totalSignals = 6;
  const pickShare = (id, fallback) => {
    const value = metricNum(metrics, id);
    if (value == null) return fallback;
    availableSignals += 1;
    return clampRange(value, 0, 1);
  };
  const pickMetric = (id, fallback) => {
    const value = metricNum(metrics, id);
    if (value == null) return fallback;
    availableSignals += 1;
    return value;
  };

  const renterShare = pickShare("renter_share", 0.35);
  const multiUnitShare = pickShare("multi_unit_share", 0.20);
  const limitedEnglishShare = pickShare("limited_english_share", 0.05);
  const baPlusShare = pickShare("ba_plus_share", 0.33);
  const medianIncome = pickMetric("median_household_income_est", 65000);
  const population = metricNum(metrics, "population_total");
  const housingUnits = metricNum(metrics, "housing_units_total");
  let densityRatio = 0.45;
  if (Number.isFinite(population) && population > 0 && Number.isFinite(housingUnits) && housingUnits > 0){
    densityRatio = housingUnits / population;
    availableSignals += 1;
  }
  densityRatio = clampRange(densityRatio, 0.2, 0.9);

  const indices = computeAdvisoryIndices({
    renterShare,
    multiUnitShare,
    limitedEnglishShare,
    baPlusShare,
    medianIncome,
    densityRatio,
  });
  const fieldSpeed = indices.fieldSpeed;
  const persuasionEnvironment = indices.persuasionEnvironment;
  const turnoutElasticity = indices.turnoutElasticity;
  const fieldDifficulty = indices.fieldDifficulty;

  const shareRaw = Number(doorShare);
  const share = Number.isFinite(shareRaw) ? clampRange(shareRaw, 0, 1) : 0.5;
  const dph = Number(doorsPerHour);
  const cph = Number(callsPerHour);
  const hasBaseAph = Number.isFinite(dph) && dph > 0 && Number.isFinite(cph) && cph > 0;
  const baseAph = hasBaseAph ? (share * dph) + ((1 - share) * cph) : null;
  const doorsMultiplier = clampRange(fieldSpeed / fieldDifficulty, 0.70, 1.30);
  const multiplierBand = advisoryMultiplierBand({
    rowsByGeoid,
    selectedGeoids: selectedIds,
    fallbackMultiplier: doorsMultiplier,
    fallbackSignals: {
      renterShare,
      multiUnitShare,
      limitedEnglishShare,
      baPlusShare,
      medianIncome,
      densityRatio,
    },
  });
  const bandMid = Number(multiplierBand.mid);
  const effectiveMultiplier = Number.isFinite(bandMid) ? bandMid : doorsMultiplier;
  const adjustedAph = baseAph != null ? baseAph * effectiveMultiplier : null;
  const aphDeltaPct = (baseAph != null && baseAph > 0 && adjustedAph != null) ? ((adjustedAph / baseAph) - 1) : null;
  const aphRange = {
    low: baseAph != null ? baseAph * Number(multiplierBand.low) : null,
    mid: baseAph != null ? baseAph * Number(multiplierBand.mid) : null,
    high: baseAph != null ? baseAph * Number(multiplierBand.high) : null,
  };

  const ready = selectedGeoCount > 0 && availableSignals > 0;
  const reason = ready
    ? "ready"
    : (selectedGeoCount > 0 ? "signals_unavailable" : "selection_missing");

  return {
    ready,
    reason,
    selectedGeoCount,
    coverage: {
      availableSignals,
      totalSignals,
    },
    indices: {
      fieldSpeed,
      persuasionEnvironment,
      turnoutElasticity,
      fieldDifficulty,
    },
    bands: {
      fieldSpeed: advisoryBand(fieldSpeed),
      persuasionEnvironment: advisoryBand(persuasionEnvironment),
      turnoutElasticity: advisoryBand(turnoutElasticity),
      fieldDifficulty: advisoryBand(fieldDifficulty),
    },
    multipliers: {
      doorsPerHour: effectiveMultiplier,
      persuasion: persuasionEnvironment,
      turnoutLift: turnoutElasticity,
      organizerLoad: fieldDifficulty,
    },
    multiplierBand,
    aph: {
      base: baseAph,
      adjusted: adjustedAph,
      deltaPct: aphDeltaPct,
      range: aphRange,
    },
  };
}

function pctToUnitOrNull(value){
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  const bounded = clampRange(raw, 0, 100);
  return bounded / 100;
}

export function evaluateCensusPaceAgainstAdvisory({
  advisory,
  needVotes,
  weeks,
  contactRatePct,
  supportRatePct,
  turnoutReliabilityPct,
  orgCount,
  orgHoursPerWeek,
  volunteerMult,
} = {}){
  const adjustedAph = Number(advisory?.aph?.adjusted);
  const aphRangeRaw = advisory?.aph?.range && typeof advisory.aph.range === "object" ? advisory.aph.range : null;
  const rangeLow = Number(aphRangeRaw?.low);
  const rangeMid = Number(aphRangeRaw?.mid);
  const rangeHigh = Number(aphRangeRaw?.high);
  const hasRange = Number.isFinite(rangeLow) && rangeLow > 0
    && Number.isFinite(rangeMid) && rangeMid > 0
    && Number.isFinite(rangeHigh) && rangeHigh > 0;
  const availableAph = hasRange ? rangeMid : adjustedAph;
  const hasAdjustedAph = Number.isFinite(availableAph) && availableAph > 0;
  const goalRaw = Number(needVotes);
  const hasGoal = Number.isFinite(goalRaw) && goalRaw >= 0;
  const weeksRaw = Number(weeks);
  const hasWeeks = Number.isFinite(weeksRaw) && weeksRaw > 0;
  const cr = pctToUnitOrNull(contactRatePct);
  const sr = pctToUnitOrNull(supportRatePct);
  const tr = pctToUnitOrNull(turnoutReliabilityPct);
  const hasRates = cr != null && cr > 0 && sr != null && sr > 0 && tr != null && tr > 0;
  const orgs = Number(orgCount);
  const hours = Number(orgHoursPerWeek);
  const vmRaw = Number(volunteerMult);
  const vm = Number.isFinite(vmRaw) && vmRaw > 0 ? vmRaw : 1;
  const capacityHoursPerWeek = (Number.isFinite(orgs) && orgs > 0 && Number.isFinite(hours) && hours > 0)
    ? (orgs * hours * vm)
    : null;
  const hasCapacityHours = Number.isFinite(capacityHoursPerWeek) && capacityHoursPerWeek > 0;

  let reason = "ready";
  if (!hasAdjustedAph){
    reason = "advisory_aph_missing";
  } else if (!hasGoal){
    reason = "need_votes_missing";
  } else if (!hasWeeks){
    reason = "weeks_missing";
  } else if (!hasRates){
    reason = "rates_missing";
  } else if (!hasCapacityHours){
    reason = "capacity_hours_missing";
  }

  if (reason !== "ready"){
    return {
      ready: false,
      reason,
      availableAph: hasAdjustedAph ? availableAph : null,
      availableAphRange: hasRange ? { low: rangeLow, mid: rangeMid, high: rangeHigh } : null,
      requiredAph: null,
      gapPct: null,
      ratio: null,
      feasible: null,
      severity: "muted",
      nearTop: null,
      requiredAttemptsPerWeek: null,
      capacityHoursPerWeek: hasCapacityHours ? capacityHoursPerWeek : null,
    };
  }

  const safeGoal = Math.max(0, goalRaw);
  const requiredAttemptsTotal = safeGoal > 0 ? (safeGoal / (cr * sr * tr)) : 0;
  const requiredAttemptsPerWeek = requiredAttemptsTotal / weeksRaw;
  const requiredAph = requiredAttemptsPerWeek / capacityHoursPerWeek;
  const comparisonAph = hasRange ? rangeHigh : availableAph;
  const ratio = requiredAph / comparisonAph;
  const gapPct = ratio - 1;
  const feasible = ratio <= 1;
  const nearTop = hasRange ? (feasible && requiredAph >= (rangeHigh * 0.9)) : false;
  const severity = hasRange
    ? (feasible ? (nearTop ? "warn" : "ok") : "bad")
    : (feasible ? "ok" : (ratio > 1.2 ? "bad" : "warn"));

  return {
    ready: true,
    reason,
    availableAph,
    availableAphRange: hasRange ? { low: rangeLow, mid: rangeMid, high: rangeHigh } : null,
    requiredAph,
    gapPct,
    ratio,
    feasible,
    severity,
    nearTop,
    requiredAttemptsPerWeek,
    capacityHoursPerWeek,
  };
}

export function evaluateQaOverlayNonBlocking({ primaryFeatureCount, qaEnabled, qaFailed } = {}){
  const primaryCount = Number(primaryFeatureCount);
  const primaryReady = Number.isFinite(primaryCount) && primaryCount > 0;
  if (!qaEnabled){
    return {
      primaryReady,
      qaEnabled: false,
      qaFailed: false,
      blocking: !primaryReady,
      code: primaryReady ? "primary_ready" : "primary_missing",
    };
  }
  if (qaFailed){
    return {
      primaryReady,
      qaEnabled: true,
      qaFailed: true,
      blocking: !primaryReady,
      code: primaryReady ? "qa_non_blocking" : "qa_blocking",
    };
  }
  return {
    primaryReady,
    qaEnabled: true,
    qaFailed: false,
    blocking: !primaryReady,
    code: primaryReady ? "qa_ready" : "primary_missing",
  };
}

export function validateMetricSetWithCatalog(metricSet, variableNames){
  const vars = new Set(Array.isArray(variableNames) ? variableNames.map((v) => cleanText(v)) : []);
  const required = getVariablesForMetricSet(metricSet);
  const missing = required.filter((v) => !vars.has(v));
  return {
    ok: missing.length === 0,
    missing,
    required,
  };
}
