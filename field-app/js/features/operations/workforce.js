// @ts-check
// Canonical workforce role modeling + staffing rollups.
import {
  operationsClampNumber,
  operationsFiniteNumber,
  operationsShiftHours,
} from "./time.js";
import { roundWholeNumberByMode } from "../../core/utils.js";

export const WORKFORCE_ROLE_TYPES = [
  "field_organizer",
  "canvasser",
  "volunteer",
  "volunteer_lead",
];

export const WORKFORCE_CANONICAL_ROLES = [
  "organizer",
  "volunteer",
  "paid_canvasser",
];

export const WORKFORCE_COMPENSATION_TYPES = [
  "paid",
  "volunteer",
  "stipend",
];

const ORGANIZER_SUPERVISION_SPAN = 12;
const ORGANIZER_RECRUITMENT_STEP = 0.03;
const ORGANIZER_RECRUITMENT_CAP = 1.60;

function clean(value){
  return String(value == null ? "" : value).trim();
}

const num = operationsFiniteNumber;
const clamp = operationsClampNumber;

function hasValue(value){
  return clean(value) !== "";
}

function roleFromLegacy(value){
  const raw = clean(value).toLowerCase();
  if (!raw) return "";
  if (raw === "organizer" || raw === "field organizer" || raw === "field_organizer") return "field_organizer";
  if (raw === "volunteer lead" || raw === "volunteer_lead") return "volunteer_lead";
  if (raw === "volunteer") return "volunteer";
  if (raw === "canvasser" || raw === "paid canvasser" || raw === "paid_canvasser") return "canvasser";
  return "";
}

function compensationFromLegacy(value){
  const raw = clean(value).toLowerCase();
  if (!raw) return "";
  if (raw === "paid" || raw === "hourly" || raw === "salary") return "paid";
  if (raw === "stipend") return "stipend";
  if (raw === "volunteer" || raw === "unpaid") return "volunteer";
  return "";
}

function canonicalRoleFromLegacy(value){
  const raw = clean(value).toLowerCase();
  if (!raw) return "";
  if (raw === "organizer" || raw === "field organizer" || raw === "field_organizer") return "organizer";
  if (raw === "volunteer" || raw === "volunteer lead" || raw === "volunteer_lead") return "volunteer";
  if (raw === "canvasser" || raw === "paid canvasser" || raw === "paid_canvasser") return "paid_canvasser";
  return "";
}

function isVolunteerRole(roleType){
  return roleType === "volunteer" || roleType === "volunteer_lead";
}

function isPaidComp(compensationType){
  return compensationType === "paid" || compensationType === "stipend";
}

export function normalizeRoleType(value, fallback = "canvasser"){
  const raw = clean(value).toLowerCase();
  const role = roleFromLegacy(raw) || roleFromLegacy(fallback) || "canvasser";
  return WORKFORCE_ROLE_TYPES.includes(role) ? role : "canvasser";
}

export function normalizeCompensationType(value, roleType = "canvasser"){
  const fromLegacy = compensationFromLegacy(value);
  if (WORKFORCE_COMPENSATION_TYPES.includes(fromLegacy)) return fromLegacy;
  if (isVolunteerRole(roleType)) return "volunteer";
  return "paid";
}

export function resolveCanonicalWorkforceRole({ workforceRole = "", roleType = "", compensationType = "" } = {}){
  const explicit = canonicalRoleFromLegacy(workforceRole);
  if (WORKFORCE_CANONICAL_ROLES.includes(explicit)) return explicit;

  const normalizedRoleType = normalizeRoleType(roleType || "canvasser");
  const normalizedCompensation = normalizeCompensationType(compensationType, normalizedRoleType);
  if (normalizedRoleType === "field_organizer") return "organizer";
  if (normalizedRoleType === "canvasser" && isPaidComp(normalizedCompensation)) return "paid_canvasser";
  if (isVolunteerRole(normalizedRoleType) || normalizedCompensation === "volunteer") return "volunteer";
  return "paid_canvasser";
}

