// @ts-check

const TURF_EVENT_UNIT_TYPES = ["turf", "precinct", "tract", "block_group"];
const UNIT_TYPE_SET = new Set(TURF_EVENT_UNIT_TYPES);

function clean(value){
  return String(value == null ? "" : value).trim();
}

function cleanLower(value){
  return clean(value).toLowerCase();
}

function digitsOnly(value){
  return clean(value).replace(/\D+/g, "");
}

function normalizeToken(value){
  return cleanLower(value).replace(/[^a-z0-9]/g, "");
}

function normalizeStateFips(value){
  const digits = digitsOnly(value);
  if (!digits) return "";
  if (digits.length >= 2){
    return digits.slice(0, 2);
  }
  return "";
}

function normalizeCountyFips(value){
  const digits = digitsOnly(value);
  if (!digits) return "";
  if (digits.length === 5){
    return digits.slice(2, 5);
  }
  if (digits.length >= 3){
    return digits.slice(-3);
  }
  return "";
}

function normalizeGeoid(value, expectedLength){
  const digits = digitsOnly(value);
  if (!digits || !Number.isFinite(expectedLength) || expectedLength <= 0){
    return "";
  }
  if (digits.length === expectedLength){
    return digits;
  }
  if (digits.length > expectedLength){
    return digits.slice(-expectedLength);
  }
  return "";
}

function readPreferredUnitType(raw){
  const val = cleanLower(raw);
  if (!val) return "";
  if (val === "blockgroup" || val === "block-group" || val === "block group" || val === "blockgroupgeoid"){
    return "block_group";
  }
  if (val === "bg" || val === "block_group") return "block_group";
  if (val === "tract") return "tract";
  if (val === "precinct") return "precinct";
  if (val === "turf") return "turf";
  return "";
}

function normalizeUnitIdByType(unitType, rawUnitId){
  const type = readPreferredUnitType(unitType);
  if (!type) return "";
  if (type === "tract"){
    return normalizeGeoid(rawUnitId, 11);
  }
  if (type === "block_group"){
    return normalizeGeoid(rawUnitId, 12);
  }
  return clean(rawUnitId);
}

/**
 * Build a normalized geography unit join key.
 * GEOID unit families remain digit-exact; turf/precinct families are token-normalized.
 * @param {any} unitType
 * @param {any} unitId
 * @returns {string}
 */
export function buildTurfEventUnitJoinKey(unitType, unitId){
  const type = normalizeTurfEventUnitType(unitType);
  const normalizedUnitId = normalizeUnitIdByType(type, unitId);
  if (!type || !normalizedUnitId){
    return "";
  }
  const keyId = (type === "tract" || type === "block_group")
    ? normalizedUnitId
    : normalizeToken(normalizedUnitId);
  return `${type}:${keyId}`;
}

function readLegacyGeoFields(record){
  const row = record && typeof record === "object" ? record : {};
  const blockGroupGeoid = normalizeGeoid(
    row.blockGroupGeoid
      || row.block_group_geoid
      || row.blockGroupId
      || row.block_group_id,
    12,
  );
  const tractGeoid = normalizeGeoid(
    row.tractGeoid
      || row.tract_geoid
      || row.tractId
      || row.tract_id,
    11,
  );
  const precinct = clean(row.precinct);
  const turfId = clean(row.turfId);
  return {
    blockGroupGeoid,
    tractGeoid,
    precinct,
    turfId,
  };
}

function derivePreferredUnit(record, explicitUnitType, explicitUnitId){
  if (explicitUnitType && explicitUnitId){
    return { unitType: explicitUnitType, unitId: explicitUnitId };
  }
  const legacy = readLegacyGeoFields(record);
  if (legacy.blockGroupGeoid){
    return { unitType: "block_group", unitId: legacy.blockGroupGeoid };
  }
  if (legacy.tractGeoid){
    return { unitType: "tract", unitId: legacy.tractGeoid };
  }
  if (legacy.precinct){
    return { unitType: "precinct", unitId: legacy.precinct };
  }
  if (legacy.turfId){
    return { unitType: "turf", unitId: legacy.turfId };
  }
  return { unitType: "", unitId: "" };
}

