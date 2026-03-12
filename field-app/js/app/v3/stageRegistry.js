export const V3_STAGE_REGISTRY = [
  {
    id: "district",
    navLabel: "District",
    pageTitle: "District Reality",
    subtitle: "Race context, electorate shape, baseline support, and starting reality.",
    legacyStageIds: ["setup", "universe", "ballot", "structure"],
    surface: "district",
    group: "Model"
  },
  {
    id: "reach",
    navLabel: "Reach",
    pageTitle: "Capacity & Reach",
    subtitle: "How much contact the program can realistically generate and what is limiting it.",
    legacyStageIds: ["capacity"],
    surface: "reach",
    group: "Model"
  },
  {
    id: "outcome",
    navLabel: "Outcome",
    pageTitle: "Outcome & Risk",
    subtitle: "Forecast, uncertainty, and what is driving the current path.",
    legacyStageIds: ["results"],
    surface: "outcome",
    group: "Model"
  },
  {
    id: "turnout",
    navLabel: "Turnout",
    pageTitle: "Turnout & Efficiency",
    subtitle: "Turnout assumptions, lift, efficiency, and realized-vote mechanics.",
    legacyStageIds: ["roi"],
    surface: "turnout",
    group: "Model"
  },
  {
    id: "plan",
    navLabel: "Plan",
    pageTitle: "Execution Plan",
    subtitle: "Execution pacing, workload, staffing, and timeline requirements.",
    legacyStageIds: ["gotv"],
    surface: "plan",
    group: "Model"
  },
  {
    id: "scenarios",
    navLabel: "Scenarios",
    pageTitle: "Scenario Planning",
    subtitle: "Create, compare, and preserve alternate paths through the race.",
    legacyStageIds: ["scenarios"],
    surface: "scenarios",
    group: "Decisions"
  },
  {
    id: "decision-log",
    navLabel: "Decision Log",
    pageTitle: "Decision Log",
    subtitle: "Structured decision records and scenario-linked reasoning.",
    legacyStageIds: ["decisions"],
    surface: "decisionLog",
    group: "Decisions"
  },
  {
    id: "controls",
    navLabel: "Controls",
    pageTitle: "Model Controls",
    subtitle: "Benchmarks, evidence, guardrails, and governance.",
    legacyStageIds: ["checks"],
    surface: "controls",
    group: "System"
  },
  {
    id: "data",
    navLabel: "Data",
    pageTitle: "Data & Recovery",
    subtitle: "Import, export, backups, recovery, and data handling policy.",
    legacyStageIds: ["integrity"],
    surface: "data",
    group: "System"
  }
];

export const V3_DEFAULT_STAGE = "district";

export function getStageById(stageId) {
  return V3_STAGE_REGISTRY.find((stage) => stage.id === stageId) || null;
}

export function getStageByLegacyId(stageId) {
  const normalized = String(stageId || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return (
    V3_STAGE_REGISTRY.find((stage) =>
      Array.isArray(stage.legacyStageIds) &&
      stage.legacyStageIds.some((legacyId) => String(legacyId || "").trim().toLowerCase() === normalized)
    ) || null
  );
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

  const byLegacyId = getStageByLegacyId(normalized);
  if (byLegacyId) {
    return byLegacyId.id;
  }

  return V3_DEFAULT_STAGE;
}
