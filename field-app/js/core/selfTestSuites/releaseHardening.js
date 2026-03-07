// @ts-check

/**
 * @param {{
 *   test: (name: string, fn: () => unknown) => void,
 *   assert: (cond: unknown, msg?: string) => void,
 *   withUniverseDefaults: (s: Record<string, any>) => Record<string, any>,
 *   makeDefaultIntelState: (...args: any[]) => any,
 *   makeScenarioExport: (...args: any[]) => any,
 *   MODEL_VERSION: string,
 *   APP_VERSION: string,
 *   BUILD_ID: string,
 *   formatSummaryText: (...args: any[]) => string,
 *   SELFTEST_GATE: Record<string, string>,
 *   gateFromSelfTestResult: (...args: any[]) => string,
 *   writeBackupEntry: (...args: any[]) => any,
 *   readBackups: (...args: any[]) => any[],
 *   CURRENT_SCHEMA_VERSION: string,
 *   computeSnapshotHash: (...args: any[]) => string,
 *   migrateSnapshot: (...args: any[]) => any,
 *   validateScenarioExport: (...args: any[]) => any,
 *   checkStrictImportPolicy: (...args: any[]) => any,
 * }} ctx
 * @returns {void}
 */
export function registerReleaseHardeningTests(ctx){
  const {
    test,
    assert,
    withUniverseDefaults,
    makeDefaultIntelState,
    makeScenarioExport,
    MODEL_VERSION,
    APP_VERSION,
    BUILD_ID,
    formatSummaryText,
    SELFTEST_GATE,
    gateFromSelfTestResult,
    writeBackupEntry,
    readBackups,
    CURRENT_SCHEMA_VERSION,
    computeSnapshotHash,
    migrateSnapshot,
    validateScenarioExport,
    checkStrictImportPolicy,
  } = ctx;

  test("Phase 11: Export metadata includes appVersion + buildId", () => {
    const payload = makeScenarioExport({ modelVersion: MODEL_VERSION, scenarioState: { a: 1 } });
    assert(payload.appVersion === APP_VERSION, "appVersion missing or wrong");
    assert(payload.buildId === BUILD_ID, "buildId missing or wrong");
    return true;
  });

  test("Phase 11: export includes governance summary object", () => {
    const scenario = withUniverseDefaults({ scenarioName: "GovExport", universeSize: 1000, ui: { training: false, dark: false } });
    scenario.intelState = makeDefaultIntelState();
    scenario.intelState.workflow.scenarioLocked = false;
    scenario.intelState.audit = [
      {
        id: "a1",
        ts: "2026-03-04T00:00:00.000Z",
        governanceTracked: true,
        requiresEvidence: true,
        requiresNote: true,
        status: "open",
        evidenceId: null,
        note: "",
      }
    ];
    scenario.intelState.briefs = [
      { id: "b1", kind: "calibrationSources", createdAt: "2026-03-04T12:00:00.000Z" }
    ];
    const payload = makeScenarioExport({ modelVersion: MODEL_VERSION, scenarioState: scenario });
    assert(payload.governance && payload.governance.available === true, "Missing governance summary on export");
    assert(payload.governance.missing?.evidence === 1, "Governance missing evidence count mismatch");
    assert(payload.governance.missing?.note === 1, "Governance missing note count mismatch");
    assert(!!payload.governance.calibrationBrief, "Expected calibration brief summary");
    return true;
  });

  test("Phase 11: export includes intel bundle payload + calibration brief content", () => {
    const scenario = withUniverseDefaults({ scenarioName: "IntelBundleExport", universeSize: 1000, ui: { training: false, dark: false } });
    scenario.intelState = makeDefaultIntelState();
    scenario.intelState.audit = [
      { id: "aud_1", ts: "2026-03-05T00:00:00.000Z", ref: "core.supportRatePct", requiresEvidence: true, evidenceId: null, status: "missingEvidence", governanceTracked: true }
    ];
    scenario.intelState.evidence = [
      { id: "ev_1", ref: "core.supportRatePct", title: "Field memo", source: "operator", capturedAt: "2026-03-05T00:00:00.000Z" }
    ];
    scenario.intelState.recommendations = [
      { id: "rec_1", title: "Adjust support rate", detail: "Observed < assumed", priority: 1, ref: "core.supportRatePct" }
    ];
    scenario.intelState.briefs = [
      { id: "brief_1", kind: "calibrationSources", createdAt: "2026-03-05T01:00:00.000Z", content: "# Calibration sources" }
    ];

    const payload = makeScenarioExport({ modelVersion: MODEL_VERSION, scenarioState: scenario });
    assert(payload.intelBundle && payload.intelBundle.available === true, "Missing intelBundle on export");
    assert(payload.intelBundle.counts?.audit === 1, "intelBundle audit count mismatch");
    assert(payload.intelBundle.counts?.evidence === 1, "intelBundle evidence count mismatch");
    assert(payload.intelBundle.counts?.recommendations === 1, "intelBundle recommendation count mismatch");
    assert(payload.intelBundle.latestCalibrationBrief && payload.intelBundle.latestCalibrationBrief.id === "brief_1", "intelBundle latest calibration brief missing");
    assert(Array.isArray(payload.intelBundle.payload?.audit) && payload.intelBundle.payload.audit.length === 1, "intelBundle audit payload missing");
    assert(Array.isArray(payload.intelBundle.payload?.evidence) && payload.intelBundle.payload.evidence.length === 1, "intelBundle evidence payload missing");
    return true;
  });

  test("Phase 11: copy summary includes governance lines", () => {
    const text = formatSummaryText({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      snapshotHash: "hash123",
      summary: {
        objective: "net",
        netVotes: 100,
        cost: 200,
        feasible: true,
        primaryBottleneck: "none/unknown",
        topAllocations: ["Doors: 100 attempts"],
      },
      governance: {
        available: true,
        workflow: { scenarioLocked: true },
        missing: { evidence: 2, note: 3 },
        calibrationBrief: { id: "brief1" },
      },
    });
    assert(text.includes("Governance lock: ON"), "Missing governance lock line in summary text");
    assert(text.includes("Governance missing evidence: 2"), "Missing governance evidence line in summary text");
    assert(text.includes("Governance missing note: 3"), "Missing governance note line in summary text");
    assert(text.includes("Calibration brief: present"), "Missing calibration brief line in summary text");
    return true;
  });

  test("Phase 11: Self-test gate state transitions (pure)", () => {
    assert(gateFromSelfTestResult(null) === SELFTEST_GATE.UNVERIFIED, "null should be UNVERIFIED");
    assert(gateFromSelfTestResult({ total: 10, passed: 10, failed: 0 }) === SELFTEST_GATE.VERIFIED, "pass should be VERIFIED");
    assert(gateFromSelfTestResult({ total: 10, passed: 9, failed: 1 }) === SELFTEST_GATE.FAILED, "fail should be FAILED");
    return true;
  });

  test("Phase 11: Backups roll to max 5 (mocked storage)", () => {
    const mem = (() => {
      const m = new Map();
      return { getItem: (k)=> m.has(k)? m.get(k): null, setItem:(k,v)=>{ m.set(k,String(v)); } };
    })();

    for (let i=0;i<7;i++){
      writeBackupEntry({ ts: String(i), scenarioName: "S"+i, payload: { schemaVersion: CURRENT_SCHEMA_VERSION, modelVersion: MODEL_VERSION, scenario: { n:i } } }, mem);
    }
    const arr = readBackups(mem);
    assert(arr.length === 5, "Expected 5 backups max");
    assert(arr[0].ts === "6", "Newest backup should be first");
    assert(arr[4].ts === "2", "Oldest retained should be #2");
    return true;
  });

  test("Phase 11: Restore backup payload preserves deterministic hash", () => {
    const scenario = withUniverseDefaults({ scenarioName:"RestoreTest", universeSize: 1000, ui:{ training:false, dark:false } });
    const snap = { modelVersion: MODEL_VERSION, schemaVersion: CURRENT_SCHEMA_VERSION, scenarioState: scenario };
    const hash0 = computeSnapshotHash(snap);
    const payload = makeScenarioExport({ modelVersion: MODEL_VERSION, scenarioState: scenario });
    const mig = migrateSnapshot(payload);
    assert(mig && mig.snapshot && typeof mig.snapshot === "object", "migrateSnapshot failed");
    const v = validateScenarioExport(mig.snapshot, MODEL_VERSION);
    assert(v.ok, "validateScenarioExport failed after migration");
    const hash1 = computeSnapshotHash({ modelVersion: v.modelVersion, scenarioState: v.scenario });
    assert(hash1 === hash0, "Hash changed after restore path");
    return true;
  });

  test("Phase 11: Strict import blocks newer schema + hash mismatch, allows when OFF", () => {
    const newer = checkStrictImportPolicy({ strictMode:true, importedSchemaVersion:"9.9.9", currentSchemaVersion:CURRENT_SCHEMA_VERSION, hashMismatch:false });
    assert(!newer.ok && newer.issues.length, "Should block newer schema");
    const hm = checkStrictImportPolicy({ strictMode:true, importedSchemaVersion:CURRENT_SCHEMA_VERSION, currentSchemaVersion:CURRENT_SCHEMA_VERSION, hashMismatch:true });
    assert(!hm.ok && hm.issues.length, "Should block hash mismatch");
    const off = checkStrictImportPolicy({ strictMode:false, importedSchemaVersion:"9.9.9", currentSchemaVersion:CURRENT_SCHEMA_VERSION, hashMismatch:true });
    assert(off.ok, "Should allow when strict mode OFF");
    return true;
  });
}
