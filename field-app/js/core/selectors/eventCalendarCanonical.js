// @ts-check

import { clone, ensureCanonicalState } from "./_core.js";

export function selectEventCalendarCanonicalView(state, options = {}) {
  const canonical = ensureCanonicalState(state, options);
  const eventCalendar = canonical.domains?.eventCalendar || {};

  return {
    revision: Number(eventCalendar.revision || 0),
    version: eventCalendar.version || "",
    filters: clone(eventCalendar.filters || {}),
    draft: clone(eventCalendar.draft || {}),
    events: clone(eventCalendar.events || []),
  };
}

