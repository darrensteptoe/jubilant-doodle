// @ts-check

function clean(value){
  return String(value == null ? "" : value).trim().toLowerCase();
}

export const BENCHMARK_PROFILE_PRESETS = Object.freeze({
  federal_general: Object.freeze({
    contactMin: 8,
    contactMax: 45,
    supportMin: 25,
    supportMax: 80,
    turnoutMin: 30,
    turnoutMax: 80,
    persuasionMin: 8,
    persuasionMax: 55,
  }),
  state_house_general: Object.freeze({
    contactMin: 5,
    contactMax: 50,
    supportMin: 20,
    supportMax: 85,
    turnoutMin: 20,
    turnoutMax: 85,
    persuasionMin: 5,
    persuasionMax: 65,
  }),
  municipal_nonpartisan: Object.freeze({
    contactMin: 6,
    contactMax: 55,
    supportMin: 20,
    supportMax: 85,
    turnoutMin: 10,
    turnoutMax: 70,
    persuasionMin: 8,
    persuasionMax: 70,
  }),
  county_general: Object.freeze({
    contactMin: 6,
    contactMax: 50,
    supportMin: 20,
    supportMax: 85,
    turnoutMin: 20,
    turnoutMax: 80,
    persuasionMin: 6,
    persuasionMax: 65,
  }),
  special_low_turnout: Object.freeze({
    contactMin: 5,
    contactMax: 45,
    supportMin: 20,
    supportMax: 85,
    turnoutMin: 10,
    turnoutMax: 70,
    persuasionMin: 8,
    persuasionMax: 70,
  }),
  default: Object.freeze({
    contactMin: 5,
    contactMax: 60,
    supportMin: 20,
    supportMax: 85,
    turnoutMin: 20,
    turnoutMax: 90,
    persuasionMin: 5,
    persuasionMax: 70,
  }),
});

export const BENCHMARK_PROFILE_KEY_BY_RACE_TYPE = Object.freeze({
  federal: "federal_general",
  state_leg: "state_house_general",
  municipal: "municipal_nonpartisan",
  county: "county_general",
  all: "default",
});

export const BENCHMARK_RACE_TYPE_BY_PROFILE_KEY = Object.freeze({
  federal_general: "federal",
  state_house_general: "state_leg",
  municipal_nonpartisan: "municipal",
  county_general: "county",
  special_low_turnout: "all",
  default: "all",
});

export const BENCHMARK_PROFILE_LABEL_BY_KEY = Object.freeze({
  federal_general: "Federal general",
  state_house_general: "State house general",
  municipal_nonpartisan: "Municipal nonpartisan",
  county_general: "County general",
  special_low_turnout: "Special / low turnout",
  default: "Template/default scope",
});

export const BENCHMARK_SCOPE_OPTIONS = Object.freeze([
  Object.freeze({
    value: "default",
    benchmarkKey: "default",
    raceType: "all",
    label: BENCHMARK_PROFILE_LABEL_BY_KEY.default,
  }),
  Object.freeze({
    value: "federal_general",
    benchmarkKey: "federal_general",
    raceType: "federal",
    label: BENCHMARK_PROFILE_LABEL_BY_KEY.federal_general,
  }),
  Object.freeze({
    value: "state_house_general",
    benchmarkKey: "state_house_general",
    raceType: "state_leg",
    label: BENCHMARK_PROFILE_LABEL_BY_KEY.state_house_general,
  }),
  Object.freeze({
    value: "municipal_nonpartisan",
    benchmarkKey: "municipal_nonpartisan",
    raceType: "municipal",
    label: BENCHMARK_PROFILE_LABEL_BY_KEY.municipal_nonpartisan,
  }),
  Object.freeze({
    value: "county_general",
    benchmarkKey: "county_general",
    raceType: "county",
    label: BENCHMARK_PROFILE_LABEL_BY_KEY.county_general,
  }),
  Object.freeze({
    value: "special_low_turnout",
    benchmarkKey: "special_low_turnout",
    raceType: "all",
    label: BENCHMARK_PROFILE_LABEL_BY_KEY.special_low_turnout,
  }),
]);

export function isBenchmarkProfileKey(value){
  const key = clean(value);
  return !!(key && Object.prototype.hasOwnProperty.call(BENCHMARK_PROFILE_PRESETS, key));
}

export function normalizeKnownBenchmarkProfileKey(value){
  const key = clean(value);
  return isBenchmarkProfileKey(key) ? key : "";
}

export function benchmarkProfileKeyFromRaceType(raceType){
  const race = clean(raceType);
  return BENCHMARK_PROFILE_KEY_BY_RACE_TYPE[race] || "default";
}

export function benchmarkScopeToBenchmarkKey(scopeValue){
  const value = clean(scopeValue);
  if (!value) return "default";
  const knownKey = normalizeKnownBenchmarkProfileKey(value);
  if (knownKey) return knownKey;
  return benchmarkProfileKeyFromRaceType(value);
}

export function benchmarkScopeToRaceType(scopeValue){
  const value = clean(scopeValue);
  if (Object.prototype.hasOwnProperty.call(BENCHMARK_PROFILE_KEY_BY_RACE_TYPE, value)){
    return value;
  }
  const key = benchmarkScopeToBenchmarkKey(value);
  return BENCHMARK_RACE_TYPE_BY_PROFILE_KEY[key] || "all";
}

export function benchmarkScopeLabel(scopeValue){
  const key = benchmarkScopeToBenchmarkKey(scopeValue);
  return BENCHMARK_PROFILE_LABEL_BY_KEY[key] || BENCHMARK_PROFILE_LABEL_BY_KEY.default;
}

export function listBenchmarkScopeOptions(){
  return BENCHMARK_SCOPE_OPTIONS.map((row) => ({ ...row }));
}

export function getBenchmarkProfilePreset(key){
  const resolved = normalizeKnownBenchmarkProfileKey(key) || "default";
  return BENCHMARK_PROFILE_PRESETS[resolved] || BENCHMARK_PROFILE_PRESETS.default;
}

export function getAssumptionRangeProfileByKey(key){
  const preset = getBenchmarkProfilePreset(key);
  return {
    contactRatePct: [preset.contactMin, preset.contactMax],
    supportRatePct: [preset.supportMin, preset.supportMax],
    turnoutA: [preset.turnoutMin, preset.turnoutMax],
    turnoutB: [preset.turnoutMin, preset.turnoutMax],
    persuasionPct: [preset.persuasionMin, preset.persuasionMax],
  };
}
