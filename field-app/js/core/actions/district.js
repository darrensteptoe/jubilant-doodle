// @ts-check

import { FIELD_OWNERSHIP_REGISTRY } from "../state/schema.js";
import {
  createFallbackGuardContext,
  guardUnknownFieldOwnership,
} from "../state/fallbackGuards.js";
import { makeActionResult, mutateDomain, toFinite } from "./_core.js";

const districtActionGuard = createFallbackGuardContext({
  moduleName: "districtActions",
});

const DISTRICT_FORM_FIELDS = new Set([
  "electionDate",
  "weeksRemaining",
  "mode",
  "universeBasis",
  "universeSize",
  "sourceNote",
  "turnoutA",
  "turnoutB",
  "bandWidth",
]);

const DISTRICT_TEMPLATE_FIELDS = new Set([
  "raceType",
  "officeLevel",
  "electionType",
  "seatContext",
  "partisanshipMode",
  "salienceLevel",
  "appliedTemplateId",
  "appliedVersion",
  "benchmarkKey",
  "assumptionsProfile",
]);

const DISTRICT_UNIVERSE_FIELDS = new Set([
  "enabled",
  "demPct",
  "repPct",
  "npaPct",
  "otherPct",
  "retentionFactor",
]);

function normalizeDistrictFormValue(field, value) {
  if (field === "universeSize" || field === "turnoutA" || field === "turnoutB" || field === "bandWidth") {
    return toFinite(value, null);
  }
  return String(value == null ? "" : value).trim();
}

function normalizeTemplateValue(field, value) {
  if (field === "overriddenFields") {
    return Array.isArray(value) ? value.map((x) => String(x == null ? "" : x).trim()).filter(Boolean) : [];
  }
  return String(value == null ? "" : value).trim();
}

function normalizeUniverseValue(field, value) {
  if (field === "enabled") return !!value;
  return toFinite(value, null);
}

export function updateDistrictFormField(state, payload, options = {}) {
  const field = String(payload?.field || "").trim();
  if (!DISTRICT_FORM_FIELDS.has(field)) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_field" });
  }
  guardUnknownFieldOwnership(districtActionGuard, {
    field: `district.form.${field}`,
    ownershipRegistry: FIELD_OWNERSHIP_REGISTRY,
  });

  const result = mutateDomain(
    state,
    "district",
    (draft) => {
      const nextValue = normalizeDistrictFormValue(field, payload?.value);
      if (draft.form[field] === nextValue) return false;
      draft.form[field] = nextValue;
      return true;
    },
    { ...options, revisionReason: `district.form.${field}` },
  );
  return makeActionResult(result, { field });
}

export function updateDistrictTemplateField(state, payload, options = {}) {
  const field = String(payload?.field || "").trim();
  if (!DISTRICT_TEMPLATE_FIELDS.has(field) && field !== "overriddenFields") {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_field" });
  }
  if (field !== "overriddenFields") {
    guardUnknownFieldOwnership(districtActionGuard, {
      field: `district.templateProfile.${field}`,
      ownershipRegistry: FIELD_OWNERSHIP_REGISTRY,
    });
  }

  const result = mutateDomain(
    state,
    "district",
    (draft) => {
      const nextValue = normalizeTemplateValue(field, payload?.value);
      const currentValue = draft.templateProfile[field];
      const same = Array.isArray(currentValue) && Array.isArray(nextValue)
        ? JSON.stringify(currentValue) === JSON.stringify(nextValue)
        : currentValue === nextValue;
      if (same) return false;
      draft.templateProfile[field] = nextValue;
      return true;
    },
    { ...options, revisionReason: `district.templateProfile.${field}` },
  );
  return makeActionResult(result, { field });
}

export function applyDistrictTemplate(state, payload, options = {}) {
  const templatePatch = payload?.templatePatch && typeof payload.templatePatch === "object"
    ? payload.templatePatch
    : {};
  const formPatch = payload?.formPatch && typeof payload.formPatch === "object" ? payload.formPatch : {};
  const universePatch = payload?.universePatch && typeof payload.universePatch === "object" ? payload.universePatch : {};

  const result = mutateDomain(
    state,
    "district",
    (draft) => {
      let changed = false;

      Object.keys(templatePatch).forEach((field) => {
        if (!DISTRICT_TEMPLATE_FIELDS.has(field) && field !== "overriddenFields") return;
        const nextValue = normalizeTemplateValue(field, templatePatch[field]);
        const currentValue = draft.templateProfile[field];
        const same = Array.isArray(currentValue) && Array.isArray(nextValue)
          ? JSON.stringify(currentValue) === JSON.stringify(nextValue)
          : currentValue === nextValue;
        if (!same) {
          draft.templateProfile[field] = nextValue;
          changed = true;
        }
      });

      Object.keys(formPatch).forEach((field) => {
        if (!DISTRICT_FORM_FIELDS.has(field)) return;
        const nextValue = normalizeDistrictFormValue(field, formPatch[field]);
        if (draft.form[field] !== nextValue) {
          draft.form[field] = nextValue;
          changed = true;
        }
      });

      Object.keys(universePatch).forEach((field) => {
        if (!DISTRICT_UNIVERSE_FIELDS.has(field)) return;
        const nextValue = normalizeUniverseValue(field, universePatch[field]);
        if (draft.universeComposition[field] !== nextValue) {
          draft.universeComposition[field] = nextValue;
          changed = true;
        }
      });

      return changed;
    },
    { ...options, revisionReason: "district.applyTemplate" },
  );
  return makeActionResult(result);
}

export function updateDistrictUniverseField(state, payload, options = {}) {
  const field = String(payload?.field || "").trim();
  if (!DISTRICT_UNIVERSE_FIELDS.has(field)) {
    return makeActionResult({ state, changed: false, blocked: true, reason: "invalid_field" });
  }

  const result = mutateDomain(
    state,
    "district",
    (draft) => {
      const nextValue = normalizeUniverseValue(field, payload?.value);
      if (draft.universeComposition[field] === nextValue) return false;
      draft.universeComposition[field] = nextValue;
      return true;
    },
    { ...options, revisionReason: `district.universeComposition.${field}` },
  );
  return makeActionResult(result, { field });
}
