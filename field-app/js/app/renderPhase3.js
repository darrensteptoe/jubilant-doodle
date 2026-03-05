export function renderPhase3Module(args){
  const {
    els,
    state,
    res,
    weeks,
    fmtInt,
    compileEffectiveInputs,
    computeCapacityContacts,
    deriveNeedVotes,
    renderMcFreshness,
    renderMcResults,
  } = args || {};

  if (!els?.p3CapContacts) return;

  const w = (weeks != null && weeks >= 0) ? weeks : null;
  els.p3Weeks.textContent = w == null ? "—" : fmtInt(w);

  const effective = compileEffectiveInputs(state);
  const cr = effective.rates.cr;
  const pr = effective.rates.sr;
  const rr = effective.rates.tr;

  const orgCount = effective.capacity.orgCount;
  const orgHrs = effective.capacity.orgHoursPerWeek;
  const volMult = effective.capacity.volunteerMult;
  const doorShare = effective.capacity.doorShare;
  const dph = effective.capacity.doorsPerHour;
  const cph = effective.capacity.callsPerHour;
  const capacityDecay = effective.capacity.capacityDecay;

  const capContacts = computeCapacityContacts({
    weeks: w,
    orgCount,
    orgHoursPerWeek: orgHrs,
    volunteerMult: volMult,
    doorShare,
    doorsPerHour: dph,
    callsPerHour: cph,
    capacityDecay,
  });

  els.p3CapContacts.textContent = (capContacts == null) ? "—" : fmtInt(Math.floor(capContacts));

  const needVotes = deriveNeedVotes(res);

  let reqContacts = null;
  if (needVotes > 0 && cr && cr > 0 && pr && pr > 0 && rr && rr > 0){
    const reqSupports = needVotes / rr;
    const reqConvos = reqSupports / pr;
    reqContacts = reqConvos / cr;
  }

  if (capContacts == null || reqContacts == null){
    els.p3GapContacts.textContent = "—";
    els.p3GapNote.textContent = "Enter Phase 2 rates + Phase 3 capacity to compute.";
  } else {
    const gap = capContacts - reqContacts;
    const sign = gap >= 0 ? "+" : "−";
    els.p3GapContacts.textContent = `${sign}${fmtInt(Math.ceil(Math.abs(gap)))}`;
    if (gap >= 0){
      els.p3GapNote.textContent = "Capacity ≥ requirement (base rates).";
    } else {
      els.p3GapNote.textContent = "Shortfall vs requirement (base rates).";
    }
  }

  renderMcFreshness(res, w);

  if (state.mcLast){
    renderMcResults(state.mcLast);
  }
}