function deriveStateCountyFips(record, tractGeoid, blockGroupGeoid){
  const row = record && typeof record === "object" ? record : {};
  const derivedGeoid = blockGroupGeoid || tractGeoid;
  const derivedState = derivedGeoid ? derivedGeoid.slice(0, 2) : "";
  const derivedCounty = derivedGeoid ? derivedGeoid.slice(2, 5) : "";
  return {
    stateFips: normalizeStateFips(row.stateFips || row.state_fips || derivedState),
    countyFips: normalizeCountyFips(row.countyFips || row.county_fips || derivedCounty),
  };
}

/**
 * Normalize supported unit type values for turf-event geography references.
 * @param {any} value
 * @returns {"turf"|"precinct"|"tract"|"block_group"|""}
 */
export function normalizeTurfEventUnitType(value){
  const type = readPreferredUnitType(value);
  return UNIT_TYPE_SET.has(type) ? /** @type {any} */ (type) : "";
}

/**
 * Normalize a turf event into an additive geography-join safe shape.
 * Legacy fields are preserved; normalized fields become preferred join refs.
 * @param {Record<string, any>} input
 * @returns {Record<string, any>}
 */
export function normalizeTurfEventRecord(input){
  const record = (input && typeof input === "object") ? { ...input } : {};

  const explicitType = normalizeTurfEventUnitType(record.unitType);
  const explicitUnitId = normalizeUnitIdByType(explicitType, record.unitId);
  const preferred = derivePreferredUnit(record, explicitType, explicitUnitId);

  let blockGroupGeoid = normalizeGeoid(record.blockGroupGeoid || record.block_group_geoid, 12);
  let tractGeoid = normalizeGeoid(record.tractGeoid || record.tract_geoid, 11);

  if (!blockGroupGeoid && preferred.unitType === "block_group"){
    blockGroupGeoid = normalizeGeoid(preferred.unitId, 12);
  }
  if (!tractGeoid && preferred.unitType === "tract"){
    tractGeoid = normalizeGeoid(preferred.unitId, 11);
  }
  if (!tractGeoid && blockGroupGeoid){
    tractGeoid = blockGroupGeoid.slice(0, 11);
  }

  const fips = deriveStateCountyFips(record, tractGeoid, blockGroupGeoid);

  record.unitType = preferred.unitType;
  record.unitId = preferred.unitId;
  record.tractGeoid = tractGeoid;
  record.blockGroupGeoid = blockGroupGeoid;
  record.stateFips = fips.stateFips;
  record.countyFips = fips.countyFips;

  return record;
}

/**
 * Normalize a list of turf events while preserving list order.
 * @param {Array<Record<string, any>>} records
 * @returns {Array<Record<string, any>>}
 */
export function normalizeTurfEventRecords(records){
  const rows = Array.isArray(records) ? records : [];
  return rows.map((row) => normalizeTurfEventRecord(row));
}

/**
 * Resolve preferred map join reference for a turf event.
 * @param {Record<string, any>} input
 * @returns {{
 *   unitType: string,
 *   unitId: string,
 *   joinKey: string,
 *   joinable: boolean,
 *   tractGeoid: string,
 *   blockGroupGeoid: string,
 *   stateFips: string,
 *   countyFips: string
 * }}
 */
