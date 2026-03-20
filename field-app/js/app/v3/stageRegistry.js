export const V3_STAGE_REGISTRY = [
  {
    id: "district",
    navLabel: "District",
    pageTitle: "District Reality",
    subtitle: "Race context, electorate shape, baseline support, and starting reality.",
    surface: "district",
    group: "Model"
  },
  {
    id: "reach",
    navLabel: "Reach",
    pageTitle: "Capacity & Reach",
    subtitle: "How much contact the program can realistically generate and what is limiting it.",
    surface: "reach",
    group: "Model"
  },
  {
    id: "outcome",
    navLabel: "Outcome",
    pageTitle: "Outcome & Risk",
    subtitle: "Forecast, uncertainty, and what is driving the current path.",
    surface: "outcome",
    group: "Model"
  },
  {
    id: "turnout",
    navLabel: "Turnout",
    pageTitle: "Turnout & Efficiency",
    subtitle: "Turnout assumptions, lift, efficiency, and realized-vote mechanics.",
    surface: "turnout",
    group: "Model"
  },
  {
    id: "plan",
    navLabel: "Plan",
    pageTitle: "Execution Plan",
    subtitle: "Execution pacing, workload, staffing, and timeline requirements.",
    surface: "plan",
    group: "Model"
  },
  {
    id: "scenarios",
    navLabel: "Scenarios",
    pageTitle: "Scenario Planning",
    subtitle: "Create, compare, and preserve alternate paths through the race.",
    surface: "scenarios",
    group: "Decisions"
  },
  {
    id: "decision-log",
    navLabel: "War Room",
    pageTitle: "War Room",
    subtitle: "Signal-aware decision sessions, actionability framing, and follow-through logging.",
    surface: "decisionLog",
    group: "Decisions"
  },
  {
    id: "controls",
    navLabel: "Controls",
    pageTitle: "Model Controls",
    subtitle: "Benchmarks, evidence, guardrails, and governance.",
    surface: "controls",
    group: "System"
  },
  {
    id: "data",
    navLabel: "Data",
    pageTitle: "Data & Recovery",
    subtitle: "Import, export, backups, recovery, and data handling policy.",
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