export function normalizePersonWorkforceFields(person, defaults = {}){
  const src = (person && typeof person === "object") ? person : {};
  let roleType = normalizeRoleType(
    src.roleType || src.role || src.workforceRole || src.canonicalRole || defaults.roleType || "canvasser"
  );
  let compensationType = normalizeCompensationType(src.compensationType || defaults.compensationType, roleType);
  const workforceRole = resolveCanonicalWorkforceRole({
    workforceRole: src.workforceRole || src.canonicalRole,
    roleType,
    compensationType,
  });
  if (workforceRole === "organizer"){
    roleType = "field_organizer";
    compensationType = (compensationType === "volunteer") ? "paid" : compensationType;
  } else if (workforceRole === "paid_canvasser"){
    roleType = "canvasser";
    compensationType = isPaidComp(compensationType) ? compensationType : "paid";
  } else {
    roleType = isVolunteerRole(roleType) ? roleType : "volunteer";
    compensationType = "volunteer";
  }
  const payRate = num(src.payRate, null);
  const expectedHoursPerWeek = num(src.expectedHoursPerWeek, null);
  return {
    ...src,
    roleType,
    workforceRole,
    canonicalRole: workforceRole,
    compensationType,
    payRate: (payRate != null && payRate >= 0) ? payRate : null,
    expectedHoursPerWeek: (expectedHoursPerWeek != null && expectedHoursPerWeek >= 0) ? expectedHoursPerWeek : null,
    supervisorId: clean(src.supervisorId),
    role: clean(src.role) || roleType,
    active: !!src.active,
  };
}

function isoDay(value){
  const s = clean(value);
  if (!s) return "";
  return s.slice(0, 10);
}

function parseTs(value){
  const raw = clean(value);
  if (!raw) return NaN;
  const ts = Date.parse(raw.length <= 10 ? `${raw}T00:00:00` : raw);
  return Number.isFinite(ts) ? ts : NaN;
}

function shiftAttempts(rec){
  const val = num(rec?.attempts, 0);
  return Math.max(0, val || 0);
}

function buildPersonMap(persons){
  const map = new Map();
  const rows = Array.isArray(persons) ? persons : [];
  for (const raw of rows){
    const normalized = normalizePersonWorkforceFields(raw);
    const id = clean(normalized.id);
    if (!id) continue;
    map.set(id, normalized);
  }
  return map;
}

function activeByRole(rows, roleType){
  return rows.filter((p) => p.roleType === roleType && !!p.active).length;
}

function activeByWorkforceRole(rows, workforceRole){
  return rows.filter((p) => p.workforceRole === workforceRole && !!p.active).length;
}

function roleShare(count, total){
  if (!Number.isFinite(total) || total <= 0) return 0;
  return clamp((Number(count) || 0) / total, 0, 1);
}

function officeBucketId(person){
  return clean(person?.officeId) || clean(person?.office) || "unassigned";
}

function officeSortWeight(id){
  return id === "unassigned" ? 1 : 0;
}

function averageAttemptsPerHour({ attempts, hours }){
  if (!Number.isFinite(hours) || hours <= 0) return null;
  if (!Number.isFinite(attempts) || attempts < 0) return null;
  return attempts / hours;
}

/**
 * @param {{
 *   persons?: Array<Record<string, any>>,
 *   shiftRecords?: Array<Record<string, any>>,
 *   lookbackDays?: number,
 * }} args
 */
