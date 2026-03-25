// @ts-check

export const TEMPLATE_REGISTRY_VERSION = "2026.03.25";
export const DEFAULT_TEMPLATE_ID = "state_house";

export const TEMPLATE_DIMENSION_KEYS = Object.freeze([
  "officeLevel",
  "electionType",
  "seatContext",
  "partisanshipMode",
  "salienceLevel",
]);

export const TEMPLATE_DEFAULT_FIELD_KEYS = Object.freeze([
  "bandWidth",
  "persuasionPct",
  "earlyVoteExp",
  "supportRatePct",
  "contactRatePct",
  "turnoutReliabilityPct",
  "gotvMaxLiftPP",
  "channelDoorPct",
  "doorsPerHour3",
  "callsPerHour3",
  "timelineGotvWeeks",
  "timelineRampMode",
]);

export const OFFICE_LEVEL_LABELS = Object.freeze({
  municipal_executive: "City / Municipal Executive",
  municipal_legislative: "City / Municipal Legislative",
  countywide: "Countywide",
  state_legislative_lower: "State House",
  state_legislative_upper: "State Senate",
  congressional_district: "U.S. House / Congressional",
  statewide_executive: "Governor / Statewide Executive",
  statewide_federal: "U.S. Senate / Statewide Federal",
  judicial_other: "Judicial / Other",
  custom_context: "Custom",
});

export const TEMPLATE_DIMENSION_LABELS = Object.freeze({
  officeLevel: Object.freeze({
    municipal_executive: "Municipal executive",
    municipal_legislative: "Municipal legislative",
    countywide: "Countywide",
    state_legislative_lower: "State house",
    state_legislative_upper: "State senate",
    congressional_district: "U.S. House / Congressional",
    statewide_executive: "Governor / Statewide Executive",
    statewide_federal: "U.S. Senate / Statewide Federal",
    judicial_other: "Judicial / Other",
    custom_context: "Custom",
  }),
  electionType: Object.freeze({
    general: "General",
    primary: "Primary",
    special: "Special",
  }),
  seatContext: Object.freeze({
    executive: "Executive",
    legislative: "Legislative",
    countywide: "Countywide",
    statewide: "Statewide",
    open: "Open",
    incumbent: "Incumbent",
    challenger: "Challenger",
    judicial: "Judicial",
    custom: "Custom",
  }),
  partisanshipMode: Object.freeze({
    partisan: "Partisan",
    nonpartisan: "Nonpartisan",
    mixed: "Mixed",
  }),
  salienceLevel: Object.freeze({
    low: "Low",
    medium: "Medium",
    high: "High",
  }),
});

function freezeTemplateRecord(record){
  return Object.freeze({
    ...record,
    dimensions: Object.freeze({ ...(record?.dimensions || {}) }),
    defaults: Object.freeze({ ...(record?.defaults || {}) }),
    notes: Object.freeze(Array.isArray(record?.notes) ? record.notes.slice() : []),
  });
}

function withSharedDefaults(overrides = {}){
  return {
    supportRatePct: 55,
    contactRatePct: 22,
    turnoutReliabilityPct: 80,
    gotvMaxLiftPP: 10,
    channelDoorPct: 68,
    doorsPerHour3: 30,
    callsPerHour3: 20,
    timelineGotvWeeks: 2,
    timelineRampMode: "linear",
    ...overrides,
  };
}

