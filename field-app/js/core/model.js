// Capacity model helpers used by Phase 3.

function n(v){
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

// Returns total contacts capacity across remaining weeks.
// doorShare is fraction 0..1 (null => 0.5 default)
export function computeCapacityContacts(args){
  if (!args || typeof args !== "object") return null;
  const weeks = n(args.weeks);
  const orgCount = n(args.orgCount);
  const orgHrs = n(args.orgHoursPerWeek);
  const volMult = n(args.volunteerMult);
  const doorsPerHour = n(args.doorsPerHour);
  const callsPerHour = n(args.callsPerHour);

  if (weeks == null || weeks < 0) return null;
  if (orgCount == null || orgCount < 0) return null;
  if (orgHrs == null || orgHrs < 0) return null;
  if (volMult == null || volMult < 0) return null;
  if (doorsPerHour == null || doorsPerHour < 0) return null;
  if (callsPerHour == null || callsPerHour < 0) return null;

  const share = (args.doorShare == null) ? 0.5 : n(args.doorShare);
  if (share == null || share < 0 || share > 1) return null;

  const totalHours = weeks * orgCount * orgHrs * volMult;
  const doorsHours = totalHours * share;
  const callsHours = totalHours * (1 - share);

  const doors = doorsHours * doorsPerHour;
  const calls = callsHours * callsPerHour;

  const total = doors + calls;
  return Number.isFinite(total) ? total : null;
}

export function computeCapacityBreakdown(args){
  if (!args || typeof args !== "object") return null;
  const weeks = n(args.weeks);
  const orgCount = n(args.orgCount);
  const orgHrs = n(args.orgHoursPerWeek);
  const volMult = n(args.volunteerMult);
  const doorsPerHour = n(args.doorsPerHour);
  const callsPerHour = n(args.callsPerHour);

  if (weeks == null || weeks < 0) return null;
  if (orgCount == null || orgCount < 0) return null;
  if (orgHrs == null || orgHrs < 0) return null;
  if (volMult == null || volMult < 0) return null;
  if (doorsPerHour == null || doorsPerHour < 0) return null;
  if (callsPerHour == null || callsPerHour < 0) return null;

  const share = (args.doorShare == null) ? 0.5 : n(args.doorShare);
  if (share == null || share < 0 || share > 1) return null;

  const totalHours = weeks * orgCount * orgHrs * volMult;
  const doorsHours = totalHours * share;
  const callsHours = totalHours * (1 - share);

  const doors = doorsHours * doorsPerHour;
  const calls = callsHours * callsPerHour;
  const total = doors + calls;

  return {
    weeks,
    orgCount,
    orgHoursPerWeek: orgHrs,
    volunteerMult: volMult,
    doorShare: share,
    totalHours,
    doorsHours,
    callsHours,
    doors,
    calls,
    total,
  };
}
