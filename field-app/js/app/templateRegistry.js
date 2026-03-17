// @ts-check

export const TEMPLATE_REGISTRY_VERSION = "2026.03.16";
export const DEFAULT_TEMPLATE_ID = "state_house_general_open";

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

function freezeTemplateRecord(record){
  return Object.freeze({
    ...record,
    dimensions: Object.freeze({ ...(record?.dimensions || {}) }),
    defaults: Object.freeze({ ...(record?.defaults || {}) }),
    notes: Object.freeze(Array.isArray(record?.notes) ? record.notes.slice() : []),
  });
}

export const TEMPLATE_REGISTRY = Object.freeze({
  federal_general_incumbent: freezeTemplateRecord({
    id: "federal_general_incumbent",
    version: TEMPLATE_REGISTRY_VERSION,
    legacyRaceType: "federal",
    legacyLabel: "Federal (US House)",
    label: "Federal General (Incumbent)",
    benchmarkKey: "federal_general",
    dimensions: {
      officeLevel: "federal",
      electionType: "general",
      seatContext: "incumbent",
      partisanshipMode: "partisan",
      salienceLevel: "high",
    },
    defaults: {
      bandWidth: 4,
      persuasionPct: 28,
      earlyVoteExp: 45,
      supportRatePct: 54,
      contactRatePct: 24,
      turnoutReliabilityPct: 82,
      gotvMaxLiftPP: 8,
      channelDoorPct: 62,
      doorsPerHour3: 28,
      callsPerHour3: 24,
      timelineGotvWeeks: 2,
      timelineRampMode: "linear",
    },
    notes: ["Higher early-vote share, tighter persuasion universe."],
  }),
  state_house_general_open: freezeTemplateRecord({
    id: "state_house_general_open",
    version: TEMPLATE_REGISTRY_VERSION,
    legacyRaceType: "state_leg",
    legacyLabel: "State legislative",
    label: "State House General (Open)",
    benchmarkKey: "state_house_general",
    dimensions: {
      officeLevel: "state_house",
      electionType: "general",
      seatContext: "open",
      partisanshipMode: "partisan",
      salienceLevel: "medium",
    },
    defaults: {
      bandWidth: 4,
      persuasionPct: 30,
      earlyVoteExp: 38,
      supportRatePct: 55,
      contactRatePct: 22,
      turnoutReliabilityPct: 80,
      gotvMaxLiftPP: 10,
      channelDoorPct: 70,
      doorsPerHour3: 30,
      callsPerHour3: 20,
      timelineGotvWeeks: 2,
      timelineRampMode: "linear",
    },
    notes: ["Balanced persuasion-turnout baseline."],
  }),
  mayoral_nonpartisan: freezeTemplateRecord({
    id: "mayoral_nonpartisan",
    version: TEMPLATE_REGISTRY_VERSION,
    legacyRaceType: "municipal",
    legacyLabel: "Municipal / ward",
    label: "Mayoral Nonpartisan",
    benchmarkKey: "municipal_nonpartisan",
    dimensions: {
      officeLevel: "municipal",
      electionType: "general",
      seatContext: "open",
      partisanshipMode: "nonpartisan",
      salienceLevel: "medium",
    },
    defaults: {
      bandWidth: 5,
      persuasionPct: 35,
      earlyVoteExp: 35,
      supportRatePct: 58,
      contactRatePct: 20,
      turnoutReliabilityPct: 77,
      gotvMaxLiftPP: 11,
      channelDoorPct: 75,
      doorsPerHour3: 32,
      callsPerHour3: 18,
      timelineGotvWeeks: 2,
      timelineRampMode: "linear",
    },
    notes: ["Wider uncertainty and larger persuasion share."],
  }),
  county_general_open: freezeTemplateRecord({
    id: "county_general_open",
    version: TEMPLATE_REGISTRY_VERSION,
    legacyRaceType: "county",
    legacyLabel: "County / regional",
    label: "County General (Open)",
    benchmarkKey: "county_general",
    dimensions: {
      officeLevel: "county",
      electionType: "general",
      seatContext: "open",
      partisanshipMode: "partisan",
      salienceLevel: "medium",
    },
    defaults: {
      bandWidth: 4,
      persuasionPct: 30,
      earlyVoteExp: 40,
      supportRatePct: 56,
      contactRatePct: 23,
      turnoutReliabilityPct: 81,
      gotvMaxLiftPP: 9,
      channelDoorPct: 68,
      doorsPerHour3: 30,
      callsPerHour3: 21,
      timelineGotvWeeks: 2,
      timelineRampMode: "linear",
    },
    notes: ["County baseline with moderate early-vote weighting."],
  }),
  special_low_turnout: freezeTemplateRecord({
    id: "special_low_turnout",
    version: TEMPLATE_REGISTRY_VERSION,
    legacyRaceType: "state_leg",
    legacyLabel: "State legislative",
    label: "Special Election (Low Turnout)",
    benchmarkKey: "special_low_turnout",
    dimensions: {
      officeLevel: "state_house",
      electionType: "special",
      seatContext: "open",
      partisanshipMode: "partisan",
      salienceLevel: "low",
    },
    defaults: {
      bandWidth: 6,
      persuasionPct: 32,
      earlyVoteExp: 28,
      supportRatePct: 57,
      contactRatePct: 19,
      turnoutReliabilityPct: 74,
      gotvMaxLiftPP: 13,
      channelDoorPct: 78,
      doorsPerHour3: 31,
      callsPerHour3: 17,
      timelineGotvWeeks: 3,
      timelineRampMode: "linear",
    },
    notes: ["Higher volatility and stronger field-contact reliance."],
  }),
});

export const LEGACY_RACE_TYPE_TO_TEMPLATE_ID = Object.freeze({
  federal: "federal_general_incumbent",
  state_leg: "state_house_general_open",
  municipal: "mayoral_nonpartisan",
  county: "county_general_open",
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
    options.set(value, toLabelCase(value));
  }
  return Array.from(options.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
}
