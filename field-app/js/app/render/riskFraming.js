// @ts-check
import { buildOutcomeRiskFramingView } from "../../core/outcomeView.js";

export function renderRiskFramingPanel({ els, state, setTextPair, fmtSigned, clamp, mcStaleness = null }){
  const hasBand = !!(els?.riskBandTag || els?.riskBandTagSidebar);
  const hasWin = !!(els?.riskWinProb || els?.riskWinProbSidebar);
  const hasMargin = !!(els?.riskMarginBand || els?.riskMarginBandSidebar);
  const hasVol = !!(els?.riskVolatility || els?.riskVolatilitySidebar);
  const hasBanner = !!(els?.riskPlainBanner || els?.riskPlainBannerSidebar);
  if (!hasBand || !hasWin || !hasMargin || !hasVol || !hasBanner) return;

  const setTag = (label, cls) => {
    setTextPair(els.riskBandTag, els.riskBandTagSidebar, label || "—");
    if (els.riskBandTag){
      els.riskBandTag.classList.remove("ok", "warn", "bad");
      if (cls) els.riskBandTag.classList.add(cls);
    }
    if (els.riskBandTagSidebar){
      els.riskBandTagSidebar.classList.remove("ok", "warn", "bad");
      if (cls) els.riskBandTagSidebar.classList.add(cls);
    }
  };

  const setBanner = (text, cls) => {
    if (els.riskPlainBanner){
      els.riskPlainBanner.className = `banner ${cls || ""}`.trim();
      els.riskPlainBanner.textContent = text || "—";
    }
    if (els.riskPlainBannerSidebar){
      els.riskPlainBannerSidebar.className = `banner ${cls || ""}`.trim();
      els.riskPlainBannerSidebar.textContent = text || "—";
    }
  };

  const view = buildOutcomeRiskFramingView({
    mcResult: state?.mcLast || null,
    formatSigned: fmtSigned,
    clampFn: clamp,
    mcStaleness,
  });

  setTag(view.tagLabel, view.tagKind);
  setTextPair(els.riskWinProb, els.riskWinProbSidebar, view.winProbText);
  setTextPair(els.riskMarginBand, els.riskMarginBandSidebar, view.marginBandText);
  setTextPair(els.riskVolatility, els.riskVolatilitySidebar, view.volatilityText);
  setBanner(view.bannerText, view.bannerKind);
}
