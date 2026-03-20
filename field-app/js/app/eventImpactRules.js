// @ts-check
import {
  EVENT_CATEGORY_CAMPAIGN,
  EVENT_STATUS_ACTIVE,
  EVENT_STATUS_SCHEDULED,
  normalizeIsoDate,
} from "./eventCalendarState.js";
import { formatFixedNumber, safeNum } from "../core/utils.js";

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function asNonNegativeNumber(value, fallback = 0){
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  if (n < 0) return 0;
  return n;
}

function resolveDateIso(value, fallbackNow = new Date()){
  const fallback = new Date(fallbackNow).toISOString().slice(0, 10);
  return normalizeIsoDate(value, fallback);
}

function eventStatusAllowsCapacity(status){
  const text = cleanText(status).toLowerCase();
  return text === EVENT_STATUS_SCHEDULED || text === EVENT_STATUS_ACTIVE;
}

function eventMatchesContext(event, { campaignId = "", officeId = "", scenarioId = "" } = {}){
  const src = event && typeof event === "object" ? event : {};
  if (cleanText(src.campaignId) !== cleanText(campaignId)) return false;
  if (cleanText(src.officeId) !== cleanText(officeId)) return false;

  const eventScenarioId = cleanText(src.scenarioId);
  const currentScenarioId = cleanText(scenarioId);
  if (!eventScenarioId) return true;
  return eventScenarioId === currentScenarioId;
}

function buildWorkforceBaseline(state = {}){
  const workforce = (state?.ui?.twCapOutlookLatest && typeof state.ui.twCapOutlookLatest === "object")
    ? (state.ui.twCapOutlookLatest.workforce || {})
    : {};

  const organizerCount = safeNum(workforce.organizerCount) ?? safeNum(state?.orgCount) ?? 0;
  const activeVolunteerCount = safeNum(workforce.activeVolunteerCount)
    ?? safeNum(workforce.activeVolunteerHeadcount)
    ?? Math.max(0, organizerCount) * 4;
  const paidCanvasserCount = safeNum(workforce.paidCanvasserCount)
    ?? safeNum(workforce.activePaidHeadcount)
    ?? Math.max(0, organizerCount);

  return {
    organizerCount: Math.max(1, asNonNegativeNumber(organizerCount, 1)),
    activeVolunteerCount: Math.max(1, asNonNegativeNumber(activeVolunteerCount, 1)),
    paidCanvasserCount: Math.max(1, asNonNegativeNumber(paidCanvasserCount, 1)),
  };
}

function clamp(value, min, max){
  return Math.min(max, Math.max(min, value));
}

function deriveSingleEventCapacityModifier(event, baseline){
  const volunteers = asNonNegativeNumber(event?.expectedVolunteers, 0);
  const paidCanvassers = asNonNegativeNumber(event?.expectedPaidCanvassers, 0);
  const shiftHours = asNonNegativeNumber(event?.expectedShiftHours, 0);

  const volunteerLift = clamp(1 + (volunteers / baseline.activeVolunteerCount) * 0.7, 1, 2.4);
  const paidLift = clamp(1 + (paidCanvassers / baseline.paidCanvasserCount) * 0.55, 1, 2.1);
  const shiftLift = shiftHours > 0
    ? clamp(shiftHours / 4, 0.8, 1.7)
    : 1;

  return {
    volunteerMultiplier: volunteerLift,
    doorsPerHourMultiplier: clamp((volunteerLift * 0.45 + paidLift * 0.55) * shiftLift, 1, 2.6),
    callsPerHourMultiplier: clamp((volunteerLift * 0.4 + paidLift * 0.6) * shiftLift, 1, 2.6),
    shiftHoursMultiplier: shiftLift,
  };
}

