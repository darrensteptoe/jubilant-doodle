// @ts-check

import {
  buildTurfEventUnitJoinKey,
  normalizeTurfEventRecords,
  resolveTurfEventMapJoinRef,
} from "./geographyActivity.js";

function clean(value){
  return String(value == null ? "" : value).trim();
}

function cleanLower(value){
  return clean(value).toLowerCase();
}

function normalizeAlias(value){
  return cleanLower(value).replace(/[^a-z0-9]/g, "");
}

function asNonNegativeNumber(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function dateToken(value){
  const token = clean(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(token) ? token : "";
}

function inDateRange(token, from, to){
  if (!token) return true;
  if (from && token < from) return false;
  if (to && token > to) return false;
  return true;
}

function statsFromEvent(row){
  return {
    touches: 1,
    attempts: asNonNegativeNumber(row?.attempts),
    canvassed: asNonNegativeNumber(row?.canvassed),
    vbms: asNonNegativeNumber(row?.vbms),
    latestDate: dateToken(row?.date),
  };
}

function mergeStats(target, delta){
  const base = target && typeof target === "object"
    ? target
    : {
      touches: 0,
      attempts: 0,
      canvassed: 0,
      vbms: 0,
      latestDate: "",
    };
  const nextDate = clean(delta?.latestDate);
  return {
    touches: asNonNegativeNumber(base.touches) + asNonNegativeNumber(delta?.touches),
    attempts: asNonNegativeNumber(base.attempts) + asNonNegativeNumber(delta?.attempts),
    canvassed: asNonNegativeNumber(base.canvassed) + asNonNegativeNumber(delta?.canvassed),
    vbms: asNonNegativeNumber(base.vbms) + asNonNegativeNumber(delta?.vbms),
    latestDate: (!base.latestDate || (nextDate && nextDate > base.latestDate))
      ? nextDate
      : clean(base.latestDate),
  };
}

function addToMapStats(map, key, delta){
  if (!(map instanceof Map)) return;
  if (!clean(key)) return;
  map.set(clean(key), mergeStats(map.get(clean(key)), delta));
}

function addOrganizerAliasStats(aliasMap, organizerAliases, joinKey, delta){
  if (!(aliasMap instanceof Map)) return;
  const unitKey = clean(joinKey);
  if (!unitKey) return;
  for (const alias of organizerAliases){
    const organizerAlias = clean(alias);
    if (!organizerAlias) continue;
    addToMapStats(aliasMap, `${organizerAlias}|${unitKey}`, delta);
  }
}

function organizerAliasSet(event, personNameById){
  const assignedTo = clean(event?.assignedTo);
  const aliases = new Set();
  const idAlias = normalizeAlias(assignedTo);
  if (idAlias){
    aliases.add(idAlias);
  }
  const nameAlias = normalizeAlias(personNameById.get(assignedTo));
  if (nameAlias){
    aliases.add(nameAlias);
  }
  return aliases;
}

/**
 * Normalize organizer alias tokens for worked-geography lookups.
 * @param {any} value
 */
export function normalizeWorkedGeographyAlias(value){
  return normalizeAlias(value);
}

/**
 * Build a deterministic read-only worked-geography index from turf events.
 * @param {{
 *   turfEvents?: Array<Record<string, any>>,
 *   persons?: Array<Record<string, any>>,
 *   officeId?: string,
 *   organizerId?: string,
 *   shiftId?: string,
 *   dateFrom?: string,
 *   dateTo?: string,
 * }} args
 */
export function buildWorkedGeographyActivityIndex(args = {}){
  const turfEvents = Array.isArray(args?.turfEvents) ? args.turfEvents : [];
  const persons = Array.isArray(args?.persons) ? args.persons : [];
  const normalizedEvents = normalizeTurfEventRecords(turfEvents);

  const officeFilter = cleanLower(args?.officeId);
  const organizerFilter = normalizeAlias(args?.organizerId);
  const shiftFilter = clean(args?.shiftId);
  const from = dateToken(args?.dateFrom);
  const to = dateToken(args?.dateTo);

  const personNameById = new Map();
  for (const row of persons){
    const id = clean(row?.id);
    if (!id) continue;
    personNameById.set(id, clean(row?.name));
  }

  const byUnitKey = new Map();
  const byOrganizerAliasUnitKey = new Map();
  const byOrganizerTotals = new Map();
  const byOfficeTotals = new Map();
  const byOfficeUnitKey = new Map();
  const unitTypeCounts = new Map();

  let consideredEventCount = 0;
  let joinableEventCount = 0;

  for (const event of normalizedEvents){
    const eventOffice = cleanLower(event?.officeId || event?.office);
    if (officeFilter && eventOffice && eventOffice !== officeFilter){
      continue;
    }
    if (shiftFilter && clean(event?.shiftId) !== shiftFilter){
      continue;
    }
    const eventDate = dateToken(event?.date);
    if (!inDateRange(eventDate, from, to)){
      continue;
    }

    const aliases = organizerAliasSet(event, personNameById);
    if (organizerFilter && !aliases.has(organizerFilter)){
      continue;
    }

    consideredEventCount += 1;
    const joinRef = resolveTurfEventMapJoinRef(event);
    if (!joinRef.joinable || !clean(joinRef.joinKey)){
      continue;
    }
    joinableEventCount += 1;
    unitTypeCounts.set(joinRef.unitType, (unitTypeCounts.get(joinRef.unitType) || 0) + 1);

    const delta = statsFromEvent(event);
    addToMapStats(byUnitKey, joinRef.joinKey, delta);
    addOrganizerAliasStats(byOrganizerAliasUnitKey, aliases, joinRef.joinKey, delta);

    const assignedTo = clean(event?.assignedTo);
    if (assignedTo){
      addToMapStats(byOrganizerTotals, assignedTo, delta);
    }
    if (eventOffice){
      addToMapStats(byOfficeTotals, eventOffice, delta);
      addToMapStats(byOfficeUnitKey, `${eventOffice}|${joinRef.joinKey}`, delta);
    }
  }

  const officeTotals = officeFilter
    ? (byOfficeTotals.get(officeFilter) || { touches: 0, attempts: 0, canvassed: 0, vbms: 0, latestDate: "" })
    : Array.from(byOfficeTotals.values()).reduce((sum, row) => mergeStats(sum, row), {
      touches: 0,
      attempts: 0,
      canvassed: 0,
      vbms: 0,
      latestDate: "",
    });

  return {
    available: byUnitKey.size > 0,
    consideredEventCount,
    joinableEventCount,
    byUnitKey,
    byOrganizerAliasUnitKey,
    byOrganizerTotals,
    byOfficeTotals,
    byOfficeUnitKey,
    officeTotals,
    unitTypeCounts: Object.fromEntries(unitTypeCounts.entries()),
  };
}

/**
 * Build a unit join key for feature-side lookups.
 * @param {any} unitType
 * @param {any} unitId
 */
export function buildWorkedGeographyUnitJoinKey(unitType, unitId){
  return buildTurfEventUnitJoinKey(unitType, unitId);
}
