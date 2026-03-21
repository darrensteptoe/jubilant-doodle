// @ts-check

import { asArray, cleanText, ensureCanonicalState } from "./_core.js";

function toDateStamp(value) {
  const token = cleanText(value);
  if (!token) return "";
  const date = new Date(token);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function selectEventCalendarDerivedView(state, options = {}) {
  const canonical = ensureCanonicalState(state, options);
  const eventCalendar = canonical.domains?.eventCalendar || {};
  const events = asArray(eventCalendar.events);
  const upcoming = events
    .filter((event) => cleanText(event?.date))
    .slice()
    .sort((a, b) => cleanText(a?.date).localeCompare(cleanText(b?.date)))
    .slice(0, 5)
    .map((event) => ({
      eventId: cleanText(event?.eventId),
      title: cleanText(event?.title),
      date: toDateStamp(event?.date),
      category: cleanText(event?.category),
      status: cleanText(event?.status),
      applyToModel: !!event?.applyToModel,
    }));

  return {
    summary: {
      totalEvents: events.length,
      appliedEvents: events.filter((event) => !!event?.applyToModel).length,
      openFollowUps: events.filter((event) => cleanText(event?.status) !== "closed").length,
      upcomingCount: upcoming.length,
    },
    upcomingEvents: upcoming,
    filtersApplied: {
      category: cleanText(eventCalendar?.filters?.category) || "all",
      date: toDateStamp(eventCalendar?.filters?.date),
      includeInactive: !!eventCalendar?.filters?.includeInactive,
      appliedOnly: !!eventCalendar?.filters?.appliedOnly,
    },
  };
}

