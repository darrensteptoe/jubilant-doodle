// @ts-check
// Canonical voter data contract and normalization layer.
// This module owns voter-file schema normalization, source adapters, and
// deterministic universe/contact-history summaries.

import { clampFiniteNumber, roundWholeNumberByMode, safeNum } from "./utils.js";
import { parseCsvText } from "./censusModule.js";

export const VOTER_DATA_VERSION = "1.0.0";
export const VOTER_FILE_SCHEMA_VERSION = "voter_file.v1";
export const VOTER_LAYER_SCOPING_RULE = "import_broad_persist_narrow";

export const VOTER_LAYER_MATERIAL_FIELD_CLASSES = Object.freeze([
  "canonical_identity",
  "geography_linkage",
  "registration_basics",
  "support_turnout_persuasion",
  "contact_history_linkage",
  "universe_targeting_reporting_inputs",
  "source_provenance",
]);

const VOTER_ADAPTER_PRESETS = Object.freeze({
  canonical: Object.freeze({
    id: "canonical",
    label: "Canonical v1",
    aliases: {
      voterId: ["voter_id", "voterid", "id"],
      firstName: ["first_name", "firstname", "first"],
      lastName: ["last_name", "lastname", "last"],
      fullName: ["full_name", "fullname", "name"],
      address1: ["address", "address1", "street", "street1"],
      city: ["city"],
      state: ["state", "state_abbr", "st"],
      zip5: ["zip", "zip5", "zipcode"],
      precinctId: ["precinct", "precinct_id", "vtd", "vtd_id"],
      tractGeoid: ["tract_geoid", "tract", "tractid", "geoid_tract"],
      blockGroupGeoid: ["block_group_geoid", "blockgroup", "block_group", "geoid_bg", "bg_geoid"],
      supportScore: ["support_score", "supportscore", "support_prob", "support_probability"],
      turnoutScore: ["turnout_score", "turnoutscore", "turnout_prob", "turnout_probability"],
      persuasionScore: ["persuasion_score", "persuasionscore", "persuasion_prob"],
      contactPhone: ["phone", "cell", "mobile", "phone_number", "phone1"],
      contactEmail: ["email", "email_address"],
      preferredLanguage: ["language", "preferred_language"],
      age: ["age"],
      party: ["party", "party_code"],
      registrationStatus: ["registration_status", "reg_status", "status"],
      isAbsenteePermanent: ["is_absentee_permanent", "permanent_absentee", "absentee_permanent"],
      lastContactAt: ["last_contact_at", "last_contact_date", "last_contact"],
      lastContactResult: ["last_contact_result", "contact_result"],
      contactAttempts: ["contact_attempts", "attempts", "attempt_count"],
      contactConversations: ["contact_conversations", "conversations", "conversation_count", "convos"],
      supportLevel: ["support_level", "support_code"],
      universeTags: ["universe_tags", "tags", "segments"],
    },
  }),
  van: Object.freeze({
    id: "van",
    label: "VAN",
    aliases: {
      voterId: ["vanid", "voterfilevanid", "voter_file_vanid", "voter_file_id"],
      firstName: ["firstname", "first_name"],
      lastName: ["lastname", "last_name"],
      fullName: ["name", "full_name"],
      address1: ["addressline1", "address_line_1", "address"],
      city: ["city"],
      state: ["statecode", "state"],
      zip5: ["zip", "zip5", "zip_code"],
      precinctId: ["precinctname", "precinct", "precinct_id", "vtd"],
      tractGeoid: ["tract", "tract_geoid"],
      blockGroupGeoid: ["blockgroup", "block_group", "bg_geoid"],
      supportScore: ["supportscore", "support_score"],
      turnoutScore: ["turnoutscore", "turnout_score"],
      persuasionScore: ["persuasionscore", "persuasion_score"],
      contactPhone: ["phone", "cellphone", "bestphone", "best_phone"],
      contactEmail: ["email", "emailaddress"],
      preferredLanguage: ["preferredlanguage", "language"],
      age: ["age"],
      party: ["party", "partyname"],
      registrationStatus: ["voterstatus", "registration_status"],
      isAbsenteePermanent: ["permanentabsentee", "is_absentee_permanent"],
      lastContactAt: ["lastcontacteddate", "last_contact_date"],
      lastContactResult: ["lastcontactresult", "last_contact_result"],
      contactAttempts: ["attempts", "contact_attempts"],
      contactConversations: ["conversations", "contact_conversations"],
      supportLevel: ["supportlevel", "support_level"],
      universeTags: ["mycampaignuniverses", "universes", "tags"],
    },
  }),
  l2: Object.freeze({
    id: "l2",
    label: "L2",
    aliases: {
      voterId: ["l2_voter_id", "voter_id", "state_voter_id"],
      firstName: ["first_name"],
      lastName: ["last_name"],
      fullName: ["full_name", "name"],
      address1: ["residential_address", "address", "address1"],
      city: ["residential_city", "city"],
      state: ["residential_state", "state"],
      zip5: ["residential_zip5", "zip5", "zip"],
      precinctId: ["precinct_id", "precinct"],
      tractGeoid: ["tract_geoid", "tract"],
      blockGroupGeoid: ["block_group_geoid", "blockgroup_geoid", "block_group"],
      supportScore: ["support_score", "support_prob"],
      turnoutScore: ["turnout_score", "turnout_prob"],
      persuasionScore: ["persuasion_score", "persuasion_prob"],
      contactPhone: ["phone", "mobile_phone", "cell_phone"],
      contactEmail: ["email"],
      preferredLanguage: ["language"],
      age: ["age"],
      party: ["party"],
      registrationStatus: ["registration_status"],
      isAbsenteePermanent: ["is_absentee_permanent"],
      lastContactAt: ["last_contact_at", "last_contact_date"],
      lastContactResult: ["last_contact_result"],
      contactAttempts: ["contact_attempts"],
      contactConversations: ["contact_conversations"],
      supportLevel: ["support_level"],
      universeTags: ["universe_tags", "tags"],
    },
  }),
  state_file: Object.freeze({
    id: "state_file",
    label: "State File CSV",
    aliases: {
      voterId: ["state_voter_id", "voter_id", "idnumber", "id"],
      firstName: ["first_name", "firstname"],
      lastName: ["last_name", "lastname"],
      fullName: ["name", "full_name"],
      address1: ["res_address", "residential_address", "address"],
      city: ["city", "res_city"],
      state: ["state", "res_state"],
      zip5: ["zip5", "zip", "res_zip5"],
      precinctId: ["precinct", "pct", "vtd", "precinct_id"],
      tractGeoid: ["tract_geoid", "tract"],
      blockGroupGeoid: ["block_group_geoid", "block_group", "bg_geoid"],
      supportScore: ["support_score"],
      turnoutScore: ["turnout_score"],
      persuasionScore: ["persuasion_score"],
      contactPhone: ["phone", "cell", "mobile", "phone_number"],
      contactEmail: ["email"],
      preferredLanguage: ["language"],
      age: ["age"],
      party: ["party"],
      registrationStatus: ["registration_status"],
      isAbsenteePermanent: ["permanent_absentee", "is_absentee_permanent"],
      lastContactAt: ["last_contact_date", "last_contact_at"],
      lastContactResult: ["last_contact_result"],
      contactAttempts: ["contact_attempts", "attempts"],
      contactConversations: ["contact_conversations", "conversations"],
      supportLevel: ["support_level"],
      universeTags: ["universe_tags", "tags", "segments"],
    },
  }),
});

