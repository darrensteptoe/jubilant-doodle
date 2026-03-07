// @ts-check
// js/core/importQuality.js
// Import data-quality guardrails (pure). Runs after migration/shape validation.

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
function isObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function num(v){
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {unknown} v
 * @returns {boolean}
 */
function isBlankNumeric(v){
  if (v == null) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  return false;
}

/**
 * @param {string[]} list
 * @param {string} kind
 * @param {string} key
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 */
function pushRangeIssue(list, kind, key, value, min, max){
  const n = num(value);
  if (n == null) return;
  if (n < min || n > max){
    list.push(`${kind}: '${key}' expected ${min}..${max}, got ${value}.`);
  }
}

const BENCHMARK_RANGES_BY_RACE = {
  federal: {
    contactRatePct: [8, 45],
    supportRatePct: [25, 80],
    turnoutA: [30, 80],
    turnoutB: [30, 80],
    persuasionPct: [8, 55],
  },
  state_leg: {
    contactRatePct: [5, 50],
    supportRatePct: [20, 85],
    turnoutA: [20, 85],
    turnoutB: [20, 85],
    persuasionPct: [5, 65],
  },
  municipal: {
    contactRatePct: [6, 55],
    supportRatePct: [20, 85],
    turnoutA: [10, 70],
    turnoutB: [10, 70],
    persuasionPct: [8, 70],
  },
  county: {
    contactRatePct: [6, 50],
    supportRatePct: [20, 85],
    turnoutA: [20, 80],
    turnoutB: [20, 80],
    persuasionPct: [6, 65],
  },
  default: {
    contactRatePct: [5, 60],
    supportRatePct: [20, 85],
    turnoutA: [20, 90],
    turnoutB: [20, 90],
    persuasionPct: [5, 70],
  },
};

/**
 * @param {unknown} v
 * @returns {string}
 */
function normalizeString(v){
  return String(v == null ? "" : v).trim();
}

const BENCHMARK_REF_ALIASES = {
  "core.universeSize": ["universeSize", "universe"],
  "core.persuasionUniversePct": ["persuasionUniversePct", "persuasionPct"],
  "core.supportRatePct": ["supportRatePct"],
  "core.contactRatePct": ["contactRatePct"],
  "core.turnoutCycleA": ["turnoutCycleA", "turnoutA"],
  "core.turnoutCycleB": ["turnoutCycleB", "turnoutB"],
  "core.turnoutBandWidth": ["turnoutBandWidth", "turnoutBand"],
  "core.turnoutBaselinePct": ["turnoutBaselinePct"],
  "core.gotvLiftPP": ["gotvLiftPP"],
  "core.gotvLiftCeilingPP": ["gotvLiftCeilingPP", "gotvMaxLiftPP", "gotvMaxLiftPP2"],
  "core.orgCount": ["orgCount"],
  "core.orgHoursPerWeek": ["orgHoursPerWeek"],
  "core.volunteerMultiplier": ["volunteerMultiplier", "volunteerMultBase"],
  "core.channelDoorPct": ["channelDoorPct"],
  "core.doorsPerHour": ["doorsPerHour", "doorsPerHour3"],
  "core.callsPerHour": ["callsPerHour", "callsPerHour3"],
};

/**
 * @param {Record<string, any>} scenario
 * @param {string} ref
 * @returns {unknown}
 */
function getScenarioValueByRef(scenario, ref){
  if (!isObject(scenario)) return undefined;
  const raw = normalizeString(ref);
  if (!raw) return undefined;

  const direct = scenario[raw];
  if (direct !== undefined) return direct;

  const key = raw.split(".").pop();
  if (!key) return undefined;
  if (scenario[key] !== undefined) return scenario[key];

  const aliases = BENCHMARK_REF_ALIASES[raw];
  if (Array.isArray(aliases)){
    for (const alias of aliases){
      const k = normalizeString(alias);
      if (!k) continue;
      if (scenario[k] !== undefined) return scenario[k];
    }
  }

  return undefined;
}

/**
 * @param {string[]} out
 * @param {Record<string, any>} scenario
 * @param {string} prefix
 */
function appendIntelBenchmarkWarnings(out, scenario, prefix){
  const rows = Array.isArray(scenario?.intelState?.benchmarks)
    ? scenario.intelState.benchmarks
    : [];
  if (!rows.length) return;
  const scenarioRace = normalizeString(scenario?.raceType || "default").toLowerCase();

  for (const row of rows){
    if (!isObject(row)) continue;
    const rowRace = normalizeString(row.raceType || "all").toLowerCase();
    if (rowRace && rowRace !== "all" && rowRace !== scenarioRace) continue;
    const ref = normalizeString(row.ref || row.key || "");
    if (!ref) continue;

    const valueRaw = getScenarioValueByRef(scenario, ref);
    const value = num(valueRaw);
    if (value == null) continue;

    const range = isObject(row.range) ? row.range : null;
    const min = num(range?.min);
    const max = num(range?.max);

    if (min != null && value < min){
      out.push(`${prefix}: '${ref}' below benchmark range ${min}..${max != null ? max : "∞"} (got ${valueRaw}).`);
    }
    if (max != null && value > max){
      out.push(`${prefix}: '${ref}' above benchmark range ${min != null ? min : "-∞"}..${max} (got ${valueRaw}).`);
    }

    const sev = isObject(row.severityBands) ? row.severityBands : null;
    const warnAbove = num(sev?.warnAbove);
    const hardAbove = num(sev?.hardAbove);

    if (hardAbove != null && value > hardAbove){
      out.push(`${prefix}: '${ref}' exceeds hard-above threshold ${hardAbove} (got ${valueRaw}).`);
    } else if (warnAbove != null && value > warnAbove){
      out.push(`${prefix}: '${ref}' exceeds warn-above threshold ${warnAbove} (got ${valueRaw}).`);
    }

  }
}

/**
 * @param {Record<string, any>} scenario
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateImportedScenarioData(scenario){
  const errors = [];
  const warnings = [];

  if (!isObject(scenario)){
    return { ok: false, errors: ["Import quality check failed: scenario must be an object."], warnings };
  }

  const electionDate = normalizeString(scenario.electionDate);
  if (electionDate && !/^\d{4}-\d{2}-\d{2}$/.test(electionDate)){
    errors.push("Invalid electionDate format. Expected YYYY-MM-DD.");
  }

  const boundedFields = [
    ["turnoutA", 0, 100],
    ["turnoutB", 0, 100],
    ["bandWidth", 0, 50],
    ["undecidedPct", 0, 100],
    ["persuasionPct", 0, 100],
    ["earlyVoteExp", 0, 100],
    ["supportRatePct", 0, 100],
    ["contactRatePct", 0, 100],
    ["turnoutReliabilityPct", 0, 100],
    ["channelDoorPct", 0, 100],
    ["turnoutBaselinePct", 0, 100],
    ["gotvLiftPP", 0, 25],
    ["gotvMaxLiftPP", 0, 50],
    ["gotvLiftMin", 0, 25],
    ["gotvLiftMode", 0, 25],
    ["gotvLiftMax", 0, 25],
    ["gotvMaxLiftPP2", 0, 50],
    ["universeDemPct", 0, 100],
    ["universeRepPct", 0, 100],
    ["universeNpaPct", 0, 100],
    ["universeOtherPct", 0, 100],
  ];

  for (const [key, min, max] of boundedFields){
    const hasKey = Object.prototype.hasOwnProperty.call(scenario, key);
    if (!hasKey) continue;
    const raw = scenario[key];
    // Many planner fields are intentionally optional and may round-trip as "".
    // Treat blank as unset (non-fatal) and let in-app validation handle completeness.
    if (isBlankNumeric(raw)) continue;
    const n = num(raw);
    if (n == null){
      errors.push(`Invalid number for '${key}'.`);
      continue;
    }
    if (n < min || n > max){
      errors.push(`Out-of-range '${key}': expected ${min}..${max}, got ${raw}.`);
    }
  }

  const nonNegativeFields = [
    "universeSize",
    "goalSupportIds",
    "orgCount",
    "orgHoursPerWeek",
    "volunteerMultBase",
    "doorsPerHour3",
    "callsPerHour3",
    "doorsPerHour",
    "hoursPerShift",
    "shiftsPerVolunteerPerWeek",
    "timelineActiveWeeks",
    "timelineGotvWeeks",
    "timelineStaffCount",
    "timelineStaffHours",
    "timelineVolCount",
    "timelineVolHours",
    "timelineDoorsPerHour",
    "timelineCallsPerHour",
    "timelineTextsPerHour",
    "twCapOverrideHorizonWeeks",
  ];

  for (const key of nonNegativeFields){
    if (!Object.prototype.hasOwnProperty.call(scenario, key)) continue;
    const raw = scenario[key];
    if (isBlankNumeric(raw)) continue;
    const n = num(raw);
    if (n == null){
      errors.push(`Invalid number for '${key}'.`);
      continue;
    }
    if (n < 0){
      errors.push(`Out-of-range '${key}': expected >= 0, got ${raw}.`);
    }
  }

  // Candidate integrity
  const candidates = Array.isArray(scenario.candidates) ? scenario.candidates : null;
  if (!candidates || !candidates.length){
    errors.push("Candidates array is missing or empty.");
  } else {
    const ids = new Set();
    const names = new Set();
    for (let i = 0; i < candidates.length; i++){
      const c = candidates[i];
      if (!isObject(c)){
        errors.push(`Candidate at index ${i} must be an object.`);
        continue;
      }
      const id = normalizeString(c.id);
      const name = normalizeString(c.name);
      if (!id){
        errors.push(`Candidate at index ${i} is missing id.`);
      } else if (ids.has(id)){
        errors.push(`Duplicate candidate id '${id}'.`);
      } else {
        ids.add(id);
      }
      if (!name){
        warnings.push(`Candidate '${id || i}' has no display name.`);
      } else {
        const key = name.toLowerCase();
        if (names.has(key)) warnings.push(`Duplicate candidate name '${name}'.`);
        names.add(key);
      }
      const support = num(c.supportPct);
      if (support == null){
        errors.push(`Candidate '${id || i}' has invalid supportPct.`);
      } else if (support < 0 || support > 100){
        errors.push(`Candidate '${id || i}' supportPct out of range 0..100.`);
      }
    }

    const yourId = normalizeString(scenario.yourCandidateId);
    if (yourId && !ids.has(yourId)){
      errors.push(`yourCandidateId '${yourId}' is not present in candidates.`);
    }

    const undecided = num(scenario.undecidedPct);
    if (undecided != null){
      let total = undecided;
      for (const c of candidates){
        const s = num(c?.supportPct);
        if (s != null) total += s;
      }
      if (Math.abs(total - 100) > 0.25){
        warnings.push(`Candidate support + undecided totals ${total.toFixed(2)} (expected ~100).`);
      }
    }
  }

  // Universe layer behavior checks
  if (scenario.universeLayerEnabled){
    const dem = num(scenario.universeDemPct) || 0;
    const rep = num(scenario.universeRepPct) || 0;
    const npa = num(scenario.universeNpaPct) || 0;
    const other = num(scenario.universeOtherPct) || 0;
    const sum = dem + rep + npa + other;
    if (Math.abs(sum - 100) > 0.25){
      warnings.push(`Universe composition totals ${sum.toFixed(2)} (expected ~100). Auto-normalize may adjust on edit.`);
    }
  }

  const retention = num(scenario.retentionFactor);
  if (retention != null){
    if (retention < 0) errors.push("retentionFactor must be >= 0.");
    if (retention > 1 && retention <= 100){
      warnings.push("retentionFactor appears to be percentage-style (>1). Expected decimal 0..1.");
    }
    if (retention > 100) errors.push("retentionFactor is unrealistically high.");
  }

  // Budget tactics integrity
  const tactics = scenario?.budget?.tactics;
  if (isObject(tactics)){
    for (const key of ["doors", "phones", "texts"]){
      const t = tactics[key];
      if (!isObject(t)) continue;
      const cpa = num(t.cpa);
      if (cpa == null){
        errors.push(`Budget tactic '${key}' has invalid cpa.`);
      } else if (cpa < 0){
        errors.push(`Budget tactic '${key}' cpa must be >= 0.`);
      }
    }
  }

  // Range warnings (non-blocking benchmark hints)
  warnings.push(...computeAssumptionBenchmarkWarnings(scenario, "Warning"));

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * @param {Record<string, any>} scenario
 * @param {string} [prefix]
 * @returns {string[]}
 */
export function computeAssumptionBenchmarkWarnings(scenario, prefix = "Benchmark"){
  const out = [];
  if (!isObject(scenario)) return out;

  const raceType = normalizeString(scenario.raceType || "default");
  const profile = BENCHMARK_RANGES_BY_RACE[raceType] || BENCHMARK_RANGES_BY_RACE.default;
  for (const key of Object.keys(profile)){
    const [min, max] = profile[key];
    pushRangeIssue(out, prefix, key, scenario[key], min, max);
  }

  // Optional scenario-scoped benchmark catalog (Phase 2 intel layer).
  appendIntelBenchmarkWarnings(out, scenario, prefix);

  return out;
}
