// @ts-check

export const ASSUMPTION_BASELINES_VERSION = "1.0.0";

export const ASSUMPTION_BASELINES = Object.freeze({
  persuasionPct: Object.freeze({
    label: "Persuasion % of universe",
    typical: Object.freeze({ min: 15, max: 45 }),
    hard: Object.freeze({ min: 5, max: 65 }),
  }),
  contactRatePct: Object.freeze({
    label: "Contact rate %",
    typical: Object.freeze({ min: 12, max: 40 }),
    hard: Object.freeze({ min: 5, max: 55 }),
  }),
  supportRatePct: Object.freeze({
    label: "Support rate %",
    typical: Object.freeze({ min: 40, max: 70 }),
    hard: Object.freeze({ min: 25, max: 85 }),
  }),
  turnoutReliabilityPct: Object.freeze({
    label: "Turnout reliability %",
    typical: Object.freeze({ min: 60, max: 90 }),
    hard: Object.freeze({ min: 40, max: 98 }),
  }),
  gotvMaxLiftPP: Object.freeze({
    label: "GOTV max lift (pp)",
    typical: Object.freeze({ min: 2, max: 12 }),
    hard: Object.freeze({ min: 0, max: 20 }),
  }),
  doorsPerHour3: Object.freeze({
    label: "Doors per hour",
    typical: Object.freeze({ min: 18, max: 45 }),
    hard: Object.freeze({ min: 8, max: 65 }),
  }),
  callsPerHour3: Object.freeze({
    label: "Calls per hour",
    typical: Object.freeze({ min: 10, max: 35 }),
    hard: Object.freeze({ min: 4, max: 55 }),
  }),
});

function toFiniteNumber(value){
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clamp(value, lo, hi){
  const n = Number(value);
  if (!Number.isFinite(n)) return lo;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function scoreSeverity(flags){
  let penalty = 0;
  for (const flag of flags){
    if (flag.severity === "bad"){
      penalty += 28;
      continue;
    }
    if (flag.severity === "warn"){
      penalty += 10;
    }
  }
  return clamp(100 - penalty, 0, 100);
}

export function evaluateAssumptionRealism(state, baselines = ASSUMPTION_BASELINES){
  const src = state && typeof state === "object" ? state : {};
  const flags = [];
  let checked = 0;
  let outOfTypical = 0;
  let outOfHard = 0;

  for (const [field, baseline] of Object.entries(baselines || {})){
    const value = toFiniteNumber(src[field]);
    if (value == null) continue;
    checked += 1;

    const hardMin = Number(baseline?.hard?.min);
    const hardMax = Number(baseline?.hard?.max);
    const typMin = Number(baseline?.typical?.min);
    const typMax = Number(baseline?.typical?.max);
    if (!Number.isFinite(hardMin) || !Number.isFinite(hardMax)) continue;

    if (value < hardMin || value > hardMax){
      outOfHard += 1;
      flags.push({
        field,
        label: String(baseline?.label || field),
        severity: "bad",
        value,
        typicalMin: typMin,
        typicalMax: typMax,
        hardMin,
        hardMax,
      });
      continue;
    }

    if (Number.isFinite(typMin) && Number.isFinite(typMax) && (value < typMin || value > typMax)){
      outOfTypical += 1;
      flags.push({
        field,
        label: String(baseline?.label || field),
        severity: "warn",
        value,
        typicalMin: typMin,
        typicalMax: typMax,
        hardMin,
        hardMax,
      });
    }
  }

  const score = scoreSeverity(flags);
  const status = outOfHard > 0 ? "bad" : (outOfTypical > 0 ? "warn" : "ok");
  return {
    version: ASSUMPTION_BASELINES_VERSION,
    score,
    status,
    checked,
    outOfTypical,
    outOfHard,
    flags,
  };
}