function combineModifiers(modifiers = []){
  let volunteerMultiplier = 1;
  let doorsPerHourMultiplier = 1;
  let callsPerHourMultiplier = 1;
  let shiftHoursMultiplier = 1;

  for (const row of modifiers){
    volunteerMultiplier = clamp(volunteerMultiplier * (safeNum(row?.volunteerMultiplier) ?? 1), 1, 3.2);
    doorsPerHourMultiplier = clamp(doorsPerHourMultiplier * (safeNum(row?.doorsPerHourMultiplier) ?? 1), 1, 3.2);
    callsPerHourMultiplier = clamp(callsPerHourMultiplier * (safeNum(row?.callsPerHourMultiplier) ?? 1), 1, 3.2);
    shiftHoursMultiplier = clamp(shiftHoursMultiplier * (safeNum(row?.shiftHoursMultiplier) ?? 1), 0.8, 2.5);
  }

  return {
    volunteerMultiplier,
    doorsPerHourMultiplier,
    callsPerHourMultiplier,
    shiftHoursMultiplier,
  };
}

function collectCampaignEventsForDate(state = {}, {
  date = null,
  scenarioId = "",
  requireApplyToModel = false,
  includeInactive = false,
} = {}){
  const events = Array.isArray(state?.warRoom?.eventCalendar?.events)
    ? state.warRoom.eventCalendar.events
    : [];
  const dateIso = resolveDateIso(date, new Date());
  const campaignId = cleanText(state?.campaignId);
  const officeId = cleanText(state?.officeId);
  const activeScenarioId = cleanText(scenarioId || state?.ui?.activeScenarioId);

  return events.filter((event) => {
    const src = event && typeof event === "object" ? event : {};
    if (cleanText(src.category) !== EVENT_CATEGORY_CAMPAIGN) return false;
    if (!eventMatchesContext(src, { campaignId, officeId, scenarioId: activeScenarioId })) return false;
    if (resolveDateIso(src.date, new Date()) !== dateIso) return false;
    if (!includeInactive && !eventStatusAllowsCapacity(src.status)) return false;
    if (requireApplyToModel && !src.applyToModel) return false;
    return true;
  });
}

export function deriveEventCapacityAdjustmentForState(state = {}, {
  date = null,
  scenarioId = "",
} = {}){
  const targetDate = resolveDateIso(date, new Date());
  const appliedEvents = collectCampaignEventsForDate(state, {
    date: targetDate,
    scenarioId,
    requireApplyToModel: true,
    includeInactive: false,
  });

  if (!appliedEvents.length){
    return {
      enabled: false,
      date: targetDate,
      eventCount: 0,
      appliedEventIds: [],
      volunteerMultiplier: 1,
      doorsPerHourMultiplier: 1,
      callsPerHourMultiplier: 1,
      shiftHoursMultiplier: 1,
      events: [],
    };
  }

  const baseline = buildWorkforceBaseline(state);
  const perEventModifiers = appliedEvents.map((event) => deriveSingleEventCapacityModifier(event, baseline));
  const combined = combineModifiers(perEventModifiers);

  return {
    enabled: true,
    date: targetDate,
    eventCount: appliedEvents.length,
    appliedEventIds: appliedEvents.map((event) => cleanText(event?.eventId)).filter(Boolean),
    volunteerMultiplier: combined.volunteerMultiplier,
    doorsPerHourMultiplier: combined.doorsPerHourMultiplier,
    callsPerHourMultiplier: combined.callsPerHourMultiplier,
    shiftHoursMultiplier: combined.shiftHoursMultiplier,
    events: appliedEvents.map((event, idx) => ({
      eventId: cleanText(event?.eventId),
      title: cleanText(event?.title) || "Campaign event",
      eventType: cleanText(event?.eventType),
      date: resolveDateIso(event?.date, new Date()),
      expectedVolunteers: asNonNegativeNumber(event?.expectedVolunteers, 0),
      expectedPaidCanvassers: asNonNegativeNumber(event?.expectedPaidCanvassers, 0),
      expectedShiftHours: asNonNegativeNumber(event?.expectedShiftHours, 0),
      modifier: perEventModifiers[idx],
    })),
  };
}

