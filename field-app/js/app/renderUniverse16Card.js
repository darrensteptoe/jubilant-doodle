export function renderUniverse16CardModule(ctx){
  const {
    els,
    state,
    getUniverseLayerConfig,
    getEffectiveBaseRates,
    universeDefaults,
  } = ctx || {};

  if (!els?.retentionFactor && !els?.universe16Enabled) return;
  const cfg = getUniverseLayerConfig();

  if (els.universe16Enabled) els.universe16Enabled.checked = !!state?.universeLayerEnabled;
  const setIf = (el, v) => {
    if (!el) return;
    if (document.activeElement === el) return;
    const next = (v == null || !isFinite(v)) ? "" : String(Number(v).toFixed(1));
    if (el.value !== next) el.value = next;
  };
  setIf(els.universe16DemPct, cfg.percents.demPct);
  setIf(els.universe16RepPct, cfg.percents.repPct);
  setIf(els.universe16NpaPct, cfg.percents.npaPct);
  setIf(els.universe16OtherPct, cfg.percents.otherPct);
  if (els.retentionFactor && document.activeElement !== els.retentionFactor){
    const next = String((cfg.retentionFactor ?? universeDefaults.retentionFactor).toFixed(2));
    if (els.retentionFactor.value !== next) els.retentionFactor.value = next;
  }

  const disabled = !cfg.enabled;
  for (const el of [els.universe16DemPct, els.universe16RepPct, els.universe16NpaPct, els.universe16OtherPct, els.retentionFactor]){
    if (el) el.disabled = disabled;
  }

  const eff = getEffectiveBaseRates();
  if (els.universe16Derived){
    if (!cfg.enabled){
      els.universe16Derived.textContent = "Disabled (baseline behavior).";
    } else {
      const pm = eff?.meta?.persuasionMultiplier;
      const tm = eff?.meta?.turnoutMultiplier;
      const tb = eff?.meta?.turnoutBoostApplied;
      const parts = [];
      parts.push(`Persuasion multiplier: ${(pm != null && isFinite(pm)) ? pm.toFixed(2) : "—"}`);
      parts.push(`Turnout multiplier: ${(tm != null && isFinite(tm)) ? tm.toFixed(2) : "—"}`);
      parts.push(`Turnout boost: ${(tb != null && isFinite(tb)) ? (100 * tb).toFixed(1) + "%" : "—"}`);
      parts.push(`Effective support rate: ${(eff.sr != null && isFinite(eff.sr)) ? (100 * eff.sr).toFixed(1) + "%" : "—"}`);
      parts.push(`Effective turnout reliability: ${(eff.tr != null && isFinite(eff.tr)) ? (100 * eff.tr).toFixed(1) + "%" : "—"}`);
      els.universe16Derived.textContent = parts.join(" · ");
    }
  }

  if (els.universe16Warn){
    if (cfg.enabled && cfg.wasNormalized && cfg.warning){
      els.universe16Warn.hidden = false;
      els.universe16Warn.textContent = cfg.warning;
    } else {
      els.universe16Warn.hidden = true;
      els.universe16Warn.textContent = "";
    }
  }
}
