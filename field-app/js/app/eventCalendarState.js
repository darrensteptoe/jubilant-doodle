// @ts-check

export const EVENT_CALENDAR_VERSION = "18.75.0";

export const EVENT_CATEGORY_ADMIN = "admin";
export const EVENT_CATEGORY_CAMPAIGN = "campaign";

export const EVENT_STATUS_SCHEDULED = "scheduled";
export const EVENT_STATUS_ACTIVE = "active";
export const EVENT_STATUS_COMPLETED = "completed";
export const EVENT_STATUS_CANCELLED = "cancelled";

export const EVENT_CATEGORY_OPTIONS = Object.freeze([
  Object.freeze({ value: EVENT_CATEGORY_ADMIN, label: "Admin" }),
  Object.freeze({ value: EVENT_CATEGORY_CAMPAIGN, label: "Campaign" }),
]);

export const EVENT_CATEGORY_FILTER_OPTIONS = Object.freeze([
  Object.freeze({ value: "all", label: "All categories" }),
  ...EVENT_CATEGORY_OPTIONS,
]);

export const EVENT_STATUS_OPTIONS = Object.freeze([
  Object.freeze({ value: EVENT_STATUS_SCHEDULED, label: "Scheduled" }),
  Object.freeze({ value: EVENT_STATUS_ACTIVE, label: "Active" }),
  Object.freeze({ value: EVENT_STATUS_COMPLETED, label: "Completed" }),
  Object.freeze({ value: EVENT_STATUS_CANCELLED, label: "Cancelled" }),
]);