const VOTER_ADAPTER_ALIASES = Object.freeze({
  statecsv: "state_file",
  state_csv: "state_file",
  "state-file": "state_file",
  statefile: "state_file",
  statefiles: "state_file",
});

const CANONICAL_VOTER_FIELDS = Object.freeze([
  "voterId",
  "firstName",
  "lastName",
  "fullName",
  "address1",
  "city",
  "state",
  "zip5",
  "precinctId",
  "tractGeoid",
  "blockGroupGeoid",
  "supportScore",
  "turnoutScore",
  "persuasionScore",
  "contactPhone",
  "contactEmail",
  "preferredLanguage",
  "age",
  "party",
  "registrationStatus",
  "isAbsenteePermanent",
  "lastContactAt",
  "lastContactResult",
  "contactAttempts",
  "contactConversations",
  "supportLevel",
  "universeTags",
  "campaignId",
  "officeId",
  "sourceId",
  "sourceRowIndex",
]);
const TRACEABILITY_HEADER_SAMPLE_LIMIT = 32;

const REQUIRED_CANONICAL_FIELDS = Object.freeze(["voterId"]);
const RECOMMENDED_CANONICAL_FIELDS = Object.freeze([
  "precinctId",
  "tractGeoid",
  "supportScore",
  "turnoutScore",
  "lastContactAt",
]);

const NON_ROW_CONTEXT_FIELDS = new Set(["campaignId", "officeId", "sourceId", "sourceRowIndex"]);

/**
 * @param {unknown} value
 * @returns {string}
 */
