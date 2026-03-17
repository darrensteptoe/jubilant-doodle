// @ts-check
// Canonical workforce role modeling + staffing rollups.

export const WORKFORCE_ROLE_TYPES = [
  "field_organizer",
  "canvasser",
  "volunteer",
  "volunteer_lead",
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

function num(value, fallback = null){
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, lo, hi){
  if (!Number.isFinite(value)) return lo;
  return Math.max(lo, Math.min(hi, value));
}

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

export function normalizePersonWorkforceFields(person, defaults = {}){
  const src = (person && typeof person === "object") ? person : {};
  const roleType = normalizeRoleType(src.roleType || src.role || defaults.roleType || "canvasser");
  const compensationType = normalizeCompensationType(src.compensationType || defaults.compensationType, roleType);
  const payRate = num(src.payRate, null);
  const expectedHoursPerWeek = num(src.expectedHoursPerWeek, null);
  return {
    ...src,
    roleType,
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

function shiftHours(rec){
  const start = parseTs(rec?.checkInAt || rec?.startAt);
  const end = parseTs(rec?.checkOutAt || rec?.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return (end - start) / 3600000;
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

function activePaidCanvassers(rows){
  return rows.filter((p) => p.roleType === "canvasser" && !!p.active && isPaidComp(p.compensationType)).length;
}

function activeVolunteers(rows){
  return rows.filter((p) => !!p.active && (isVolunteerRole(p.roleType) || p.compensationType === "volunteer")).length;
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

  const organizerCount = activeByRole(personRows, "field_organizer");
  const paidCanvasserCount = activePaidCanvassers(personRows);
  const activeVolunteerCount = activeVolunteers(personRows);
  const activePaidHeadcount = personRows.filter((p) => !!p.active && p.compensationType === "paid").length;
  const activeStipendHeadcount = personRows.filter((p) => !!p.active && p.compensationType === "stipend").length;
  const activeVolunteerHeadcount = personRows.filter((p) => !!p.active && p.compensationType === "volunteer").length;
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
    const hours = shiftHours(rec);

    if (person.roleType === "canvasser" && isPaidComp(person.compensationType)){
      paidAttempts += attempts;
      paidHours += hours;
      continue;
    }
    if (isVolunteerRole(person.roleType) || person.compensationType === "volunteer"){
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

  return {
    organizerCount,
    paidCanvasserCount,
    activeVolunteerCount,
    activePaidHeadcount,
    activeStipendHeadcount,
    activeVolunteerHeadcount,
    volunteerShowRate,
    organizerRecruitmentMultiplier,
    organizerSupervisionCapacity,
    paidCanvasserProductivity,
    volunteerProductivity,
    paidAttemptsPerHour,
    volunteerAttemptsPerHour,
    overallAttemptsPerHour,
    lookbackDays: Math.max(1, Math.round(num(lookbackDays, 14) || 14)),
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
    if (person.roleType === "field_organizer") row.organizerCount += 1;
    if (person.roleType === "canvasser" && isPaidComp(person.compensationType)) row.paidCanvasserCount += 1;
    if (isVolunteerRole(person.roleType) || person.compensationType === "volunteer") row.activeVolunteerCount += 1;
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
