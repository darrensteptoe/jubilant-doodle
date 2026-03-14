// @ts-check

/**
 * @param {{
 *   test: (name: string, fn: () => unknown) => void,
 *   assert: (cond: unknown, msg?: string) => void,
 *   engine: Record<string, any>,
 *   withUniverseDefaults: (s: Record<string, any>) => Record<string, any>,
 *   isFiniteNum: (v: unknown) => boolean,
 *   computeWinMathAll: (...args: any[]) => any,
 *   makeSeededRng: (...args: any[]) => any,
 *   triSampleSeeded: (...args: any[]) => number,
 *   normalSampleBounded: (...args: any[]) => number,
 *   selectPlan: (...args: any[]) => any,
 *   buildDeterministicExplainMap: (...args: any[]) => any,
 *   computeAssumptionBenchmarkWarnings: (...args: any[]) => any,
 *   validateImportedScenarioData: (...args: any[]) => any,
 *   computeVolunteerNeedFromGoal: (...args: any[]) => any,
 *   createEffectiveInputsController: (...args: any[]) => any,
 *   safeNum: (v: unknown, fallback?: number) => number,
 *   getEffectiveBaseRates: (...args: any[]) => any,
 *   computeUniverseAdjustedRates: (...args: any[]) => any,
 *   validateOperationsCapacityInput: (...args: any[]) => any,
 * }} ctx
 * @returns {void}
 */