function cleanText(value){
  return String(value == null ? "" : value).trim();
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function canonicalToken(value){
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function isoOrNull(value){
  const s = cleanText(value);
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function intOrNull(value){
  const n = safeNum(value);
  if (n == null) return null;
  return Math.trunc(n);
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function nonNegativeIntOrNull(value){
  const n = intOrNull(value);
  if (n == null) return null;
  return n < 0 ? 0 : n;
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function unitScoreOrNull(value){
  const n = safeNum(value);
  if (n == null) return null;
  // Accept either 0..1 or 0..100 and normalize into unit.
  const normalized = n > 1 ? (n / 100) : n;
  return clampFiniteNumber(normalized, 0, 1);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function boolValue(value){
  const s = cleanText(value).toLowerCase();
  if (!s) return false;
  if (s === "true" || s === "1" || s === "yes" || s === "y") return true;
  return false;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function parseZip5(value){
  const digits = cleanText(value).replace(/\D+/g, "");
  if (!digits) return null;
  return digits.slice(0, 5).padStart(5, "0");
}

/**
 * @param {unknown} numerator
 * @param {unknown} denominator
 * @returns {number}
 */
function unitRatio(numerator, denominator){
  const num = safeNum(numerator);
  const den = safeNum(denominator);
  if (num == null || den == null || den <= 0) return 0;
  return clampFiniteNumber(num / den, 0, 1);
}

/**
 * @param {unknown} value
 * @param {11|12=} expectedLen
 * @returns {string | null}
 */
function parseGeoid(value, expectedLen){
  const digits = cleanText(value).replace(/\D+/g, "");
  if (!digits) return null;
  if (expectedLen === 11){
    if (digits.length < 11) return null;
    return digits.slice(0, 11);
  }
  if (expectedLen === 12){
    if (digits.length < 12) return null;
    return digits.slice(0, 12);
  }
  return digits;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function parseUniverseTags(value){
  const raw = cleanText(value);
  if (!raw) return [];
  const out = [];
  const seen = new Set();
  for (const token of raw.split(/[\s,;|]+/g)){
    const next = cleanText(token);
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
}

/**
 * Parse user-provided voter rows from JSON/CSV input.
 * Parsing is flexible; canonical field shaping happens in normalizeVoterRows().
 *
 * @param {unknown} input
 * @param {{ format?: unknown, maxRows?: unknown }=} options
 * @returns {{
 *   ok: boolean,
 *   format: "json" | "csv" | "rows" | "unknown",
 *   rows: Array<Record<string, any>>,
 *   errors: string[],
 *   warnings: string[],
 * }}
 */
export function parseVoterRowsInput(input, options = {}){
  const format = cleanText(options?.format).toLowerCase();
  const maxRows = Math.max(
    1,
    roundWholeNumberByMode(safeNum(options?.maxRows) ?? 500000, { mode: "floor", fallback: 500000 }) ?? 500000
  );
  const fail = (message) => ({
    ok: false,
    format: "unknown",
    rows: [],
    errors: [String(message || "Invalid voter input.")],
    warnings: [],
  });

  if (Array.isArray(input)){
    return {
      ok: true,
      format: "rows",
      rows: input.filter((row) => row && typeof row === "object" && !Array.isArray(row)),
      errors: [],
      warnings: [],
    };
  }

  if (input && typeof input === "object" && Array.isArray(input.rows)){
    return {
      ok: true,
      format: "rows",
      rows: input.rows.filter((row) => row && typeof row === "object" && !Array.isArray(row)),
      errors: [],
      warnings: [],
    };
  }

  const text = String(input == null ? "" : input).replace(/^\uFEFF/, "");
  const trimmed = cleanText(text);
  if (!trimmed){
    return fail("Voter input is empty.");
  }

  const shouldParseJson = format === "json" || (format !== "csv" && (trimmed.startsWith("[") || trimmed.startsWith("{")));
  if (shouldParseJson){
    try{
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)){
        return {
          ok: true,
          format: "json",
          rows: parsed.filter((row) => row && typeof row === "object" && !Array.isArray(row)),
          errors: [],
          warnings: [],
        };
      }
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.rows)){
        return {
          ok: true,
          format: "json",
          rows: parsed.rows.filter((row) => row && typeof row === "object" && !Array.isArray(row)),
          errors: [],
          warnings: [],
        };
      }
      return fail("JSON voter input must be an array of row objects or { rows: [...] }.");
    } catch (err){
      if (format === "json"){
        return fail(`JSON parse failed: ${String(err?.message || "invalid JSON")}`);
      }
      // Fall through to CSV parsing in auto mode.
    }
  }

  const parsedCsv = parseCsvText(trimmed, { maxRows });
  return {
    ok: !!parsedCsv?.ok,
    format: "csv",
    rows: Array.isArray(parsedCsv?.rows) ? parsedCsv.rows : [],
    errors: Array.isArray(parsedCsv?.errors) ? parsedCsv.errors.map((value) => String(value || "")).filter(Boolean) : [],
    warnings: Array.isArray(parsedCsv?.warnings) ? parsedCsv.warnings.map((value) => String(value || "")).filter(Boolean) : [],
  };
}

/**
 * Canonical voter-import outcome summary for bridge/UI surfaces.
 * @param {{
 *   voterDataState?: unknown,
 *   warnings?: unknown[],
 * }} payload
 * @returns {{
 *   rowCount: number,
 *   sourceRef: string,
 *   statusText: string,
 *   warningText: string,
 * }}
 */
export function buildVoterImportOutcomeView(payload = {}){
  const src = payload && typeof payload === "object" ? payload : {};
  const normalized = normalizeVoterDataState(src.voterDataState);
  const warnings = Array.isArray(src.warnings)
    ? src.warnings.map((value) => cleanText(value)).filter(Boolean)
    : [];
  const rowCount = Array.isArray(normalized?.rows) ? normalized.rows.length : 0;
  const sourceRef = formatVoterSourceRef(
    normalized?.manifest?.adapterId,
    normalized?.manifest?.sourceId,
    { fallback: "canonical" },
  );
  const statusText = rowCount > 0
    ? `Imported ${rowCount.toLocaleString("en-US")} voter rows (${sourceRef}).`
    : "No voter rows imported.";
  const warningText = warnings.length
    ? `Voter import warnings: ${warnings.slice(0, 3).join(" ")}`
    : "";
  return {
    rowCount,
    sourceRef,
    statusText,
    warningText,
  };
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeStringArray(value){
  const list = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const item of list){
    const next = cleanText(item);
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
}

/**
 * @param {string} canonicalField
 * @returns {boolean}
 */
export function isMaterialCanonicalVoterField(canonicalField){
  const key = cleanText(canonicalField);
  return CANONICAL_VOTER_FIELDS.includes(key);
}

/**
 * @param {string} canonicalField
 * @param {Record<string, string>} headerMap
 * @param {{ aliases?: Record<string, string[]> }=} adapter
 * @returns {Set<string>}
 */
function resolveFieldLookupTokens(canonicalField, headerMap, adapter){
  const tokens = new Set();
  tokens.add(canonicalToken(canonicalField));
  const preferred = cleanText(headerMap?.[canonicalField]);
  if (preferred) tokens.add(canonicalToken(preferred));
  const aliasList = Array.isArray(adapter?.aliases?.[canonicalField]) ? adapter.aliases[canonicalField] : [];
  for (const alias of aliasList){
    const token = canonicalToken(alias);
    if (token) tokens.add(token);
  }
  return tokens;
}

/**
 * @param {unknown[]} rows
 * @returns {Array<{ name: string, token: string }>}
 */
function collectSourceHeaders(rows){
  const out = [];
  const seen = new Set();
  for (const row of rows){
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    for (const key of Object.keys(/** @type {Record<string, any>} */ (row))){
      const name = cleanText(key);
      const token = canonicalToken(name);
      if (!name || !token || seen.has(token)) continue;
      seen.add(token);
      out.push({ name, token });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/**
 * @param {unknown} adapterId
 * @returns {string}
 */
export function normalizeVoterAdapterId(adapterId){
  const raw = cleanText(adapterId).toLowerCase();
  if (Object.prototype.hasOwnProperty.call(VOTER_ADAPTER_PRESETS, raw)){
    return raw;
  }
  const compact = raw.replace(/[\s\-]+/g, "_");
  if (Object.prototype.hasOwnProperty.call(VOTER_ADAPTER_PRESETS, compact)){
    return compact;
  }
  const aliasHit = Object.prototype.hasOwnProperty.call(VOTER_ADAPTER_ALIASES, raw)
    ? VOTER_ADAPTER_ALIASES[raw]
    : VOTER_ADAPTER_ALIASES[compact];
  return aliasHit || "canonical";
}

/**
 * @returns {Array<{ id: string, label: string }>}
 */
export function listVoterAdapterOptions(){
  return Object.values(VOTER_ADAPTER_PRESETS).map((row) => ({
    id: row.id,
    label: row.label,
  }));
}

/**
 * Canonical adapter/source reference label for voter provenance.
 * @param {unknown} adapterId
 * @param {unknown} sourceId
 * @param {{ fallback?: string }=} options
 * @returns {string}
 */
export function formatVoterSourceRef(adapterId, sourceId, options = {}){
  const fallback = cleanText(options?.fallback || "—");
  const adapter = cleanText(adapterId);
  const source = cleanText(sourceId);
  if (adapter && source){
    return `${adapter}:${source}`;
  }
  return source || adapter || fallback;
}

/**
 * Canonical voter-file format inference from filename.
 * @param {unknown} fileName
 * @param {{ fallback?: "auto" | "csv" | "json" }=} options
 * @returns {"auto" | "csv" | "json"}
 */
export function inferVoterInputFormat(fileName, options = {}){
  const fallback = String(options?.fallback || "auto").trim().toLowerCase();
  const safeFallback = fallback === "csv" || fallback === "json" ? fallback : "auto";
  const name = cleanText(fileName).toLowerCase();
  if (!name){
    return safeFallback;
  }
  if (name.endsWith(".json")){
    return "json";
  }
  if (name.endsWith(".csv")){
    return "csv";
  }
  return safeFallback;
}

/**
 * @returns {string[]}
 */
export function listCanonicalVoterFields(){
  return CANONICAL_VOTER_FIELDS.slice();
}

/**
 * @returns {{ required: string[], recommended: string[] }}
 */
export function listCanonicalVoterFieldTiers(){
  return {
    required: REQUIRED_CANONICAL_FIELDS.slice(),
    recommended: RECOMMENDED_CANONICAL_FIELDS.slice(),
  };
}

/**
 * @returns {{
 *   schemaVersion: string,
 *   sourceId: string,
 *   sourceLabel: string,
 *   adapterId: string,
 *   importedAt: string | null,
 *   campaignId: string,
 *   officeId: string,
 *   rowCount: number,
 *   headerMap: Record<string, string>,
 *   mappedCanonicalFields: string[],
 *   ignoredHeaderCount: number,
 *   ignoredHeadersSample: string[],
 * }}
 */
export function makeDefaultVoterManifest(){
  return {
    schemaVersion: VOTER_FILE_SCHEMA_VERSION,
    sourceId: "",
    sourceLabel: "",
    adapterId: "canonical",
    importedAt: null,
    campaignId: "default",
    officeId: "",
    rowCount: 0,
    headerMap: {},
    mappedCanonicalFields: [],
    ignoredHeaderCount: 0,
    ignoredHeadersSample: [],
  };
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof makeDefaultVoterManifest>}
 */
export function normalizeVoterManifest(raw){
  const base = makeDefaultVoterManifest();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const src = /** @type {Record<string, any>} */ (raw);
  const rowCountRaw = safeNum(src.rowCount);
  return {
    ...base,
    ...src,
    schemaVersion: cleanText(src.schemaVersion) || base.schemaVersion,
    sourceId: cleanText(src.sourceId),
    sourceLabel: cleanText(src.sourceLabel),
    adapterId: normalizeVoterAdapterId(src.adapterId),
    importedAt: isoOrNull(src.importedAt),
    campaignId: cleanText(src.campaignId) || base.campaignId,
    officeId: cleanText(src.officeId),
    rowCount: Number.isFinite(rowCountRaw) && rowCountRaw > 0 ? Math.trunc(rowCountRaw) : 0,
    headerMap: normalizeVoterHeaderMap(src.headerMap, { adapterId: src.adapterId }),
    mappedCanonicalFields: normalizeStringArray(src.mappedCanonicalFields).filter((field) => CANONICAL_VOTER_FIELDS.includes(field)),
    ignoredHeaderCount: Math.max(0, Math.trunc(Number(src.ignoredHeaderCount) || 0)),
    ignoredHeadersSample: normalizeStringArray(src.ignoredHeadersSample).slice(0, TRACEABILITY_HEADER_SAMPLE_LIMIT),
  };
}

/**
 * @param {unknown} raw
 * @param {{ adapterId?: unknown }=} options
 * @returns {Record<string, string>}
 */
export function normalizeVoterHeaderMap(raw, { adapterId } = {}){
  const out = {};
  const src = (raw && typeof raw === "object" && !Array.isArray(raw))
    ? /** @type {Record<string, any>} */ (raw)
    : {};
  for (const field of CANONICAL_VOTER_FIELDS){
    if (NON_ROW_CONTEXT_FIELDS.has(field)) continue;
    const mapped = cleanText(src[field]);
    if (mapped) out[field] = mapped;
  }

  const adapter = VOTER_ADAPTER_PRESETS[normalizeVoterAdapterId(adapterId)];
  for (const field of CANONICAL_VOTER_FIELDS){
    if (NON_ROW_CONTEXT_FIELDS.has(field)) continue;
    if (out[field]) continue;
    const aliases = adapter?.aliases?.[field] || [];
    if (aliases[0]) out[field] = String(aliases[0]);
  }
  return out;
}

/**
 * @param {Record<string, any>} row
 * @param {string} canonicalField
 * @param {Record<string, string>} headerMap
 * @param {{ aliases?: Record<string, string[]> }} adapter
 * @returns {unknown}
 */
function resolveFieldValue(row, canonicalField, headerMap, adapter){
  const preferred = cleanText(headerMap?.[canonicalField]);
  if (preferred && Object.prototype.hasOwnProperty.call(row, preferred)){
    return row[preferred];
  }

  const aliasList = Array.isArray(adapter?.aliases?.[canonicalField]) ? adapter.aliases[canonicalField] : [];
  const wanted = new Set(aliasList.map((token) => canonicalToken(token)));
  // Always include canonical field-token fallback so canonical row keys remain valid
  // even when adapter aliases are vendor-specific (e.g., VAN/L2 imports).
  wanted.add(canonicalToken(canonicalField));
  if (preferred) wanted.add(canonicalToken(preferred));

  for (const [key, value] of Object.entries(row)){
    const normalizedKey = canonicalToken(key);
    if (wanted.has(normalizedKey)){
      return value;
    }
  }
  return null;
}

/**
 * @param {Record<string, any>} row
 * @param {{
 *   adapterId?: unknown,
 *   headerMap?: unknown,
 *   campaignId?: unknown,
 *   officeId?: unknown,
 *   sourceId?: unknown,
 *   sourceRowIndex?: unknown,
 * }} options
 * @returns {Record<string, any> | null}
 */
export function normalizeVoterRecord(row, options = {}){
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const adapterId = normalizeVoterAdapterId(options.adapterId);
  const adapter = VOTER_ADAPTER_PRESETS[adapterId];
  const headerMap = normalizeVoterHeaderMap(options.headerMap, { adapterId });
  const resolve = (field) => resolveFieldValue(row, field, headerMap, adapter);

  const voterIdRaw = cleanText(resolve("voterId"));
  if (!voterIdRaw) return null;
  const tractGeoid = parseGeoid(resolve("tractGeoid"), 11);
  const blockGroupGeoid = parseGeoid(resolve("blockGroupGeoid"), 12);

  return {
    voterId: voterIdRaw,
    firstName: cleanText(resolve("firstName")),
    lastName: cleanText(resolve("lastName")),
    fullName: cleanText(resolve("fullName")),
    address1: cleanText(resolve("address1")),
    city: cleanText(resolve("city")),
    state: cleanText(resolve("state")).toUpperCase(),
    zip5: parseZip5(resolve("zip5")),
    precinctId: cleanText(resolve("precinctId")),
    tractGeoid,
    blockGroupGeoid,
    supportScore: unitScoreOrNull(resolve("supportScore")),
    turnoutScore: unitScoreOrNull(resolve("turnoutScore")),
    persuasionScore: unitScoreOrNull(resolve("persuasionScore")),
    contactPhone: cleanText(resolve("contactPhone")),
    contactEmail: cleanText(resolve("contactEmail")).toLowerCase(),
    preferredLanguage: cleanText(resolve("preferredLanguage")),
    age: nonNegativeIntOrNull(resolve("age")),
    party: cleanText(resolve("party")),
    registrationStatus: cleanText(resolve("registrationStatus")),
    isAbsenteePermanent: boolValue(resolve("isAbsenteePermanent")),
    lastContactAt: isoOrNull(resolve("lastContactAt")),
    lastContactResult: cleanText(resolve("lastContactResult")),
    contactAttempts: nonNegativeIntOrNull(resolve("contactAttempts")) ?? 0,
    contactConversations: nonNegativeIntOrNull(resolve("contactConversations")) ?? 0,
    supportLevel: cleanText(resolve("supportLevel")),
    universeTags: parseUniverseTags(resolve("universeTags")),
    campaignId: cleanText(options.campaignId) || "default",
    officeId: cleanText(options.officeId),
    sourceId: cleanText(options.sourceId),
    sourceRowIndex: Number.isFinite(Number(options.sourceRowIndex)) ? Math.max(0, Math.trunc(Number(options.sourceRowIndex))) : 0,
  };
}

/**
 * @param {unknown} rows
 * @param {{
 *   manifest?: unknown,
 *   adapterId?: unknown,
 *   headerMap?: unknown,
 *   campaignId?: unknown,
 *   officeId?: unknown,
 *   sourceId?: unknown,
 * }} options
 * @returns {{
 *   rows: Array<Record<string, any>>,
 *   manifest: ReturnType<typeof normalizeVoterManifest>,
 *   rejectedCount: number,
 *   duplicateCount: number,
 *   warnings: string[],
 * }}
 */
export function normalizeVoterRows(rows, options = {}){
  const list = Array.isArray(rows) ? rows : [];
  const manifest = normalizeVoterManifest({
    ...(options.manifest && typeof options.manifest === "object" ? options.manifest : {}),
    adapterId: options.adapterId,
    headerMap: options.headerMap,
    campaignId: options.campaignId,
    officeId: options.officeId,
    sourceId: options.sourceId,
  });

  const byId = new Map();
  let rejectedCount = 0;
  let duplicateCount = 0;
  for (let i = 0; i < list.length; i += 1){
    const normalized = normalizeVoterRecord(/** @type {Record<string, any>} */ (list[i]), {
      adapterId: manifest.adapterId,
      headerMap: manifest.headerMap,
      campaignId: manifest.campaignId,
      officeId: manifest.officeId,
      sourceId: manifest.sourceId,
      sourceRowIndex: i,
    });
    if (!normalized){
      rejectedCount += 1;
      continue;
    }
    if (byId.has(normalized.voterId)){
      duplicateCount += 1;
    }
    byId.set(normalized.voterId, normalized);
  }

  const normalizedRows = Array.from(byId.values())
    .sort((a, b) => String(a.voterId).localeCompare(String(b.voterId)));
  const adapter = VOTER_ADAPTER_PRESETS[manifest.adapterId];
  const sourceHeaders = collectSourceHeaders(list);
  const mappedCanonicalFieldsDerived = [];
  const matchedHeaderTokens = new Set();
  for (const field of CANONICAL_VOTER_FIELDS){
    if (NON_ROW_CONTEXT_FIELDS.has(field)) continue;
    const tokens = resolveFieldLookupTokens(field, manifest.headerMap, adapter);
    const hasMatch = sourceHeaders.some((header) => tokens.has(header.token));
    if (!hasMatch) continue;
    mappedCanonicalFieldsDerived.push(field);
    for (const token of tokens){
      if (!token) continue;
      matchedHeaderTokens.add(token);
    }
  }
  const ignoredHeaders = sourceHeaders
    .filter((row) => !matchedHeaderTokens.has(row.token))
    .map((row) => row.name);
  const mappedCanonicalFieldsExisting = normalizeStringArray(manifest.mappedCanonicalFields)
    .filter((field) => CANONICAL_VOTER_FIELDS.includes(field));
  const mappedCanonicalFields = mappedCanonicalFieldsExisting.length
    ? mappedCanonicalFieldsExisting
    : mappedCanonicalFieldsDerived;
  const ignoredHeaderCountExisting = safeNum(manifest.ignoredHeaderCount);
  const ignoredHeadersSampleExisting = normalizeStringArray(manifest.ignoredHeadersSample).slice(0, TRACEABILITY_HEADER_SAMPLE_LIMIT);

  const nextManifest = {
    ...manifest,
    importedAt: manifest.importedAt || new Date().toISOString(),
    rowCount: normalizedRows.length,
    mappedCanonicalFields,
    ignoredHeaderCount: (ignoredHeaderCountExisting != null && ignoredHeaderCountExisting >= 0)
      ? Math.max(0, Math.trunc(ignoredHeaderCountExisting))
      : ignoredHeaders.length,
    ignoredHeadersSample: ignoredHeadersSampleExisting.length
      ? ignoredHeadersSampleExisting
      : ignoredHeaders.slice(0, TRACEABILITY_HEADER_SAMPLE_LIMIT),
  };

  const warnings = [];
  if (!normalizedRows.length){
    warnings.push("No valid voter rows were normalized.");
  }
  if (rejectedCount > 0){
    warnings.push(`Rejected ${rejectedCount} row(s) missing required canonical fields.`);
  }
  if (duplicateCount > 0){
    warnings.push(`Collapsed ${duplicateCount} duplicate row(s) by voterId.`);
  }

  return {
    rows: normalizedRows,
    manifest: nextManifest,
    rejectedCount,
    duplicateCount,
    warnings,
  };
}

/**
 * @param {unknown} rows
 * @param {{ includeUniverseTags?: unknown }} options
 * @returns {{
 *   totalVoters: number,
 *   contactableVoters: number,
 *   mappedToPrecinct: number,
 *   mappedToTract: number,
 *   mappedToBlockGroup: number,
 *   persuasionUniverse: number,
 *   turnoutOpportunityUniverse: number,
 *   strongSupportUniverse: number,
 *   strongOppositionUniverse: number,
 *   avgSupportScore: number | null,
 *   avgTurnoutScore: number | null,
 *   avgPersuasionScore: number | null,
 *   partyMix: Record<string, number>,
 * }}
 */
export function buildVoterUniverseSummary(rows, options = {}){
  const list = Array.isArray(rows) ? rows : [];
  const includeTags = parseUniverseTags(options.includeUniverseTags);
  const includeSet = includeTags.length ? new Set(includeTags.map((token) => token.toLowerCase())) : null;
  const filtered = includeSet
    ? list.filter((row) => {
        const tags = Array.isArray(row?.universeTags) ? row.universeTags : [];
        return tags.some((tag) => includeSet.has(cleanText(tag).toLowerCase()));
      })
    : list;

  let total = 0;
  let contactable = 0;
  let mappedPrecinct = 0;
  let mappedTract = 0;
  let mappedBlock = 0;
  let persuasionUniverse = 0;
  let turnoutOpportunityUniverse = 0;
  let strongSupport = 0;
  let strongOpposition = 0;
  let supportSum = 0;
  let supportCount = 0;
  let turnoutSum = 0;
  let turnoutCount = 0;
  let persuasionSum = 0;
  let persuasionCount = 0;
  const partyMix = {};

  for (const row of filtered){
    total += 1;
    const phone = cleanText(row?.contactPhone);
    const email = cleanText(row?.contactEmail);
    if (phone || email) contactable += 1;
    if (cleanText(row?.precinctId)) mappedPrecinct += 1;
    if (cleanText(row?.tractGeoid)) mappedTract += 1;
    if (cleanText(row?.blockGroupGeoid)) mappedBlock += 1;

    const support = unitScoreOrNull(row?.supportScore);
    if (support != null){
      supportSum += support;
      supportCount += 1;
      if (support >= 0.65) strongSupport += 1;
      if (support <= 0.35) strongOpposition += 1;
      if (support > 0.35 && support < 0.65) persuasionUniverse += 1;
    }

    const turnout = unitScoreOrNull(row?.turnoutScore);
    if (turnout != null){
      turnoutSum += turnout;
      turnoutCount += 1;
      if (turnout < 0.60) turnoutOpportunityUniverse += 1;
    }

    const persuasion = unitScoreOrNull(row?.persuasionScore);
    if (persuasion != null){
      persuasionSum += persuasion;
      persuasionCount += 1;
    }

    const party = cleanText(row?.party).toUpperCase() || "UNKNOWN";
    partyMix[party] = (partyMix[party] || 0) + 1;
  }

  return {
    totalVoters: total,
    contactableVoters: contactable,
    mappedToPrecinct: mappedPrecinct,
    mappedToTract: mappedTract,
    mappedToBlockGroup: mappedBlock,
    persuasionUniverse,
    turnoutOpportunityUniverse,
    strongSupportUniverse: strongSupport,
    strongOppositionUniverse: strongOpposition,
    avgSupportScore: supportCount > 0 ? (supportSum / supportCount) : null,
    avgTurnoutScore: turnoutCount > 0 ? (turnoutSum / turnoutCount) : null,
    avgPersuasionScore: persuasionCount > 0 ? (persuasionSum / persuasionCount) : null,
    partyMix,
  };
}

/**
 * @param {unknown} rows
 * @param {{ recentWindowDays?: unknown, nowIso?: unknown }} options
 * @returns {{
 *   totalRows: number,
 *   withContactTimestamp: number,
 *   recentlyContacted: number,
 *   totalAttempts: number,
 *   totalConversations: number,
 *   supportIdentifiedCount: number,
 *   historyByDate: Array<{ date: string, contacted: number, attempts: number, conversations: number }>,
 * }}
 */
export function buildVoterContactHistoryLedger(rows, options = {}){
  const list = Array.isArray(rows) ? rows : [];
  const nowIso = isoOrNull(options.nowIso) || new Date().toISOString();
  const nowMs = new Date(nowIso).getTime();
  const recentWindowRaw = safeNum(options.recentWindowDays);
  const recentWindowDays = (recentWindowRaw != null && recentWindowRaw > 0) ? Math.trunc(recentWindowRaw) : 21;
  const recentMs = recentWindowDays * 24 * 60 * 60 * 1000;

  const history = new Map();
  let withContactTimestamp = 0;
  let recentlyContacted = 0;
  let totalAttempts = 0;
  let totalConversations = 0;
  let supportIdentifiedCount = 0;

  for (const row of list){
    const attempts = Math.max(0, nonNegativeIntOrNull(row?.contactAttempts) ?? 0);
    const conversations = Math.max(0, nonNegativeIntOrNull(row?.contactConversations) ?? 0);
    totalAttempts += attempts;
    totalConversations += Math.min(conversations, attempts);
    const resultText = cleanText(row?.lastContactResult).toLowerCase();
    if (resultText.includes("support")) supportIdentifiedCount += 1;

    const contactIso = isoOrNull(row?.lastContactAt);
    if (!contactIso) continue;
    withContactTimestamp += 1;
    const contactMs = new Date(contactIso).getTime();
    const hasRecentConversation = Math.min(conversations, attempts) > 0;
    const hasRecentResult = resultText.length > 0;
    if (Number.isFinite(contactMs) && (nowMs - contactMs) <= recentMs && (hasRecentConversation || hasRecentResult)){
      recentlyContacted += 1;
    }
    const date = contactIso.slice(0, 10);
    const bucket = history.get(date) || { date, contacted: 0, attempts: 0, conversations: 0 };
    bucket.contacted += 1;
    bucket.attempts += attempts;
    bucket.conversations += Math.min(conversations, attempts);
    history.set(date, bucket);
  }

  return {
    totalRows: list.length,
    withContactTimestamp,
    recentlyContacted,
    totalAttempts,
    totalConversations,
    supportIdentifiedCount,
    historyByDate: Array.from(history.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/**
 * Derive canonical voter-data signals for downstream model modules.
 * Keeps voter import logic lean while exposing deterministic scoring inputs.
 *
 * @param {unknown} voterDataState
 * @param {{ nowIso?: unknown, recentWindowDays?: unknown }} options
 * @returns {{
 *   hasRows: boolean,
 *   totalRows: number,
 *   coverage: {
 *     contactableRate: number,
 *     mappedPrecinctRate: number,
 *     mappedTractRate: number,
 *     mappedBlockGroupRate: number,
 *     geoCoverageRate: number,
 *   },
 *   history: {
 *     recentContactRate: number,
 *     conversationRate: number,
 *     supportIdentifiedRate: number,
 *   },
 *   targeting: {
 *     networkValueDefault: number,
 *     contactProbabilityMultiplier: number,
 *     saturationMultiplierDefault: number,
 *   },
 * }}
 */
export function deriveVoterModelSignals(voterDataState, options = {}){
  const state = (voterDataState && typeof voterDataState === "object" && !Array.isArray(voterDataState))
    ? /** @type {Record<string, any>} */ (voterDataState)
    : {};
  const rows = Array.isArray(state.rows) ? state.rows : [];
  const summary = (state.latestUniverseSummary && typeof state.latestUniverseSummary === "object")
    ? state.latestUniverseSummary
    : buildVoterUniverseSummary(rows);
  const ledger = (state.latestContactLedger && typeof state.latestContactLedger === "object")
    ? state.latestContactLedger
    : buildVoterContactHistoryLedger(rows, options);

  const totalRows = Math.max(
    0,
    Math.trunc(
      safeNum(summary?.totalVoters)
      ?? safeNum(ledger?.totalRows)
      ?? rows.length,
    ),
  );
  const hasRows = totalRows > 0;
  const contactableRate = unitRatio(summary?.contactableVoters, totalRows);
  const mappedPrecinctRate = unitRatio(summary?.mappedToPrecinct, totalRows);
  const mappedTractRate = unitRatio(summary?.mappedToTract, totalRows);
  const mappedBlockGroupRate = unitRatio(summary?.mappedToBlockGroup, totalRows);
  const geoCoverageRate = Math.max(mappedBlockGroupRate, mappedTractRate, mappedPrecinctRate);

  const recentContactRate = unitRatio(ledger?.recentlyContacted, totalRows);
  const conversationRate = unitRatio(ledger?.totalConversations, ledger?.totalAttempts);
  const supportIdentifiedRate = unitRatio(ledger?.supportIdentifiedCount, totalRows);

  const networkValueDefault = clampFiniteNumber(
    (supportIdentifiedRate * 0.7) + (conversationRate * 0.3),
    0,
    1,
  );
  const contactProbabilityMultiplier = clampFiniteNumber(
    0.72 + (contactableRate * 0.56),
    0.65,
    1.25,
  );
  const saturationMultiplierDefault = clampFiniteNumber(
    1 - (recentContactRate * 0.5),
    0.55,
    1.05,
  );

  return {
    hasRows,
    totalRows,
    coverage: {
      contactableRate,
      mappedPrecinctRate,
      mappedTractRate,
      mappedBlockGroupRate,
      geoCoverageRate,
    },
    history: {
      recentContactRate,
      conversationRate,
      supportIdentifiedRate,
    },
    targeting: {
      networkValueDefault,
      contactProbabilityMultiplier,
      saturationMultiplierDefault,
    },
  };
}

/**
 * Canonical compact voter-layer snapshot for bridge/view modules.
 * Keeps voter-status shaping out of UI/runtime glue code.
 *
 * @param {unknown} voterDataState
 * @param {{ nowIso?: unknown, recentWindowDays?: unknown }=} options
 * @returns {{
 *   scopingRule: string,
 *   hasRows: boolean,
 *   rowCount: number,
 *   adapterId: string,
 *   sourceId: string,
 *   importedAt: string,
 *   mappedCanonicalFieldCount: number,
 *   ignoredHeaderCount: number,
 *   geoCoverageRate: number,
 *   contactableRate: number,
 *   recentContactRate: number,
 *   conversationRate: number,
 * }}
 */
export function buildVoterLayerStatusSnapshot(voterDataState, options = {}){
  const normalized = normalizeVoterDataState(voterDataState);
  const manifest = normalized?.manifest && typeof normalized.manifest === "object"
    ? normalized.manifest
    : makeDefaultVoterManifest();
  const signals = deriveVoterModelSignals(normalized, options);
  return {
    scopingRule: VOTER_LAYER_SCOPING_RULE,
    hasRows: !!signals?.hasRows,
    rowCount: Math.max(0, Math.trunc(safeNum(signals?.totalRows) ?? 0)),
    adapterId: normalizeVoterAdapterId(manifest?.adapterId),
    sourceId: cleanText(manifest?.sourceId),
    importedAt: cleanText(manifest?.importedAt),
    mappedCanonicalFieldCount: Array.isArray(manifest?.mappedCanonicalFields)
      ? manifest.mappedCanonicalFields.length
      : 0,
    ignoredHeaderCount: Math.max(0, Math.trunc(safeNum(manifest?.ignoredHeaderCount) ?? 0)),
    geoCoverageRate: clampFiniteNumber(safeNum(signals?.coverage?.geoCoverageRate) ?? 0, 0, 1),
    contactableRate: clampFiniteNumber(safeNum(signals?.coverage?.contactableRate) ?? 0, 0, 1),
    recentContactRate: clampFiniteNumber(safeNum(signals?.history?.recentContactRate) ?? 0, 0, 1),
    conversationRate: clampFiniteNumber(safeNum(signals?.history?.conversationRate) ?? 0, 0, 1),
  };
}

/**
 * @returns {{
 *   version: string,
 *   manifest: ReturnType<typeof makeDefaultVoterManifest>,
 *   rows: Array<Record<string, any>>,
 *   latestUniverseSummary: ReturnType<typeof buildVoterUniverseSummary> | null,
 *   latestContactLedger: ReturnType<typeof buildVoterContactHistoryLedger> | null,
 * }}
 */
export function makeDefaultVoterDataState(){
  return {
    version: VOTER_DATA_VERSION,
    manifest: makeDefaultVoterManifest(),
    rows: [],
    latestUniverseSummary: null,
    latestContactLedger: null,
  };
}

/**
 * @param {unknown} raw
 * @returns {ReturnType<typeof makeDefaultVoterDataState>}
 */
export function normalizeVoterDataState(raw){
  const base = makeDefaultVoterDataState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const src = /** @type {Record<string, any>} */ (raw);
  const normalizedRows = normalizeVoterRows(src.rows, {
    manifest: src.manifest,
    adapterId: src?.manifest?.adapterId,
    headerMap: src?.manifest?.headerMap,
    campaignId: src?.manifest?.campaignId,
    officeId: src?.manifest?.officeId,
    sourceId: src?.manifest?.sourceId,
  });
  const latestUniverseSummary = buildVoterUniverseSummary(normalizedRows.rows);
  const latestContactLedger = buildVoterContactHistoryLedger(normalizedRows.rows);
  return {
    ...base,
    ...src,
    version: cleanText(src.version) || base.version,
    manifest: normalizedRows.manifest,
    rows: normalizedRows.rows,
    latestUniverseSummary,
    latestContactLedger,
  };
}
