export type AnyState = Record<string, any>;
export type ElsMap = Record<string, any>;
export type AnyFn = (...args: any[]) => any;
export type GetState = () => AnyState;
export type SetState = (updater: AnyState | ((prev: AnyState) => AnyState | void)) => void;

export interface UiQueueCommitOptions {
  render?: boolean;
  persist?: boolean;
  immediatePersist?: boolean;
  allowScenarioLockBypass?: boolean;
}

export type CommitUIUpdate = (opts?: UiQueueCommitOptions) => void;

export interface RenderMainCtx {
  state: AnyState;
  els: ElsMap;
  safeNum: AnyFn;
  engine: AnyState;
  derivedWeeksRemaining: AnyFn;
  deriveNeedVotes: AnyFn;
  computeElectionSnapshot: AnyFn;
  computeExecutionSnapshot: AnyFn;
  computeWeeklyOpsContext: AnyFn;
  setLastRenderCtx: AnyFn;
  setLastResultsSnapshot: AnyFn;
  fmtInt: AnyFn;
  setText: AnyFn;
  safeCall: AnyFn;
  renderStress: AnyFn;
  renderValidation: AnyFn;
  renderAssumptions: AnyFn;
  renderGuardrails: AnyFn;
  renderConversion: AnyFn;
  renderPhase3: AnyFn;
  renderWeeklyOps: AnyFn;
  renderWeeklyOpsInsights: AnyFn;
  renderWeeklyOpsFreshness: AnyFn;
  scheduleOperationsCapacityOutlookRender: AnyFn;
  renderAssumptionDriftE1: AnyFn;
  renderRiskFramingE2: AnyFn;
  renderBottleneckAttributionE3: AnyFn;
  renderSensitivitySnapshotE4: AnyFn;
  renderDecisionConfidenceE5: AnyFn;
  renderImpactTraceE6: AnyFn;
  renderUniverse16Card: AnyFn;
  renderRoi: AnyFn;
  renderOptimization: AnyFn;
  renderTimeline: AnyFn;
  renderDecisionIntelligencePanel: AnyFn;
}

export interface ApplyStateToUIViewCtx {
  els: ElsMap;
  state: AnyState;
  canonicalDoorsPerHourFromSnap: AnyFn;
  syncMcModeUI: AnyFn;
  syncGotvModeUI: AnyFn;
  applyThemeFromState: AnyFn;
}

export interface InitDevToolsCtx {
  isDevMode: AnyFn;
  getState: GetState;
  derivedWeeksRemaining: AnyFn;
  safeNum: AnyFn;
  deriveNeedVotes: AnyFn;
  engine: AnyState;
  getSelfTestAccessors: AnyFn;
  setSelfTestGateStatus: AnyFn;
  updateSelfTestGateBadge: AnyFn;
  loadSelfTests: AnyFn;
}

export interface InitTabsCtx {
  state: AnyState;
}

export interface InitExplainCardCtx {
  els: ElsMap;
  state: AnyState;
}

export interface UiUpdateQueueCtx {
  render: AnyFn;
  persist: AnyFn;
  debounceMs?: number;
  getWindow?: AnyFn;
}

export interface DefaultStateCtx {
  uid: AnyFn;
  activeContext?: {
    campaignId?: string;
    campaignName?: string;
    officeId?: string;
    scenarioId?: string;
    search?: string;
  };
}

export interface RenderUniverse16CardCtx {
  els: ElsMap;
  state: AnyState;
  getUniverseLayerConfig: AnyFn;
  getEffectiveBaseRates: AnyFn;
  universeDefaults: AnyState;
}

export interface PersistenceStatusCtx {
  scope: "state" | "backup";
  result: { error?: string; code?: string };
  persistenceState: {
    stateSaveOk: boolean;
    backupSaveOk: boolean;
    stateError: string;
    backupError: string;
  };
  getPersistenceErrorSig: AnyFn;
  setPersistenceErrorSig: AnyFn;
  recordError: AnyFn;
  updatePersistenceStatusChip: AnyFn;
}

export interface ClearPersistenceStatusCtx {
  scope: "state" | "backup";
  persistenceState: {
    stateSaveOk: boolean;
    backupSaveOk: boolean;
    stateError: string;
    backupError: string;
  };
  setPersistenceErrorSig: AnyFn;
  updatePersistenceStatusChip: AnyFn;
}

