// @ts-check

function cleanText(value){
  return String(value == null ? "" : value).trim();
}

function toFinite(value, fallback = 0){
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max){
  return Math.min(max, Math.max(min, value));
}

function clone(value){
  try{
    if (typeof structuredClone === "function"){
      return structuredClone(value);
    }
  } catch {}
  try{
    return JSON.parse(JSON.stringify(value));
  } catch {
    if (Array.isArray(value)) return value.slice();
    if (value && typeof value === "object") return { ...value };
    return value;
  }
}

function toIsoDate(baseDate, offsetDays = 0){
  const dt = new Date(baseDate.getTime());
  dt.setUTCDate(dt.getUTCDate() + Number(offsetDays || 0));
  return dt.toISOString().slice(0, 10);
}

function toIsoDateTime(dateIso, hhmm){
  const date = cleanText(dateIso);
  const time = cleanText(hhmm);
  if (!date || !time) return "";
  return `${date}T${time}:00.000Z`;
}

const DEMO_SCENARIO_DEFS = Object.freeze([
  Object.freeze({
    id: "demo_past_2020_presidential",
    name: "Past Election Demo — 2020 Presidential",
    electionDate: "2020-11-03",
    electionType: "general",
    mode: "persuasion",
    supportDelta: 2.0,
    turnoutADelta: 3.0,
    turnoutBDelta: 2.0,
    contactDelta: 1.5,
  }),
  Object.freeze({
    id: "demo_past_2022_midterm",
    name: "Past Election Demo — 2022 Midterm",
    electionDate: "2022-11-08",
    electionType: "general",
    mode: "turnout",
    supportDelta: -1.0,
    turnoutADelta: -2.0,
    turnoutBDelta: -1.0,
    contactDelta: -1.0,
  }),
  Object.freeze({
    id: "demo_past_2024_presidential",
    name: "Past Election Demo — 2024 Presidential",
    electionDate: "2024-11-05",
    electionType: "general",
    mode: "persuasion",
    supportDelta: 0.8,
    turnoutADelta: 1.2,
    turnoutBDelta: 1.0,
    contactDelta: 0.8,
  }),
]);

function patchScenarioInputs(baseInputs, def){
  const next = clone(baseInputs || {}) || {};
  next.scenarioName = def.name;
  next.electionDate = def.electionDate;
  next.mode = def.mode;

  const supportBase = toFinite(baseInputs?.supportRatePct, 50);
  const turnoutABase = toFinite(baseInputs?.turnoutA, 42);
  const turnoutBBase = toFinite(baseInputs?.turnoutB, 48);
  const contactBase = toFinite(baseInputs?.contactRatePct, 24);

  next.supportRatePct = clamp(supportBase + def.supportDelta, 0, 100);
  next.turnoutA = clamp(turnoutABase + def.turnoutADelta, 0, 100);
  next.turnoutB = clamp(turnoutBBase + def.turnoutBDelta, 0, 100);
  next.contactRatePct = clamp(contactBase + def.contactDelta, 0, 100);
  next.demoScenarioTag = "past_election";

  if (next.templateMeta && typeof next.templateMeta === "object"){
    next.templateMeta = {
      ...next.templateMeta,
      electionType: def.electionType,
    };
  }

  return next;
}

export function buildPastElectionDemoScenarios({
  baselineInputs = {},
  baselineOutputs = {},
  nowIso = new Date().toISOString(),
} = {}){
  const baseDate = new Date(nowIso);
  const safeBaseDate = Number.isFinite(baseDate.getTime()) ? baseDate : new Date();
  const baseOutputsClone = clone(baselineOutputs || {}) || {};

  return DEMO_SCENARIO_DEFS.map((def, index) => ({
    id: def.id,
    name: def.name,
    inputs: patchScenarioInputs(baselineInputs, def),
    outputs: clone(baseOutputsClone || {}),
    createdAt: new Date(safeBaseDate.getTime() + (index * 60000)).toISOString(),
  }));
}