export function resolveTurfEventMapJoinRef(input){
  const row = normalizeTurfEventRecord(input);
  const unitType = normalizeTurfEventUnitType(row.unitType);
  const unitId = normalizeUnitIdByType(unitType, row.unitId);
  const joinKey = buildTurfEventUnitJoinKey(unitType, unitId);
  const joinable = !!joinKey;
  return {
    unitType,
    unitId,
    joinable,
    joinKey,
    tractGeoid: normalizeGeoid(row.tractGeoid, 11),
    blockGroupGeoid: normalizeGeoid(row.blockGroupGeoid, 12),
    stateFips: normalizeStateFips(row.stateFips),
    countyFips: normalizeCountyFips(row.countyFips),
  };
}

/**
 * Deterministic joinability audit summary for organizer/turf geography links.
 * @param {{
 *   persons?: Array<Record<string, any>>,
 *   shiftRecords?: Array<Record<string, any>>,
 *   turfEvents?: Array<Record<string, any>>,
 * }} args
 */
export function summarizeOrganizerGeographyJoinability(args = {}){
  const persons = Array.isArray(args?.persons) ? args.persons : [];
  const shiftRecords = Array.isArray(args?.shiftRecords) ? args.shiftRecords : [];
  const turfEvents = Array.isArray(args?.turfEvents) ? args.turfEvents : [];
  const normalizedEvents = normalizeTurfEventRecords(turfEvents);

  const unitTypeCounts = {
    turf: 0,
    precinct: 0,
    tract: 0,
    block_group: 0,
    none: 0,
  };
  let joinableEventCount = 0;
  let organizerLinkedEventCount = 0;
  let organizerJoinableEventCount = 0;
  let shiftLinkedEventCount = 0;
  let legacyOnlyEventCount = 0;

  for (let idx = 0; idx < normalizedEvents.length; idx += 1){
    const event = normalizedEvents[idx] || {};
    const raw = turfEvents[idx] && typeof turfEvents[idx] === "object" ? turfEvents[idx] : {};
    const joinRef = resolveTurfEventMapJoinRef(event);
    const assignedTo = clean(event.assignedTo);
    const shiftId = clean(event.shiftId);

    if (joinRef.joinable){
      joinableEventCount += 1;
      unitTypeCounts[joinRef.unitType] += 1;
    } else {
      unitTypeCounts.none += 1;
    }
    if (assignedTo){
      organizerLinkedEventCount += 1;
      if (joinRef.joinable){
        organizerJoinableEventCount += 1;
      }
    }
    if (shiftId){
      shiftLinkedEventCount += 1;
    }

    const hadLegacyOnly = !!(
      !clean(raw.unitType)
      && !clean(raw.unitId)
      && (clean(raw.turfId) || clean(raw.precinct) || clean(raw.tractGeoid) || clean(raw.blockGroupGeoid))
    );
    if (hadLegacyOnly){
      legacyOnlyEventCount += 1;
    }
  }

  const shiftWithTurfIdCount = shiftRecords.reduce((total, row) => {
    return total + (clean(row?.turfId) ? 1 : 0);
  }, 0);
  const organizerCount = persons.reduce((total, row) => {
    const role = cleanLower(row?.workforceRole || row?.roleType || row?.canonicalRole || row?.role);
    if (role === "organizer" || role === "field_organizer" || role === "field organizer"){
      return total + 1;
    }
    return total;
  }, 0);

  return {
    organizerCount,
    shiftCount: shiftRecords.length,
    turfEventCount: normalizedEvents.length,
    shiftWithTurfIdCount,
    shiftLinkedEventCount,
    organizerLinkedEventCount,
    organizerJoinableEventCount,
    joinableEventCount,
    unitTypeCounts,
    legacyOnlyEventCount,
    mappingScope: {
      officeLevel: true,
      turfLevel: unitTypeCounts.turf > 0 || shiftWithTurfIdCount > 0,
      precinctLevel: unitTypeCounts.precinct > 0,
      tractLevel: unitTypeCounts.tract > 0,
      blockGroupLevel: unitTypeCounts.block_group > 0,
    },
  };
}

export const OPERATIONS_TURF_EVENT_UNIT_TYPES = TURF_EVENT_UNIT_TYPES.slice();
