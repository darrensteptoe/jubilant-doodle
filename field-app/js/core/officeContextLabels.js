// @ts-check

export const OFFICE_CONTEXT_UNMAPPED_LABEL = "Unmapped Office Context";

export const OFFICE_CONTEXT_CANONICAL_VALUES = Object.freeze([
  "municipal_executive",
  "municipal_legislative",
  "countywide",
  "state_house",
  "state_senate",
  "congressional_district",
  "statewide_executive",
  "statewide_federal",
  "judicial_other",
  "custom_context",
]);

export const OFFICE_CONTEXT_CANONICAL_LABELS = Object.freeze({
  municipal_executive: "Municipal Executive",
  municipal_legislative: "Municipal Legislative",
  countywide: "Countywide",
  state_house: "State House",
  state_senate: "State Senate",
  congressional_district: "Congressional District",
  statewide_executive: "Statewide Executive",
  statewide_federal: "Statewide Federal",
  judicial_other: "Judicial / Other",
  custom_context: "Custom Context",
});

export const OFFICE_CONTEXT_DIMENSION_LABELS = Object.freeze({
  ...OFFICE_CONTEXT_CANONICAL_LABELS,
  state_legislative_lower: "State House",
  state_legislative_upper: "State Senate",
});

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function isCanonicalishToken(token){
  return /^[a-z0-9_ ]+$/i.test(token) && /[a-z]/i.test(token);
}

function toTitleCase(token){
  return token
    .replace(/[_\s-]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function normalizeOfficeContextToken(value){
  const raw = cleanText(value).toLowerCase();
  if (!raw) return "";
  return raw.replace(/[\s-]+/g, "_");
}

function resolveLegacyFederalLabel(intentToken){
  if (intentToken === "statewide_federal"){
    return OFFICE_CONTEXT_CANONICAL_LABELS.statewide_federal;
  }
  if (intentToken === "statewide_executive"){
    return OFFICE_CONTEXT_CANONICAL_LABELS.statewide_executive;
  }
  if (intentToken === "congressional_district"){
    return OFFICE_CONTEXT_CANONICAL_LABELS.congressional_district;
  }
  return "Federal";
}

function resolveLegacyStateLegLabel(intentToken){
  if (intentToken === "state_house" || intentToken === "state_legislative_lower"){
    return OFFICE_CONTEXT_CANONICAL_LABELS.state_house;
  }
  if (intentToken === "state_senate" || intentToken === "state_legislative_upper"){
    return OFFICE_CONTEXT_CANONICAL_LABELS.state_senate;
  }
  return "State Legislative";
}

/**
 * Convert stored office/context tokens into human-facing labels.
 *
 * @param {unknown} value
 * @param {{ legacyIntent?: unknown, unmappedLabel?: string }=} options
 * @returns {string}
 */
export function formatOfficeContextLabel(value, options = {}){
  const raw = cleanText(value);
  if (!raw) return "";
  const token = normalizeOfficeContextToken(raw);
  const mapped = OFFICE_CONTEXT_DIMENSION_LABELS[token];
  if (mapped){
    return mapped;
  }

  const legacyIntentToken = normalizeOfficeContextToken(options?.legacyIntent);
  if (token === "federal"){
    return resolveLegacyFederalLabel(legacyIntentToken);
  }
  if (token === "state_leg"){
    return resolveLegacyStateLegLabel(legacyIntentToken);
  }
  if (token === "municipal" || token === "city" || token === "local"){
    return "Municipal";
  }
  if (token === "county"){
    return "County";
  }

  if (isCanonicalishToken(token)){
    return toTitleCase(token);
  }
  return cleanText(options?.unmappedLabel) || OFFICE_CONTEXT_UNMAPPED_LABEL;
}

/**
 * Resolve a display label for office/race/template context from strongest to weakest source.
 *
 * @param {{ appliedTemplateId?: unknown, officeLevel?: unknown, raceType?: unknown, fallback?: string }=} input
 * @returns {string}
 */
export function resolveOfficeContextDisplayLabel(input = {}){
  const src = input && typeof input === "object" ? input : {};
  const appliedTemplateId = normalizeOfficeContextToken(src?.appliedTemplateId);
  if (appliedTemplateId){
    return formatOfficeContextLabel(appliedTemplateId);
  }
  const officeLevel = normalizeOfficeContextToken(src?.officeLevel);
  if (officeLevel){
    return formatOfficeContextLabel(officeLevel);
  }
  const raceType = cleanText(src?.raceType);
  if (raceType){
    return formatOfficeContextLabel(raceType, {
      legacyIntent: officeLevel || appliedTemplateId,
    });
  }
  return cleanText(src?.fallback);
}

/**
 * Canonical office options for modern UI selectors.
 *
 * @param {{ includeBlank?: boolean, blankLabel?: string }=} options
 * @returns {Array<{ value: string, label: string }>}
 */
export function listCanonicalOfficeContextOptions(options = {}){
  const rows = [];
  if (options?.includeBlank){
    rows.push({
      value: "",
      label: cleanText(options?.blankLabel) || "All compatible offices",
    });
  }
  for (const value of OFFICE_CONTEXT_CANONICAL_VALUES){
    rows.push({
      value,
      label: OFFICE_CONTEXT_CANONICAL_LABELS[value] || formatOfficeContextLabel(value),
    });
  }
  return rows;
}