export function buildFakeTeamOperationsData({
  campaignId = "default",
  officeId = "",
  nowIso = new Date().toISOString(),
} = {}){
  const campaign = cleanText(campaignId) || "default";
  const office = cleanText(officeId);
  const officeLabel = office || "district_hq";
  const baseDate = new Date(nowIso);
  const safeBaseDate = Number.isFinite(baseDate.getTime()) ? baseDate : new Date();

  const day0 = toIsoDate(safeBaseDate, -6);
  const day1 = toIsoDate(safeBaseDate, -5);
  const day2 = toIsoDate(safeBaseDate, -4);
  const day3 = toIsoDate(safeBaseDate, -3);
  const day4 = toIsoDate(safeBaseDate, -2);

  const people = [
    { id: "demo_per_jordan_lee", name: "Jordan Lee", roleType: "field_organizer", compensationType: "paid", payRate: 31, expectedHoursPerWeek: 45, active: true, office: officeLabel, region: "north" },
    { id: "demo_per_riley_chen", name: "Riley Chen", roleType: "field_organizer", compensationType: "paid", payRate: 30, expectedHoursPerWeek: 45, active: true, office: officeLabel, region: "south" },
    { id: "demo_per_sam_patel", name: "Sam Patel", roleType: "canvasser", compensationType: "paid", payRate: 24, expectedHoursPerWeek: 32, active: true, supervisorId: "demo_per_jordan_lee", office: officeLabel, region: "north" },
    { id: "demo_per_maya_ortiz", name: "Maya Ortiz", roleType: "canvasser", compensationType: "paid", payRate: 23, expectedHoursPerWeek: 30, active: true, supervisorId: "demo_per_riley_chen", office: officeLabel, region: "south" },
    { id: "demo_per_taylor_brooks", name: "Taylor Brooks", roleType: "volunteer", compensationType: "volunteer", active: true, supervisorId: "demo_per_jordan_lee", office: officeLabel, region: "north" },
    { id: "demo_per_avery_kim", name: "Avery Kim", roleType: "volunteer_lead", compensationType: "volunteer", active: true, supervisorId: "demo_per_riley_chen", office: officeLabel, region: "south" },
  ].map((row) => ({ ...row, campaignId: campaign, officeId: office }));

  const pipelineRecords = [
    { id: "demo_pipe_001", personId: "demo_per_sam_patel", stage: "Active", recruiter: "Jordan Lee", office: officeLabel, stageDates: { Active: day4 } },
    { id: "demo_pipe_002", personId: "demo_per_maya_ortiz", stage: "Training Complete", recruiter: "Riley Chen", office: officeLabel, stageDates: { "Training Complete": day4 } },
    { id: "demo_pipe_003", personId: "demo_per_taylor_brooks", stage: "Interviewed", recruiter: "Jordan Lee", office: officeLabel, stageDates: { Interviewed: day3 } },
    { id: "demo_pipe_004", personId: "demo_per_avery_kim", stage: "Offer Accepted", recruiter: "Riley Chen", office: officeLabel, stageDates: { "Offer Accepted": day2 } },
  ].map((row) => ({ ...row, campaignId: campaign, officeId: office }));

  const interviews = [
    { id: "demo_iv_001", personId: "demo_per_taylor_brooks", interviewer: "Jordan Lee", score: 88, outcome: "advance", scheduledAt: toIsoDateTime(day3, "15:00"), notes: "Strong field communication." },
    { id: "demo_iv_002", personId: "demo_per_avery_kim", interviewer: "Riley Chen", score: 91, outcome: "advance", scheduledAt: toIsoDateTime(day2, "16:30"), notes: "Experienced volunteer lead." },
  ].map((row) => ({ ...row, campaignId: campaign, officeId: office }));

  const onboardingRecords = [
    { id: "demo_onb_001", personId: "demo_per_avery_kim", backgroundStatus: "passed", onboardingStatus: "complete", docsSubmittedAt: toIsoDateTime(day2, "17:30"), completedAt: toIsoDateTime(day1, "13:00"), notes: "Ready for deployment." },
    { id: "demo_onb_002", personId: "demo_per_taylor_brooks", backgroundStatus: "pending", onboardingStatus: "in_progress", docsSubmittedAt: toIsoDateTime(day1, "14:15"), notes: "Awaiting final check." },
  ].map((row) => ({ ...row, campaignId: campaign, officeId: office }));

  const trainingRecords = [
    { id: "demo_trn_001", personId: "demo_per_avery_kim", trainingTrack: "field_lead", sessions: 3, completionStatus: "complete", completedAt: toIsoDateTime(day1, "18:00"), notes: "Lead turf runner." },
    { id: "demo_trn_002", personId: "demo_per_taylor_brooks", trainingTrack: "canvass_basics", sessions: 2, completionStatus: "in_progress", notes: "Needs one more roleplay." },
  ].map((row) => ({ ...row, campaignId: campaign, officeId: office }));

  const shiftRecords = [
    { id: "demo_shift_001", personId: "demo_per_sam_patel", date: day1, mode: "door", turfId: "demo_turf_a", checkInAt: toIsoDateTime(day1, "15:00"), checkOutAt: toIsoDateTime(day1, "19:00"), attempts: 118, convos: 44, supportIds: 14, office: officeLabel },
    { id: "demo_shift_002", personId: "demo_per_maya_ortiz", date: day1, mode: "door", turfId: "demo_turf_b", checkInAt: toIsoDateTime(day1, "15:30"), checkOutAt: toIsoDateTime(day1, "19:30"), attempts: 109, convos: 39, supportIds: 12, office: officeLabel },
    { id: "demo_shift_003", personId: "demo_per_taylor_brooks", date: day2, mode: "phone", turfId: "demo_phone_bank", checkInAt: toIsoDateTime(day2, "16:00"), checkOutAt: toIsoDateTime(day2, "19:00"), attempts: 96, convos: 41, supportIds: 11, office: officeLabel },
    { id: "demo_shift_004", personId: "demo_per_avery_kim", date: day3, mode: "door", turfId: "demo_turf_c", checkInAt: toIsoDateTime(day3, "14:00"), checkOutAt: toIsoDateTime(day3, "18:30"), attempts: 127, convos: 51, supportIds: 18, office: officeLabel },
  ].map((row) => ({ ...row, campaignId: campaign, officeId: office }));

  const turfEvents = [
    { id: "demo_turf_evt_001", turfId: "demo_turf_a", shiftId: "demo_shift_001", assignedTo: "demo_per_sam_patel", precinct: "P-101", county: "Demo County", date: day1, mode: "door", attempts: 118, canvassed: 44, vbms: 5 },
    { id: "demo_turf_evt_002", turfId: "demo_turf_b", shiftId: "demo_shift_002", assignedTo: "demo_per_maya_ortiz", precinct: "P-102", county: "Demo County", date: day1, mode: "door", attempts: 109, canvassed: 39, vbms: 4 },
    { id: "demo_turf_evt_003", turfId: "demo_turf_c", shiftId: "demo_shift_004", assignedTo: "demo_per_avery_kim", precinct: "P-103", county: "Demo County", date: day3, mode: "door", attempts: 127, canvassed: 51, vbms: 8 },
    { id: "demo_turf_evt_004", turfId: "demo_turf_followup", assignedTo: "demo_per_taylor_brooks", precinct: "P-101", county: "Demo County", date: day0, mode: "phone", attempts: 64, canvassed: 27, vbms: 3 },
  ].map((row) => ({ ...row, campaignId: campaign, officeId: office }));

  return {
    persons: people,
    pipelineRecords,
    interviews,
    onboardingRecords,
    trainingRecords,
    shiftRecords,
    turfEvents,
    forecastConfigs: [],
    meta: [],
  };
}

export function buildScenarioDemoPackage({
  baselineInputs = {},
  baselineOutputs = {},
  campaignId = "default",
  officeId = "",
  nowIso = new Date().toISOString(),
} = {}){
  const scenarios = buildPastElectionDemoScenarios({
    baselineInputs,
    baselineOutputs,
    nowIso,
  });
  const operationsData = buildFakeTeamOperationsData({
    campaignId,
    officeId,
    nowIso,
  });

  return {
    scenarios,
    operationsData,
    summary: {
      scenarioCount: scenarios.length,
      teamHeadcount: operationsData.persons.length,
      shiftCount: operationsData.shiftRecords.length,
      turfEventCount: operationsData.turfEvents.length,
    },
  };
}
