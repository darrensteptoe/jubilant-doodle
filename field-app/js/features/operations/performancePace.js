// @ts-check

import { normalizePersonWorkforceFields } from "./workforce.js";
import { operationsParseDate, operationsStartOfWeekUTC, operationsToIsoDateUTC } from "./time.js";

const DAY_MS = 86400000;
const WEEK_MS = 7 * DAY_MS;

function clean(value){
  return String(value == null ? "" : value).trim();
}

function asNonNegativeNumber(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function parseRecordDate(...candidates){
  for (const candidate of candidates){
    const dt = operationsParseDate(candidate);
    if (dt instanceof Date && Number.isFinite(dt.getTime())){
      return dt;
    }
  }
  return null;
}

function weekKeyFromMs(ms){
  const dt = new Date(ms);
  if (!Number.isFinite(dt.getTime())) return "";
  return operationsToIsoDateUTC(operationsStartOfWeekUTC(dt));
}

function percentUnit(part, whole){
  const w = Number(whole);
  if (!Number.isFinite(w) || w <= 0) return null;
  const ratio = Number(part) / w;
  if (!Number.isFinite(ratio)) return null;
  return Math.max(0, ratio);
}

function elapsedWeeks(nowMs, firstTs, total){
  if (Number.isFinite(firstTs)){
    return Math.max(1, (Math.max(0, nowMs - firstTs) / WEEK_MS));
  }
  if (Number(total) > 0) return 1;
  return null;
}

function classifyPaceStatus({ goalAvailable, remaining, requiredWeeklyPace, averageWeeklyPace, weeksAvailable }){
  if (!goalAvailable) return "Goal Missing";
  if (Number.isFinite(remaining) && remaining <= 0) return "Ahead";
  if (!weeksAvailable) return "Watch";
  if (!Number.isFinite(requiredWeeklyPace) || requiredWeeklyPace <= 0){
    return "On Track";
  }
  if (!Number.isFinite(averageWeeklyPace) || averageWeeklyPace <= 0){
    return "Behind";
  }
  const ratio = averageWeeklyPace / requiredWeeklyPace;
  if (ratio >= 1.05) return "Ahead";
  if (ratio >= 0.9) return "On Track";
  return "Behind";
}

function trendDirection(thisWeek, priorWeek){
  const current = asNonNegativeNumber(thisWeek);
  const prior = asNonNegativeNumber(priorWeek);
  if (prior <= 0){
    return current > 0 ? "up" : "flat";
  }
  const deltaUnit = (current - prior) / prior;
  if (deltaUnit >= 0.1) return "up";
  if (deltaUnit <= -0.1) return "down";
  return "flat";
}

function buildImprovementCue({ status, thisWeek, requiredWeeklyPace, activeVolunteers, vbmsCollected, priorWeek }){
  if (status === "Behind" && Number.isFinite(requiredWeeklyPace) && thisWeek < requiredWeeklyPace){
    return "Raise weekly support-ID pace to close the gap.";
  }
  if (status === "Behind"){
    return "Increase weekly output consistency to recover pace.";
  }
  if ((activeVolunteers || 0) <= 0 && thisWeek > 0){
    return "Add volunteer activation to protect current output.";
  }
  if ((vbmsCollected || 0) > 0 && thisWeek <= 0){
    return "Convert ballot collection work into support-ID progress.";
  }
  if (thisWeek < priorWeek){
    return "Output slipped vs prior week; stabilize weekly cadence.";
  }
  if (status === "Ahead"){
    return "Maintain pace and help de-risk weaker lanes.";
  }
  return "Maintain current weekly execution cadence.";
}

function sortOrganizerRows(rows){
  return rows.slice().sort((a, b) => {
    const byToDate = asNonNegativeNumber(b?.completedToDate) - asNonNegativeNumber(a?.completedToDate);
    if (byToDate !== 0) return byToDate;
    return clean(a?.name).localeCompare(clean(b?.name));
  });
}

/**
 * Compute deterministic operations performance/pace summaries from existing canonical state and operations records.
 * Read-only: this helper does not mutate state or write any store values.
 *
 * @param {{
 *   stateSnapshot?: Record<string, any>,
 *   persons?: Array<Record<string, any>>,
 *   shiftRecords?: Array<Record<string, any>>,
 *   turfEvents?: Array<Record<string, any>>,
 *   nowMs?: number,
 * }} args
 */
export function computeOperationsPerformancePaceView(args = {}){
  const stateSnapshot = args?.stateSnapshot && typeof args.stateSnapshot === "object"
    ? args.stateSnapshot
    : {};
  const persons = Array.isArray(args?.persons) ? args.persons : [];
  const shiftRecords = Array.isArray(args?.shiftRecords) ? args.shiftRecords : [];
  const turfEvents = Array.isArray(args?.turfEvents) ? args.turfEvents : [];
  const nowMs = Number.isFinite(Number(args?.nowMs)) ? Number(args.nowMs) : Date.now();

  const normalizedPeople = persons.map((row) => normalizePersonWorkforceFields(row));
  const personById = new Map();
  for (const person of normalizedPeople){
    const id = clean(person?.id);
    if (!id) continue;
    personById.set(id, person);
  }

  const thisWeekKey = weekKeyFromMs(nowMs);
  const priorWeekKey = weekKeyFromMs(nowMs - WEEK_MS);

  /** @type {Map<string, { completedToDate: number, completedThisWeek: number, completedPriorWeek: number, firstTs: number | null }>} */
  const personProduction = new Map();
  let officeCompletedToDate = 0;
  let officeCompletedThisWeek = 0;
  let officeCompletedPriorWeek = 0;
  let officeFirstTs = null;

  for (const record of shiftRecords){
    const supportIds = asNonNegativeNumber(record?.supportIds);
    if (supportIds <= 0) continue;

    officeCompletedToDate += supportIds;

    const dt = parseRecordDate(record?.date, record?.checkInAt, record?.startAt, record?.updatedAt);
    if (dt instanceof Date && Number.isFinite(dt.getTime())){
      const ts = dt.getTime();
      const weekKey = weekKeyFromMs(ts);
      if (weekKey && weekKey === thisWeekKey) officeCompletedThisWeek += supportIds;
      if (weekKey && weekKey === priorWeekKey) officeCompletedPriorWeek += supportIds;
      officeFirstTs = (officeFirstTs == null) ? ts : Math.min(officeFirstTs, ts);
    }

    const personId = clean(record?.personId) || "unassigned";
    const current = personProduction.get(personId) || {
      completedToDate: 0,
      completedThisWeek: 0,
      completedPriorWeek: 0,
      firstTs: null,
    };
    current.completedToDate += supportIds;

    if (dt instanceof Date && Number.isFinite(dt.getTime())){
      const ts = dt.getTime();
      const weekKey = weekKeyFromMs(ts);
      if (weekKey && weekKey === thisWeekKey) current.completedThisWeek += supportIds;
      if (weekKey && weekKey === priorWeekKey) current.completedPriorWeek += supportIds;
      current.firstTs = (current.firstTs == null) ? ts : Math.min(current.firstTs, ts);
    }

    personProduction.set(personId, current);
  }

  const activeVolunteerCount = normalizedPeople
    .filter((person) => !!person?.active && clean(person?.workforceRole) === "volunteer")
    .length;
  const organizerIdsFromPeople = normalizedPeople
    .filter((person) => clean(person?.id) && clean(person?.workforceRole) === "organizer")
    .map((person) => clean(person.id));

  const volunteerBySupervisor = new Map();
  for (const person of normalizedPeople){
    if (!person?.active || clean(person?.workforceRole) !== "volunteer") continue;
    const supervisorId = clean(person?.supervisorId);
    if (!supervisorId) continue;
    volunteerBySupervisor.set(supervisorId, (volunteerBySupervisor.get(supervisorId) || 0) + 1);
  }

  const vbmsByOrganizer = new Map();
  let officeVbmsCollected = 0;
  for (const event of turfEvents){
    const vbms = asNonNegativeNumber(event?.vbms);
    if (vbms <= 0) continue;
    officeVbmsCollected += vbms;
    const assignedTo = clean(event?.assignedTo);
    if (!assignedTo) continue;
    vbmsByOrganizer.set(assignedTo, (vbmsByOrganizer.get(assignedTo) || 0) + vbms);
  }

  const goalRaw = Number(stateSnapshot?.goalSupportIds);
  const weeksRaw = Number(stateSnapshot?.weeksRemaining);
  const goal = Number.isFinite(goalRaw) && goalRaw > 0 ? goalRaw : null;
  const weeksRemaining = Number.isFinite(weeksRaw) && weeksRaw > 0 ? weeksRaw : null;

  const remainingToGoal = Number.isFinite(goal)
    ? Math.max(0, goal - officeCompletedToDate)
    : null;
  const percentComplete = Number.isFinite(goal)
    ? percentUnit(officeCompletedToDate, goal)
    : null;
  const percentRemaining = Number.isFinite(percentComplete)
    ? Math.max(0, 1 - percentComplete)
    : null;

  const officeElapsedWeeks = elapsedWeeks(nowMs, officeFirstTs, officeCompletedToDate);
  const averageWeeklyPace = Number.isFinite(officeElapsedWeeks) && officeElapsedWeeks > 0
    ? (officeCompletedToDate / officeElapsedWeeks)
    : null;
  const requiredWeeklyPace = Number.isFinite(weeksRemaining)
    ? ((Number.isFinite(remainingToGoal) && remainingToGoal > 0) ? (remainingToGoal / weeksRemaining) : 0)
    : null;

  const officePaceStatus = classifyPaceStatus({
    goalAvailable: Number.isFinite(goal),
    remaining: remainingToGoal,
    requiredWeeklyPace,
    averageWeeklyPace,
    weeksAvailable: Number.isFinite(weeksRemaining),
  });

  const organizerIdSet = new Set(organizerIdsFromPeople);
  if (!organizerIdSet.size){
    for (const key of personProduction.keys()){
      if (key) organizerIdSet.add(key);
    }
  }

  const organizerIds = Array.from(organizerIdSet).filter(Boolean);
  const organizerGoalShare = Number.isFinite(goal) && organizerIds.length > 0
    ? (goal / organizerIds.length)
    : null;

  const organizerRows = sortOrganizerRows(organizerIds.map((organizerId) => {
    const person = personById.get(organizerId);
    const production = personProduction.get(organizerId) || {
      completedToDate: 0,
      completedThisWeek: 0,
      completedPriorWeek: 0,
      firstTs: null,
    };

    const elapsed = elapsedWeeks(nowMs, production.firstTs, production.completedToDate);
    const avgPace = Number.isFinite(elapsed) && elapsed > 0
      ? (production.completedToDate / elapsed)
      : null;

    const remainingToShare = Number.isFinite(organizerGoalShare)
      ? Math.max(0, organizerGoalShare - production.completedToDate)
      : null;
    const requiredPace = Number.isFinite(weeksRemaining)
      ? ((Number.isFinite(remainingToShare) && remainingToShare > 0) ? (remainingToShare / weeksRemaining) : 0)
      : null;
    const percentToShare = Number.isFinite(organizerGoalShare)
      ? percentUnit(production.completedToDate, organizerGoalShare)
      : null;

    const status = classifyPaceStatus({
      goalAvailable: Number.isFinite(organizerGoalShare),
      remaining: remainingToShare,
      requiredWeeklyPace: requiredPace,
      averageWeeklyPace: avgPace,
      weeksAvailable: Number.isFinite(weeksRemaining),
    });

    return {
      organizerId,
      name: clean(person?.name) || organizerId,
      completedThisWeek: production.completedThisWeek,
      completedToDate: production.completedToDate,
      expectedShareGoal: organizerGoalShare,
      percentToShare,
      remainingToShare,
      requiredWeeklyPace: requiredPace,
      averageWeeklyPace: avgPace,
      activeVolunteers: volunteerBySupervisor.get(organizerId) || 0,
      vbmsCollected: vbmsByOrganizer.get(organizerId) || 0,
      status,
      contributionShare: percentUnit(production.completedToDate, officeCompletedToDate),
      improvementCue: buildImprovementCue({
        status,
        thisWeek: production.completedThisWeek,
        requiredWeeklyPace: requiredPace,
        activeVolunteers: volunteerBySupervisor.get(organizerId) || 0,
        vbmsCollected: vbmsByOrganizer.get(organizerId) || 0,
        priorWeek: production.completedPriorWeek,
      }),
    };
  }));

  const insights = [];
  const weeklyDirection = trendDirection(officeCompletedThisWeek, officeCompletedPriorWeek);

  if (!Number.isFinite(goal)){
    insights.push("Canonical support-ID goal is missing for this scope; pace guidance is limited.");
  } else if (officePaceStatus === "Behind" && weeklyDirection === "up"){
    insights.push("Behind required pace despite improving week-over-week output.");
  } else if (officePaceStatus === "Behind"){
    insights.push("Behind required pace; increase weekly support-ID production.");
  } else if (officePaceStatus === "Ahead"){
    insights.push("Ahead of required pace; protect consistency and reduce concentration risk.");
  } else if (officePaceStatus === "On Track"){
    insights.push("Current output is near required pace; maintain weekly discipline.");
  }

  if (activeVolunteerCount <= 0){
    insights.push("Volunteer activation is weak; office output depends on paid/organizer lanes.");
  }

  if (officeVbmsCollected > 0 && officeCompletedThisWeek <= 0){
    insights.push("VBM collection is active, but weekly support-ID conversion is low.");
  }

  if (organizerRows.length >= 3 && officeCompletedToDate > 0){
    const topTwo = organizerRows.slice(0, 2).reduce((sum, row) => sum + asNonNegativeNumber(row.completedToDate), 0);
    const topTwoShare = topTwo / officeCompletedToDate;
    if (topTwoShare >= 0.7){
      insights.push("Output is concentrated in a small organizer subset; bench depth risk is elevated.");
    }
  }

  if (weeklyDirection === "down"){
    insights.push("Weekly output is down versus prior week; confirm near-term recovery plan.");
  }

  return {
    goalSource: Number.isFinite(goal) ? "goalSupportIds" : "",
    office: {
      goal,
      completedToDate: officeCompletedToDate,
      remainingToGoal,
      percentComplete,
      percentRemaining,
      weeksRemaining,
      requiredWeeklyPace,
      averageWeeklyPace,
      paceStatus: officePaceStatus,
      activeVolunteers: activeVolunteerCount,
      vbmsCollected: officeVbmsCollected,
      weekly: {
        thisWeek: officeCompletedThisWeek,
        priorWeek: officeCompletedPriorWeek,
        direction: weeklyDirection,
      },
    },
    organizers: organizerRows,
    insights: insights.slice(0, 4),
  };
}