export const TEMPLATE_REGISTRY = Object.freeze({
  municipal_executive: freezeTemplateRecord({
    id: "municipal_executive",
    version: TEMPLATE_REGISTRY_VERSION,
    legacyRaceType: "municipal",
    legacyLabel: OFFICE_LEVEL_LABELS.municipal_executive,
    label: OFFICE_LEVEL_LABELS.municipal_executive,
    benchmarkKey: "municipal_nonpartisan",
    dimensions: {
      officeLevel: "municipal_executive",
      electionType: "general",
      seatContext: "executive",
      partisanshipMode: "nonpartisan",
      salienceLevel: "medium",
    },
    defaults: withSharedDefaults({
      bandWidth: 4,
      persuasionPct: 12,
      earlyVoteExp: 25,
      contactRatePct: 21,
      channelDoorPct: 72,
      doorsPerHour3: 31,
      callsPerHour3: 18,
    }),
    notes: ["City executive baseline with moderate uncertainty and coalition variance."],
  }),
  municipal_legislative: freezeTemplateRecord({
    id: "municipal_legislative",
    version: TEMPLATE_REGISTRY_VERSION,
    legacyRaceType: "municipal",
    legacyLabel: OFFICE_LEVEL_LABELS.municipal_legislative,
    label: OFFICE_LEVEL_LABELS.municipal_legislative,
    benchmarkKey: "municipal_nonpartisan",
    dimensions: {
      officeLevel: "municipal_legislative",
      electionType: "general",
      seatContext: "legislative",
      partisanshipMode: "nonpartisan",
      salienceLevel: "medium",
    },
    defaults: withSharedDefaults({
      bandWidth: 4,
      persuasionPct: 10,
      earlyVoteExp: 25,
      contactRatePct: 22,
      channelDoorPct: 74,
      doorsPerHour3: 31,
      callsPerHour3: 19,
    }),
    notes: ["Municipal legislative baseline tuned for field-legible local contests."],
  }),
  countywide: freezeTemplateRecord({
    id: "countywide",
    version: TEMPLATE_REGISTRY_VERSION,
    legacyRaceType: "county",
    legacyLabel: OFFICE_LEVEL_LABELS.countywide,
    label: OFFICE_LEVEL_LABELS.countywide,
    benchmarkKey: "county_general",
    dimensions: {
      officeLevel: "countywide",
      electionType: "general",
      seatContext: "countywide",
      partisanshipMode: "partisan",
      salienceLevel: "medium",
    },
    defaults: withSharedDefaults({
      bandWidth: 5,
      persuasionPct: 12,
      earlyVoteExp: 35,
      supportRatePct: 56,
      contactRatePct: 23,
      turnoutReliabilityPct: 81,
      gotvMaxLiftPP: 9,
      channelDoorPct: 68,
      doorsPerHour3: 30,
      callsPerHour3: 21,
    }),
    notes: ["Countywide baseline with moderate geography variance and turnout asymmetry."],
  }),
  state_house: freezeTemplateRecord({
    id: "state_house",
    version: TEMPLATE_REGISTRY_VERSION,
    legacyRaceType: "state_leg",
    legacyLabel: OFFICE_LEVEL_LABELS.state_legislative_lower,
    label: OFFICE_LEVEL_LABELS.state_legislative_lower,
    benchmarkKey: "state_house_general",
    dimensions: {
      officeLevel: "state_legislative_lower",
      electionType: "general",
      seatContext: "open",
      partisanshipMode: "partisan",
      salienceLevel: "medium",
    },
    defaults: withSharedDefaults({
      bandWidth: 5,
      persuasionPct: 11,
      earlyVoteExp: 35,
      supportRatePct: 55,
      contactRatePct: 22,
      turnoutReliabilityPct: 80,
      gotvMaxLiftPP: 10,
      channelDoorPct: 70,
      doorsPerHour3: 30,
      callsPerHour3: 20,
    }),
    notes: ["Lower-chamber legislative baseline for field-legible district environments."],
  }),
  state_senate: freezeTemplateRecord({
    id: "state_senate",
    version: TEMPLATE_REGISTRY_VERSION,
    legacyRaceType: "state_leg",
    legacyLabel: OFFICE_LEVEL_LABELS.state_legislative_upper,
    label: OFFICE_LEVEL_LABELS.state_legislative_upper,
    benchmarkKey: "state_house_general",
    dimensions: {
      officeLevel: "state_legislative_upper",
      electionType: "general",
      seatContext: "open",
      partisanshipMode: "partisan",
      salienceLevel: "medium",
    },
    defaults: withSharedDefaults({
      bandWidth: 6,
      persuasionPct: 12,
      earlyVoteExp: 40,
      supportRatePct: 55,
      contactRatePct: 22,
      turnoutReliabilityPct: 79,
      gotvMaxLiftPP: 10,
      channelDoorPct: 68,
      doorsPerHour3: 29,
      callsPerHour3: 21,
    }),
    notes: ["Upper-chamber legislative baseline with broader district uncertainty."],
  }),
  congressional_district: freezeTemplateRecord({
    id: "congressional_district",
    version: TEMPLATE_REGISTRY_VERSION,
    legacyRaceType: "federal",
    legacyLabel: OFFICE_LEVEL_LABELS.congressional_district,
    label: OFFICE_LEVEL_LABELS.congressional_district,
    benchmarkKey: "federal_general",
    dimensions: {
      officeLevel: "congressional_district",
      electionType: "general",
      seatContext: "open",
      partisanshipMode: "partisan",
      salienceLevel: "high",
    },
    defaults: withSharedDefaults({
      bandWidth: 6,
      persuasionPct: 13,
      earlyVoteExp: 45,
      supportRatePct: 54,
      contactRatePct: 24,
      turnoutReliabilityPct: 82,
      gotvMaxLiftPP: 8,
      channelDoorPct: 62,
      doorsPerHour3: 28,
      callsPerHour3: 24,
    }),
    notes: ["Congressional baseline with nationalized pressure and district-level legibility."],
  }),
  statewide_executive: freezeTemplateRecord({
    id: "statewide_executive",
    version: TEMPLATE_REGISTRY_VERSION,
    legacyRaceType: "federal",
    legacyLabel: OFFICE_LEVEL_LABELS.statewide_executive,
    label: OFFICE_LEVEL_LABELS.statewide_executive,
    benchmarkKey: "federal_general",
    dimensions: {
      officeLevel: "statewide_executive",
      electionType: "general",
      seatContext: "executive",
      partisanshipMode: "partisan",
      salienceLevel: "high",
    },
    defaults: withSharedDefaults({
      bandWidth: 8,
      persuasionPct: 15,
      earlyVoteExp: 45,
      supportRatePct: 54,
      contactRatePct: 23,
      turnoutReliabilityPct: 78,
      gotvMaxLiftPP: 8,
      channelDoorPct: 60,
      doorsPerHour3: 27,
      callsPerHour3: 24,
    }),
    notes: ["Statewide executive baseline with wider volatility and regional variance."],
  }),
  statewide_federal: freezeTemplateRecord({
    id: "statewide_federal",
    version: TEMPLATE_REGISTRY_VERSION,
    legacyRaceType: "federal",
    legacyLabel: OFFICE_LEVEL_LABELS.statewide_federal,
    label: OFFICE_LEVEL_LABELS.statewide_federal,
    benchmarkKey: "federal_general",
    dimensions: {
      officeLevel: "statewide_federal",
      electionType: "general",
      seatContext: "statewide",
      partisanshipMode: "partisan",
      salienceLevel: "high",
    },
    defaults: withSharedDefaults({
      bandWidth: 8,
      persuasionPct: 15,
      earlyVoteExp: 50,
      supportRatePct: 54,
      contactRatePct: 23,
      turnoutReliabilityPct: 78,
      gotvMaxLiftPP: 8,
      channelDoorPct: 58,
      doorsPerHour3: 27,
      callsPerHour3: 24,
    }),
    notes: ["Statewide federal baseline with elevated narrative and spending volatility."],
  }),
  judicial_other: freezeTemplateRecord({
    id: "judicial_other",
    version: TEMPLATE_REGISTRY_VERSION,
    legacyRaceType: "county",
    legacyLabel: OFFICE_LEVEL_LABELS.judicial_other,
    label: OFFICE_LEVEL_LABELS.judicial_other,
    benchmarkKey: "county_general",
    dimensions: {
      officeLevel: "judicial_other",
      electionType: "general",
      seatContext: "judicial",
      partisanshipMode: "nonpartisan",
      salienceLevel: "medium",
    },
    defaults: withSharedDefaults({
      bandWidth: 7,
      persuasionPct: 9,
      earlyVoteExp: 35,
      supportRatePct: 55,
      contactRatePct: 21,
      turnoutReliabilityPct: 79,
      gotvMaxLiftPP: 9,
      channelDoorPct: 66,
      doorsPerHour3: 29,
      callsPerHour3: 20,
    }),
    notes: ["Judicial and non-standard race baseline with cautious uncertainty posture."],
  }),
  custom_context: freezeTemplateRecord({
    id: "custom_context",
    version: TEMPLATE_REGISTRY_VERSION,
    legacyRaceType: "state_leg",
    legacyLabel: OFFICE_LEVEL_LABELS.custom_context,
    label: OFFICE_LEVEL_LABELS.custom_context,
    benchmarkKey: "default",
    dimensions: {
      officeLevel: "custom_context",
      electionType: "general",
      seatContext: "custom",
      partisanshipMode: "mixed",
      salienceLevel: "medium",
    },
    defaults: {},
    notes: ["Custom context preserves user-entered values and requires operator judgment."],
  }),
});

export const LEGACY_RACE_TYPE_TO_TEMPLATE_ID = Object.freeze({
  federal: "congressional_district",
  state_leg: "state_house",
  municipal: "municipal_legislative",
  county: "countywide",
  default: DEFAULT_TEMPLATE_ID,
});

function toLabelCase(value){
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return "";
  return raw
    .split(/[_\s-]+/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

export function listTemplateDimensionOptions(dimensionKey){
  const key = String(dimensionKey == null ? "" : dimensionKey).trim();
  if (!TEMPLATE_DIMENSION_KEYS.includes(key)) return [];
  const options = new Map();
  for (const record of Object.values(TEMPLATE_REGISTRY)){
    const value = String(record?.dimensions?.[key] || "").trim();
    if (!value || options.has(value)) continue;
    const explicitLabel = TEMPLATE_DIMENSION_LABELS?.[key]?.[value];
    options.set(value, String(explicitLabel || toLabelCase(value)).trim() || toLabelCase(value));
  }
  return Array.from(options.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}
