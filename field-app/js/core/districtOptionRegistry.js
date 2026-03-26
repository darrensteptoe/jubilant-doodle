// @ts-check
import { TEMPLATE_REGISTRY } from "./templateRegistry.js";
import { templateIdForRaceType } from "./templateResolver.js";
import { formatOfficeContextLabel } from "../core/officeContextLabels.js";

const DEFAULT_TEMPLATE_ORDER = Object.freeze([
  "municipal_executive",
  "municipal_legislative",
  "countywide",
  "state_house",
  "state_senate",
  "congressional_district",
  "statewide_executive",
  "statewide_federal",
  "judicial_other",
  "custom_context",
]);

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

function cleanString(value){
  return String(value == null ? "" : value).trim();
}

function templateLabelById(templateId){
  const id = cleanString(templateId);
  const record = id ? TEMPLATE_REGISTRY[id] : null;
  if (!record) return "";
  return cleanString(record?.label) || cleanString(record?.legacyLabel) || id;
}

export function getDistrictRaceTypeLabel(raceTypeOrTemplateId){
  const token = cleanString(raceTypeOrTemplateId);
  if (!token) return "";
  const direct = templateLabelById(token);
  if (direct) return direct;
  const resolvedTemplateId = templateIdForRaceType(token);
  return templateLabelById(resolvedTemplateId)
    || formatOfficeContextLabel(token, { legacyIntent: resolvedTemplateId })
    || token;
}

export function listDistrictRaceTypeOptions() {
  const ordered = [];
  const seen = new Set();

  for (const templateId of DEFAULT_TEMPLATE_ORDER) {
    const label = templateLabelById(templateId);
    if (!label || seen.has(templateId)) {
      continue;
    }
    ordered.push({ value: templateId, label });
    seen.add(templateId);
  }

  for (const [templateId] of Object.entries(TEMPLATE_REGISTRY)) {
    if (seen.has(templateId)) {
      continue;
    }
    const label = templateLabelById(templateId);
    if (!label) {
      continue;
    }
    ordered.push({ value: templateId, label });
    seen.add(templateId);
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
