// @ts-check
import { formatPercentFromUnit } from "../core/utils.js";
import {
  buildDistrictStructureDerivedText,
  buildDistrictStructureInputView,
  formatDistrictMultiplier,
} from "../core/districtView.js";

/** @param {import("./types").RenderUniverse16CardCtx} ctx */
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
  const structureInputView = buildDistrictStructureInputView(cfg, {
    defaultRetentionFactor: universeDefaults?.retentionFactor,
  });

  if (els.universe16Enabled) els.universe16Enabled.checked = !!state?.universeLayerEnabled;
  const setIf = (el, v) => {
    if (!el) return;
    if (document.activeElement === el) return;
    const next = String(v == null ? "" : v);
    if (el.value !== next) el.value = next;
  };
  setIf(els.universe16DemPct, structureInputView.demPctInput);
  setIf(els.universe16RepPct, structureInputView.repPctInput);
  setIf(els.universe16NpaPct, structureInputView.npaPctInput);
  setIf(els.universe16OtherPct, structureInputView.otherPctInput);
  if (els.retentionFactor && document.activeElement !== els.retentionFactor){
    const next = structureInputView.retentionFactorInput;
    if (els.retentionFactor.value !== next) els.retentionFactor.value = next;
  }

  const disabled = !structureInputView.enabled;
  for (const el of [els.universe16DemPct, els.universe16RepPct, els.universe16NpaPct, els.universe16OtherPct, els.retentionFactor]){
    if (el) el.disabled = disabled;
  }

  const eff = getEffectiveBaseRates();
  if (els.universe16Derived){
    els.universe16Derived.textContent = buildDistrictStructureDerivedText({
      enabled: cfg.enabled,
      adjusted: {
        meta: eff?.meta || {},
        srAdj: eff?.sr,
        trAdj: eff?.tr,
      },
      formatMultiplier: (value) => formatDistrictMultiplier(value, 2, "—"),
      formatPercentFromRate: (value) => formatPercentFromUnit(value, 1),
    });
  }

  if (els.universe16Warn){
    if (structureInputView.warningVisible){
      els.universe16Warn.hidden = false;
      els.universe16Warn.textContent = structureInputView.warningText;
    } else {
      els.universe16Warn.hidden = true;
      els.universe16Warn.textContent = "";
    }
  }
}