export function computeWorkforceRollups({ persons, shiftRecords, lookbackDays = 14 } = {}){
  const personRows = Array.isArray(persons) ? persons.map((p) => normalizePersonWorkforceFields(p)) : [];
  const personById = buildPersonMap(personRows);
  const shiftRows = Array.isArray(shiftRecords) ? shiftRecords : [];

  const organizerCount = activeByWorkforceRole(personRows, "organizer");
  const paidCanvasserCount = activeByWorkforceRole(personRows, "paid_canvasser");
  const activeVolunteerCount = activeByWorkforceRole(personRows, "volunteer");
  const activePaidHeadcount = personRows.filter((p) => !!p.active && p.compensationType === "paid").length;
  const activeStipendHeadcount = personRows.filter((p) => !!p.active && p.compensationType === "stipend").length;
  const activeVolunteerHeadcount = personRows.filter((p) => !!p.active && p.compensationType === "volunteer").length;
  const activeHeadcount = personRows.filter((p) => !!p.active).length;
  const activeRoleTypedCount = personRows.filter((p) => !!p.active && WORKFORCE_CANONICAL_ROLES.includes(String(p?.workforceRole || ""))).length;
  const missingRoleTypedCount = Math.max(0, activeHeadcount - activeRoleTypedCount);
  const roleTypingCoveragePct = activeHeadcount > 0
    ? clamp(activeRoleTypedCount / activeHeadcount, 0, 1)
    : 1;
  const organizerSupervisionCapacity = organizerCount * ORGANIZER_SUPERVISION_SPAN;
  const organizerRecruitmentMultiplier = clamp(1 + (organizerCount * ORGANIZER_RECRUITMENT_STEP), 1, ORGANIZER_RECRUITMENT_CAP);

  const now = Date.now();
  const lookbackMs = Math.max(1, num(lookbackDays, 14) || 14) * 86400000;
  const minTs = now - lookbackMs;
  const volunteersWithShift = new Set();

  let paidAttempts = 0;
  let paidHours = 0;
  let volunteerAttempts = 0;
  let volunteerHours = 0;

  for (const rec of shiftRows){
    const personId = clean(rec?.personId);
    if (!personId) continue;
    const person = personById.get(personId);
    if (!person) continue;
    const attempts = shiftAttempts(rec);
    const hours = operationsShiftHours(rec);

    if (person.workforceRole === "paid_canvasser"){
      paidAttempts += attempts;
      paidHours += hours;
      continue;
    }
    if (person.workforceRole === "volunteer"){
      volunteerAttempts += attempts;
      volunteerHours += hours;
      const dayTs = parseTs(isoDay(rec?.date || rec?.checkInAt || rec?.startAt || rec?.updatedAt));
      if (Number.isFinite(dayTs) && dayTs >= minTs){
        volunteersWithShift.add(personId);
      }
    }
  }

  const paidAttemptsPerHour = averageAttemptsPerHour({ attempts: paidAttempts, hours: paidHours });
  const volunteerAttemptsPerHour = averageAttemptsPerHour({ attempts: volunteerAttempts, hours: volunteerHours });

  let overallAttemptsPerHour = null;
  const combinedAttempts = paidAttempts + volunteerAttempts;
  const combinedHours = paidHours + volunteerHours;
  if (combinedHours > 0){
    overallAttemptsPerHour = combinedAttempts / combinedHours;
  }

  const paidCanvasserProductivity = (overallAttemptsPerHour && paidAttemptsPerHour)
    ? (paidAttemptsPerHour / overallAttemptsPerHour)
    : 1;
  const volunteerProductivity = (overallAttemptsPerHour && volunteerAttemptsPerHour)
    ? (volunteerAttemptsPerHour / overallAttemptsPerHour)
    : 1;

  const volunteerShowRate = activeVolunteerCount > 0
    ? clamp(volunteersWithShift.size / activeVolunteerCount, 0, 1)
    : null;

  const totalRoleCount = organizerCount + paidCanvasserCount + activeVolunteerCount;
  const organizerShare = roleShare(organizerCount, totalRoleCount);
  const paidCanvasserShare = roleShare(paidCanvasserCount, totalRoleCount);
  const volunteerShare = roleShare(activeVolunteerCount, totalRoleCount);

  const supervisionCoverage = activeVolunteerCount > 0
    ? clamp(organizerSupervisionCapacity / Math.max(1, activeVolunteerCount), 0.55, 1.20)
    : 1;
  const volunteerEngagementMultiplier = (volunteerShowRate == null)
    ? 1
    : clamp(0.55 + (0.45 * volunteerShowRate), 0.55, 1);
  const organizerRoleMultiplier = clamp(1 + (organizerCount * ORGANIZER_RECRUITMENT_STEP * 0.5), 1, 1.25);
  const paidRoleMultiplier = clamp(paidCanvasserProductivity, 0.65, 1.35);
  const volunteerRoleMultiplier = clamp(volunteerProductivity * supervisionCoverage * volunteerEngagementMultiplier, 0.45, 1.35);
  const roleCapacityMultiplier = (totalRoleCount > 0)
    ? clamp(
      (organizerShare * organizerRoleMultiplier) +
      (paidCanvasserShare * paidRoleMultiplier) +
      (volunteerShare * volunteerRoleMultiplier),
      0.6,
      1.35
    )
    : 1;

  return {
    organizerCount,
    paidCanvasserCount,
    activeVolunteerCount,
    activeHeadcount,
    activePaidHeadcount,
    activeStipendHeadcount,
    activeVolunteerHeadcount,
    activeRoleTypedCount,
    missingRoleTypedCount,
    roleTypingCoveragePct,
    workforceRoleCounts: {
      organizer: organizerCount,
      paid_canvasser: paidCanvasserCount,
      volunteer: activeVolunteerCount,
    },
    workforceRoleShares: {
      organizer: organizerShare,
      paid_canvasser: paidCanvasserShare,
      volunteer: volunteerShare,
    },
    volunteerShowRate,
    organizerRecruitmentMultiplier,
    organizerSupervisionCapacity,
    paidCanvasserProductivity,
    volunteerProductivity,
    organizerRoleMultiplier,
    paidRoleMultiplier,
    volunteerRoleMultiplier,
    roleCapacityMultiplier,
    paidAttemptsPerHour,
    volunteerAttemptsPerHour,
    overallAttemptsPerHour,
    lookbackDays: Math.max(1, roundWholeNumberByMode(num(lookbackDays, 14) || 14, { mode: "round", fallback: 14 }) || 14),
  };
}

