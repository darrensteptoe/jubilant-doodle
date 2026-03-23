export const V3_STAGE_REGISTRY = [
  {
    id: "district",
    navLabel: "District",
    pageTitle: "District Reality",
    subtitle: "Race context, electorate structure, baseline support, and district starting conditions.",
    surface: "districtV2",
    group: "Model"
  },
  {
    id: "election-data",
    navLabel: "Election Data",
    pageTitle: "Election Data",
    subtitle: "Import, reconcile, benchmark, and quality-grade historical election results before modeling.",
    surface: "electionData",
    group: "Model"
  },
  {
    id: "reach",
    navLabel: "Reach",
    pageTitle: "Capacity & Reach",
    subtitle: "How much contact the program can realistically generate and what is currently constraining pace.",
    surface: "reach",
    group: "Model"
  },
  {
    id: "outcome",
    navLabel: "Outcome",
    pageTitle: "Outcome & Risk",
    subtitle: "Forecast posture, uncertainty range, and the drivers shaping the current win path.",
    surface: "outcome",
    group: "Model"
  },
  {
    id: "turnout",
    navLabel: "Turnout",
    pageTitle: "Turnout & Efficiency",
    subtitle: "Turnout assumptions, lift mechanics, tactic efficiency, and realized-vote impact.",
    surface: "turnout",
    group: "Model"
  },
  {
    id: "plan",
    navLabel: "Plan",
    pageTitle: "Execution Plan",
    subtitle: "Execution pacing, workload, staffing mix, and timeline feasibility requirements.",
    surface: "plan",
    group: "Model"
  },
  {
    id: "scenarios",
    navLabel: "Scenarios",
    pageTitle: "Scenario Planning",
    subtitle: "Create, compare, and preserve alternate strategic paths without mutating baseline work.",
    surface: "scenarios",
    group: "Decisions"
  },
  {
    id: "decision-log",
    navLabel: "War Room",
    pageTitle: "War Room",
    subtitle: "Signal-aware decision sessions, actionability framing, and follow-through accountability.",
    surface: "decisionLog",
    group: "Decisions"
  },
  {
    id: "controls",
    navLabel: "Controls",
    pageTitle: "Model Controls",
    subtitle: "Benchmarks, evidence, guardrails, and governance settings that preserve model trust.",
    surface: "controls",
    group: "System"
  },
  {
    id: "data",
    navLabel: "Data",
    pageTitle: "Data & Recovery",
    subtitle: "Import/export, backups, recovery, and data-handling policy for durable operations.",
    surface: "data",
    group: "System"
  }
];

export const V3_DEFAULT_STAGE = "district";

export function getStageById(stageId) {
  return V3_STAGE_REGISTRY.find((stage) => stage.id === stageId) || null;
}

export function resolveV3StageId(stageId) {
  const normalized = String(stageId || "").trim();
  if (!normalized) {
    return V3_DEFAULT_STAGE;
  }

  const byV3Id = getStageById(normalized);
  if (byV3Id) {
    return byV3Id.id;
  }

  return V3_DEFAULT_STAGE;
}
