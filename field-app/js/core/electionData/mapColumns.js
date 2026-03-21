// @ts-check

import {
  ELECTION_DATA_OPTIONAL_COLUMNS,
  ELECTION_DATA_REQUIRED_COLUMNS,
} from "../state/schema.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function canonicalToken(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

const CANONICAL_COLUMNS = Object.freeze([
  ...ELECTION_DATA_REQUIRED_COLUMNS,
  ...ELECTION_DATA_OPTIONAL_COLUMNS,
]);

const CANONICAL_SET = new Set(CANONICAL_COLUMNS.map((key) => canonicalToken(key)));

const CANONICAL_ALIASES = Object.freeze({
  statefp: "state_fips",
  statefips: "state_fips",
  state_fp: "state_fips",
  countyfp: "county_fips",
  countyfips: "county_fips",
  county_fp: "county_fips",
  electiondate: "election_date",
  electionday: "election_date",
  election_date: "election_date",
  office: "office",
  office_name: "office",
  district: "district_id",
  districtid: "district_id",
  district_id: "district_id",
  precinctid: "precinct_id",
  precinct_id: "precinct_id",
  precinct: "precinct_id",
  wardid: "ward_id",
  ward: "ward_id",
  cand_name: "candidate",
  candidate_name: "candidate",
  candidate: "candidate",
  candidateid: "candidate_id",
  votes_cast: "votes",
  party_name: "party",
  party: "party",
  votes_total: "votes",
  votes: "votes",
  ballots: "total_votes_precinct",
  totalvotesprecinct: "total_votes_precinct",
  total_votes: "total_votes_precinct",
  ballots_cast: "total_votes_precinct",
  total_votes_precinct: "total_votes_precinct",
  registered: "registered_voters",
  registeredvoters: "registered_voters",
  registered_voters: "registered_voters",
  electiontype: "election_type",
  election_type: "election_type",
  cycleyear: "cycle_year",
  cycle_year: "cycle_year",
  jurisdiction: "jurisdiction_key",
  jurisdiction_key: "jurisdiction_key",
  geographyid: "geography_id",
  geography_id: "geography_id",
  source_row: "source_row",
  source_row_number: "source_row",
});

function resolveCanonicalColumn(value) {
  const token = canonicalToken(value);
  if (!token) return "";
  if (CANONICAL_SET.has(token)) return token;
  return CANONICAL_ALIASES[token] || "";
}

function clone(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function collectHeaders(rows = []) {
  const set = new Set();
  asArray(rows).forEach((row) => {
    if (!row || typeof row !== "object") return;
    Object.keys(row).forEach((key) => {
      const header = cleanText(key);
      if (header) set.add(header);
    });
  });
  return Array.from(set);
}

function findRowKey(row, sourceKey) {
  const src = row && typeof row === "object" ? row : {};
  if (Object.prototype.hasOwnProperty.call(src, sourceKey)) {
    return sourceKey;
  }
  const sourceToken = canonicalToken(sourceKey);
  for (const key of Object.keys(src)) {
    if (canonicalToken(key) === sourceToken) {
      return key;
    }
  }
  return "";
}

export function normalizeElectionDataColumnMap(columnMap = {}, options = {}) {
  const headers = asArray(options.headers).map((header) => cleanText(header)).filter(Boolean);
  const headerSet = new Set(headers);
  const mappingInput = columnMap && typeof columnMap === "object" ? columnMap : {};

  /** @type {Record<string, string>} */
  const targetToSource = {};
  const warnings = [];

  Object.entries(mappingInput).forEach(([leftRaw, rightRaw]) => {
    const left = cleanText(leftRaw);
    const right = cleanText(rightRaw);
    if (!left || !right) return;

    const leftCanonical = resolveCanonicalColumn(left);
    const rightCanonical = resolveCanonicalColumn(right);

    let target = "";
    let source = "";

    if (leftCanonical && !rightCanonical) {
      target = leftCanonical;
      source = right;
    } else if (!leftCanonical && rightCanonical) {
      target = rightCanonical;
      source = left;
    } else if (leftCanonical && rightCanonical) {
      const leftIsHeader = headerSet.has(left);
      const rightIsHeader = headerSet.has(right);
      if (rightIsHeader && !leftIsHeader) {
        target = leftCanonical;
        source = right;
      } else if (leftIsHeader && !rightIsHeader) {
        target = rightCanonical;
        source = left;
      } else {
        target = leftCanonical;
        source = left;
        if (leftCanonical !== rightCanonical) {
          warnings.push(`Column mapping '${left}' -> '${right}' is ambiguous; using '${left}' as source.`);
        }
      }
    } else {
      warnings.push(`Column mapping '${left}' -> '${right}' did not resolve to canonical columns.`);
      return;
    }

    if (targetToSource[target] && targetToSource[target] !== source) {
      warnings.push(`Multiple source columns mapped to '${target}'. Using '${source}'.`);
    }
    targetToSource[target] = source;
  });

  if (!Object.keys(targetToSource).length && headers.length) {
    headers.forEach((header) => {
      const canonical = resolveCanonicalColumn(header);
      if (canonical && !targetToSource[canonical]) {
        targetToSource[canonical] = header;
      }
    });
  }

  const mappedColumns = Object.keys(targetToSource);
  return {
    columnMap: clone(targetToSource),
    mappedColumns,
    warnings,
  };
}

export function applyElectionDataColumnMap(rawRows = [], columnMap = {}, options = {}) {
  const rows = asArray(rawRows).map((row) => (row && typeof row === "object" ? clone(row) : {}));
  const headers = asArray(options.headers).length ? asArray(options.headers) : collectHeaders(rows);
  const normalizedMap = normalizeElectionDataColumnMap(columnMap, { headers });
  const sourceColumnsUsed = new Set(Object.values(normalizedMap.columnMap).map((source) => cleanText(source)).filter(Boolean));

  const mappedRows = rows.map((row) => {
    const next = {};
    Object.entries(normalizedMap.columnMap).forEach(([target, source]) => {
      const sourceKey = findRowKey(row, source);
      next[target] = sourceKey ? row[sourceKey] : "";
    });
    return next;
  });

  const headerSet = new Set(headers.map((header) => cleanText(header)).filter(Boolean));
  const unmappedColumns = Array.from(headerSet).filter((header) => !sourceColumnsUsed.has(header));

  return {
    columnMap: normalizedMap.columnMap,
    mappedColumns: normalizedMap.mappedColumns,
    unmappedColumns,
    warnings: normalizedMap.warnings,
    mappedRows,
  };
}

export function deriveElectionDataColumnMap(rawRows = [], options = {}) {
  const headers = asArray(options.headers).length ? asArray(options.headers) : collectHeaders(rawRows);
  return normalizeElectionDataColumnMap({}, { headers }).columnMap;
}
