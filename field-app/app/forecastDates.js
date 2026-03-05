export function targetFinishDateFromSnapCore(snap, weeks){
  const d = String(snap?.electionDate || "").trim();
  if (d){
    const dt = new Date(d + "T00:00:00");
    if (isFinite(dt)) return dt;
  }
  if (weeks != null && isFinite(weeks) && weeks > 0){
    const days = Math.ceil(weeks * 7);
    const dt = new Date();
    dt.setHours(12, 0, 0, 0);
    dt.setDate(dt.getDate() + days);
    return dt;
  }
  return null;
}

export function paceFinishDateCore(total, pacePerDay){
  if (total == null || !isFinite(total) || total <= 0) return null;
  if (pacePerDay == null || !isFinite(pacePerDay) || pacePerDay <= 0) return null;
  const daysNeeded = Math.ceil(total / pacePerDay);
  const dt = new Date();
  dt.setHours(12, 0, 0, 0);
  dt.setDate(dt.getDate() + daysNeeded);
  return dt;
}

