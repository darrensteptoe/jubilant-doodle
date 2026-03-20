// @ts-check
import {
  EVENT_CATEGORY_ADMIN,
  EVENT_CATEGORY_CAMPAIGN,
  EVENT_STATUS_SCHEDULED,
  ensureEventCalendarStateShape,
  makeDefaultEventDraft,
  normalizeEventApplyToModel,
  normalizeEventCategory,
  normalizeEventStatus,
  normalizeEventType,
  normalizeIsoDate,
  normalizeIsoTime,
} from "./eventCalendarState.js";

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function nonNegativeNumber(value, fallback = 0){
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  return n;
}

function listFromText(value){
  return String(value == null ? "" : value)
    .split(/\r?\n|,/)
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join(", ");
}

function resolveTodayIso(nowDate = new Date()){
  const d = new Date(nowDate);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function pushAudit(calendar, { action = "update", eventId = "", note = "" } = {}){
  if (!calendar || typeof calendar !== "object") return;
  if (!Array.isArray(calendar.auditLog)){
    calendar.auditLog = [];
  }
  calendar.auditLog.unshift({
    at: new Date().toISOString(),
    action: cleanText(action) || "update",
    eventId: cleanText(eventId),
    note: String(note == null ? "" : note),
  });
  if (calendar.auditLog.length > 200){
    calendar.auditLog.length = 200;
  }
}

function ensureCalendarState(state, { nowDate = new Date() } = {}){
  const warRoom = ensureEventCalendarStateShape(state, { nowDate });
  return warRoom?.eventCalendar || null;
}

function ensureEventId(eventId, uidFn = null){
  const existing = cleanText(eventId);
  if (existing) return existing;
  const token = typeof uidFn === "function" ? cleanText(uidFn()) : "";
  const suffix = Date.now().toString(16);
  return `evt_${token || "x"}${suffix}`;
}

function normalizeEventRecord(draft, {
  state = {},
  nowDate = new Date(),
  uidFn = null,
  existingCreatedAt = "",
} = {}){
  const src = draft && typeof draft === "object" ? draft : {};
  const category = normalizeEventCategory(src.category);
  const date = normalizeIsoDate(src.date, resolveTodayIso(nowDate));
  const createdAt = cleanText(existingCreatedAt || src.createdAt) || new Date(nowDate).toISOString();
  const scenarioId = cleanText(src.scenarioId || state?.ui?.activeScenarioId);
  const campaignId = cleanText(src.campaignId || state?.campaignId);
  const officeId = cleanText(src.officeId || state?.officeId);

  const record = {
    eventId: ensureEventId(src.eventId, uidFn),
    campaignId,
    officeId,
    scenarioId,
    eventType: normalizeEventType(src.eventType, category),
    title: cleanText(src.title) || cleanText(src.eventType).replace(/_/g, " ") || "Untitled event",
    category,
    date,
    startTime: normalizeIsoTime(src.startTime),
    endTime: normalizeIsoTime(src.endTime),
    notes: String(src.notes == null ? "" : src.notes),
    createdBy: cleanText(src.createdBy),
    createdAt,
    applyToModel: normalizeEventApplyToModel(src.applyToModel, category),
    status: normalizeEventStatus(src.status || EVENT_STATUS_SCHEDULED),

    attendees: listFromText(src.attendees),
    meetingType: cleanText(src.meetingType),
    followUpOwner: cleanText(src.followUpOwner),
    followUpDate: normalizeIsoDate(src.followUpDate, ""),

    expectedVolunteers: nonNegativeNumber(src.expectedVolunteers, 0),
    expectedPaidCanvassers: nonNegativeNumber(src.expectedPaidCanvassers, 0),
    expectedShiftHours: nonNegativeNumber(src.expectedShiftHours, 0),
    officeLocation: String(src.officeLocation == null ? "" : src.officeLocation),
    fieldGoalNotes: String(src.fieldGoalNotes == null ? "" : src.fieldGoalNotes),
    channelFocus: cleanText(src.channelFocus),
  };

  if (record.category === EVENT_CATEGORY_ADMIN){
    record.applyToModel = false;
  }

  return record;
}

function eventSortKey(event){
  const src = event && typeof event === "object" ? event : {};
  return `${String(src.date || "")}_${String(src.startTime || "")}_${String(src.createdAt || "")}`;
}

function sortEventsDescending(rows = []){
  rows.sort((a, b) => eventSortKey(b).localeCompare(eventSortKey(a)));
}

function findEventIndex(events = [], eventId = ""){
  const needle = cleanText(eventId);
  if (!needle) return -1;
  return events.findIndex((entry) => cleanText(entry?.eventId) === needle);
}

export function buildEventId(uidFn = null){
  return ensureEventId("", uidFn);
}

export function setEventFilter(state, field, value, { nowDate = new Date() } = {}){
  const calendar = ensureCalendarState(state, { nowDate });
  if (!calendar) return { ok: false, code: "missing_calendar" };
  const key = cleanText(field);
  if (key === "date"){
    calendar.filters.date = normalizeIsoDate(value, resolveTodayIso(nowDate));
  } else if (key === "category"){
    const normalized = cleanText(value).toLowerCase();
    calendar.filters.category = ["all", EVENT_CATEGORY_ADMIN, EVENT_CATEGORY_CAMPAIGN].includes(normalized)
      ? normalized
      : "all";
  } else if (key === "includeInactive"){
    calendar.filters.includeInactive = !!value;
  } else if (key === "appliedOnly"){
    calendar.filters.appliedOnly = !!value;
  } else {
    return { ok: false, code: "unknown_filter_field" };
  }
  return { ok: true, code: "ok", calendar };
}

export function setEventDraftField(state, field, value, { nowDate = new Date() } = {}){
  const calendar = ensureCalendarState(state, { nowDate });
  if (!calendar) return { ok: false, code: "missing_calendar" };
  if (!calendar.draft || typeof calendar.draft !== "object"){
    calendar.draft = makeDefaultEventDraft({ nowDate });
  }
  const draft = calendar.draft;
  const key = cleanText(field);

  if (key === "eventId"){
    draft.eventId = cleanText(value);
  } else if (key === "campaignId"){
    draft.campaignId = cleanText(value);
  } else if (key === "officeId"){
    draft.officeId = cleanText(value);
  } else if (key === "scenarioId"){
    draft.scenarioId = cleanText(value);
  } else if (key === "category"){
    const category = normalizeEventCategory(value);
    draft.category = category;
    draft.eventType = normalizeEventType(draft.eventType, category);
    draft.applyToModel = normalizeEventApplyToModel(draft.applyToModel, category);
  } else if (key === "eventType"){
    draft.eventType = normalizeEventType(value, draft.category);
  } else if (key === "title"){
    draft.title = cleanText(value);
  } else if (key === "date"){
    draft.date = normalizeIsoDate(value, resolveTodayIso(nowDate));
  } else if (key === "startTime"){
    draft.startTime = normalizeIsoTime(value);
  } else if (key === "endTime"){
    draft.endTime = normalizeIsoTime(value);
  } else if (key === "notes"){
    draft.notes = String(value == null ? "" : value);
  } else if (key === "createdBy"){
    draft.createdBy = cleanText(value);
  } else if (key === "applyToModel"){
    draft.applyToModel = normalizeEventApplyToModel(value, draft.category);
  } else if (key === "status"){
    draft.status = normalizeEventStatus(value);
  } else if (key === "attendees"){
    draft.attendees = String(value == null ? "" : value);
  } else if (key === "meetingType"){
    draft.meetingType = cleanText(value);
  } else if (key === "followUpOwner"){
    draft.followUpOwner = cleanText(value);
  } else if (key === "followUpDate"){
    draft.followUpDate = normalizeIsoDate(value, "");
  } else if (key === "expectedVolunteers"){
    draft.expectedVolunteers = nonNegativeNumber(value, 0);
  } else if (key === "expectedPaidCanvassers"){
    draft.expectedPaidCanvassers = nonNegativeNumber(value, 0);
  } else if (key === "expectedShiftHours"){
    draft.expectedShiftHours = nonNegativeNumber(value, 0);
  } else if (key === "officeLocation"){
    draft.officeLocation = String(value == null ? "" : value);
  } else if (key === "fieldGoalNotes"){
    draft.fieldGoalNotes = String(value == null ? "" : value);
  } else if (key === "channelFocus"){
    draft.channelFocus = cleanText(value);
  } else {
    return { ok: false, code: "unknown_draft_field" };
  }

  return { ok: true, code: "ok", draft };
}

export function loadEventIntoDraft(state, eventId, { nowDate = new Date() } = {}){
  const calendar = ensureCalendarState(state, { nowDate });
  if (!calendar) return { ok: false, code: "missing_calendar" };
  const idx = findEventIndex(calendar.events, eventId);
  if (idx < 0) return { ok: false, code: "event_not_found" };
  const event = calendar.events[idx];
  calendar.selectedEventId = cleanText(event?.eventId);
  calendar.draft = {
    ...makeDefaultEventDraft({ nowDate }),
    ...event,
  };
  pushAudit(calendar, {
    action: "load_draft",
    eventId: calendar.selectedEventId,
    note: `Loaded '${cleanText(event?.title) || "event"}' into draft.`,
  });
  return { ok: true, code: "ok", event };
}

export function clearEventDraft(state, { nowDate = new Date() } = {}){
  const calendar = ensureCalendarState(state, { nowDate });
  if (!calendar) return { ok: false, code: "missing_calendar" };
  calendar.selectedEventId = "";
  calendar.draft = makeDefaultEventDraft({ nowDate });
  calendar.draft.campaignId = cleanText(state?.campaignId);
  calendar.draft.officeId = cleanText(state?.officeId);
  calendar.draft.scenarioId = cleanText(state?.ui?.activeScenarioId);
  pushAudit(calendar, {
    action: "clear_draft",
    note: "Cleared event draft.",
  });
  return { ok: true, code: "ok", draft: calendar.draft };
}

export function saveEventDraftAsEvent(state, {
  uidFn = null,
  nowDate = new Date(),
} = {}){
  const calendar = ensureCalendarState(state, { nowDate });
  if (!calendar) return { ok: false, code: "missing_calendar" };
  if (!calendar.draft || typeof calendar.draft !== "object"){
    calendar.draft = makeDefaultEventDraft({ nowDate });
  }

  const editingId = cleanText(calendar.draft.eventId || calendar.selectedEventId);
  const existingIdx = findEventIndex(calendar.events, editingId);
  const existing = existingIdx >= 0 ? calendar.events[existingIdx] : null;

  const record = normalizeEventRecord(calendar.draft, {
    state,
    nowDate,
    uidFn,
    existingCreatedAt: cleanText(existing?.createdAt),
  });

  if (!record.campaignId || !record.officeId){
    return {
      ok: false,
      code: "missing_context",
      message: "Event requires campaignId and officeId context.",
    };
  }

  if (!record.title){
    return {
      ok: false,
      code: "missing_title",
      message: "Event title is required.",
    };
  }

  if (existingIdx >= 0){
    calendar.events[existingIdx] = record;
  } else {
    calendar.events.unshift(record);
  }
  sortEventsDescending(calendar.events);

  calendar.selectedEventId = record.eventId;
  calendar.draft = {
    ...makeDefaultEventDraft({ nowDate }),
    ...record,
  };

  pushAudit(calendar, {
    action: existingIdx >= 0 ? "update_event" : "create_event",
    eventId: record.eventId,
    note: `${existingIdx >= 0 ? "Updated" : "Created"} ${record.category} event '${record.title}'.`,
  });

  return {
    ok: true,
    code: "ok",
    created: existingIdx < 0,
    event: record,
  };
}

export function deleteEventRecord(state, eventId, { nowDate = new Date() } = {}){
  const calendar = ensureCalendarState(state, { nowDate });
  if (!calendar) return { ok: false, code: "missing_calendar" };
  const idx = findEventIndex(calendar.events, eventId);
  if (idx < 0) return { ok: false, code: "event_not_found" };
  const removed = calendar.events.splice(idx, 1)[0] || null;
  const removedId = cleanText(removed?.eventId);

  if (calendar.selectedEventId === removedId){
    calendar.selectedEventId = "";
    calendar.draft = makeDefaultEventDraft({ nowDate });
  }

  pushAudit(calendar, {
    action: "delete_event",
    eventId: removedId,
    note: `Deleted event '${cleanText(removed?.title) || removedId || "unknown"}'.`,
  });

  return { ok: true, code: "ok", removed };
}

export function updateEventApplyToModel(state, eventId, enabled, { nowDate = new Date() } = {}){
  const calendar = ensureCalendarState(state, { nowDate });
  if (!calendar) return { ok: false, code: "missing_calendar" };
  const idx = findEventIndex(calendar.events, eventId);
  if (idx < 0) return { ok: false, code: "event_not_found" };

  const event = calendar.events[idx];
  const category = normalizeEventCategory(event?.category);
  event.applyToModel = normalizeEventApplyToModel(enabled, category);

  if (category === EVENT_CATEGORY_ADMIN){
    event.applyToModel = false;
  }

  if (cleanText(calendar.selectedEventId) === cleanText(event?.eventId) && calendar.draft){
    calendar.draft.applyToModel = !!event.applyToModel;
  }

  pushAudit(calendar, {
    action: "set_apply_to_model",
    eventId: cleanText(event?.eventId),
    note: `Set applyToModel=${event.applyToModel ? "true" : "false"}.`,
  });

  return { ok: true, code: "ok", event };
}

export function setEventStatus(state, eventId, status, { nowDate = new Date() } = {}){
  const calendar = ensureCalendarState(state, { nowDate });
  if (!calendar) return { ok: false, code: "missing_calendar" };
  const idx = findEventIndex(calendar.events, eventId);
  if (idx < 0) return { ok: false, code: "event_not_found" };

  const event = calendar.events[idx];
  event.status = normalizeEventStatus(status);

  if (cleanText(calendar.selectedEventId) === cleanText(event?.eventId) && calendar.draft){
    calendar.draft.status = event.status;
  }

  pushAudit(calendar, {
    action: "set_status",
    eventId: cleanText(event?.eventId),
    note: `Set status=${event.status}.`,
  });

  return { ok: true, code: "ok", event };
}
