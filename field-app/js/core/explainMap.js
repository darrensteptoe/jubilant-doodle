// js/core/explainMap.js
// Deterministic lineage map for impact tracing and explain-mode tooling.
// Pure metadata only; does not modify numeric outputs.

export function buildDeterministicExplainMap(inputs = {}, res = {}){
  const hasUserDefinedSplit = String(inputs?.undecidedMode || "").trim() === "user_defined";
  return {
    "validation.universeOk": {
      module: "core/winMath.js::validateInputs",
      inputs: ["universeSize"],
      dependsOn: [],
      note: "Universe must be a positive number.",
    },
    "validation.candidateTableOk": {
      module: "core/winMath.js::validateInputs",
      inputs: ["candidates[*].supportPct", "undecidedPct"],
      dependsOn: [],
      note: "Candidate + undecided totals must equal 100%.",
    },
    "turnout.expectedPct": {
      module: "core/winMath.js::computeTurnout",
      inputs: ["turnoutA", "turnoutB"],
      dependsOn: [],
      note: "Expected turnout is the midpoint of cycle A/B baselines.",
    },
    "turnout.bestPct": {
      module: "core/winMath.js::computeTurnout",
      inputs: ["turnoutA", "turnoutB", "bandWidth"],
      dependsOn: ["turnout.expectedPct"],
      note: "Best/worst turnout uses symmetric band width around expected.",
    },
    "turnout.worstPct": {
      module: "core/winMath.js::computeTurnout",
      inputs: ["turnoutA", "turnoutB", "bandWidth"],
      dependsOn: ["turnout.expectedPct"],
      note: "Best/worst turnout uses symmetric band width around expected.",
    },
    "expected.turnoutVotes": {
      module: "core/winMath.js::computeExpected",
      inputs: ["universeSize", "turnout.expectedPct"],
      dependsOn: ["validation.universeOk", "turnout.expectedPct"],
      note: "Baseline electorate turnout votes (not GOTV-adjusted).",
    },
    "expected.earlyVotes": {
      module: "core/winMath.js::computeExpected",
      inputs: ["earlyVoteExp", "expected.turnoutVotes"],
      dependsOn: ["expected.turnoutVotes"],
      note: "Early/election-day split is informational unless other layers consume it explicitly.",
    },
    "expected.edVotes": {
      module: "core/winMath.js::computeExpected",
      inputs: ["earlyVoteExp", "expected.turnoutVotes"],
      dependsOn: ["expected.turnoutVotes"],
      note: "Election-day votes are remainder after early vote split.",
    },
    "expected.yourVotes": {
      module: "core/winMath.js::computeExpected",
      inputs: [
        "candidates[*].supportPct",
        "undecidedPct",
        "undecidedMode",
        ...(hasUserDefinedSplit ? ["userSplit[*]"] : []),
      ],
      dependsOn: ["validation.candidateTableOk", "expected.turnoutVotes"],
      note: "Your projected votes after undecided allocation.",
    },
    "expected.winThreshold": {
      module: "core/winMath.js::computeExpected",
      inputs: ["candidates[*].supportPct", "undecidedPct", "undecidedMode"],
      dependsOn: ["expected.turnoutVotes", "expected.yourVotes"],
      note: "Threshold is top competitor projection + 1 vote.",
    },
    "expected.persuasionNeed": {
      module: "core/winMath.js::computeExpected",
      inputs: ["expected.winThreshold", "expected.yourVotes"],
      dependsOn: ["expected.winThreshold", "expected.yourVotes"],
      note: "Clamped at zero when projected votes already meet threshold.",
    },
    "expected.persuasionUniverse": {
      module: "core/winMath.js::computeExpected",
      inputs: ["universeSize", "persuasionPct"],
      dependsOn: ["validation.universeOk"],
      note: "Modeled movable universe for persuasion planning.",
    },
    "stressSummary": {
      module: "core/winMath.js::computeStressSummary",
      inputs: ["turnout.*", "expected.*", "validation.*"],
      dependsOn: ["turnout.expectedPct", "expected.persuasionNeed"],
      note: "Advisory risk framing from deterministic assumptions.",
    },
    "guardrails": {
      module: "core/winMath.js::computeGuardrails",
      inputs: ["raw.*", "turnout.*", "expected.*", "validation.*"],
      dependsOn: ["validation.universeOk", "validation.candidateTableOk"],
      note: "Input-quality checks and structural warnings.",
    },
    _meta: {
      generatedAt: new Date().toISOString(),
      moduleVersion: "engine.explain.v1",
      hasResult: !!res && typeof res === "object",
    },
  };
}
