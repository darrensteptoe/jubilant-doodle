// @ts-check
import {
  EVENT_CATEGORY_ADMIN,
  EVENT_CATEGORY_CAMPAIGN,
  makeDefaultEventDraft,
  normalizeIsoDate,
} from "./eventCalendarState.js";
import { deriveEventCapacityAdjustmentForState } from "./eventImpactRules.js";

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function resolveDateIso(value, fallbackNow = new Date()){
  const fallback = new Date(fallbackNow).toISOString().slice(0, 10);
  return normalizeIsoDate(value, fallback);
}

function isInactiveStatus(status){
  const text = cleanText(status).toLowerCase();
  return text === "completed" || text === "cancelled";
}

function eventMatchesContext(event, { campaignId = "", officeId = "", scenarioId = "" } = {}){
  const src = event && typeof event === "object" ? event : {};
  if (cleanText(src.campaignId) !== cleanText(campaignId)) return false;
  if (cleanText(src.officeId) !== cleanText(officeId)) return false;

  const eventScenario = cleanText(src.scenarioId);
  const activeScenario = cleanText(scenarioId);
  if (!eventScenario) return true;
  return eventScenario === activeScenario;
}

function eventDateSortKey(event){
  const src = event && typeof event === "object" ? event : {};
  return `${cleanText(src.date)}_${cleanText(src.startTime)}_${cleanText(src.title)}`;
}

export function selectEventCalendarState(state = {}, { nowDate = new Date() } = {}){
  const src = state?.warRoom?.eventCalendar;
  if (!src || typeof src !== "object"){
    return {
      events: [],
      filters: {
        date: resolveDateIso("", nowDate),
        category: "all",
        includeInactive: false,
        appliedOnly: false,
      },
      selectedEventId: "",
      draft: makeDefaultEventDraft({ nowDate }),
      auditLog: [],
    };
  }
  return src;
}

export function selectVisibleEventRows(state = {}, {
  nowDate = new Date(),
  date = "",
  category = "",
  includeInactive = null,
  appliedOnly = null,
  scenarioId = "",
} = {}){
  const calendar = selectEventCalendarState(state, { nowDate });
  if (!calendar) return [];

  const filters = calendar.filters && typeof calendar.filters === "object" ? calendar.filters : {};
  const dateFilter = resolveDateIso(date || filters.date, nowDate);
  const categoryFilter = cleanText(category || filters.category || "all").toLowerCase();
  const includeInactiveFlag = typeof includeInactive === "boolean" ? includeInactive : !!filters.includeInactive;
  const appliedOnlyFlag = typeof appliedOnly === "boolean" ? appliedOnly : !!filters.appliedOnly;

  const campaignId = cleanText(state?.campaignId);
  const officeId = cleanText(state?.officeId);
  const activeScenarioId = cleanText(scenarioId || state?.ui?.activeScenarioId);

  const events = Array.isArray(calendar.events) ? calendar.events : [];
  const rows = events.filter((event) => {
    const src = event && typeof event === "object" ? event : {};
    if (!eventMatchesContext(src, { campaignId, officeId, scenarioId: activeScenarioId })) return false;
    if (resolveDateIso(src.date, nowDate) !== dateFilter) return false;
    const eventCategory = cleanText(src.category).toLowerCase();
    if (categoryFilter !== "all" && eventCategory !== categoryFilter) return false;
    if (!includeInactiveFlag && isInactiveStatus(src.status)) return false;
    if (appliedOnlyFlag && !src.applyToModel) return false;
    return true;
  });

  rows.sort((a, b) => eventDateSortKey(a).localeCompare(eventDateSortKey(b)));
  return rows;
}

export function selectEventRowsForDate(state = {}, {
  nowDate = new Date(),
  date = "",
  scenarioId = "",
} = {}){
  const targetDate = resolveDateIso(date, nowDate);
  const rows = selectVisibleEventRows(state, {
    nowDate,
    date: targetDate,
    category: "all",
    includeInactive: true,
    appliedOnly: false,
    scenarioId,
  });
  return rows;
}

export function selectEventCalendarSummary(state = {}, {
  nowDate = new Date(),
  date = "",
  scenarioId = "",
} = {}){
  const targetDate = resolveDateIso(date, nowDate);
  const rows = selectEventRowsForDate(state, {
    nowDate,
    date: targetDate,
    scenarioId,
  });

  const adminCount = rows.filter((row) => cleanText(row?.category) === EVENT_CATEGORY_ADMIN).length;
  const campaignCount = rows.filter((row) => cleanText(row?.category) === EVENT_CATEGORY_CAMPAIGN).length;
  const appliedCount = rows.filter((row) => !!row?.applyToModel).length;

  const impact = deriveEventCapacityAdjustmentForState(state, {
    date: targetDate,
    scenarioId,
  });

  return {
    date: targetDate,
    totalCount: rows.length,
    adminCount,
    campaignCount,
    appliedCount,
    rows,
    impact,
  };
}
