// @ts-check
import {
  EVENT_CATEGORY_ADMIN,
  EVENT_CATEGORY_CAMPAIGN,
  EVENT_CATEGORY_FILTER_OPTIONS,
  EVENT_CATEGORY_OPTIONS,
  EVENT_STATUS_OPTIONS,
  eventTypeOptionsForCategory,
  makeDefaultEventDraft,
} from "./eventCalendarState.js";
import {
  formatEventCapacityAdjustmentText,
} from "./eventImpactRules.js";
import {
  selectEventCalendarSummary,
  selectEventCalendarState,
  selectVisibleEventRows,
} from "./eventSelectors.js";

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function formatDateLabel(dateIso){
  const text = cleanText(dateIso);
  if (!text) return "—";
  const parsed = new Date(`${text}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeRange(startTime, endTime){
  const start = cleanText(startTime);
  const end = cleanText(endTime);
  if (start && end) return `${start}-${end}`;
  return start || end || "—";
}

function categoryLabel(category){
  const normalized = cleanText(category).toLowerCase();
  if (normalized === EVENT_CATEGORY_ADMIN) return "Admin";
  if (normalized === EVENT_CATEGORY_CAMPAIGN) return "Campaign";
  return "Unknown";
}

function statusLabel(status){
  const normalized = cleanText(status).toLowerCase();
  const match = EVENT_STATUS_OPTIONS.find((option) => option.value === normalized);
  return match?.label || "Unknown";
}

function buildEventRowView(row){
  const src = row && typeof row === "object" ? row : {};
  const category = cleanText(src.category).toLowerCase();
  const isCampaign = category === EVENT_CATEGORY_CAMPAIGN;

  return {
    eventId: cleanText(src.eventId),
    title: cleanText(src.title) || "Untitled event",
    category,
    categoryLabel: categoryLabel(category),
    eventType: cleanText(src.eventType),
    date: cleanText(src.date),
    dateLabel: formatDateLabel(src.date),
    timeLabel: formatTimeRange(src.startTime, src.endTime),
    notes: String(src.notes == null ? "" : src.notes),
    status: cleanText(src.status).toLowerCase(),
    statusLabel: statusLabel(src.status),
    applyToModel: !!src.applyToModel,
    canApplyToModel: isCampaign,
    expectedVolunteers: Number(src.expectedVolunteers || 0) || 0,
    expectedPaidCanvassers: Number(src.expectedPaidCanvassers || 0) || 0,
    expectedShiftHours: Number(src.expectedShiftHours || 0) || 0,
    attendees: String(src.attendees == null ? "" : src.attendees),
    meetingType: cleanText(src.meetingType),
    followUpOwner: cleanText(src.followUpOwner),
    followUpDate: cleanText(src.followUpDate),
    officeLocation: String(src.officeLocation == null ? "" : src.officeLocation),
    fieldGoalNotes: String(src.fieldGoalNotes == null ? "" : src.fieldGoalNotes),
    channelFocus: cleanText(src.channelFocus),
    createdBy: cleanText(src.createdBy),
    createdAt: cleanText(src.createdAt),
    scenarioId: cleanText(src.scenarioId),
  };
}

export function buildEventCalendarView(state, {
  nowDate = new Date(),
  scenarioId = "",
} = {}){
  const calendar = selectEventCalendarState(state, { nowDate });

  if (!calendar){
    return {
      filters: {
        date: new Date(nowDate).toISOString().slice(0, 10),
        category: "all",
        includeInactive: false,
        appliedOnly: false,
      },
      draft: makeDefaultEventDraft({ nowDate }),
      selectedEventId: "",
      summaryText: "Event calendar unavailable.",
      impactText: "No active campaign events are applying capacity modifiers for the selected date.",
      rows: [],
      options: {
        categoryFilterOptions: EVENT_CATEGORY_FILTER_OPTIONS,
        categoryOptions: EVENT_CATEGORY_OPTIONS,
        eventTypeOptions: eventTypeOptionsForCategory(EVENT_CATEGORY_CAMPAIGN),
        statusOptions: EVENT_STATUS_OPTIONS,
      },
      summary: {
        date: new Date(nowDate).toISOString().slice(0, 10),
        totalCount: 0,
        adminCount: 0,
        campaignCount: 0,
        appliedCount: 0,
      },
      impact: null,
      auditLog: [],
    };
  }

  const filters = {
    date: cleanText(calendar?.filters?.date) || new Date(nowDate).toISOString().slice(0, 10),
    category: cleanText(calendar?.filters?.category || "all").toLowerCase() || "all",
    includeInactive: !!calendar?.filters?.includeInactive,
    appliedOnly: !!calendar?.filters?.appliedOnly,
  };

  const rowsRaw = selectVisibleEventRows(state, {
    nowDate,
    date: filters.date,
    category: filters.category,
    includeInactive: filters.includeInactive,
    appliedOnly: filters.appliedOnly,
    scenarioId,
  });
  const rows = rowsRaw.map((row) => buildEventRowView(row));

  const summary = selectEventCalendarSummary(state, {
    nowDate,
    date: filters.date,
    scenarioId,
  });

  const draft = {
    ...makeDefaultEventDraft({ nowDate }),
    ...(calendar?.draft && typeof calendar.draft === "object" ? calendar.draft : {}),
  };
  const draftCategory = cleanText(draft.category).toLowerCase() || EVENT_CATEGORY_CAMPAIGN;

  const summaryText = `${summary.totalCount} event(s) on ${filters.date} (${summary.adminCount} admin, ${summary.campaignCount} campaign, ${summary.appliedCount} apply-to-model).`;
  const impactText = formatEventCapacityAdjustmentText(summary.impact);

  return {
    filters,
    draft,
    selectedEventId: cleanText(calendar.selectedEventId),
    summaryText,
    impactText,
    rows,
    options: {
      categoryFilterOptions: EVENT_CATEGORY_FILTER_OPTIONS,
      categoryOptions: EVENT_CATEGORY_OPTIONS,
      eventTypeOptions: eventTypeOptionsForCategory(draftCategory),
      statusOptions: EVENT_STATUS_OPTIONS,
    },
    summary,
    impact: summary.impact,
    auditLog: Array.isArray(calendar.auditLog) ? calendar.auditLog.slice(0, 40) : [],
  };
}
