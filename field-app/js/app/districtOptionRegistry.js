// @ts-check
import { TEMPLATE_REGISTRY } from "./templateRegistry.js";
import { normalizeLegacyRaceType } from "./templateResolver.js";

const DEFAULT_RACE_ORDER = Object.freeze(["federal", "state_leg", "municipal", "county"]);

const DISTRICT_MODE_OPTIONS = Object.freeze([
  { value: "persuasion", label: "Persuasion-first (default)" },
  { value: "late_start", label: "Late-start / turnout-heavy" },
]);

const DISTRICT_UNIVERSE_BASIS_OPTIONS = Object.freeze([
  { value: "registered", label: "Registered (default)" },
  { value: "active", label: "Active (advanced)" },
]);

const DISTRICT_UNDECIDED_MODE_OPTIONS = Object.freeze([
  { value: "proportional", label: "Proportional" },
  { value: "user_defined", label: "User-defined split" },
  { value: "against", label: "Conservative against you" },
  { value: "toward", label: "Conservative toward you" },
]);

function titleCase(value) {
  return String(value || "")
    .trim()
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export function listDistrictRaceTypeOptions() {
  const byRaceType = new Map();
  for (const record of Object.values(TEMPLATE_REGISTRY)) {
    const raceType = normalizeLegacyRaceType(record?.legacyRaceType || "");
    if (!raceType || byRaceType.has(raceType)) {
      continue;
    }
    const label = String(record?.legacyLabel || "").trim() || titleCase(raceType);
    byRaceType.set(raceType, label);
  }

  const ordered = [];
  const seen = new Set();
  for (const raceType of DEFAULT_RACE_ORDER) {
    if (!byRaceType.has(raceType) || seen.has(raceType)) {
      continue;
    }
    ordered.push({
      value: raceType,
      label: byRaceType.get(raceType),
    });
    seen.add(raceType);
  }
  for (const [value, label] of byRaceType.entries()) {
    if (seen.has(value)) {
      continue;
    }
    ordered.push({ value, label });
    seen.add(value);
  }
  return ordered;
}

export function listDistrictModeOptions() {
  return DISTRICT_MODE_OPTIONS.map((row) => ({ ...row }));
}

export function listDistrictUniverseBasisOptions() {
  return DISTRICT_UNIVERSE_BASIS_OPTIONS.map((row) => ({ ...row }));
}

export function listDistrictUndecidedModeOptions() {
  return DISTRICT_UNDECIDED_MODE_OPTIONS.map((row) => ({ ...row }));
}