const EVENT_TYPE_OPTIONS_BY_CATEGORY = Object.freeze({
  [EVENT_CATEGORY_ADMIN]: Object.freeze([
    Object.freeze({ value: "admin_meeting", label: "Campaign meeting" }),
    Object.freeze({ value: "internal_review", label: "Internal review" }),
    Object.freeze({ value: "follow_up", label: "Follow-up" }),
  ]),
  [EVENT_CATEGORY_CAMPAIGN]: Object.freeze([
    Object.freeze({ value: "day_of_action", label: "Day of Action" }),
    Object.freeze({ value: "canvass_launch", label: "Canvass launch" }),
    Object.freeze({ value: "phone_bank", label: "Phone bank" }),
    Object.freeze({ value: "text_bank", label: "Text bank" }),
    Object.freeze({ value: "volunteer_training", label: "Volunteer training" }),
    Object.freeze({ value: "gotv_push", label: "GOTV push" }),
  ]),
});

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function asBoolean(value){
  if (typeof value === "boolean") return value;
  const normalized = cleanText(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function asNonNegativeNumber(value, fallback = 0){
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  return n;
}

function resolveTodayIso(nowDate = new Date()){
  const d = new Date(nowDate);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function normalizeIsoDate(value, fallback = ""){
  const text = cleanText(value);
  if (!text) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().slice(0, 10);
}

export function normalizeIsoTime(value, fallback = ""){
  const text = cleanText(value);
  if (!text) return fallback;
  const direct = text.match(/^(\d{1,2}):(\d{2})$/);
  if (direct){
    const hh = Number(direct[1]);
    const mm = Number(direct[2]);
    if (Number.isFinite(hh) && Number.isFinite(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59){
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
  }
  const parsed = new Date(`1970-01-01T${text}`);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
}

export function normalizeEventCategory(value){
  const text = cleanText(value).toLowerCase();
  if (text === EVENT_CATEGORY_ADMIN) return EVENT_CATEGORY_ADMIN;
  if (text === EVENT_CATEGORY_CAMPAIGN) return EVENT_CATEGORY_CAMPAIGN;
  return EVENT_CATEGORY_CAMPAIGN;
}

export function normalizeEventStatus(value){
  const text = cleanText(value).toLowerCase();
  if (text === EVENT_STATUS_ACTIVE) return EVENT_STATUS_ACTIVE;
  if (text === EVENT_STATUS_COMPLETED) return EVENT_STATUS_COMPLETED;
  if (text === EVENT_STATUS_CANCELLED) return EVENT_STATUS_CANCELLED;
  return EVENT_STATUS_SCHEDULED;
}

export function eventTypeOptionsForCategory(category){
  const resolvedCategory = normalizeEventCategory(category);
  return EVENT_TYPE_OPTIONS_BY_CATEGORY[resolvedCategory] || EVENT_TYPE_OPTIONS_BY_CATEGORY[EVENT_CATEGORY_CAMPAIGN];
}

export function normalizeEventType(value, category){
  const text = cleanText(value).toLowerCase();
  const options = eventTypeOptionsForCategory(category);
  if (options.some((option) => option.value === text)) return text;
  return options[0]?.value || "";
}

export function normalizeEventApplyToModel(value, category){
  const resolvedCategory = normalizeEventCategory(category);
  if (resolvedCategory !== EVENT_CATEGORY_CAMPAIGN) return false;
  return asBoolean(value);
}

export function makeDefaultEventDraft({ nowDate = new Date() } = {}){
  const today = resolveTodayIso(nowDate);
  const category = EVENT_CATEGORY_CAMPAIGN;
  return {
    eventId: "",
    campaignId: "",
    officeId: "",
    scenarioId: "",
    eventType: normalizeEventType("", category),
    title: "",
    category,
    date: today,
    startTime: "",
    endTime: "",
    notes: "",
    createdBy: "",
    createdAt: "",
    applyToModel: false,
    status: EVENT_STATUS_SCHEDULED,

    attendees: "",
    meetingType: "",
    followUpOwner: "",
    followUpDate: "",

    expectedVolunteers: 0,
    expectedPaidCanvassers: 0,
    expectedShiftHours: 0,
    officeLocation: "",
    fieldGoalNotes: "",
    channelFocus: "",
  };
}

function normalizeDraft(raw, { nowDate = new Date() } = {}){
  const src = raw && typeof raw === "object" ? raw : {};
  const defaults = makeDefaultEventDraft({ nowDate });
  const category = normalizeEventCategory(src.category ?? defaults.category);
  const date = normalizeIsoDate(src.date, defaults.date);
  const draft = {
    ...defaults,
    ...src,
    eventId: cleanText(src.eventId),
    campaignId: cleanText(src.campaignId),
    officeId: cleanText(src.officeId),
    scenarioId: cleanText(src.scenarioId),
    category,
    eventType: normalizeEventType(src.eventType, category),
    title: cleanText(src.title),
    date,
    startTime: normalizeIsoTime(src.startTime),
    endTime: normalizeIsoTime(src.endTime),
    notes: String(src.notes == null ? "" : src.notes),
    createdBy: cleanText(src.createdBy),
    createdAt: cleanText(src.createdAt),
    applyToModel: normalizeEventApplyToModel(src.applyToModel, category),
    status: normalizeEventStatus(src.status),
    attendees: String(src.attendees == null ? "" : src.attendees),
    meetingType: cleanText(src.meetingType),
    followUpOwner: cleanText(src.followUpOwner),
    followUpDate: normalizeIsoDate(src.followUpDate, ""),
    expectedVolunteers: asNonNegativeNumber(src.expectedVolunteers, 0),
    expectedPaidCanvassers: asNonNegativeNumber(src.expectedPaidCanvassers, 0),
    expectedShiftHours: asNonNegativeNumber(src.expectedShiftHours, 0),
    officeLocation: String(src.officeLocation == null ? "" : src.officeLocation),
    fieldGoalNotes: String(src.fieldGoalNotes == null ? "" : src.fieldGoalNotes),
    channelFocus: cleanText(src.channelFocus),
  };

  if (draft.category === EVENT_CATEGORY_ADMIN){
    draft.applyToModel = false;
  }

  return draft;
}

function normalizeFilterCategory(value){
  const text = cleanText(value).toLowerCase();
  if (text === "all") return "all";
  if (text === EVENT_CATEGORY_ADMIN) return EVENT_CATEGORY_ADMIN;
  if (text === EVENT_CATEGORY_CAMPAIGN) return EVENT_CATEGORY_CAMPAIGN;
  return "all";
}

function normalizeFilters(raw, { nowDate = new Date() } = {}){
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    date: normalizeIsoDate(src.date, resolveTodayIso(nowDate)),
    category: normalizeFilterCategory(src.category),
    includeInactive: asBoolean(src.includeInactive),
    appliedOnly: asBoolean(src.appliedOnly),
  };
}

function normalizeEventRecordLight(raw, { nowDate = new Date() } = {}){
  return normalizeDraft(raw, { nowDate });
}

function normalizeAuditLog(raw){
  const rows = Array.isArray(raw) ? raw : [];
  return rows
    .map((entry) => {
      const src = entry && typeof entry === "object" ? entry : {};
      return {
        at: cleanText(src.at),
        action: cleanText(src.action),
        eventId: cleanText(src.eventId),
        note: String(src.note == null ? "" : src.note),
      };
    })
    .filter((entry) => entry.at || entry.action || entry.eventId || entry.note)
    .slice(0, 120);
}

export function makeDefaultEventCalendarState({ nowDate = new Date() } = {}){
  return {
    version: EVENT_CALENDAR_VERSION,
    events: [],
    filters: normalizeFilters({}, { nowDate }),
    selectedEventId: "",
    draft: makeDefaultEventDraft({ nowDate }),
    auditLog: [],
  };
}

export function ensureEventCalendarStateShape(state, { nowDate = new Date() } = {}){
  if (!state || typeof state !== "object"){
    return makeDefaultEventCalendarState({ nowDate });
  }
  if (!state.warRoom || typeof state.warRoom !== "object"){
    state.warRoom = {};
  }

  const warRoom = state.warRoom;
  const defaults = makeDefaultEventCalendarState({ nowDate });
  const src = (warRoom.eventCalendar && typeof warRoom.eventCalendar === "object")
    ? warRoom.eventCalendar
    : {};

  warRoom.eventCalendar = {
    ...defaults,
    ...src,
  };

  const calendar = warRoom.eventCalendar;
  calendar.version = EVENT_CALENDAR_VERSION;
  calendar.events = (Array.isArray(src.events) ? src.events : []).map((entry) => normalizeEventRecordLight(entry, { nowDate }));
  calendar.events.sort((a, b) => {
    const aDate = `${String(a?.date || "")}-${String(a?.startTime || "")}`;
    const bDate = `${String(b?.date || "")}-${String(b?.startTime || "")}`;
    return bDate.localeCompare(aDate);
  });
  calendar.filters = normalizeFilters(src.filters, { nowDate });
  calendar.selectedEventId = cleanText(src.selectedEventId);
  calendar.draft = normalizeDraft(src.draft, { nowDate });
  calendar.auditLog = normalizeAuditLog(src.auditLog);

  if (
    calendar.selectedEventId
    && !calendar.events.some((entry) => cleanText(entry?.eventId) === calendar.selectedEventId)
  ){
    calendar.selectedEventId = "";
  }

  return warRoom;
}