export function formatEventCapacityAdjustmentText(adjustment = null){
  const src = adjustment && typeof adjustment === "object" ? adjustment : null;
  if (!src?.enabled || !src?.eventCount){
    return "No active campaign events are applying capacity modifiers for the selected date.";
  }

  const vol = formatFixedNumber(src.volunteerMultiplier, 2);
  const doors = formatFixedNumber(src.doorsPerHourMultiplier, 2);
  const calls = formatFixedNumber(src.callsPerHourMultiplier, 2);
  return `${src.eventCount} campaign event(s) applied for ${src.date}: volunteer x${vol}, doors x${doors}, calls x${calls}.`;
}

export function evaluateEventAssumptionRealism(state = {}, {
  date = null,
  scenarioId = "",
} = {}){
  const targetDate = resolveDateIso(date, new Date());
  const events = collectCampaignEventsForDate(state, {
    date: targetDate,
    scenarioId,
    requireApplyToModel: false,
    includeInactive: true,
  });
  if (!events.length) return [];

  const baseline = buildWorkforceBaseline(state);
  const flags = [];

  for (const event of events){
    const label = cleanText(event?.title) || "Campaign event";
    const volunteers = asNonNegativeNumber(event?.expectedVolunteers, 0);
    const paid = asNonNegativeNumber(event?.expectedPaidCanvassers, 0);
    const shiftHours = asNonNegativeNumber(event?.expectedShiftHours, 0);

    if (event?.applyToModel && volunteers <= 0 && paid <= 0){
      flags.push({
        kind: "event",
        field: `event:${cleanText(event?.eventId)}`,
        label,
        severity: "warn",
        value: 0,
        reason: `${label} is set to apply-to-model but has no staffing assumptions.`,
      });
    }

    if (volunteers >= baseline.activeVolunteerCount * 4){
      flags.push({
        kind: "event",
        field: `event:${cleanText(event?.eventId)}:expectedVolunteers`,
        label,
        severity: "bad",
        value: volunteers,
        reason: `${label} expects volunteer staffing far above baseline capacity (${volunteers} vs ${baseline.activeVolunteerCount}).`,
      });
    } else if (volunteers >= baseline.activeVolunteerCount * 2){
      flags.push({
        kind: "event",
        field: `event:${cleanText(event?.eventId)}:expectedVolunteers`,
        label,
        severity: "warn",
        value: volunteers,
        reason: `${label} expects volunteer staffing materially above baseline (${volunteers} vs ${baseline.activeVolunteerCount}).`,
      });
    }

    if (paid >= baseline.paidCanvasserCount * 4){
      flags.push({
        kind: "event",
        field: `event:${cleanText(event?.eventId)}:expectedPaidCanvassers`,
        label,
        severity: "bad",
        value: paid,
        reason: `${label} expects paid canvasser staffing far above baseline (${paid} vs ${baseline.paidCanvasserCount}).`,
      });
    } else if (paid >= baseline.paidCanvasserCount * 2){
      flags.push({
        kind: "event",
        field: `event:${cleanText(event?.eventId)}:expectedPaidCanvassers`,
        label,
        severity: "warn",
        value: paid,
        reason: `${label} expects paid canvasser staffing above baseline (${paid} vs ${baseline.paidCanvasserCount}).`,
      });
    }

    if (shiftHours > 12){
      flags.push({
        kind: "event",
        field: `event:${cleanText(event?.eventId)}:expectedShiftHours`,
        label,
        severity: "bad",
        value: shiftHours,
        reason: `${label} shift-hour assumption exceeds plausible field-day limits (${shiftHours}h).`,
      });
    } else if (shiftHours > 8){
      flags.push({
        kind: "event",
        field: `event:${cleanText(event?.eventId)}:expectedShiftHours`,
        label,
        severity: "warn",
        value: shiftHours,
        reason: `${label} shift-hour assumption is aggressive (${shiftHours}h).`,
      });
    }
  }

  return flags;
}
