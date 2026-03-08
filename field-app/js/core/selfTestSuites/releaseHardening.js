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
 *   makeDefaultDataRefs: (...args: any[]) => any,
 *   makeDefaultDataCatalog: (...args: any[]) => any,
 *   makeDefaultGeoPack: (...args: any[]) => any,
 *   makeDefaultDistrictIntelPack: (...args: any[]) => any,
 *   normalizeDataCatalog: (...args: any[]) => any,
 *   normalizeDistrictDataState: (...args: any[]) => any,
 *   validateDistrictDataContract: (...args: any[]) => any,
 *   normalizeCensusManifest: (...args: any[]) => any,
 *   validateCensusManifest: (...args: any[]) => any,
 *   normalizeElectionManifest: (...args: any[]) => any,
 *   validateElectionManifest: (...args: any[]) => any,
 *   censusManifestToCatalogEntry: (...args: any[]) => any,
 *   electionManifestToCatalogEntry: (...args: any[]) => any,
 *   normalizeElectionPrecinctPayload: (...args: any[]) => any,
 *   allocatePrecinctVotesToGeo: (...args: any[]) => any,
 *   compileDistrictEvidence: (...args: any[]) => any,
 *   derivePersuasionSignalFromElection: (...args: any[]) => any,
 *   summarizeGeoEvidenceLayers: (...args: any[]) => any,
 *   summarizeGeoOpportunityLayers: (...args: any[]) => any,
 *   buildGeoEvidenceMapLayer: (...args: any[]) => any,
 *   summarizePrecinctEvidenceLayers: (...args: any[]) => any,
 *   resolveDistrictEvidenceInputs: (...args: any[]) => any,
 *   summarizeDistrictEvidenceInputs: (...args: any[]) => any,
 *   buildDistrictIntelPackFromEvidence: (...args: any[]) => any,
 *   applyDistrictIntelRateOverrides: (...args: any[]) => any,
 *   applyDistrictIntelCapacityOverrides: (...args: any[]) => any,
 *   buildDataSourceRegistry: (...args: any[]) => any,
 *   resolveDataRefsByPolicy: (...args: any[]) => any,
 *   materializePinnedDataRefs: (...args: any[]) => any,
 *   diagnoseDataRefAlignment: (...args: any[]) => any,
 *   scoreElectionDatasetCompatibility: (...args: any[]) => any,
 *   rankElectionDatasetsForScenario: (...args: any[]) => any,
 *   buildAutoPullUrlPlan: (...args: any[]) => any,
 *   buildAutoPullPlanFingerprint: (...args: any[]) => any,
 *   createAutoPullReceipt: (...args: any[]) => any,
 *   summarizeAutoPullReceipt: (...args: any[]) => any,
 *   evaluateAutoPullPlan: (...args: any[]) => any,
 *   resolveAutoPullUrls: (...args: any[]) => any,
 *   assessAutoPullReceiptAlignment: (...args: any[]) => any,
 *   evaluateAutoPullRunNeed: (...args: any[]) => any,
 *   normalizeAreaSelection: (...args: any[]) => any,
 *   buildAreaResolverCacheKey: (...args: any[]) => any,
 *   deriveAreaResolverContext: (...args: any[]) => any,
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
    makeDefaultDataRefs,
    makeDefaultDataCatalog,
    makeDefaultGeoPack,
    makeDefaultDistrictIntelPack,
    normalizeDataCatalog,
    normalizeDistrictDataState,
    validateDistrictDataContract,
    normalizeCensusManifest,
    validateCensusManifest,
    normalizeElectionManifest,
    validateElectionManifest,
    censusManifestToCatalogEntry,
    electionManifestToCatalogEntry,
    normalizeElectionPrecinctPayload,
    allocatePrecinctVotesToGeo,
    compileDistrictEvidence,
    derivePersuasionSignalFromElection,
    summarizeGeoEvidenceLayers,
    summarizeGeoOpportunityLayers,
    buildGeoEvidenceMapLayer,
    summarizePrecinctEvidenceLayers,
    resolveDistrictEvidenceInputs,
    summarizeDistrictEvidenceInputs,
    buildDistrictIntelPackFromEvidence,
    applyDistrictIntelRateOverrides,
    applyDistrictIntelCapacityOverrides,
    buildDataSourceRegistry,
    resolveDataRefsByPolicy,
    materializePinnedDataRefs,
    diagnoseDataRefAlignment,
    scoreElectionDatasetCompatibility,
    rankElectionDatasetsForScenario,
    buildAutoPullUrlPlan,
    buildAutoPullPlanFingerprint,
    createAutoPullReceipt,
    summarizeAutoPullReceipt,
    evaluateAutoPullPlan,
    resolveAutoPullUrls,
    assessAutoPullReceiptAlignment,
    evaluateAutoPullRunNeed,
    normalizeAreaSelection,
    buildAreaResolverCacheKey,
    deriveAreaResolverContext,
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

  test("Phase 18: migrate applies district data contract defaults for legacy snapshots", () => {
    const legacyScenario = withUniverseDefaults({
      scenarioName: "Legacy District Data",
      raceType: "state_leg",
      electionDate: "2026-06-02",
      universeSize: 10000,
      ui: { training: false, dark: false },
    });
    delete legacyScenario.dataRefs;
    delete legacyScenario.dataCatalog;
    delete legacyScenario.geoPack;
    delete legacyScenario.districtIntelPack;
    delete legacyScenario.useDistrictIntel;

    const payload = {
      schemaVersion: "1.2.0",
      modelVersion: MODEL_VERSION,
      scenario: legacyScenario,
    };
    const migrated = migrateSnapshot(payload);
    const scen = migrated?.snapshot?.scenario || {};
    const refs = makeDefaultDataRefs();
    const catalog = makeDefaultDataCatalog();
    const geo = makeDefaultGeoPack();
    const intel = makeDefaultDistrictIntelPack();

    assert(scen.useDistrictIntel === false, "Expected useDistrictIntel default false");
    assert(scen.dataRefs && scen.dataRefs.mode === refs.mode, "Expected default dataRefs mode");
    assert(Array.isArray(scen.dataCatalog?.boundarySets) && scen.dataCatalog.boundarySets.length === catalog.boundarySets.length, "Expected default dataCatalog boundary set list");
    assert(scen.geoPack && scen.geoPack.resolution === geo.resolution, "Expected default geoPack resolution");
    assert(scen.districtIntelPack && scen.districtIntelPack.bounds?.min === intel.bounds.min, "Expected districtIntelPack defaults");

    const contract = validateDistrictDataContract(scen);
    assert(contract.ok, `District data contract should be valid after migration: ${(contract.errors || []).join(" | ")}`);
    assert((contract.warnings || []).length === 0, "Legacy migration defaults should not emit district-data warnings when feature is unused");
    return true;
  });

  test("Phase 18: district data normalizer repairs malformed values without throwing", () => {
    const raw = {
      useDistrictIntel: "yes",
      dataRefs: {
        mode: "somethingElse",
        censusDatasetId: "  census_2024  ",
        pinnedAt: "not-a-date",
        electionStrictSimilarity: "yes",
        electionMaxYearDelta: 99,
        electionMinCoveragePct: -5,
      },
      dataCatalog: {
        boundarySets: [{ id: "statehouse_2024", label: "State House 2024", geographyType: "SLDL" }],
        crosswalks: [{ id: "cw_2024", fromBoundarySetId: "statehouse_2022", toBoundarySetId: "statehouse_2024", quality: { coveragePct: 99, unmatchedPct: 1, weightDriftPct: 0.5, isVerified: true } }],
        censusDatasets: [{ id: "acs5_2024", label: "ACS 2024", quality: { coveragePct: 96, isVerified: true } }],
        electionDatasets: [{ id: "mit_precinct_2024", label: "MIT 2024", quality: { coveragePct: 97, isVerified: true } }],
      },
      geoPack: {
        resolution: "unknown",
        units: [{ geoid: " 34013010100 ", w: 1.2 }, { geoid: "", w: 0.2 }, { geoid: "34013010200", w: -1 }],
      },
      districtIntelPack: {
        bounds: { min: 1.5, max: 1.2 },
        indices: { fieldSpeed: 2.4, persuasionEnv: 0.1, turnoutElasticity: 1.3, fieldDifficulty: 9 },
      },
    };
    const next = normalizeDistrictDataState(JSON.parse(JSON.stringify(raw)));
    assert(next.useDistrictIntel === true, "useDistrictIntel should coerce to boolean");
    assert(next.dataRefs.mode === "pinned_verified", "invalid dataRefs mode should normalize to pinned_verified");
    assert(next.dataRefs.censusDatasetId === "census_2024", "census dataset id should trim");
    assert(next.dataRefs.pinnedAt === null, "invalid pinnedAt should normalize to null");
    assert(next.dataRefs.electionStrictSimilarity === true, "strict similarity should coerce to boolean");
    assert(next.dataRefs.electionMaxYearDelta === 30, "max year delta should clamp to 30");
    assert(next.dataRefs.electionMinCoveragePct === 0, "min coverage pct should clamp to 0");
    assert(next.geoPack.resolution === "tract", "invalid geo resolution should normalize to tract");
    assert(next.dataCatalog.crosswalks[0].unit === "tract", "crosswalk unit should default to tract");
    assert(next.dataCatalog.crosswalks[0].method === "area", "crosswalk method should default to area");
    assert(Array.isArray(next.geoPack.units) && next.geoPack.units.length === 2, "geo units should retain valid geoids");
    assert(next.geoPack.units[0].w >= 0 && next.geoPack.units[0].w <= 1, "geo unit weight should clamp to 0..1");
    assert(next.districtIntelPack.indices.fieldSpeed <= next.districtIntelPack.bounds.max, "fieldSpeed should clamp to bounds");
    assert(next.districtIntelPack.indices.persuasionEnv >= next.districtIntelPack.bounds.min, "persuasionEnv should clamp to bounds");
    return true;
  });

  test("Phase 18: pinned mode enforces crosswalk quality gates when district data is in use", () => {
    const scenario = withUniverseDefaults({
      scenarioName: "Quality Gate",
      raceType: "state_leg",
      electionDate: "2026-11-03",
      universeSize: 10000,
      useDistrictIntel: true,
      dataRefs: {
        mode: "pinned_verified",
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_precinct_2024",
        boundarySetId: "sldl_2024",
        crosswalkVersionId: "cw_bad",
      },
      dataCatalog: {
        boundarySets: [{ id: "sldl_2024", label: "SLDL 2024", geographyType: "SLDL" }],
        crosswalks: [{
          id: "cw_bad",
          fromBoundarySetId: "sldl_2022",
          toBoundarySetId: "sldl_2024",
          unit: "tract",
          method: "population",
          quality: {
            coveragePct: 91,
            unmatchedPct: 7,
            weightDriftPct: 2.6,
            isVerified: false
          }
        }],
        censusDatasets: [{ id: "acs5_2024", kind: "census", label: "ACS 2024", source: "acs5", vintage: "2024", boundarySetId: "sldl_2024", granularity: "tract", refreshedAt: null, hash: null, quality: { coveragePct: 99, isVerified: true } }],
        electionDatasets: [{ id: "mit_precinct_2024", kind: "election", label: "MIT 2024", source: "mit", vintage: "2024", boundarySetId: "sldl_2024", granularity: "precinct", refreshedAt: null, hash: null, quality: { coveragePct: 99, isVerified: true } }]
      },
      ui: { training: false, dark: false },
    });
    const contract = validateDistrictDataContract(scenario);
    assert(contract.ok === false, "Expected quality gates to fail in pinned_verified mode");
    const message = (contract.errors || []).join(" | ");
    assert(message.includes("not verified"), "Expected unverified crosswalk error");
    assert(message.includes("coveragePct below gate"), "Expected coverage gate error");
    assert(message.includes("unmatchedPct above gate"), "Expected unmatched gate error");
    assert(message.includes("weightDriftPct above gate"), "Expected drift gate error");
    return true;
  });

  test("Phase 18: boundary pinning requires referenced boundary set in catalog", () => {
    const scenario = withUniverseDefaults({
      scenarioName: "Boundary Pinning Gate",
      raceType: "state_leg",
      electionDate: "2026-11-03",
      universeSize: 10000,
      useDistrictIntel: true,
      dataRefs: {
        mode: "pinned_verified",
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_precinct_2024",
        boundarySetId: "sldl_2026_missing",
        crosswalkVersionId: null,
      },
      dataCatalog: {
        boundarySets: [{ id: "sldl_2024", label: "SLDL 2024", geographyType: "SLDL" }],
        crosswalks: [],
        censusDatasets: [{ id: "acs5_2024", kind: "census", label: "ACS 2024", source: "acs5", vintage: "2024", boundarySetId: "sldl_2024", granularity: "tract", refreshedAt: null, hash: null, quality: { coveragePct: 99, isVerified: true } }],
        electionDatasets: [{ id: "mit_precinct_2024", kind: "election", label: "MIT 2024", source: "mit", vintage: "2024", boundarySetId: "sldl_2024", granularity: "precinct", refreshedAt: null, hash: null, quality: { coveragePct: 99, isVerified: true } }]
      },
      ui: { training: false, dark: false },
    });
    const contract = validateDistrictDataContract(scenario);
    assert(contract.ok === false, "Expected missing boundary pin to fail contract");
    const message = (contract.errors || []).join(" | ");
    assert(message.includes("boundarySetId"), "Expected boundarySetId catalog error");
    return true;
  });

  test("Phase 18: pinned mode enforces verified + coverage gates for census/election datasets", () => {
    const scenario = withUniverseDefaults({
      scenarioName: "Dataset Quality Gate",
      raceType: "state_leg",
      electionDate: "2026-11-03",
      universeSize: 10000,
      useDistrictIntel: true,
      dataRefs: {
        mode: "pinned_verified",
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_precinct_2024",
        boundarySetId: "sldl_2024",
        crosswalkVersionId: "cw_ok",
      },
      dataCatalog: {
        boundarySets: [{ id: "sldl_2024", label: "SLDL 2024", geographyType: "SLDL" }],
        crosswalks: [{
          id: "cw_ok",
          fromBoundarySetId: "sldl_2022",
          toBoundarySetId: "sldl_2024",
          unit: "tract",
          method: "population",
          quality: {
            coveragePct: 99,
            unmatchedPct: 1,
            weightDriftPct: 0.8,
            isVerified: true
          }
        }],
        censusDatasets: [{ id: "acs5_2024", kind: "census", label: "ACS 2024", source: "acs5", vintage: "2024", boundarySetId: "sldl_2024", granularity: "tract", refreshedAt: null, hash: null, quality: { coveragePct: 93, isVerified: false } }],
        electionDatasets: [{ id: "mit_precinct_2024", kind: "election", label: "MIT 2024", source: "mit", vintage: "2024", boundarySetId: "sldl_2024", granularity: "precinct", refreshedAt: null, hash: null, quality: { coveragePct: 92, isVerified: false } }]
      },
      ui: { training: false, dark: false },
    });
    const contract = validateDistrictDataContract(scenario);
    assert(contract.ok === false, "Expected dataset quality gates to fail in pinned_verified mode");
    const message = (contract.errors || []).join(" | ");
    assert(message.includes("census dataset"), "Expected census dataset gate error");
    assert(message.includes("election dataset"), "Expected election dataset gate error");
    assert(message.includes("coveragePct below gate"), "Expected dataset coverage gate error");
    return true;
  });

  test("Phase 18: ingest manifests normalize + validate and convert to catalog entries", () => {
    const census = normalizeCensusManifest({
      id: " acs5_2024 ",
      label: "ACS 5-Year 2024",
      source: "census_acs5",
      vintage: "2024",
      boundarySetId: "sldl_2024",
      granularity: "TRACT",
      quality: { coveragePct: 97.2, isVerified: true },
      variableRefs: ["B01003_001E", "B01003_001E", " B25001_001E "],
      rowCount: 1420,
    });
    const cVal = validateCensusManifest(census);
    assert(cVal.ok, `Expected valid census manifest: ${cVal.errors.join(" | ")}`);
    assert(census.granularity === "tract", "Census granularity should normalize to tract");
    assert(census.variableRefs.length === 2, "Census variable refs should de-duplicate");

    const election = normalizeElectionManifest({
      id: "mit_precinct_2024",
      label: "MIT Precinct 2024",
      source: "mit_electionlab",
      vintage: "2024",
      electionDate: "2024-11-05",
      officeType: "us_house",
      boundarySetId: "sldl_2024",
      granularity: "PRECINCT",
      quality: { coveragePct: 96.1, isVerified: true },
      candidateIds: ["cand_a", "cand_a", "cand_b"],
      rowCount: 5500,
    });
    const eVal = validateElectionManifest(election);
    assert(eVal.ok, `Expected valid election manifest: ${eVal.errors.join(" | ")}`);
    assert(election.granularity === "precinct", "Election granularity should normalize to precinct");
    assert(election.candidateIds.length === 2, "Election candidate IDs should de-duplicate");

    const cEntry = censusManifestToCatalogEntry(census);
    const eEntry = electionManifestToCatalogEntry(election);
    assert(cEntry.kind === "census" && cEntry.id === "acs5_2024", "Census manifest should convert to catalog entry");
    assert(eEntry.kind === "election" && eEntry.id === "mit_precinct_2024", "Election manifest should convert to catalog entry");
    return true;
  });

  test("Phase 18: precinct-to-census weighted allocation preserves totals when normalized", () => {
    const joined = allocatePrecinctVotesToGeo({
      precinctResults: [
        { precinctId: "p1", totalVotes: 100, candidateVotes: { a: 60, b: 40 } },
        { precinctId: "p2", totalVotes: 50, candidateVotes: { a: 20, b: 30 } },
      ],
      crosswalkRows: [
        { precinctId: "p1", geoid: "g1", weight: 0.5 },
        { precinctId: "p1", geoid: "g2", weight: 0.5 },
        { precinctId: "p2", geoid: "g2", weight: 1.0 },
      ],
      normalizeWeights: true,
    });

    assert(joined.perGeo.length === 2, "Expected two GEO rows");
    assert(joined.reconciliation.inputVotes === 150, "Input vote total should be 150");
    assert(Math.abs(joined.reconciliation.allocatedVotes - 150) < 1e-9, "Allocated votes should reconcile to input");
    assert(joined.reconciliation.unmatchedVotes === 0, "Expected zero unmatched votes");
    assert(joined.reconciliation.coveragePct === 100, "Expected 100% coverage");
    assert((joined.warnings || []).length === 0, "Expected no allocation warnings");
    return true;
  });

  test("Phase 18: data source registry materializes deterministic latest flags", () => {
    const registry = buildDataSourceRegistry({
      version: "0.1.0",
      boundarySets: [
        { id: "sldl_2022", label: "SLDL 2022", geographyType: "SLDL", vintage: "2022", refreshedAt: "2025-01-01T00:00:00.000Z", isVerified: true },
        { id: "sldl_2024", label: "SLDL 2024", geographyType: "SLDL", vintage: "2024", refreshedAt: "2026-01-01T00:00:00.000Z", isVerified: true },
      ],
      crosswalks: [
        { id: "cw_2022_2024_a", fromBoundarySetId: "sldl_2022", toBoundarySetId: "sldl_2024", unit: "tract", method: "population", quality: { coveragePct: 97, unmatchedPct: 1, weightDriftPct: 0.5, isVerified: true }, refreshedAt: "2026-01-02T00:00:00.000Z" },
        { id: "cw_2022_2024_b", fromBoundarySetId: "sldl_2022", toBoundarySetId: "sldl_2024", unit: "tract", method: "population", quality: { coveragePct: 99, unmatchedPct: 1, weightDriftPct: 0.3, isVerified: true }, refreshedAt: "2026-02-01T00:00:00.000Z" },
      ],
      censusDatasets: [
        { id: "acs5_2022", kind: "census", label: "ACS 2022", source: "acs5", vintage: "2022", boundarySetId: "sldl_2024", granularity: "tract", quality: { coveragePct: 96, isVerified: true }, refreshedAt: "2025-01-01T00:00:00.000Z" },
        { id: "acs5_2024", kind: "census", label: "ACS 2024", source: "acs5", vintage: "2024", boundarySetId: "sldl_2024", granularity: "tract", quality: { coveragePct: 98, isVerified: true }, refreshedAt: "2026-01-01T00:00:00.000Z" },
      ],
      electionDatasets: [
        { id: "mit_2022", kind: "election", label: "MIT 2022", source: "mit", vintage: "2022", boundarySetId: "sldl_2024", granularity: "precinct", quality: { coveragePct: 96, isVerified: true }, refreshedAt: "2025-01-03T00:00:00.000Z" },
        { id: "mit_2024", kind: "election", label: "MIT 2024", source: "mit", vintage: "2024", boundarySetId: "sldl_2024", granularity: "precinct", quality: { coveragePct: 98, isVerified: true }, refreshedAt: "2026-01-03T00:00:00.000Z" },
      ],
    });

    const latestBoundary = registry.boundarySets.find((r) => r.id === "sldl_2024");
    const latestCrosswalk = registry.crosswalks.find((r) => r.id === "cw_2022_2024_b");
    const latestCensus = registry.censusDatasets.find((r) => r.id === "acs5_2024");
    const latestElection = registry.electionDatasets.find((r) => r.id === "mit_2024");
    assert(!!latestBoundary?.isLatest, "Expected newest boundary to be latest");
    assert(!!latestCrosswalk?.isLatest, "Expected newest crosswalk to be latest");
    assert(!!latestCensus?.isLatest, "Expected newest census dataset to be latest");
    assert(!!latestElection?.isLatest, "Expected newest election dataset to be latest");
    return true;
  });

  test("Phase 18: latest_verified policy resolves missing pins to latest verified entries", () => {
    const resolved = resolveDataRefsByPolicy({
      dataRefs: {
        mode: "latest_verified",
        boundarySetId: "missing_boundary",
        crosswalkVersionId: "missing_crosswalk",
        censusDatasetId: "missing_census",
        electionDatasetId: "missing_election",
      },
      dataCatalog: {
        boundarySets: [
          { id: "sldl_2024", label: "SLDL 2024", geographyType: "SLDL", vintage: "2024", isVerified: true, isLatest: true },
        ],
        crosswalks: [
          { id: "cw_2022_2024", fromBoundarySetId: "sldl_2022", toBoundarySetId: "sldl_2024", unit: "tract", method: "population", isLatest: true, quality: { coveragePct: 99, unmatchedPct: 1, weightDriftPct: 0.1, isVerified: true } },
        ],
        censusDatasets: [
          { id: "acs5_2024", kind: "census", label: "ACS 2024", source: "acs5", vintage: "2024", boundarySetId: "sldl_2024", granularity: "tract", isLatest: true, quality: { coveragePct: 98, isVerified: true } },
        ],
        electionDatasets: [
          { id: "mit_2024", kind: "election", label: "MIT 2024", source: "mit", vintage: "2024", boundarySetId: "sldl_2024", granularity: "precinct", isLatest: true, quality: { coveragePct: 98, isVerified: true } },
        ],
      },
    });

    assert(resolved.mode === "latest_verified", "Expected latest_verified mode");
    assert(resolved.selected.boundarySetId === "sldl_2024", "Expected fallback to latest boundary");
    assert(resolved.selected.crosswalkVersionId === "cw_2022_2024", "Expected fallback to latest crosswalk");
    assert(resolved.selected.censusDatasetId === "acs5_2024", "Expected fallback to latest census dataset");
    assert(resolved.selected.electionDatasetId === "mit_2024", "Expected fallback to latest election dataset");
    assert(resolved.usedFallbacks === true, "Expected fallback marker in latest_verified mode");
    assert((resolved.notes || []).length >= 1, "Expected fallback notes");
    return true;
  });

  test("Phase 18: pinned/manual policies do not rewrite explicit missing refs", () => {
    const pinned = resolveDataRefsByPolicy({
      dataRefs: {
        mode: "pinned_verified",
        boundarySetId: "missing_boundary",
        crosswalkVersionId: "missing_crosswalk",
        censusDatasetId: "missing_census",
        electionDatasetId: "missing_election",
      },
      dataCatalog: {
        boundarySets: [],
        crosswalks: [],
        censusDatasets: [],
        electionDatasets: [],
      },
    });
    const manual = resolveDataRefsByPolicy({
      dataRefs: {
        mode: "manual",
        boundarySetId: "missing_boundary",
        crosswalkVersionId: "missing_crosswalk",
        censusDatasetId: "missing_census",
        electionDatasetId: "missing_election",
      },
      dataCatalog: {
        boundarySets: [],
        crosswalks: [],
        censusDatasets: [],
        electionDatasets: [],
      },
    });
    assert(pinned.selected.boundarySetId === "missing_boundary", "Pinned mode should preserve explicit boundary ref");
    assert(pinned.selected.crosswalkVersionId === "missing_crosswalk", "Pinned mode should preserve explicit crosswalk ref");
    assert(pinned.selected.censusDatasetId === "missing_census", "Pinned mode should preserve explicit census ref");
    assert(pinned.selected.electionDatasetId === "missing_election", "Pinned mode should preserve explicit election ref");
    assert(pinned.usedFallbacks === false, "Pinned mode should not auto-fallback");
    assert((pinned.notes || []).length >= 1, "Pinned mode should emit missing-ref notes");
    assert(manual.selected.boundarySetId === "missing_boundary", "Manual mode should preserve explicit boundary ref");
    assert(manual.selected.crosswalkVersionId === "missing_crosswalk", "Manual mode should preserve explicit crosswalk ref");
    assert(manual.selected.censusDatasetId === "missing_census", "Manual mode should preserve explicit census ref");
    assert(manual.selected.electionDatasetId === "missing_election", "Manual mode should preserve explicit election ref");
    assert(manual.usedFallbacks === false, "Manual mode should not auto-fallback");
    return true;
  });

  test("Phase 18: area resolver normalization canonicalizes IDs and resolution", () => {
    const area = normalizeAreaSelection({
      type: "sldl",
      stateFips: "3",
      district: "7",
      countyFips: "31",
      placeFips: "29",
      resolution: "BLOCK_GROUP",
      boundarySetId: " sldl_2024 ",
      boundaryVintage: " 2024 ",
    });
    assert(area.type === "SLDL", "Area type should normalize to uppercase enum");
    assert(area.stateFips === "03", "State FIPS should pad to 2 digits");
    assert(area.district === "007", "District should pad to 3 digits");
    assert(area.countyFips === "031", "County FIPS should normalize/pad");
    assert(area.placeFips === "00029", "Place FIPS should pad to 5 digits");
    assert(area.resolution === "block_group", "Resolution should normalize to block_group");
    assert(area.boundarySetId === "sldl_2024", "Boundary set id should trim");
    assert(area.boundaryVintage === "2024", "Boundary vintage should trim");
    return true;
  });

  test("Phase 18: area resolver cache key is deterministic and sensitive to boundary vintage/resolution", () => {
    const keyA = buildAreaResolverCacheKey({
      area: {
        type: "SLDL",
        stateFips: "34",
        district: "012",
        boundarySetId: "sldl_2024",
        boundaryVintage: "2024",
        resolution: "tract",
      }
    });
    const keyB = buildAreaResolverCacheKey({
      area: {
        type: "SLDL",
        stateFips: "34",
        district: "012",
        boundarySetId: "sldl_2024",
        boundaryVintage: "2024",
        resolution: "tract",
      }
    });
    const keyDifferentVintage = buildAreaResolverCacheKey({
      area: {
        type: "SLDL",
        stateFips: "34",
        district: "012",
        boundarySetId: "sldl_2024",
        boundaryVintage: "2026",
        resolution: "tract",
      }
    });
    const keyDifferentResolution = buildAreaResolverCacheKey({
      area: {
        type: "SLDL",
        stateFips: "34",
        district: "012",
        boundarySetId: "sldl_2024",
        boundaryVintage: "2024",
        resolution: "block_group",
      }
    });
    assert(keyA === keyB, "Expected deterministic area resolver key for identical inputs");
    assert(keyA !== keyDifferentVintage, "Expected area resolver key to change with boundary vintage");
    assert(keyA !== keyDifferentResolution, "Expected area resolver key to change with resolution");
    return true;
  });

  test("Phase 18: derived area resolver context uses boundary vintage from registry", () => {
    const ctxOut = deriveAreaResolverContext({
      scenario: {
        dataRefs: { boundarySetId: "sldl_2024" },
        geoPack: {
          area: { type: "SLDL", stateFips: "34", district: "12", label: "NJ LD12" },
          resolution: "tract",
        },
      },
      registry: {
        byId: {
          boundarySets: {
            sldl_2024: { id: "sldl_2024", vintage: "2024" },
          },
        },
      },
    });
    assert(ctxOut.area.boundarySetId === "sldl_2024", "Expected derived area boundary set from refs");
    assert(ctxOut.area.boundaryVintage === "2024", "Expected derived boundary vintage from registry");
    assert(typeof ctxOut.cacheKey === "string" && ctxOut.cacheKey.includes("vintage=2024"), "Expected cache key with boundary vintage");
    return true;
  });

  test("Phase 18: area resolver flags boundary vintage mismatch and uses registry vintage", () => {
    const ctxOut = deriveAreaResolverContext({
      scenario: {
        dataRefs: { boundarySetId: "sldl_2024" },
        geoPack: {
          boundarySetId: "sldl_2024",
          source: { vintage: "2022" },
          area: { type: "SLDL", stateFips: "34", district: "12" },
          resolution: "tract",
        },
      },
      registry: {
        byId: {
          boundarySets: {
            sldl_2024: { id: "sldl_2024", vintage: "2024" },
          },
        },
      },
    });
    assert(ctxOut.area.boundaryVintage === "2024", "Expected registry vintage to win on mismatch");
    assert(Array.isArray(ctxOut.notes) && ctxOut.notes.some((x) => String(x).toLowerCase().includes("mismatch")), "Expected mismatch note");
    return true;
  });

  test("Phase 18: area resolver context cache key preserves block-group resolution identity", () => {
    const ctxOut = deriveAreaResolverContext({
      scenario: {
        dataRefs: { boundarySetId: "county_2024" },
        geoPack: {
          boundarySetId: "county_2024",
          area: { type: "COUNTY", stateFips: "34", countyFips: "013" },
          resolution: "block_group",
        },
      },
      registry: {
        byId: {
          boundarySets: {
            county_2024: { id: "county_2024", vintage: "2024" },
          },
        },
      },
    });
    assert(ctxOut.area.type === "COUNTY", "Expected county area type in resolver context");
    assert(ctxOut.area.resolution === "block_group", "Expected block_group resolution in resolver context");
    assert(typeof ctxOut.cacheKey === "string" && ctxOut.cacheKey.includes("resolution=block_group"), "Expected cache key resolution component");
    assert(ctxOut.cacheKey.includes("id=013"), "Expected county identity token in cache key");
    return true;
  });

  test("Phase 18: latest_verified resolution can be materialized to pinned refs", () => {
    const pinned = materializePinnedDataRefs({
      dataRefs: {
        mode: "latest_verified",
        boundarySetId: "missing_boundary",
        crosswalkVersionId: "missing_crosswalk",
        censusDatasetId: "missing_census",
        electionDatasetId: "missing_election",
      },
      dataCatalog: {
        boundarySets: [
          { id: "sldl_2024", label: "SLDL 2024", geographyType: "SLDL", vintage: "2024", isVerified: true, isLatest: true },
        ],
        crosswalks: [
          { id: "cw_2022_2024", fromBoundarySetId: "sldl_2022", toBoundarySetId: "sldl_2024", unit: "tract", method: "population", isLatest: true, quality: { coveragePct: 99, unmatchedPct: 1, weightDriftPct: 0.1, isVerified: true } },
        ],
        censusDatasets: [
          { id: "acs5_2024", kind: "census", label: "ACS 2024", source: "acs5", vintage: "2024", boundarySetId: "sldl_2024", granularity: "tract", isLatest: true, quality: { coveragePct: 98, isVerified: true } },
        ],
        electionDatasets: [
          { id: "mit_2024", kind: "election", label: "MIT 2024", source: "mit", vintage: "2024", boundarySetId: "sldl_2024", granularity: "precinct", isLatest: true, quality: { coveragePct: 98, isVerified: true } },
        ],
      },
      nowIso: "2026-03-07T08:00:00.000Z",
    });
    assert(pinned.dataRefs.mode === "pinned_verified", "Expected latest_verified to materialize as pinned_verified");
    assert(pinned.dataRefs.boundarySetId === "sldl_2024", "Expected pinned boundary selection");
    assert(pinned.dataRefs.crosswalkVersionId === "cw_2022_2024", "Expected pinned crosswalk selection");
    assert(pinned.dataRefs.censusDatasetId === "acs5_2024", "Expected pinned census selection");
    assert(pinned.dataRefs.electionDatasetId === "mit_2024", "Expected pinned election selection");
    assert(pinned.dataRefs.pinnedAt === "2026-03-07T08:00:00.000Z", "Expected pinnedAt timestamp from materialization call");
    assert(pinned.changed === true, "Expected materialization to report changed=true");
    return true;
  });

  test("Phase 20: election dataset compatibility scoring prefers similar office/race and nearby cycle", () => {
    const scoreA = scoreElectionDatasetCompatibility({
      dataset: {
        id: "mit_cd_2024",
        boundarySetId: "cd_2024",
        officeType: "us_house",
        raceType: "federal",
        electionDate: "2024-11-05",
        coveragePct: 98,
        isLatest: true,
        isVerified: true,
      },
      scenario: {
        raceType: "federal",
        electionDate: "2026-11-03",
        geoPack: { area: { type: "CD" } },
      },
      boundarySetId: "cd_2024",
      requireVerified: true,
    });
    const scoreB = scoreElectionDatasetCompatibility({
      dataset: {
        id: "mit_sldl_2024",
        boundarySetId: "cd_2024",
        officeType: "state_house",
        raceType: "state_leg",
        electionDate: "2024-11-05",
        coveragePct: 99,
        isLatest: false,
        isVerified: true,
      },
      scenario: {
        raceType: "federal",
        electionDate: "2026-11-03",
        geoPack: { area: { type: "CD" } },
      },
      boundarySetId: "cd_2024",
      requireVerified: true,
    });
    assert(scoreA.eligible === true && scoreB.eligible === true, "Expected both datasets eligible");
    assert(scoreA.score > scoreB.score, "Expected federal/us_house dataset to outrank state_house dataset for CD federal scenario");
    assert(Array.isArray(scoreA.reasons) && scoreA.reasons.includes("office_exact_match"), "Expected office_exact_match reason");
    return true;
  });

  test("Phase 20: latest_verified election fallback uses compatibility ranking before latest flag", () => {
    const catalog = {
      boundarySets: [
        { id: "sldl_2024", label: "SLDL 2024", geographyType: "SLDL", vintage: "2024", isVerified: true, isLatest: true },
      ],
      crosswalks: [
        { id: "cw_2022_2024", fromBoundarySetId: "sldl_2022", toBoundarySetId: "sldl_2024", unit: "tract", method: "population", isLatest: true, quality: { coveragePct: 99, unmatchedPct: 1, weightDriftPct: 0.1, isVerified: true } },
      ],
      censusDatasets: [
        { id: "acs5_2024", kind: "census", label: "ACS 2024", source: "acs5", vintage: "2024", boundarySetId: "sldl_2024", granularity: "tract", isLatest: true, quality: { coveragePct: 98, isVerified: true } },
      ],
      electionDatasets: [
        { id: "mit_us_house_2024", kind: "election", label: "MIT US House 2024", source: "mit", vintage: "2024", electionDate: "2024-11-05", officeType: "us_house", raceType: "federal", boundarySetId: "sldl_2024", granularity: "precinct", isLatest: true, quality: { coveragePct: 99, isVerified: true } },
        { id: "mit_state_house_2022", kind: "election", label: "MIT State House 2022", source: "mit", vintage: "2022", electionDate: "2022-11-08", officeType: "state_house", raceType: "state_leg", boundarySetId: "sldl_2024", granularity: "precinct", isLatest: false, quality: { coveragePct: 97, isVerified: true } },
      ],
    };
    const ranked = rankElectionDatasetsForScenario({
      dataCatalog: catalog,
      scenario: {
        raceType: "state_leg",
        electionDate: "2026-11-03",
        geoPack: { area: { type: "SLDL" } },
      },
      boundarySetId: "sldl_2024",
      requireVerified: true,
    });
    assert(Array.isArray(ranked) && ranked.length === 2, "Expected both election datasets ranked");
    assert(ranked[0].dataset?.id === "mit_state_house_2022", "Expected similar-race state_house dataset to rank above latest federal dataset");

    const resolved = resolveDataRefsByPolicy({
      dataRefs: {
        mode: "latest_verified",
        boundarySetId: "sldl_2024",
        crosswalkVersionId: "cw_2022_2024",
        censusDatasetId: "acs5_2024",
        electionDatasetId: null,
      },
      dataCatalog: catalog,
      scenario: {
        raceType: "state_leg",
        electionDate: "2026-11-03",
        geoPack: { area: { type: "SLDL" } },
      },
    });
    assert(resolved.selected.electionDatasetId === "mit_state_house_2022", "Expected policy resolver to pick compatibility-ranked election dataset");
    return true;
  });

  test("Phase 20: election compatibility filters narrow candidates by similarity, year gap, and coverage", () => {
    const catalog = {
      boundarySets: [
        { id: "sldl_2024", label: "SLDL 2024", geographyType: "SLDL", vintage: "2024", isVerified: true, isLatest: true },
      ],
      crosswalks: [],
      censusDatasets: [],
      electionDatasets: [
        { id: "mit_state_house_2022", kind: "election", label: "MIT State House 2022", source: "mit", vintage: "2022", electionDate: "2022-11-08", officeType: "state_house", raceType: "state_leg", boundarySetId: "sldl_2024", granularity: "precinct", isLatest: false, quality: { coveragePct: 97, isVerified: true } },
        { id: "mit_state_house_2014", kind: "election", label: "MIT State House 2014", source: "mit", vintage: "2014", electionDate: "2014-11-04", officeType: "state_house", raceType: "state_leg", boundarySetId: "sldl_2024", granularity: "precinct", isLatest: false, quality: { coveragePct: 98, isVerified: true } },
        { id: "mit_state_senate_2022", kind: "election", label: "MIT State Senate 2022", source: "mit", vintage: "2022", electionDate: "2022-11-08", officeType: "state_senate", raceType: "state_leg", boundarySetId: "sldl_2024", granularity: "precinct", isLatest: true, quality: { coveragePct: 97, isVerified: true } },
        { id: "mit_state_house_2022_low_cov", kind: "election", label: "MIT State House 2022 low coverage", source: "mit", vintage: "2022", electionDate: "2022-11-08", officeType: "state_house", raceType: "state_leg", boundarySetId: "sldl_2024", granularity: "precinct", isLatest: false, quality: { coveragePct: 72, isVerified: true } },
      ],
    };

    const ranked = rankElectionDatasetsForScenario({
      dataCatalog: catalog,
      scenario: {
        raceType: "state_leg",
        electionDate: "2026-11-03",
        geoPack: { area: { type: "SLDL" } },
      },
      boundarySetId: "sldl_2024",
      requireVerified: true,
      filters: {
        strictSimilarity: true,
        maxYearDelta: 6,
        minCoveragePct: 90,
      },
    });
    assert(Array.isArray(ranked) && ranked.length === 1, "Expected filters to narrow ranking to one compatible dataset");
    assert(ranked[0].dataset?.id === "mit_state_house_2022", "Expected filtered ranking to keep only similar, recent, high-coverage dataset");
    assert(Number(ranked[0].yearGap) === 4, "Expected yearGap metadata on ranked row");
    assert(Number(ranked[0].coveragePct) === 97, "Expected coveragePct metadata on ranked row");

    const resolved = resolveDataRefsByPolicy({
      dataRefs: {
        mode: "latest_verified",
        boundarySetId: "sldl_2024",
        electionDatasetId: null,
        electionStrictSimilarity: true,
        electionMaxYearDelta: 6,
        electionMinCoveragePct: 90,
      },
      dataCatalog: catalog,
      scenario: {
        raceType: "state_leg",
        electionDate: "2026-11-03",
        geoPack: { area: { type: "SLDL" } },
      },
    });
    assert(resolved.selected.electionDatasetId === "mit_state_house_2022", "Expected policy resolver to honor election compatibility filters");
    return true;
  });

  test("Phase 20: data-ref alignment diagnostics flags boundary mismatch and large year gap", () => {
    const catalog = {
      boundarySets: [
        { id: "sldl_2024", label: "SLDL 2024", geographyType: "SLDL", vintage: "2024", isVerified: true, isLatest: true },
      ],
      crosswalks: [
        { id: "cw_other", fromBoundarySetId: "sldl_2018", toBoundarySetId: "sldl_2018", unit: "tract", method: "population", isLatest: true, quality: { coveragePct: 99, unmatchedPct: 1, weightDriftPct: 0.1, isVerified: true } },
      ],
      censusDatasets: [
        { id: "acs5_2024", kind: "census", label: "ACS 2024", source: "acs5", vintage: "2024", boundarySetId: "sldl_2024", granularity: "tract", isLatest: true, quality: { coveragePct: 98, isVerified: true } },
      ],
      electionDatasets: [
        { id: "mit_state_house_2016", kind: "election", label: "MIT State House 2016", source: "mit", vintage: "2016", electionDate: "2016-11-08", officeType: "state_house", raceType: "state_leg", boundarySetId: "sldl_2024", granularity: "precinct", isLatest: true, quality: { coveragePct: 96, isVerified: true } },
      ],
    };

    const diag = diagnoseDataRefAlignment({
      dataRefs: {
        mode: "manual",
        boundarySetId: "sldl_2024",
        crosswalkVersionId: "cw_other",
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_state_house_2016",
        electionMaxYearDelta: 4,
      },
      dataCatalog: catalog,
      scenario: {
        raceType: "state_leg",
        electionDate: "2026-11-03",
        geoPack: { area: { type: "SLDL" } },
      },
    });

    assert(diag.status === "warn", "Expected warn status for alignment issues");
    assert(Array.isArray(diag.warnings) && diag.warnings.length >= 1, "Expected alignment warnings");
    assert(diag.warnings.some((x) => String(x).includes("does not reference boundary set")), "Expected boundary-crosswalk mismatch warning");
    assert(diag.warnings.some((x) => String(x).includes("exceeds filter")), "Expected year-gap warning");
    assert(Number(diag.details?.electionYearGap) === 10, "Expected computed election year gap");
    return true;
  });

  test("Phase 20: data-ref alignment diagnostics computes age-days and stale warnings", () => {
    const catalog = {
      boundarySets: [
        { id: "sldl_2024", label: "SLDL 2024", geographyType: "SLDL", vintage: "2024", refreshedAt: "2025-01-01T00:00:00.000Z", isVerified: true, isLatest: true },
      ],
      crosswalks: [
        { id: "cw_2024", fromBoundarySetId: "sldl_2022", toBoundarySetId: "sldl_2024", unit: "tract", method: "population", refreshedAt: "2025-01-15T00:00:00.000Z", isLatest: true, quality: { coveragePct: 99, unmatchedPct: 1, weightDriftPct: 0.1, isVerified: true } },
      ],
      censusDatasets: [
        { id: "acs5_2024", kind: "census", label: "ACS 2024", source: "acs5", vintage: "2024", boundarySetId: "sldl_2024", granularity: "tract", refreshedAt: "2024-12-01T00:00:00.000Z", isLatest: true, quality: { coveragePct: 98, isVerified: true } },
      ],
      electionDatasets: [
        { id: "mit_state_house_2024", kind: "election", label: "MIT State House 2024", source: "mit", vintage: "2024", electionDate: "2024-11-05", officeType: "state_house", raceType: "state_leg", boundarySetId: "sldl_2024", granularity: "precinct", refreshedAt: "2024-11-20T00:00:00.000Z", isLatest: true, quality: { coveragePct: 96, isVerified: true } },
      ],
    };
    const diag = diagnoseDataRefAlignment({
      dataRefs: {
        mode: "latest_verified",
        boundarySetId: "sldl_2024",
        crosswalkVersionId: "cw_2024",
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_state_house_2024",
      },
      dataCatalog: catalog,
      scenario: {
        raceType: "state_leg",
        electionDate: "2026-11-03",
        geoPack: { area: { type: "SLDL" } },
      },
      nowIso: "2027-12-31T00:00:00.000Z",
    });
    assert(Array.isArray(diag.warnings) && diag.warnings.some((x) => String(x).includes("stale")), "Expected stale-age warning");
    assert(Number(diag.details?.selectedMeta?.election?.ageDays) > 700, "Expected election age-days metadata");
    assert(Number(diag.details?.selectedMeta?.census?.ageDays) > 700, "Expected census age-days metadata");
    return true;
  });

  test("Phase 21: auto-pull URL plan resolves latest_verified refs deterministically", () => {
    const catalog = {
      boundarySets: [
        { id: "sldl_2024", label: "SLDL 2024", geographyType: "SLDL", isVerified: true, isLatest: true },
      ],
      crosswalks: [
        { id: "cw_2024", fromBoundarySetId: "sldl_2022", toBoundarySetId: "sldl_2024", unit: "tract", method: "population", rowsUrl: "https://example.test/crosswalk-2024.json", quality: { coveragePct: 99, unmatchedPct: 1, weightDriftPct: 0.1, isVerified: true }, isLatest: true },
      ],
      censusDatasets: [
        { id: "acs5_2024", kind: "census", label: "ACS 2024", boundarySetId: "sldl_2024", manifestUrl: "https://example.test/acs5-2024-manifest.json", rowsUrl: "https://example.test/acs5-2024-rows.json", quality: { coveragePct: 98, isVerified: true }, isLatest: true },
      ],
      electionDatasets: [
        { id: "mit_2024", kind: "election", label: "MIT 2024", boundarySetId: "sldl_2024", electionDate: "2024-11-05", officeType: "state_house", raceType: "state_leg", manifestUrl: "https://example.test/mit-2024-manifest.json", rowsUrl: "https://example.test/mit-2024-rows.json", quality: { coveragePct: 97, isVerified: true }, isLatest: true },
      ],
    };
    const plan = buildAutoPullUrlPlan({
      dataRefs: { mode: "latest_verified" },
      dataCatalog: catalog,
      scenario: { raceType: "state_leg", electionDate: "2026-11-03", geoPack: { area: { type: "SLDL" } } },
      resolveDataRefsByPolicy,
    });
    assert(plan.mode === "latest_verified", "Expected latest_verified mode in auto-pull plan");
    assert(plan.selected.censusDatasetId === "acs5_2024", "Expected latest census id in selected refs");
    assert(plan.selected.electionDatasetId === "mit_2024", "Expected latest election id in selected refs");
    assert(plan.urls.censusManifestUrl === "https://example.test/acs5-2024-manifest.json", "Expected census manifest URL from dataset metadata");
    assert(plan.urls.precinctResultsUrl === "https://example.test/mit-2024-rows.json", "Expected precinct rows URL from election metadata");
    assert(plan.availableCount === 5, "Expected all five auto-pull URLs available");
    return true;
  });

  test("Phase 21: auto-pull URL plan reports deterministic missing-url notes", () => {
    const plan = buildAutoPullUrlPlan({
      dataRefs: {
        mode: "pinned_verified",
        boundarySetId: "sldl_2024",
        crosswalkVersionId: "cw_2024",
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_2024",
      },
      dataCatalog: {
        boundarySets: [{ id: "sldl_2024", label: "SLDL 2024", geographyType: "SLDL", isVerified: true, isLatest: true }],
        crosswalks: [{ id: "cw_2024", fromBoundarySetId: "sldl_2022", toBoundarySetId: "sldl_2024", unit: "tract", method: "population", quality: { coveragePct: 99, unmatchedPct: 1, weightDriftPct: 0.1, isVerified: true }, isLatest: true }],
        censusDatasets: [{ id: "acs5_2024", kind: "census", label: "ACS 2024", boundarySetId: "sldl_2024", quality: { coveragePct: 98, isVerified: true }, isLatest: true }],
        electionDatasets: [{ id: "mit_2024", kind: "election", label: "MIT 2024", boundarySetId: "sldl_2024", electionDate: "2024-11-05", officeType: "state_house", raceType: "state_leg", quality: { coveragePct: 97, isVerified: true }, isLatest: true }],
      },
      scenario: { raceType: "state_leg", electionDate: "2026-11-03", geoPack: { area: { type: "SLDL" } } },
      resolveDataRefsByPolicy,
    });
    assert(plan.availableCount === 0, "Expected no URLs when metadata has no URL fields");
    assert(plan.missingCount === 5, "Expected five missing URL slots");
    assert(Array.isArray(plan.notes) && plan.notes.length >= 4, "Expected missing URL notes");
    assert(plan.notes.some((x) => String(x).includes("No census manifest URL")), "Expected census missing URL note");
    return true;
  });

  test("Phase 21: data catalog normalization preserves URL metadata for auto-pull", () => {
    const catalog = normalizeDataCatalog({
      boundarySets: [{ id: "sldl_2024", label: "SLDL 2024", geographyType: "SLDL", isVerified: true, isLatest: true }],
      crosswalks: [{
        id: "cw_2024",
        fromBoundarySetId: "sldl_2022",
        toBoundarySetId: "sldl_2024",
        unit: "tract",
        method: "population",
        rowsUrl: "https://example.test/crosswalk-2024-rows.json",
        quality: { coveragePct: 99, unmatchedPct: 1, weightDriftPct: 0.1, isVerified: true },
        isLatest: true,
      }],
      censusDatasets: [{
        id: "acs5_2024",
        label: "ACS 2024",
        source: "acs5",
        boundarySetId: "sldl_2024",
        granularity: "tract",
        manifestUrl: "https://example.test/acs5-2024-manifest.json",
        rowsUrl: "https://example.test/acs5-2024-rows.json",
        quality: { coveragePct: 98, isVerified: true },
        isLatest: true,
      }],
      electionDatasets: [{
        id: "mit_2024",
        label: "MIT 2024",
        source: "mit",
        boundarySetId: "sldl_2024",
        electionDate: "2024-11-05",
        officeType: "state_house",
        raceType: "state_leg",
        granularity: "precinct",
        manifestUrl: "https://example.test/mit-2024-manifest.json",
        rowsUrl: "https://example.test/mit-2024-rows.json",
        quality: { coveragePct: 97, isVerified: true },
        isLatest: true,
      }],
    });
    assert(catalog.crosswalks[0]?.rowsUrl === "https://example.test/crosswalk-2024-rows.json", "Expected crosswalk rowsUrl to persist through normalization");
    assert(catalog.censusDatasets[0]?.manifestUrl === "https://example.test/acs5-2024-manifest.json", "Expected census manifestUrl to persist through normalization");
    assert(catalog.censusDatasets[0]?.rowsUrl === "https://example.test/acs5-2024-rows.json", "Expected census rowsUrl to persist through normalization");
    assert(catalog.electionDatasets[0]?.manifestUrl === "https://example.test/mit-2024-manifest.json", "Expected election manifestUrl to persist through normalization");
    assert(catalog.electionDatasets[0]?.rowsUrl === "https://example.test/mit-2024-rows.json", "Expected election rowsUrl to persist through normalization");
    return true;
  });

  test("Phase 21: auto-pull receipt summarizes deterministic run outcomes", () => {
    const receipt = createAutoPullReceipt({
      nowIso: "2026-03-07T12:00:00.000Z",
      mode: "latest_verified",
      selected: {
        boundarySetId: "sldl_2024",
        crosswalkVersionId: "cw_2024",
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_2024",
      },
      urls: {
        censusManifestUrl: "https://example.test/acs5-2024-manifest.json",
        electionManifestUrl: "https://example.test/mit-2024-manifest.json",
        crosswalkRowsUrl: "https://example.test/cw-2024-rows.json",
        precinctResultsUrl: "https://example.test/mit-2024-rows.json",
        censusGeoRowsUrl: "https://example.test/acs5-2024-rows.json",
      },
      results: [
        { source: "Census manifest", url: "https://example.test/acs5-2024-manifest.json", ok: true, message: "ok" },
        { source: "Election manifest", url: "https://example.test/mit-2024-manifest.json", ok: false, message: "HTTP 404" },
      ],
    });
    assert(receipt.status === "warn", "Expected warn status for mixed success/failure");
    assert(receipt.requestedCount === 2, "Expected requested count in receipt");
    assert(receipt.successCount === 1, "Expected success count in receipt");
    assert(receipt.warningCount === 1, "Expected warning count in receipt");
    assert(typeof receipt.fingerprint === "string" && receipt.fingerprint.length > 10, "Expected deterministic fingerprint string");
    const line = summarizeAutoPullReceipt(receipt);
    assert(String(line).includes("imported 1/2"), "Expected summary line to include imported ratio");
    return true;
  });

  test("Phase 21: auto-pull plan evaluator reports ready/warn states deterministically", () => {
    const readyEval = evaluateAutoPullPlan({
      mode: "latest_verified",
      urls: {
        censusManifestUrl: "https://example.test/census-manifest.json",
        electionManifestUrl: "https://example.test/election-manifest.json",
        crosswalkRowsUrl: "https://example.test/crosswalk-rows.json",
        precinctResultsUrl: "https://example.test/precinct-rows.json",
        censusGeoRowsUrl: "https://example.test/census-rows.json",
      },
    });
    assert(readyEval.ready === true, "Expected ready=true when all URLs are present");
    assert(readyEval.status === "ok", "Expected ok status when all URL slots are present");
    assert(readyEval.availableCount === 5, "Expected full available URL slot count");

    const partialEval = evaluateAutoPullPlan({
      mode: "pinned_verified",
      urls: {
        censusManifestUrl: "https://example.test/census-manifest.json",
      },
    });
    assert(partialEval.ready === true, "Expected ready=true when at least one URL exists");
    assert(partialEval.status === "warn", "Expected warn status when some slots are missing");
    assert(partialEval.missingKeys.includes("electionManifestUrl"), "Expected deterministic missing key list");
    return true;
  });

  test("Phase 21: auto-pull URL resolver prioritizes manual overrides and falls back to plan", () => {
    const merged = resolveAutoPullUrls({
      plan: {
        mode: "latest_verified",
        urls: {
          censusManifestUrl: "https://example.test/plan-census-manifest.json",
          electionManifestUrl: "https://example.test/plan-election-manifest.json",
          crosswalkRowsUrl: "https://example.test/plan-crosswalk-rows.json",
          precinctResultsUrl: "https://example.test/plan-precinct-rows.json",
          censusGeoRowsUrl: "https://example.test/plan-census-rows.json",
        },
      },
      overrides: {
        electionManifestUrl: "https://example.test/manual-election-manifest.json",
        precinctResultsUrl: "notaurl",
      },
    });
    assert(merged.mode === "latest_verified", "Expected merged mode from plan");
    assert(merged.urls.electionManifestUrl === "https://example.test/manual-election-manifest.json", "Expected valid manual override to win");
    assert(merged.urls.precinctResultsUrl === "https://example.test/plan-precinct-rows.json", "Expected invalid manual override to fall back to plan");
    assert(merged.sourceByKey.electionManifestUrl === "override", "Expected override source marker");
    assert(merged.sourceByKey.precinctResultsUrl === "plan", "Expected plan source marker after fallback");
    assert(merged.availableCount === 5 && merged.missingCount === 0, "Expected all URL slots available after merge");
    return true;
  });

  test("Phase 21: auto-pull fingerprint is deterministic for normalized identity", () => {
    const fpA = buildAutoPullPlanFingerprint({
      mode: "LATEST_VERIFIED",
      selected: {
        boundarySetId: " sldl_2024 ",
        crosswalkVersionId: " cw_2024 ",
        censusDatasetId: " acs5_2024 ",
        electionDatasetId: " mit_2024 ",
      },
      urls: {
        electionManifestUrl: "https://example.test/election.json",
        censusManifestUrl: "https://example.test/census.json",
        precinctResultsUrl: "https://example.test/precinct-rows.json",
        censusGeoRowsUrl: "https://example.test/census-rows.json",
        crosswalkRowsUrl: "https://example.test/crosswalk-rows.json",
      },
    });
    const fpB = buildAutoPullPlanFingerprint({
      mode: "latest_verified",
      selected: {
        electionDatasetId: "mit_2024",
        censusDatasetId: "acs5_2024",
        crosswalkVersionId: "cw_2024",
        boundarySetId: "sldl_2024",
      },
      urls: {
        crosswalkRowsUrl: "https://example.test/crosswalk-rows.json",
        censusGeoRowsUrl: "https://example.test/census-rows.json",
        precinctResultsUrl: "https://example.test/precinct-rows.json",
        censusManifestUrl: "https://example.test/census.json",
        electionManifestUrl: "https://example.test/election.json",
      },
    });
    assert(fpA === fpB, "Expected deterministic fingerprint for normalized equivalent identity");
    return true;
  });

  test("Phase 21: auto-pull receipt alignment reports current and stale deterministically", () => {
    const receipt = createAutoPullReceipt({
      nowIso: "2026-03-07T12:00:00.000Z",
      mode: "latest_verified",
      selected: {
        boundarySetId: "sldl_2024",
        crosswalkVersionId: "cw_2024",
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_2024",
      },
      urls: {
        censusManifestUrl: "https://example.test/census-manifest.json",
        electionManifestUrl: "https://example.test/election-manifest.json",
        crosswalkRowsUrl: "https://example.test/crosswalk-rows.json",
        precinctResultsUrl: "https://example.test/precinct-rows.json",
        censusGeoRowsUrl: "https://example.test/census-rows.json",
      },
      results: [{ source: "Census manifest", url: "https://example.test/census-manifest.json", ok: true, message: "ok" }],
    });
    const current = assessAutoPullReceiptAlignment({
      receipt,
      mode: "latest_verified",
      selected: receipt.selected,
      urls: receipt.urls,
    });
    assert(current.aligned === true, "Expected aligned receipt for matching refs/URLs");
    assert(current.status === "ok", "Expected ok status for aligned receipt");
    const stale = assessAutoPullReceiptAlignment({
      receipt,
      mode: "latest_verified",
      selected: receipt.selected,
      urls: {
        ...receipt.urls,
        electionManifestUrl: "https://example.test/election-manifest-v2.json",
      },
    });
    assert(stale.aligned === false, "Expected stale alignment when URLs drift");
    assert(stale.status === "warn", "Expected warn status when refs/URLs drift");
    return true;
  });

  test("Phase 21: auto-pull receipt alignment warns on legacy receipts without plan fingerprint", () => {
    const legacyReceipt = {
      ts: "2026-03-07T12:00:00.000Z",
      mode: "latest_verified",
      selected: {
        boundarySetId: "sldl_2024",
        crosswalkVersionId: "cw_2024",
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_2024",
      },
      urls: {
        censusManifestUrl: "https://example.test/census-manifest.json",
        electionManifestUrl: "https://example.test/election-manifest.json",
        crosswalkRowsUrl: "https://example.test/crosswalk-rows.json",
        precinctResultsUrl: "https://example.test/precinct-rows.json",
        censusGeoRowsUrl: "https://example.test/census-rows.json",
      },
      requestedCount: 1,
      successCount: 1,
      warningCount: 0,
      warnings: [],
      status: "ok",
      fingerprint: "legacy",
    };
    const aligned = assessAutoPullReceiptAlignment({
      receipt: legacyReceipt,
      mode: "latest_verified",
      selected: legacyReceipt.selected,
      urls: legacyReceipt.urls,
    });
    assert(aligned.aligned === false, "Expected non-aligned status for legacy receipt");
    assert(aligned.status === "warn", "Expected warn status for legacy receipt");
    assert(String(aligned.summaryLine).includes("missing plan fingerprint"), "Expected missing-fingerprint warning summary");
    return true;
  });

  test("Phase 21: auto-pull run-need evaluator returns no-run for current successful receipt", () => {
    const receipt = createAutoPullReceipt({
      nowIso: "2026-03-07T12:00:00.000Z",
      mode: "latest_verified",
      selected: {
        boundarySetId: "sldl_2024",
        crosswalkVersionId: "cw_2024",
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_2024",
      },
      urls: {
        censusManifestUrl: "https://example.test/census-manifest.json",
        electionManifestUrl: "https://example.test/election-manifest.json",
        crosswalkRowsUrl: "https://example.test/crosswalk-rows.json",
        precinctResultsUrl: "https://example.test/precinct-rows.json",
        censusGeoRowsUrl: "https://example.test/census-rows.json",
      },
      results: [
        { source: "Census manifest", url: "https://example.test/census-manifest.json", ok: true, message: "ok" },
        { source: "Election manifest", url: "https://example.test/election-manifest.json", ok: true, message: "ok" },
      ],
    });
    const need = evaluateAutoPullRunNeed({
      receipt,
      mode: "latest_verified",
      selected: receipt.selected,
      urls: receipt.urls,
    });
    assert(need.shouldRun === false, "Expected shouldRun=false for current successful receipt");
    assert(need.status === "ok", "Expected ok status for current successful receipt");
    return true;
  });

  test("Phase 21: auto-pull run-need evaluator returns rerun for stale or warning receipts", () => {
    const receipt = createAutoPullReceipt({
      nowIso: "2026-03-07T12:00:00.000Z",
      mode: "latest_verified",
      selected: {
        boundarySetId: "sldl_2024",
        crosswalkVersionId: "cw_2024",
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_2024",
      },
      urls: {
        censusManifestUrl: "https://example.test/census-manifest.json",
        electionManifestUrl: "https://example.test/election-manifest.json",
        crosswalkRowsUrl: "https://example.test/crosswalk-rows.json",
        precinctResultsUrl: "https://example.test/precinct-rows.json",
        censusGeoRowsUrl: "https://example.test/census-rows.json",
      },
      results: [
        { source: "Census manifest", url: "https://example.test/census-manifest.json", ok: true, message: "ok" },
        { source: "Election manifest", url: "https://example.test/election-manifest.json", ok: false, message: "HTTP 404" },
      ],
    });
    const staleNeed = evaluateAutoPullRunNeed({
      receipt,
      mode: "latest_verified",
      selected: receipt.selected,
      urls: {
        ...receipt.urls,
        electionManifestUrl: "https://example.test/election-manifest-v2.json",
      },
    });
    assert(staleNeed.shouldRun === true, "Expected shouldRun=true when refs/URLs are stale");
    assert(staleNeed.status === "warn", "Expected warn status when refs/URLs are stale");
    const warningNeed = evaluateAutoPullRunNeed({
      receipt,
      mode: "latest_verified",
      selected: receipt.selected,
      urls: receipt.urls,
    });
    assert(warningNeed.shouldRun === true, "Expected shouldRun=true when previous run had warnings");
    assert(warningNeed.status === "warn", "Expected warn status when previous run had warnings");
    return true;
  });

  test("Phase 19: district evidence compile produces deterministic candidate rollups + precinct linkage", () => {
    const evidence = compileDistrictEvidence({
      geoUnits: [
        { geoid: "34013010002", w: 0.3 },
        { geoid: "34013010001", w: 0.7 },
      ],
      precinctResults: [
        { precinctId: "P2", candidateVotes: { A: 50, B: 30 } },
        { precinctId: "P1", candidateVotes: { A: 40, B: 80 } },
      ],
      crosswalkRows: [
        { precinctId: "P1", geoid: "34013010002", weight: 0.5 },
        { precinctId: "P1", geoid: "34013010001", weight: 0.5 },
        { precinctId: "P2", geoid: "34013010002", weight: 1.0 },
      ],
      censusGeoRows: [
        { geoid: "34013010002", values: { pop: 900, housing_units: 350 } },
        { geoid: "34013010001", values: { pop: 1000, housing_units: 400 } },
      ],
    });

    assert(Array.isArray(evidence.candidateTotals) && evidence.candidateTotals.length === 2, "Expected candidate totals for both A and B");
    assert(evidence.candidateTotals[0].candidateId === "B", "Expected B to lead in weighted district totals");
    assert(Math.abs(evidence.candidateTotals[0].votes - 49) < 1e-9, "Unexpected weighted votes for B");
    assert(Math.abs(evidence.candidateTotals[1].votes - 35) < 1e-9, "Unexpected weighted votes for A");
    assert(Math.abs(evidence.summary.totalVotes - 84) < 1e-9, "Unexpected total weighted votes");
    assert(Array.isArray(evidence.precinctToGeo) && evidence.precinctToGeo.length === 3, "Expected explicit precinct->geo linkage rows");
    assert(evidence.precinctToGeo[0].precinctId === "P1" && evidence.precinctToGeo[0].geoid === "34013010001", "Expected deterministic precinct linkage ordering");
    return true;
  });

  test("Phase 19: election precinct adapter normalizes canonical payload deterministically", () => {
    const out = normalizeElectionPrecinctPayload({
      precinctResults: [
        { precinctId: "P2", candidateVotes: { A: 20, B: 25 }, totalVotes: 45 },
        { precinctId: "P1", candidateVotes: { A: 40, B: 60 } },
      ],
    }, { format: "auto" });
    assert(out.detectedFormat === "canonical", "Expected canonical detection");
    assert(out.effectiveFormat === "canonical", "Expected canonical effective format");
    assert(out.outputCount === 2, "Expected two normalized rows");
    assert(out.rows[0].precinctId === "P1", "Expected deterministic precinct sort");
    assert(out.rows[0].candidateVotes.B === 60, "Expected candidate vote map preserved");
    return true;
  });

  test("Phase 19: election precinct adapter normalizes long rows into canonical precinct rows", () => {
    const out = normalizeElectionPrecinctPayload([
      { precinct: "P1", candidate: "A", candidatevotes: 30, totalvotes: 70 },
      { precinct: "P1", candidate: "B", candidatevotes: 40, totalvotes: 70 },
      { precinct: "P2", candidate: "A", candidatevotes: 15, totalvotes: 40 },
      { precinct: "P2", candidate: "B", candidatevotes: 25, totalvotes: 40 },
    ], { format: "auto" });
    assert(out.detectedFormat === "long", "Expected long detection");
    assert(out.effectiveFormat === "long", "Expected long effective format");
    assert(out.outputCount === 2, "Expected two canonical precinct rows");
    assert(out.rows[1].precinctId === "P2", "Expected second row for P2");
    assert(out.rows[1].totalVotes === 40, "Expected totalVotes from long format");
    assert(out.rows[1].candidateVotes.B === 25, "Expected candidate vote aggregation from long format");
    return true;
  });

  test("Phase 19: persuasion signal derives competitiveness index from candidate totals", () => {
    const signal = derivePersuasionSignalFromElection({
      candidateTotals: [
        { candidateId: "A", votes: 5000, sharePct: 52.6315789474 },
        { candidateId: "B", votes: 4500, sharePct: 47.3684210526 },
      ],
      min: 0.7,
      max: 1.3,
    });
    assert(signal.totalVotes === 9500, "Expected total vote count from candidate totals");
    assert(signal.leaderCandidateId === "A", "Expected A as leader");
    assert(signal.runnerUpCandidateId === "B", "Expected B as runner-up");
    assert(signal.marginVotes === 500, "Expected top-two margin votes");
    assert(signal.marginPct != null && signal.marginPct > 5 && signal.marginPct < 6, "Expected ~5.26% top-two margin");
    assert(signal.index > 1.06 && signal.index < 1.07, "Expected competitiveness-derived persuasion index");
    return true;
  });

  test("Phase 19: geo evidence layer summary ranks geos and exposes candidate margin details", () => {
    const evidence = compileDistrictEvidence({
      geoUnits: [
        { geoid: "34013010001", w: 0.7 },
        { geoid: "34013010002", w: 0.3 },
      ],
      precinctResults: [
        { precinctId: "P1", candidateVotes: { A: 40, B: 80 } },
        { precinctId: "P2", candidateVotes: { A: 50, B: 30 } },
      ],
      crosswalkRows: [
        { precinctId: "P1", geoid: "34013010001", weight: 0.5 },
        { precinctId: "P1", geoid: "34013010002", weight: 0.5 },
        { precinctId: "P2", geoid: "34013010002", weight: 1.0 },
      ],
      censusGeoRows: [
        { geoid: "34013010001", values: { pop: 1000 } },
        { geoid: "34013010002", values: { pop: 900 } },
      ],
    });
    const layers = summarizeGeoEvidenceLayers({
      geoRows: evidence.geoRows,
      maxRows: 10,
    });
    assert(Array.isArray(layers) && layers.length === 2, "Expected two GEO layer summary rows");
    assert(layers[0].geoid === "34013010001", "Expected top GEO by total votes to lead summary");
    assert(layers[0].leaderCandidateId === "B", "Expected B to lead top GEO");
    assert(layers[0].marginVotes > 0, "Expected positive top-two margin in top GEO");
    assert(layers[0].candidateCount === 2, "Expected candidate count in top GEO summary");
    return true;
  });

  test("Phase 19: geo opportunity summary ranks opportunity score deterministically", () => {
    const evidence = compileDistrictEvidence({
      geoUnits: [
        { geoid: "34013010001", w: 0.7 },
        { geoid: "34013010002", w: 0.3 },
      ],
      precinctResults: [
        { precinctId: "P1", candidateVotes: { A: 40, B: 80 } },
        { precinctId: "P2", candidateVotes: { A: 50, B: 30 } },
      ],
      crosswalkRows: [
        { precinctId: "P1", geoid: "34013010001", weight: 0.5 },
        { precinctId: "P1", geoid: "34013010002", weight: 0.5 },
        { precinctId: "P2", geoid: "34013010002", weight: 1.0 },
      ],
      censusGeoRows: [
        { geoid: "34013010001", values: { pop: 1000, housing_units: 400 } },
        { geoid: "34013010002", values: { pop: 900, housing_units: 350 } },
      ],
    });
    const rows = summarizeGeoOpportunityLayers({
      geoRows: evidence.geoRows,
      maxRows: 10,
    });
    assert(Array.isArray(rows) && rows.length === 2, "Expected two GEO opportunity rows");
    assert(rows[0].geoid === "34013010002", "Expected competitive GEO to rank first by opportunity score");
    assert(Number(rows[0].opportunityScore) > Number(rows[1].opportunityScore), "Expected strict descending opportunity score");
    assert(Array.isArray(rows[0].reasons) && rows[0].reasons.includes("tight prior margin"), "Expected competitiveness reason tag");
    assert(Number(rows[0].voteMassNorm) >= Number(rows[1].voteMassNorm), "Expected vote-mass normalization ordering");
    return true;
  });

  test("Phase 19: geo evidence map layer derives centroid points + bounds deterministically", () => {
    const evidence = compileDistrictEvidence({
      geoUnits: [
        { geoid: "34013010001", w: 0.7 },
        { geoid: "34013010002", w: 0.3 },
      ],
      precinctResults: [
        { precinctId: "P1", candidateVotes: { A: 40, B: 80 } },
        { precinctId: "P2", candidateVotes: { A: 50, B: 30 } },
      ],
      crosswalkRows: [
        { precinctId: "P1", geoid: "34013010001", weight: 0.5 },
        { precinctId: "P1", geoid: "34013010002", weight: 0.5 },
        { precinctId: "P2", geoid: "34013010002", weight: 1.0 },
      ],
      censusGeoRows: [
        { geoid: "34013010001", values: { pop: 1000, INTPTLAT: 40.12, INTPTLON: -74.01 } },
        { geoid: "34013010002", values: { pop: 900, INTPTLAT: 40.21, INTPTLON: -73.93 } },
      ],
    });
    const mapLayer = buildGeoEvidenceMapLayer({
      geoRows: evidence.geoRows,
      maxPoints: 10,
    });
    assert(mapLayer && mapLayer.available === true, "Expected available map layer");
    assert(Array.isArray(mapLayer.points) && mapLayer.points.length === 2, "Expected two centroid map points");
    assert(mapLayer.points[0].geoid === "34013010001", "Expected deterministic vote-ranked map point ordering");
    assert(Number(mapLayer.bounds?.minLat) < Number(mapLayer.bounds?.maxLat), "Expected latitude bounds");
    assert(Number(mapLayer.bounds?.minLon) < Number(mapLayer.bounds?.maxLon), "Expected longitude bounds");
    return true;
  });

  test("Phase 19: geo evidence map layer returns unavailable when census centroids are missing", () => {
    const mapLayer = buildGeoEvidenceMapLayer({
      geoRows: [
        {
          geoid: "34013010001",
          totalVotes: 120,
          candidateVotes: { A: 60, B: 60 },
          hasElection: true,
          hasCensus: true,
          census: { pop: 1000 },
        },
      ],
    });
    assert(mapLayer && mapLayer.available === false, "Expected unavailable map layer without centroid coordinates");
    assert(Array.isArray(mapLayer.points) && mapLayer.points.length === 0, "Expected empty map point array");
    assert(String(mapLayer.reason || "").toLowerCase().includes("centroid"), "Expected centroid guidance in map-layer reason");
    return true;
  });

  test("Phase 19: precinct evidence layer summary shows votes + mapping coverage deterministically", () => {
    const rows = summarizePrecinctEvidenceLayers({
      geoUnits: [
        { geoid: "34013010001", w: 0.7 },
        { geoid: "34013010002", w: 0.3 },
      ],
      precinctResults: [
        { precinctId: "P2", candidateVotes: { A: 50, B: 30 } },
        { precinctId: "P1", candidateVotes: { A: 40, B: 80 } },
      ],
      crosswalkRows: [
        { precinctId: "P1", geoid: "34013010002", weight: 0.5 },
        { precinctId: "P1", geoid: "34013010001", weight: 0.5 },
        { precinctId: "P2", geoid: "34013010002", weight: 1.0 },
      ],
      maxRows: 10,
    });
    assert(Array.isArray(rows) && rows.length === 2, "Expected two precinct summary rows");
    assert(rows[0].precinctId === "P1", "Expected highest-vote precinct first");
    assert(rows[0].leaderCandidateId === "B", "Expected B to lead precinct P1");
    assert(rows[0].mappedGeoCount === 2, "Expected two mapped GEO links for P1");
    assert(Math.abs(Number(rows[0].districtWeightPct) - 50) < 1e-9, "Expected district weight pct for P1");
    assert(Array.isArray(rows[0].topGeoLinks) && rows[0].topGeoLinks.length === 2, "Expected top GEO link list for P1");
    assert(rows[0].topGeoLinks[0].geoid === "34013010001", "Expected deterministic GEO-link sort by effective weight");
    assert(Math.abs(Number(rows[0].topGeoLinks[0].effectiveWeightPct) - 35) < 1e-9, "Expected top GEO effective weight pct for P1");
    assert(rows[1].precinctId === "P2", "Expected second precinct row for P2");
    assert(rows[1].mappedGeoCount === 1, "Expected single mapped GEO link for P2");
    assert(Math.abs(Number(rows[1].districtWeightPct) - 30) < 1e-9, "Expected district weight pct for P2");
    assert(Array.isArray(rows[1].topGeoLinks) && rows[1].topGeoLinks.length === 1, "Expected one GEO link for P2");
    assert(rows[1].topGeoLinks[0].geoid === "34013010002", "Expected mapped GEO for P2");
    return true;
  });

  test("Phase 19: district evidence inputs resolve from inline evidenceInputs first", () => {
    const out = resolveDistrictEvidenceInputs({
      dataRefs: {
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_2024",
        crosswalkVersionId: "cw_2024",
      },
      geoPack: {
        district: {
          evidenceInputs: {
            precinctResults: [{ precinctId: "P1", candidateVotes: { A: 10, B: 12 } }],
            crosswalkRows: [{ precinctId: "P1", geoid: "34013010001", weight: 1 }],
            censusGeoRows: [{ geoid: "34013010001", values: { pop: 100 } }],
          },
          evidenceStore: {
            electionByDatasetId: { mit_2024: [{ precinctId: "P_IGNORE" }] },
            crosswalkByVersionId: { cw_2024: [{ precinctId: "P_IGNORE", geoid: "x", weight: 1 }] },
            censusByDatasetId: { acs5_2024: [{ geoid: "x", values: { pop: 1 } }] },
          },
        },
      },
    });
    assert(out.sourceMode === "inline", "Expected inline evidenceInputs precedence");
    assert(out.precinctResults.length === 1 && String(out.precinctResults[0]?.precinctId) === "P1", "Expected inline precinct rows");
    assert(out.crosswalkRows.length === 1 && String(out.crosswalkRows[0]?.geoid) === "34013010001", "Expected inline crosswalk rows");
    assert(out.censusGeoRows.length === 1 && String(out.censusGeoRows[0]?.geoid) === "34013010001", "Expected inline census rows");
    return true;
  });

  test("Phase 19: district evidence inputs resolve by dataRefs from evidenceStore", () => {
    const out = resolveDistrictEvidenceInputs({
      dataRefs: {
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_2024",
        crosswalkVersionId: "cw_2024",
      },
      geoPack: {
        district: {
          evidenceStore: {
            electionByDatasetId: {
              mit_2024: [{ precinctId: "P1", candidateVotes: { A: 30, B: 20 } }],
            },
            crosswalkByVersionId: {
              cw_2024: [{ precinctId: "P1", geoid: "34013010001", weight: 1 }],
            },
            censusByDatasetId: {
              acs5_2024: [{ geoid: "34013010001", values: { pop: 1000 } }],
            },
          },
        },
      },
    });
    assert(out.sourceMode === "refs", "Expected refs mode for evidenceStore selection");
    assert(out.precinctResults.length === 1, "Expected precinct rows from electionByDatasetId");
    assert(out.crosswalkRows.length === 1, "Expected crosswalk rows from crosswalkByVersionId");
    assert(out.censusGeoRows.length === 1, "Expected census rows from censusByDatasetId");
    assert(Array.isArray(out.notes) && out.notes.length === 0, "Expected no notes when refs resolve cleanly");
    return true;
  });

  test("Phase 19: district evidence input summary reports row counts + ready state", () => {
    const summary = summarizeDistrictEvidenceInputs({
      dataRefs: {
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_2024",
        crosswalkVersionId: "cw_2024",
      },
      geoPack: {
        district: {
          evidenceStore: {
            electionByDatasetId: {
              mit_2024: [{ precinctId: "P1", candidateVotes: { A: 30, B: 20 } }],
            },
            crosswalkByVersionId: {
              cw_2024: [{ precinctId: "P1", geoid: "34013010001", weight: 1 }],
            },
            censusByDatasetId: {
              acs5_2024: [{ geoid: "34013010001", values: { pop: 1000 } }],
            },
          },
        },
      },
    });
    assert(summary.sourceMode === "refs", "Expected refs source mode in summary");
    assert(summary.counts.precinctResults === 1, "Expected precinct count in summary");
    assert(summary.counts.crosswalkRows === 1, "Expected crosswalk count in summary");
    assert(summary.counts.censusGeoRows === 1, "Expected census count in summary");
    assert(summary.ready === true, "Expected ready=true when all three inputs exist");
    assert(String(summary.summaryLine).includes("Input mode: refs"), "Expected mode in summary line");
    return true;
  });

  test("Phase 19: district evidence input summary marks not-ready when a layer is missing", () => {
    const summary = summarizeDistrictEvidenceInputs({
      dataRefs: {
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_2024",
        crosswalkVersionId: "cw_2024",
      },
      geoPack: {
        district: {
          evidenceStore: {
            electionByDatasetId: {
              mit_2024: [{ precinctId: "P1", candidateVotes: { A: 30, B: 20 } }],
            },
            crosswalkByVersionId: {
              cw_2024: [{ precinctId: "P1", geoid: "34013010001", weight: 1 }],
            },
            censusByDatasetId: {},
          },
        },
      },
    });
    assert(summary.ready === false, "Expected ready=false when census rows are missing");
    assert(summary.counts.censusGeoRows === 0, "Expected missing census count");
    assert(Array.isArray(summary.notes) && summary.notes.some((x) => String(x).includes("No census geo rows found")), "Expected missing-census note");
    return true;
  });

  test("Phase 21: district-intel pack builder derives bounded indices and assumptions from evidence", () => {
    const evidence = compileDistrictEvidence({
      geoUnits: [
        { geoid: "34013010001", w: 0.5 },
        { geoid: "34013010002", w: 0.5 },
      ],
      precinctResults: [
        { precinctId: "P1", candidateVotes: { A: 120, B: 110 } },
        { precinctId: "P2", candidateVotes: { A: 90, B: 130 } },
      ],
      crosswalkRows: [
        { precinctId: "P1", geoid: "34013010001", weight: 1 },
        { precinctId: "P2", geoid: "34013010002", weight: 1 },
      ],
      censusGeoRows: [
        { geoid: "34013010001", values: { pop: 1000, housing_units: 410, renter_share: 0.44, multiunit_share: 0.28, ba_plus_share: 0.36, age_18_34_share: 0.22, age_65_plus_share: 0.18, limited_english_share: 0.05, mean_commute_min: 27 } },
        { geoid: "34013010002", values: { pop: 900, housing_units: 380, renter_share: 0.41, multiunit_share: 0.20, ba_plus_share: 0.33, age_18_34_share: 0.21, age_65_plus_share: 0.17, limited_english_share: 0.04, mean_commute_min: 24 } },
      ],
    });

    const out = buildDistrictIntelPackFromEvidence({
      scenario: withUniverseDefaults({
        useDistrictIntel: false,
        doorsPerHour3: 18,
        supportRatePct: 48,
        gotvLiftMode: 1.2,
        orgCount: 3,
      }),
      evidence,
      refs: {
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_2024",
        boundarySetId: "sldl_2024",
        crosswalkVersionId: "cw_2024",
      },
      nowIso: "2026-03-07T10:00:00.000Z",
    });

    assert(!!out?.pack, "Expected generated district-intel pack");
    assert(out.pack.ready === true, "Expected pack ready=true with election+census evidence");
    assert(out.pack.generatedAt === "2026-03-07T10:00:00.000Z", "Expected generatedAt passthrough");
    assert(out.pack.provenance?.electionDatasetId === "mit_2024", "Expected provenance election id");
    assert(out.pack.indices?.fieldSpeed >= 0.6 && out.pack.indices?.fieldSpeed <= 1.4, "FieldSpeed index should be bounded");
    assert(out.pack.indices?.persuasionEnv >= 0.7 && out.pack.indices?.persuasionEnv <= 1.3, "Persuasion index should be bounded");
    assert(out.pack.derivedAssumptions?.doorsPerHour?.base === 18, "Expected derived doors/hr base from scenario");
    assert(Number(out.pack.derivedAssumptions?.doorsPerHour?.adjusted) > 0, "Expected derived doors/hr adjusted");
    return true;
  });

  test("Phase 21: district data contract warns when district-intel provenance drifts from active refs", () => {
    const scenario = withUniverseDefaults({
      scenarioName: "Intel provenance drift",
      raceType: "state_leg",
      electionDate: "2026-11-03",
      universeSize: 10000,
      useDistrictIntel: true,
      dataRefs: {
        mode: "pinned_verified",
        boundarySetId: "sldl_2024",
        crosswalkVersionId: "cw_2024",
        censusDatasetId: "acs5_2024",
        electionDatasetId: "mit_2024",
      },
      dataCatalog: {
        boundarySets: [{ id: "sldl_2024", label: "SLDL 2024", geographyType: "SLDL", vintage: "2024", isVerified: true, isLatest: true }],
        crosswalks: [{
          id: "cw_2024",
          fromBoundarySetId: "sldl_2022",
          toBoundarySetId: "sldl_2024",
          unit: "tract",
          method: "population",
          quality: { coveragePct: 99, unmatchedPct: 1, weightDriftPct: 0.1, isVerified: true },
          isLatest: true
        }],
        censusDatasets: [{ id: "acs5_2024", kind: "census", label: "ACS 2024", source: "acs5", vintage: "2024", boundarySetId: "sldl_2024", granularity: "tract", refreshedAt: null, hash: null, quality: { coveragePct: 99, isVerified: true }, isLatest: true }],
        electionDatasets: [{ id: "mit_2024", kind: "election", label: "MIT 2024", source: "mit", vintage: "2024", boundarySetId: "sldl_2024", granularity: "precinct", refreshedAt: null, hash: null, quality: { coveragePct: 99, isVerified: true }, isLatest: true }],
      },
      districtIntelPack: {
        ready: true,
        provenance: {
          boundarySetId: "sldl_2024",
          crosswalkVersionId: "cw_2024",
          censusDatasetId: "acs5_2023",
          electionDatasetId: "mit_2023",
        },
      },
      ui: { training: false, dark: false },
    });
    const result = validateDistrictDataContract(scenario);
    assert(result.ok, "Expected provenance drift to warn but not hard-fail");
    assert(Array.isArray(result.warnings) && result.warnings.some((x) => String(x).includes("provenance censusDatasetId differs")), "Expected census provenance drift warning");
    assert(Array.isArray(result.warnings) && result.warnings.some((x) => String(x).includes("provenance electionDatasetId differs")), "Expected election provenance drift warning");
    return true;
  });

  test("Phase 21: district-intel rate/capacity overrides apply only when enabled + ready", () => {
    const stateDisabled = withUniverseDefaults({
      useDistrictIntel: false,
      districtIntelPack: {
        ready: true,
        indices: { fieldSpeed: 1.1, persuasionEnv: 1.2, turnoutElasticity: 1.0, fieldDifficulty: 1.25 },
        derivedAssumptions: {
          doorsPerHour: { base: 18, adjusted: 19.8 },
          persuasionRate: { base: 0.48, adjusted: 0.52 },
          turnoutLift: { base: 1.2, adjusted: 1.25 },
          organizerCapacity: { base: 3, adjusted: 2.4 },
        },
      },
    });
    const disabledRates = applyDistrictIntelRateOverrides({
      state: stateDisabled,
      rates: { cr: 0.3, sr: 0.48, tr: 0.62 },
    });
    const disabledCap = applyDistrictIntelCapacityOverrides({
      state: stateDisabled,
      capacity: {
        orgCount: 3,
        orgHoursPerWeek: 40,
        volunteerMult: 1.2,
        doorSharePct: 70,
        doorShare: 0.7,
        doorsPerHour: 18,
        callsPerHour: 22,
      }
    });
    assert(disabledRates.rates.sr === 0.48, "Disabled toggle should not alter sr");
    assert(disabledCap.capacity.orgCount === 3, "Disabled toggle should not alter orgCount");
    assert(disabledCap.capacity.doorsPerHour === 18, "Disabled toggle should not alter doorsPerHour");

    const stateEnabled = { ...stateDisabled, useDistrictIntel: true };
    const enabledRates = applyDistrictIntelRateOverrides({
      state: stateEnabled,
      rates: { cr: 0.3, sr: 0.48, tr: 0.62 },
    });
    const enabledCap = applyDistrictIntelCapacityOverrides({
      state: stateEnabled,
      capacity: {
        orgCount: 3,
        orgHoursPerWeek: 40,
        volunteerMult: 1.2,
        doorSharePct: 70,
        doorShare: 0.7,
        doorsPerHour: 18,
        callsPerHour: 22,
      }
    });
    assert(Math.abs(Number(enabledRates.rates.sr) - 0.52) < 1e-9, "Enabled toggle should apply persuasionRate adjusted");
    assert(Math.abs(Number(enabledCap.capacity.orgCount) - 2.4) < 1e-9, "Enabled toggle should apply organizerCapacity adjusted");
    assert(Math.abs(Number(enabledCap.capacity.doorsPerHour) - 19.8) < 1e-9, "Enabled toggle should apply doorsPerHour adjusted");
    return true;
  });
}
