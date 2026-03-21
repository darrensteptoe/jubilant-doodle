// @ts-check

import { asArray, clone, makeActionResult, mutateDomain, toBool, toFinite } from "./_core.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeEvent(event = {}, fallbackId = "") {
  return {
    eventId: cleanText(event.eventId) || fallbackId,
    eventType: cleanText(event.eventType) || "day_of_action",
    title: cleanText(event.title),
    category: cleanText(event.category) || "campaign",
    date: cleanText(event.date),
    startTime: cleanText(event.startTime),
    endTime: cleanText(event.endTime),
    notes: cleanText(event.notes),
    createdBy: cleanText(event.createdBy),
    createdAt: cleanText(event.createdAt),
    applyToModel: toBool(event.applyToModel),
    status: cleanText(event.status) || "scheduled",
    attendees: cleanText(event.attendees),
    meetingType: cleanText(event.meetingType),
    followUpOwner: cleanText(event.followUpOwner),
    followUpDate: cleanText(event.followUpDate),
    expectedVolunteers: Math.max(0, toFinite(event.expectedVolunteers, 0) || 0),
    expectedPaidCanvassers: Math.max(0, toFinite(event.expectedPaidCanvassers, 0) || 0),
    expectedShiftHours: Math.max(0, toFinite(event.expectedShiftHours, 0) || 0),
    officeLocation: cleanText(event.officeLocation),
    fieldGoalNotes: cleanText(event.fieldGoalNotes),
    channelFocus: cleanText(event.channelFocus),
  };
}

function nextEventId(events = []) {
  const used = new Set(asArray(events).map((event) => cleanText(event?.eventId)).filter(Boolean));
  let i = 1;
  while (used.has(`event_${i}`)) i += 1;
  return `event_${i}`;
}

function updateSummary(draft) {
  const events = asArray(draft.events);
  draft.statusSummary = {
    totalEvents: events.length,
    appliedEvents: events.filter((event) => toBool(event?.applyToModel)).length,
    openFollowUps: events.filter((event) => cleanText(event?.status) !== "closed").length,
  };
}

export function updateEventCalendarFilters(state, payload, options = {}) {
  const patch = payload?.filters && typeof payload.filters === "object" ? payload.filters : {};

  const result = mutateDomain(
    state,
    "eventCalendar",
    (draft) => {
      draft.filters = {
        ...draft.filters,
        ...clone(patch),
        date: cleanText(patch.date ?? draft.filters.date),
        category: cleanText(patch.category ?? draft.filters.category) || "all",
        includeInactive: toBool(patch.includeInactive ?? draft.filters.includeInactive),
        appliedOnly: toBool(patch.appliedOnly ?? draft.filters.appliedOnly),
      };
      return true;
    },
    { ...options, revisionReason: "eventCalendar.filters.update" },
  );
  return makeActionResult(result);
}

export function saveEventCalendarEvent(state, payload, options = {}) {
  const input = payload?.event && typeof payload.event === "object" ? payload.event : payload || {};
  const eventId = cleanText(input.eventId);

  const result = mutateDomain(
    state,
    "eventCalendar",
    (draft) => {
      if (!Array.isArray(draft.events)) draft.events = [];
      const idx = draft.events.findIndex((event) => cleanText(event?.eventId) === eventId);
      if (idx < 0) {
        const newId = eventId || nextEventId(draft.events);
        draft.events.push(normalizeEvent(input, newId));
      } else {
        draft.events[idx] = normalizeEvent({ ...draft.events[idx], ...input }, eventId);
      }
      updateSummary(draft);
      return true;
    },
    { ...options, revisionReason: "eventCalendar.events.save" },
  );
  return makeActionResult(result, { eventId: eventId || undefined });
}

export function deleteEventCalendarEvent(state, payload, options = {}) {
  const eventId = cleanText(payload?.eventId);
  if (!eventId) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_payload" });
  }

  const result = mutateDomain(
    state,
    "eventCalendar",
    (draft) => {
      const before = asArray(draft.events);
      const next = before.filter((event) => cleanText(event?.eventId) !== eventId);
      if (next.length === before.length) return false;
      draft.events = next;
      updateSummary(draft);
      return true;
    },
    { ...options, revisionReason: "eventCalendar.events.delete" },
  );
  return makeActionResult(result, { eventId });
}