/**
 * Office-scoped staffing mix summary for reporting surfaces.
 * @param {{
 *   persons?: Array<Record<string, any>>,
 * }} args
 */
export function computeWorkforceOfficeMix({ persons } = {}){
  const personRows = Array.isArray(persons) ? persons.map((p) => normalizePersonWorkforceFields(p)) : [];
  const byOffice = new Map();

  for (const person of personRows){
    const officeId = officeBucketId(person);
    if (!byOffice.has(officeId)){
      byOffice.set(officeId, {
        officeId,
        headcount: 0,
        activeHeadcount: 0,
        organizerCount: 0,
        paidCanvasserCount: 0,
        activeVolunteerCount: 0,
        volunteerLeadCount: 0,
        paidHeadcount: 0,
        stipendHeadcount: 0,
        volunteerHeadcount: 0,
      });
    }
    const row = byOffice.get(officeId);
    row.headcount += 1;
    if (!person.active) continue;

    row.activeHeadcount += 1;
    if (person.workforceRole === "organizer") row.organizerCount += 1;
    if (person.workforceRole === "paid_canvasser") row.paidCanvasserCount += 1;
    if (person.workforceRole === "volunteer") row.activeVolunteerCount += 1;
    if (person.roleType === "volunteer_lead") row.volunteerLeadCount += 1;
    if (person.compensationType === "paid") row.paidHeadcount += 1;
    if (person.compensationType === "stipend") row.stipendHeadcount += 1;
    if (person.compensationType === "volunteer") row.volunteerHeadcount += 1;
  }

  return Array.from(byOffice.values()).sort((a, b) => {
    const aw = officeSortWeight(a.officeId);
    const bw = officeSortWeight(b.officeId);
    if (aw !== bw) return aw - bw;
    return String(a.officeId).localeCompare(String(b.officeId));
  });
}