export interface InitPostBootCtx {
  updateBuildStamp: AnyFn;
  updateSelfTestGateBadge: AnyFn;
  updatePersistenceStatusChip: AnyFn;
  refreshBackupDropdown: AnyFn;
  applyStateToUI: AnyFn;
  rebuildCandidateTable: AnyFn;
  initTabs: AnyFn;
  initExplainCard: AnyFn;
  safeCall: AnyFn;
  wireSensitivitySurface: AnyFn;
  wireEvents: AnyFn;
  initDevTools: AnyFn;
  render: AnyFn;
  getState: GetState;
  SCENARIO_BASELINE_ID: string;
  scenarioInputsFromState: AnyFn;
  scenarioOutputsFromState: AnyFn;
  renderScenarioManagerC1: AnyFn;
  persist: AnyFn;
}

export interface PreflightElsCtx {
  els: ElsMap;
  recordError: AnyFn;
}

export interface ScenarioManagerBindingsCtx {
  els: ElsMap;
  getState: GetState;
  replaceState: AnyFn;
  ensureScenarioRegistry: AnyFn;
  SCENARIO_BASELINE_ID: string;
  SCENARIO_MAX: number;
  setScenarioWarn: AnyFn;
  uid: AnyFn;
  scenarioClone: AnyFn;
  scenarioInputsFromState: AnyFn;
  scenarioOutputsFromState: AnyFn;
  persist: AnyFn;
  renderScenarioManagerC1: AnyFn;
  markMcStale: AnyFn;
  applyStateToUI: AnyFn;
  render: AnyFn;
  safeCall: AnyFn;
  renderDecisionSessionD1: AnyFn;
}

export interface DecisionSessionActionsCtx {
  els: ElsMap;
  stateRef: GetState;
  ensureDecisionScaffold: AnyFn;
  makeDecisionSessionId: AnyFn;
  makeDecisionOptionId: AnyFn;
  OBJECTIVE_TEMPLATES: Array<{ key: string; label: string }>;
  SCENARIO_BASELINE_ID: string;
  getActiveDecisionSession: AnyFn;
  ensureDecisionSessionShape: AnyFn;
  getActiveDecisionOption: AnyFn;
  ensureDecisionOptionShape: AnyFn;
  ensureScenarioRegistry: AnyFn;
  persist: AnyFn;
  renderDecisionSessionD1: AnyFn;
}

export interface DecisionSessionBindingsCtx {
  els: ElsMap;
  ensureDecisionScaffold: AnyFn;
  getState: GetState;
  setState: SetState;
  persist: AnyFn;
  renderDecisionSessionD1: AnyFn;
  getActiveDecisionSession: AnyFn;
  ensureDecisionSessionShape: AnyFn;
  createNewDecisionSession: AnyFn;
  renameActiveDecisionSession: AnyFn;
  deleteActiveDecisionSession: AnyFn;
  linkDecisionSessionToActiveScenario: AnyFn;
  createNewDecisionOption: AnyFn;
  renameActiveDecisionOption: AnyFn;
  deleteActiveDecisionOption: AnyFn;
  linkDecisionOptionToActiveScenario: AnyFn;
  getActiveDecisionOption: AnyFn;
  ensureDecisionOptionShape: AnyFn;
  renderDecisionSummaryD4: AnyFn;
  buildDecisionSummaryText: AnyFn;
  copyTextToClipboard: AnyFn;
  decisionSummaryPlainText: AnyFn;
  decisionSessionExportObject: AnyFn;
  downloadJsonObject: AnyFn;
  runSensitivitySnapshotE4: AnyFn;
}

