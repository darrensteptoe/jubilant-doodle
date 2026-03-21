// @ts-check

import { asArray, clone, makeActionResult, mutateDomain, toBool, toFinite } from "./_core.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

const CONFIG_FIELDS = new Set([
  "officeZip",
  "overrideZip",
  "useOverrideZip",
  "selectedZip",
  "fieldExecutionRisk",
  "electionDayTurnoutRisk",
  "recommendedAction",
  "precipSignal",
]);

export function updateWeatherRiskConfig(state, payload, options = {}) {
  const field = cleanText(payload?.field);
  if (!CONFIG_FIELDS.has(field)) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_field" });
  }

  const result = mutateDomain(
    state,
    "weatherRisk",
    (draft) => {
      const nextValue = field === "useOverrideZip"
        ? toBool(payload?.value)
        : field === "precipSignal"
          ? toFinite(payload?.value, 0) || 0
          : cleanText(payload?.value);
      if (draft[field] === nextValue) return false;
      draft[field] = nextValue;
      return true;
    },
    { ...options, revisionReason: `weatherRisk.${field}` },
  );
  return makeActionResult(result, { field });
}

export function applyWeatherRiskSnapshot(state, payload, options = {}) {
  const snapshot = payload?.snapshot && typeof payload.snapshot === "object" ? payload.snapshot : {};

  const result = mutateDomain(
    state,
    "weatherRisk",
    (draft) => {
      draft.status = cleanText(snapshot.status) || draft.status;
      draft.error = cleanText(snapshot.error);
      draft.fetchedAt = cleanText(snapshot.fetchedAt) || new Date().toISOString();
      draft.current = clone(snapshot.current || null);
      draft.forecast3d = asArray(snapshot.forecast3d).map((row) => clone(row));
      draft.fieldExecutionRisk = cleanText(snapshot.fieldExecutionRisk) || draft.fieldExecutionRisk;
      draft.electionDayTurnoutRisk = cleanText(snapshot.electionDayTurnoutRisk) || draft.electionDayTurnoutRisk;
      draft.recommendedAction = cleanText(snapshot.recommendedAction) || draft.recommendedAction;
      draft.precipSignal = toFinite(snapshot.precipSignal, draft.precipSignal) || 0;
      return true;
    },
    { ...options, revisionReason: "weatherRisk.applySnapshot" },
  );
  return makeActionResult(result);
}

export function updateWeatherRiskAdjustment(state, payload, options = {}) {
  const patch = payload?.patch && typeof payload.patch === "object" ? payload.patch : {};
  const modifiers = patch?.modifiers && typeof patch.modifiers === "object" ? patch.modifiers : {};

  const result = mutateDomain(
    state,
    "weatherRisk",
    (draft) => {
      draft.adjustment = {
        ...draft.adjustment,
        ...clone(patch),
        enabled: toBool(patch.enabled ?? draft.adjustment.enabled),
        mode: cleanText(patch.mode || draft.adjustment.mode),
        date: cleanText(patch.date || draft.adjustment.date),
        zip: cleanText(patch.zip || draft.adjustment.zip),
        modifiers: {
          ...draft.adjustment.modifiers,
          ...clone(modifiers),
          doorEfficiencyMultiplier: toFinite(
            modifiers.doorEfficiencyMultiplier,
            draft.adjustment.modifiers.doorEfficiencyMultiplier,
          ) || 1,
          volunteerShowRateMultiplier: toFinite(
            modifiers.volunteerShowRateMultiplier,
            draft.adjustment.modifiers.volunteerShowRateMultiplier,
          ) || 1,
          electionDayTurnoutRiskBump: toFinite(
            modifiers.electionDayTurnoutRiskBump,
            draft.adjustment.modifiers.electionDayTurnoutRiskBump,
          ) || 0,
        },
        appliedAt: cleanText(patch.appliedAt || draft.adjustment.appliedAt),
        log: asArray(patch.log ?? draft.adjustment.log).map((row) => clone(row)),
      };
      return true;
    },
    { ...options, revisionReason: "weatherRisk.adjustment.update" },
  );
  return makeActionResult(result);
}

