// @ts-check
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
  const p3WeeksEl = els?.p3Weeks;
  const p3CapContactsEl = els?.p3CapContacts;
  const p3GapContactsEl = els?.p3GapContacts;
  const p3GapNoteEl = els?.p3GapNote;

  const w = (weeks != null && weeks >= 0) ? weeks : null;
  if (p3WeeksEl) p3WeeksEl.textContent = w == null ? "—" : fmtInt(w);

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

  if (p3CapContactsEl) p3CapContactsEl.textContent = (capContacts == null) ? "—" : fmtInt(Math.floor(capContacts));

  const needVotes = deriveNeedVotes(res);

  let reqContacts = null;
  if (needVotes > 0 && cr && cr > 0 && pr && pr > 0 && rr && rr > 0){
    const reqSupports = needVotes / rr;
    const reqConvos = reqSupports / pr;
    reqContacts = reqConvos / cr;
  }

  if (capContacts == null || reqContacts == null){
    if (p3GapContactsEl) p3GapContactsEl.textContent = "—";
    if (p3GapNoteEl) p3GapNoteEl.textContent = "Enter Phase 2 rates + Phase 3 capacity to compute.";
  } else {
    const gap = capContacts - reqContacts;
    const sign = gap >= 0 ? "+" : "−";
    if (p3GapContactsEl) p3GapContactsEl.textContent = `${sign}${fmtInt(Math.ceil(Math.abs(gap)))}`;
    if (gap >= 0){
      if (p3GapNoteEl) p3GapNoteEl.textContent = "Capacity ≥ requirement (base rates).";
    } else {
      if (p3GapNoteEl) p3GapNoteEl.textContent = "Shortfall vs requirement (base rates).";
    }
  }

  renderMcFreshness(res, w);

  if (state.mcLast){
    renderMcResults(state.mcLast);
  }
}