export interface InitScenarioDecisionWiringCtx {
  els: ElsMap;
  getState: GetState;
  replaceState: AnyFn;
  setState: SetState;
  ensureScenarioRegistry: AnyFn;
  ensureDecisionScaffold: AnyFn;
  SCENARIO_BASELINE_ID: string;
  SCENARIO_MAX: number;
  setScenarioWarn: AnyFn;
  uid: AnyFn;
  scenarioClone: AnyFn;
  scenarioInputsFromState: AnyFn;
  scenarioOutputsFromState: AnyFn;
  persist: AnyFn;
  renderScenarioManagerC1: AnyFn;
  markMcStale: AnyFn;
  applyStateToUI: AnyFn;
  render: AnyFn;
  safeCall: AnyFn;
  renderDecisionSessionD1: AnyFn;
  createDecisionSessionActions: AnyFn;
  wireScenarioManagerBindings: AnyFn;
  wireDecisionSessionBindings: AnyFn;
  makeDecisionSessionId: AnyFn;
  makeDecisionOptionId: AnyFn;
  OBJECTIVE_TEMPLATES: Array<{ key: string; label: string }>;
  getActiveDecisionSession: AnyFn;
  ensureDecisionSessionShape: AnyFn;
  getActiveDecisionOption: AnyFn;
  ensureDecisionOptionShape: AnyFn;
  renderDecisionSummaryD4: AnyFn;
  buildDecisionSummaryText: AnyFn;
  copyTextToClipboard: AnyFn;
  decisionSummaryPlainText: AnyFn;
  decisionSessionExportObject: AnyFn;
  downloadJsonObject: AnyFn;
  runSensitivitySnapshotE4: AnyFn;
}

export interface WireEventsCtx {
  els: ElsMap;
  state?: AnyState;
  getState?: GetState;
  engine?: AnyState;
  safeNum: AnyFn;
  commitUIUpdate: CommitUIUpdate;
  render: AnyFn;
  computeRealityDrift?: AnyFn;
  markMcStale?: AnyFn;
}

export interface WireEventsOrchestratorArgs {
  els: ElsMap;
  state: GetState;
  setState: SetState;
  safeNum: AnyFn;
  commitUIUpdate: CommitUIUpdate;
  schedulePersist: AnyFn;
  applyTemplateDefaultsForRace: AnyFn;
  applyStateToUI: AnyFn;
  refreshAssumptionsProfile: AnyFn;
  uid: AnyFn;
  rebuildCandidateTable: AnyFn;
  rebuildUserSplitInputs: AnyFn;
  markMcStale: AnyFn;
  switchToStage: AnyFn;
  setCanonicalDoorsPerHour: AnyFn;
  canonicalDoorsPerHourFromSnap: AnyFn;
  clamp: AnyFn;
  syncGotvModeUI: AnyFn;
  syncMcModeUI: AnyFn;
  wireSensitivitySurface: AnyFn;
  safeCall: AnyFn;
  runMonteCarloNow: AnyFn;
  render: AnyFn;
  applyThemeFromState: AnyFn;
  persist: AnyFn;
  engine: AnyState;
  APP_VERSION: string;
  BUILD_ID: string;
  getLastResultsSnapshot: AnyFn;
  setLastExportHash: AnyFn;
  downloadText: AnyFn;
  replaceState: AnyFn;
  makeDefaultState: AnyFn;
  ensureScenarioRegistry: AnyFn;
  ensureDecisionScaffold: AnyFn;
  SCENARIO_BASELINE_ID: string;
  scenarioInputsFromState: AnyFn;
  scenarioOutputsFromState: AnyFn;
  clearState: AnyFn;
  readJsonFile: AnyFn;
  requiredScenarioKeysMissing: AnyFn;
  normalizeLoadedState: AnyFn;
  setText: AnyFn;
  refreshBackupDropdown: AnyFn;
  restoreBackupByIndex: AnyFn;
  openDiagnostics: AnyFn;
  closeDiagnostics: AnyFn;
  copyDebugBundle: AnyFn;
  exportDailyLog: AnyFn;
  mergeDailyLogIntoState: AnyFn;
  applyRollingRateToAssumption: AnyFn;
  applyAllRollingCalibrations: AnyFn;
  undoLastWeeklyAction: AnyFn;
  renderScenarioManagerC1: AnyFn;
  renderDecisionSessionD1: AnyFn;
  wireSafetyAndDiagnosticsEvents: AnyFn;
  wirePrimaryPlannerEvents: AnyFn;
  wireBudgetTimelineEvents: AnyFn;
  wireIntelChecksEvents: AnyFn;
  wireTabAndExportEvents: AnyFn;
  wireResetImportAndUiToggles: AnyFn;
  computeRealityDrift: AnyFn;
}

export type ExecutionWeeklyStatusCtx = Record<string, any>;