export function registerPhase115ATests(ctx){
  const {
    test,
    assert,
    engine,
    withUniverseDefaults,
    isFiniteNum,
    computeWinMathAll,
    makeSeededRng,
    triSampleSeeded,
    normalSampleBounded,
    selectPlan,
    buildDeterministicExplainMap,
    computeAssumptionBenchmarkWarnings,
    validateImportedScenarioData,
    computeVolunteerNeedFromGoal,
    createEffectiveInputsController,
    safeNum,
    getEffectiveBaseRates,
    computeUniverseAdjustedRates,
    validateOperationsCapacityInput,
  } = ctx;

  test("Phase 11.5A: winMath proportional vs toward undecided behavior is coherent", () => {
    const base = {
      universeSize: 100000,
      turnoutA: 50,
      turnoutB: 50,
      bandWidth: 4,
      candidates: [
        { id: "a", name: "A", supportPct: 45 },
        { id: "b", name: "B", supportPct: 45 },
      ],
      undecidedPct: 10,
      yourCandidateId: "a",
      userSplit: {},
      persuasionPct: 30,
      earlyVoteExp: 35,
    };
    const proportional = computeWinMathAll({ ...base, undecidedMode: "proportional" });
    const toward = computeWinMathAll({ ...base, undecidedMode: "toward" });
    assert(proportional.validation.candidateTableOk, "proportional candidate table invalid");
    assert(toward.validation.candidateTableOk, "toward candidate table invalid");
    assert(proportional.expected.turnoutVotes === 50000, "turnout votes mismatch at 50%");
    assert(
      toward.expected.yourVotes >= proportional.expected.yourVotes,
      "toward undecided mode should not reduce your projected votes"
    );
  });

  test("Phase 11.5A: seeded RNG reproducibility and bounded samples", () => {
    const rngA = makeSeededRng("phase11-rng-seed");
    const rngB = makeSeededRng("phase11-rng-seed");
    for (let i = 0; i < 8; i++){
      assert(rngA() === rngB(), "same seed must produce same sequence");
    }
    const rngTri = makeSeededRng("phase11-rng-tri");
    for (let i = 0; i < 1500; i++){
      const v = triSampleSeeded(0.15, 0.4, 0.9, rngTri);
      assert(v >= 0.15 && v <= 0.9, "triangular sample out of bounds");
    }
    const rngNorm = makeSeededRng("phase11-rng-normal");
    for (let i = 0; i < 5000; i++){
      const v = normalSampleBounded(0.1, 0.45, 0.85, rngNorm);
      assert(v >= 0.1 && v <= 0.85, "normal bounded sample out of bounds");
    }
  });

  test("Phase 11.5A: robust plan selector preserves baseline tie and rejects dominated plan", () => {
    const baseline = { id: "baseline", score: 0.61 };
    const altSame = { id: "alt-same", score: 0.61 };
    const tie = selectPlan({
      candidates: [baseline, altSame],
      evaluateFn: (plan) => ({ riskSummary: { probWin: plan.score } }),
      objective: "max_prob_win",
      seed: "phase11-robust-tie",
    });
    assert(tie.best?.plan?.id === "baseline", "baseline should remain best in score tie");

    const dominated = { id: "dominated", score: 0.20 };
    const best = selectPlan({
      candidates: [baseline, dominated],
      evaluateFn: (plan) => ({ riskSummary: { probWin: plan.score } }),
      objective: "max_prob_win",
      seed: "phase11-robust-dominated",
    });
    assert(best.best?.plan?.id === "baseline", "dominated plan selected as best");
  });

  test("Phase 11.5A: explain map contains canonical deterministic keys", () => {
    const inputs = { undecidedMode: "proportional" };
    const res = computeWinMathAll({
      universeSize: 10000,
      turnoutA: 45,
      turnoutB: 49,
      bandWidth: 3,
      candidates: [
        { id: "a", name: "A", supportPct: 48 },
        { id: "b", name: "B", supportPct: 47 },
      ],
      undecidedPct: 5,
      yourCandidateId: "a",
      userSplit: {},
      persuasionPct: 22,
      earlyVoteExp: 40,
      undecidedMode: "proportional",
    });
    const map = buildDeterministicExplainMap(inputs, res);
    const requiredKeys = [
      "validation.universeOk",
      "validation.candidateTableOk",
      "turnout.expectedPct",
      "expected.turnoutVotes",
      "expected.winThreshold",
      "expected.persuasionNeed",
      "stressSummary",
      "guardrails",
    ];
    for (const key of requiredKeys){
      assert(map[key], `missing explain map key: ${key}`);
      assert(typeof map[key].module === "string" && map[key].module.length > 0, `missing explain module for ${key}`);
    }
  });

  test("Phase 11.5A: import quality warnings trigger outside benchmark and stay clean within range", () => {
    const noisy = { raceType: "federal", supportRatePct: 90, contactRatePct: 20, turnoutA: 55, turnoutB: 60, persuasionPct: 25 };
    const clean = { raceType: "federal", supportRatePct: 60, contactRatePct: 20, turnoutA: 55, turnoutB: 60, persuasionPct: 25 };
    const noisyWarnings = computeAssumptionBenchmarkWarnings(noisy, "Benchmark");
    const cleanWarnings = computeAssumptionBenchmarkWarnings(clean, "Benchmark");
    assert(Array.isArray(noisyWarnings) && noisyWarnings.length > 0, "expected benchmark warning not produced");
    assert(Array.isArray(cleanWarnings) && cleanWarnings.length === 0, "clean benchmark scenario produced warnings");

    const invalid = validateImportedScenarioData({
      electionDate: "2026-02-01",
      candidates: [{ id: "a", name: "A", supportPct: "bad" }, { id: "b", name: "B", supportPct: 55 }],
      undecidedPct: 45,
      yourCandidateId: "a",
    });
    assert(invalid.ok === false, "invalid import scenario unexpectedly passed");
  });

  test("Phase 11.5A: execution planner volunteer need responds to rates and handles zero weeks", () => {
    const baseline = computeVolunteerNeedFromGoal({
      goalVotes: 1200,
      supportRatePct: 50,
      contactRatePct: 25,
      doorsPerHour: 25,
      hoursPerShift: 3,
      shiftsPerVolunteerPerWeek: 2,
      weeks: 10,
    });
    const betterSupport = computeVolunteerNeedFromGoal({
      goalVotes: 1200,
      supportRatePct: 60,
      contactRatePct: 25,
      doorsPerHour: 25,
      hoursPerShift: 3,
      shiftsPerVolunteerPerWeek: 2,
      weeks: 10,
    });
    const zeroWeeks = computeVolunteerNeedFromGoal({
      goalVotes: 1200,
      supportRatePct: 50,
      contactRatePct: 25,
      doorsPerHour: 25,
      hoursPerShift: 3,
      shiftsPerVolunteerPerWeek: 2,
      weeks: 0,
    });
    assert(isFiniteNum(baseline) && baseline > 0, "baseline volunteer need should be finite positive");
    assert(isFiniteNum(betterSupport) && betterSupport < baseline, "higher support rate should reduce volunteer need");
    assert(zeroWeeks == null, "zero weeks should yield null volunteer need");
  });

  test("Phase 11.5A: Operations/Engine seam validates compileEffectiveInputs contract", () => {
    const clampNum = (v, min, max) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return min;
      return Math.max(min, Math.min(max, n));
    };
    const sampleState = withUniverseDefaults({
      orgCount: 2,
      orgHoursPerWeek: 40,
      volunteerMultBase: 1.2,
      channelDoorPct: 70,
      doorsPerHour3: 18,
      callsPerHour3: 20,
      contactRatePct: 33,
      supportRatePct: 30,
      turnoutReliabilityPct: 80,
      twCapOverrideEnabled: true,
      twCapOverrideMode: "scheduled",
      intelState: {
        expertToggles: {
          capacityDecayEnabled: true,
          decayModel: {
            type: "linear",
            weeklyDecayPct: 0.03,
            floorPctOfBaseline: 0.7,
          },
        },
      },
    });
    const controller = createEffectiveInputsController({
      getState: () => sampleState,
      safeNum,
      clamp: clampNum,
      canonicalDoorsPerHourFromSnap: (s) => {
        const n = Number(s?.doorsPerHour3);
        return Number.isFinite(n) ? n : null;
      },
      getEffectiveBaseRates: () => getEffectiveBaseRates(sampleState, { computeUniverseAdjustedRates }),
      getEffectiveBaseRatesFromSnap: (s) => getEffectiveBaseRates(s, { computeUniverseAdjustedRates }),
      twCapOverrideModeFromState: (s) => String(s?.twCapOverrideMode || "baseline"),
      twCapResolveOverrideAttempts: () => 1500,
      twCapPerOrganizerAttemptsPerWeek: () => 600,
    });

    const effective = controller.compileEffectiveInputs(sampleState);
    const seam = validateOperationsCapacityInput(effective);
    assert(seam.ok === true, `Operations capacity seam contract invalid: ${(seam.errors || []).join(" | ")}`);

    const cap = engine.computeCapacityBreakdown({
      weeks: 1,
      orgCount: effective.capacity.orgCount,
      orgHoursPerWeek: effective.capacity.orgHoursPerWeek,
      volunteerMult: effective.capacity.volunteerMult,
      doorShare: effective.capacity.doorShare,
      doorsPerHour: effective.capacity.doorsPerHour,
      callsPerHour: effective.capacity.callsPerHour,
      capacityDecay: effective.capacity.capacityDecay,
    });
    assert(cap && typeof cap === "object", "engine rejected seam payload");
    assert(isFiniteNum(cap.total), "engine seam capacity total should be finite");
    assert(cap.total >= 0, "engine seam capacity total should be non-negative");
  });
}
