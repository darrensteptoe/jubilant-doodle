import { wireInput, wireSelect, wireCheckbox } from "./wireInput.js";

export function getEls(){
  return {
      scenarioName: document.getElementById("scenarioName"),
      buildStamp: document.getElementById("buildStamp"),
      selfTestGate: document.getElementById("selfTestGate"),
      restoreBackup: document.getElementById("restoreBackup"),
      toggleStrictImport: document.getElementById("toggleStrictImport"),
      btnDiagnostics: document.getElementById("btnDiagnostics"),
      btnSaveScenario: document.getElementById("btnSaveScenario"),
      scCompareTbody: document.getElementById("scCompareTbody"),
      scOverall: document.getElementById("scOverall"),
      scWarn: document.getElementById("scWarn"),
      scenarioSelect: document.getElementById("scenarioSelect"),
      scenarioNewName: document.getElementById("scenarioNewName"),
      btnScenarioSaveNew: document.getElementById("btnScenarioSaveNew"),
      btnScenarioCloneBaseline: document.getElementById("btnScenarioCloneBaseline"),
      btnScenarioDelete: document.getElementById("btnScenarioDelete"),
      btnScenarioLoadSelected: document.getElementById("btnScenarioLoadSelected"),
      btnScenarioReturnBaseline: document.getElementById("btnScenarioReturnBaseline"),
      activeScenarioLabel: document.getElementById("activeScenarioLabel"),
      scmCompareWrap: document.getElementById("scmCompareWrap"),
      scmCompareTag: document.getElementById("scmCompareTag"),
      scmCompareEmpty: document.getElementById("scmCompareEmpty"),
      scmCompareGrid: document.getElementById("scmCompareGrid"),
      scmDiffInputs: document.getElementById("scmDiffInputs"),
      scmDiffInputsFoot: document.getElementById("scmDiffInputsFoot"),
      scmDiffOutputs: document.getElementById("scmDiffOutputs"),
    
      // Phase D1 — Decision Sessions
      decisionSessionSelect: document.getElementById("decisionSessionSelect"),
      btnDecisionNew: document.getElementById("btnDecisionNew"),
      decisionRename: document.getElementById("decisionRename"),
      btnDecisionRenameSave: document.getElementById("btnDecisionRenameSave"),
      btnDecisionDelete: document.getElementById("btnDecisionDelete"),
      decisionActiveLabel: document.getElementById("decisionActiveLabel"),
      decisionNotes: document.getElementById("decisionNotes"),
      decisionObjective: document.getElementById("decisionObjective"),
      btnDecisionLinkScenario: document.getElementById("btnDecisionLinkScenario"),
      decisionScenarioLabel: document.getElementById("decisionScenarioLabel"),
      decisionBudget: document.getElementById("decisionBudget"),
      decisionVolunteerHrs: document.getElementById("decisionVolunteerHrs"),
      decisionTurfAccess: document.getElementById("decisionTurfAccess"),
      decisionBlackoutDates: document.getElementById("decisionBlackoutDates"),
      decisionRiskPosture: document.getElementById("decisionRiskPosture"),
      decisionNonNegotiables: document.getElementById("decisionNonNegotiables"),
    
      // Phase E1 — Assumption Drift (read-only)
      driftStatusTag: document.getElementById("driftStatusTag"),
      driftReq: document.getElementById("driftReq"),
      driftActual: document.getElementById("driftActual"),
      driftDelta: document.getElementById("driftDelta"),
      driftSlipBanner: document.getElementById("driftSlipBanner"),
    
      // Phase E2 — Risk Framing (derived only)
      riskBandTag: document.getElementById("riskBandTag"),
      riskWinProb: document.getElementById("riskWinProb"),
      riskMarginBand: document.getElementById("riskMarginBand"),
      riskVolatility: document.getElementById("riskVolatility"),
      riskPlainBanner: document.getElementById("riskPlainBanner"),
    
      bneckTag: document.getElementById("bneckTag"),
      bneckPrimary: document.getElementById("bneckPrimary"),
      bneckSecondary: document.getElementById("bneckSecondary"),
      bneckTbody: document.getElementById("bneckTbody"),
      bneckWarn: document.getElementById("bneckWarn"),
    
      sensTag: document.getElementById("sensTag"),
      btnSensRun: document.getElementById("btnSensRun"),
      sensTbody: document.getElementById("sensTbody"),
      sensBanner: document.getElementById("sensBanner"),
    
      confTag: document.getElementById("confTag"),
      confExec: document.getElementById("confExec"),
      confRisk: document.getElementById("confRisk"),
      confTight: document.getElementById("confTight"),
      confDiv: document.getElementById("confDiv"),
      confBanner: document.getElementById("confBanner"),
    
      decisionOptionSelect: document.getElementById("decisionOptionSelect"),
      btnDecisionOptionNew: document.getElementById("btnDecisionOptionNew"),
      decisionOptionRename: document.getElementById("decisionOptionRename"),
      btnDecisionOptionRenameSave: document.getElementById("btnDecisionOptionRenameSave"),
      btnDecisionOptionDelete: document.getElementById("btnDecisionOptionDelete"),
      btnDecisionOptionLinkScenario: document.getElementById("btnDecisionOptionLinkScenario"),
      decisionOptionScenarioLabel: document.getElementById("decisionOptionScenarioLabel"),
      decisionOptionTacticDoors: document.getElementById("decisionOptionTacticDoors"),
      decisionOptionTacticPhones: document.getElementById("decisionOptionTacticPhones"),
      decisionOptionTacticDigital: document.getElementById("decisionOptionTacticDigital"),
      decisionRecommendSelect: document.getElementById("decisionRecommendSelect"),
      decisionWhatTrue: document.getElementById("decisionWhatTrue"),
      decisionSummaryPreview: document.getElementById("decisionSummaryPreview"),
      btnDecisionCopyMd: document.getElementById("btnDecisionCopyMd"),
      btnDecisionCopyText: document.getElementById("btnDecisionCopyText"),
      btnDecisionDownloadJson: document.getElementById("btnDecisionDownloadJson"),
      decisionCopyStatus: document.getElementById("decisionCopyStatus"),
    
      diagModal: document.getElementById("diagModal"),
      diagErrors: document.getElementById("diagErrors"),
      btnDiagClose: document.getElementById("btnDiagClose"),
      btnCopyDebug: document.getElementById("btnCopyDebug"),
      raceType: document.getElementById("raceType"),
      electionDate: document.getElementById("electionDate"),
      weeksRemaining: document.getElementById("weeksRemaining"),
      mode: document.getElementById("mode"),
    
      universeBasis: document.getElementById("universeBasis"),
      universeSize: document.getElementById("universeSize"),
      sourceNote: document.getElementById("sourceNote"),
    
      turnoutA: document.getElementById("turnoutA"),
      turnoutB: document.getElementById("turnoutB"),
      bandWidth: document.getElementById("bandWidth"),
      turnoutExpected: document.getElementById("turnoutExpected"),
      turnoutBand: document.getElementById("turnoutBand"),
      votesPer1pct: document.getElementById("votesPer1pct"),
    
      btnAddCandidate: document.getElementById("btnAddCandidate"),
      yourCandidate: document.getElementById("yourCandidate"),
      candTbody: document.getElementById("candTbody"),
      undecidedPct: document.getElementById("undecidedPct"),
      supportTotal: document.getElementById("supportTotal"),
      undecidedMode: document.getElementById("undecidedMode"),
      userSplitWrap: document.getElementById("userSplitWrap"),
      userSplitList: document.getElementById("userSplitList"),
      candWarn: document.getElementById("candWarn"),
    
      persuasionPct: document.getElementById("persuasionPct"),
      earlyVoteExp: document.getElementById("earlyVoteExp"),
        // Phase 2 — conversion + capacity
        goalSupportIds: "",
        supportRatePct: 55,
        contactRatePct: 22,
        doorsPerHour: 30,
        hoursPerShift: 3,
        shiftsPerVolunteerPerWeek: 2,
    
        // Phase 16 — universe composition + retention (OFF by default)
        universeLayerEnabled: UNIVERSE_DEFAULTS.enabled,
        universeDemPct: UNIVERSE_DEFAULTS.demPct,
        universeRepPct: UNIVERSE_DEFAULTS.repPct,
        universeNpaPct: UNIVERSE_DEFAULTS.npaPct,
        universeOtherPct: UNIVERSE_DEFAULTS.otherPct,
        retentionFactor: UNIVERSE_DEFAULTS.retentionFactor,
    
    
      // Phase 2 — conversion + capacity
      goalSupportIds: document.getElementById("goalSupportIds"),
      supportRatePct: document.getElementById("supportRatePct"),
      contactRatePct: document.getElementById("contactRatePct"),
      doorsPerHour: document.getElementById("doorsPerHour"),
      hoursPerShift: document.getElementById("hoursPerShift"),
      shiftsPerVolunteerPerWeek: document.getElementById("shiftsPerVolunteerPerWeek"),
    
      // Phase 16 — universe composition + retention
      universe16Enabled: document.getElementById("universe16Enabled"),
      universe16DemPct: document.getElementById("universe16DemPct"),
      universe16RepPct: document.getElementById("universe16RepPct"),
      universe16NpaPct: document.getElementById("universe16NpaPct"),
      universe16OtherPct: document.getElementById("universe16OtherPct"),
      retentionFactor: document.getElementById("retentionFactor"),
      universe16Derived: document.getElementById("universe16Derived"),
      universe16Warn: document.getElementById("universe16Warn"),
    
      outConversationsNeeded: document.getElementById("outConversationsNeeded"),
      outDoorsNeeded: document.getElementById("outDoorsNeeded"),
      outDoorsPerShift: document.getElementById("outDoorsPerShift"),
      outTotalShifts: document.getElementById("outTotalShifts"),
      outShiftsPerWeek: document.getElementById("outShiftsPerWeek"),
      outVolunteersNeeded: document.getElementById("outVolunteersNeeded"),
      convFeasBanner: document.getElementById("convFeasBanner"),
    
      // Weekly ops dashboard
      wkGoal: document.getElementById("wkGoal"),
      wkConvosPerWeek: document.getElementById("wkConvosPerWeek"),
      wkAttemptsPerWeek: document.getElementById("wkAttemptsPerWeek"),
      wkCapacityPerWeek: document.getElementById("wkCapacityPerWeek"),
      wkCapacityBreakdown: document.getElementById("wkCapacityBreakdown"),
      wkGapPerWeek: document.getElementById("wkGapPerWeek"),
      wkConstraint: document.getElementById("wkConstraint"),
      wkConstraintNote: document.getElementById("wkConstraintNote"),
      wkBanner: document.getElementById("wkBanner"),
    
      wkLeversIntro: document.getElementById("wkLeversIntro"),
      wkBestMovesIntro: document.getElementById("wkBestMovesIntro"),
      wkBestMovesList: document.getElementById("wkBestMovesList"),
      wkLeversTbody: document.getElementById("wkLeversTbody"),
      wkLeversFoot: document.getElementById("wkLeversFoot"),
      wkActionsList: document.getElementById("wkActionsList"),
      wkUndoActionBtn: document.getElementById("wkUndoActionBtn"),
      wkUndoActionMsg: document.getElementById("wkUndoActionMsg"),
      wkLastUpdate: document.getElementById("wkLastUpdate"),
      wkFreshNote: document.getElementById("wkFreshNote"),
      wkRollingAttempts: document.getElementById("wkRollingAttempts"),
      wkRollingNote: document.getElementById("wkRollingNote"),
      wkRollingCR: document.getElementById("wkRollingCR"),
      wkRollingCRNote: document.getElementById("wkRollingCRNote"),
      wkRollingSR: document.getElementById("wkRollingSR"),
      wkRollingSRNote: document.getElementById("wkRollingSRNote"),
      wkRollingAPH: document.getElementById("wkRollingAPH"),
      wkRollingAPHNote: document.getElementById("wkRollingAPHNote"),
      wkFreshStatus: document.getElementById("wkFreshStatus"),
      wkReqConvosWeek: document.getElementById("wkReqConvosWeek"),
        wkActConvos7: document.getElementById("wkActConvos7"),
        wkActConvosNote: document.getElementById("wkActConvosNote"),
        wkGapConvos: document.getElementById("wkGapConvos"),
        wkConvosPaceTag: document.getElementById("wkConvosPaceTag"),
      
        wkReqAttemptsWeek: document.getElementById("wkReqAttemptsWeek"),
        wkActAttempts7: document.getElementById("wkActAttempts7"),
        wkActAttemptsNote: document.getElementById("wkActAttemptsNote"),
        wkGapAttempts: document.getElementById("wkGapAttempts"),
        wkAttemptsPaceTag: document.getElementById("wkAttemptsPaceTag"),
      
        wkReqDoorAttemptsWeek: document.getElementById("wkReqDoorAttemptsWeek"),
        wkReqCallAttemptsWeek: document.getElementById("wkReqCallAttemptsWeek"),
        wkImpliedConvosWeek: document.getElementById("wkImpliedConvosWeek"),
        wkImpliedConvosNote: document.getElementById("wkImpliedConvosNote"),
      
        wkFinishConvos: document.getElementById("wkFinishConvos"),
        wkFinishAttempts: document.getElementById("wkFinishAttempts"),
        wkPaceStatus: document.getElementById("wkPaceStatus"),
        wkPaceNote: document.getElementById("wkPaceNote"),
        wkExecBanner: document.getElementById("wkExecBanner"),
      
      // Daily log import/export (analyst page)
      dailyLogExportBtn: document.getElementById("dailyLogExportBtn"),
      dailyLogImportText: document.getElementById("dailyLogImportText"),
      dailyLogImportBtn: document.getElementById("dailyLogImportBtn"),
      dailyLogImportMsg: document.getElementById("dailyLogImportMsg"),
    
      applyRollingCRBtn: document.getElementById("applyRollingCRBtn"),
      applyRollingSRBtn: document.getElementById("applyRollingSRBtn"),
      applyRollingMsg: document.getElementById("applyRollingMsg"),
    
      // Phase 3 — execution + risk
      orgCount: document.getElementById("orgCount"),
      orgHoursPerWeek: document.getElementById("orgHoursPerWeek"),
      volunteerMultBase: document.getElementById("volunteerMultBase"),
      channelDoorPct: document.getElementById("channelDoorPct"),
      doorsPerHour3: document.getElementById("doorsPerHour3"),
      callsPerHour3: document.getElementById("callsPerHour3"),
    
      p3Weeks: document.getElementById("p3Weeks"),
      p3CapContacts: document.getElementById("p3CapContacts"),
      p3GapContacts: document.getElementById("p3GapContacts"),
      p3GapNote: document.getElementById("p3GapNote"),
    
      mcMode: document.getElementById("mcMode"),
      mcSeed: document.getElementById("mcSeed"),
      mcRun: document.getElementById("mcRun"),
      mcRerun: document.getElementById("mcRerun"),
      mcFreshTag: document.getElementById("mcFreshTag"),
      mcLastRun: document.getElementById("mcLastRun"),
      mcStale: document.getElementById("mcStale"),
      mcBasic: document.getElementById("mcBasic"),
      mcAdvanced: document.getElementById("mcAdvanced"),
      mcVolatility: document.getElementById("mcVolatility"),
      turnoutReliabilityPct: document.getElementById("turnoutReliabilityPct"),
    
      turnoutEnabled: document.getElementById("turnoutEnabled"),
      turnoutBaselinePct: document.getElementById("turnoutBaselinePct"),
      turnoutTargetOverridePct: document.getElementById("turnoutTargetOverridePct"),
      gotvMode: document.getElementById("gotvMode"),
      gotvBasic: document.getElementById("gotvBasic"),
      gotvAdvanced: document.getElementById("gotvAdvanced"),
      gotvLiftPP: document.getElementById("gotvLiftPP"),
      gotvMaxLiftPP: document.getElementById("gotvMaxLiftPP"),
      gotvDiminishing: document.getElementById("gotvDiminishing"),
      gotvLiftMin: document.getElementById("gotvLiftMin"),
      gotvLiftMode: document.getElementById("gotvLiftMode"),
      gotvLiftMax: document.getElementById("gotvLiftMax"),
      gotvMaxLiftPP2: document.getElementById("gotvMaxLiftPP2"),
      gotvDiminishing2: document.getElementById("gotvDiminishing2"),
      turnoutSummary: document.getElementById("turnoutSummary"),
    
      mcContactMin: document.getElementById("mcContactMin"),
      mcContactMode: document.getElementById("mcContactMode"),
      mcContactMax: document.getElementById("mcContactMax"),
      mcPersMin: document.getElementById("mcPersMin"),
      mcPersMode: document.getElementById("mcPersMode"),
      mcPersMax: document.getElementById("mcPersMax"),
      mcReliMin: document.getElementById("mcReliMin"),
      mcReliMode: document.getElementById("mcReliMode"),
      mcReliMax: document.getElementById("mcReliMax"),
      mcDphMin: document.getElementById("mcDphMin"),
      mcDphMode: document.getElementById("mcDphMode"),
      mcDphMax: document.getElementById("mcDphMax"),
      mcCphMin: document.getElementById("mcCphMin"),
      mcCphMode: document.getElementById("mcCphMode"),
      mcCphMax: document.getElementById("mcCphMax"),
      mcVolMin: document.getElementById("mcVolMin"),
      mcVolMode: document.getElementById("mcVolMode"),
      mcVolMax: document.getElementById("mcVolMax"),
    
      mcWinProb: document.getElementById("mcWinProb"),
      mcMedian: document.getElementById("mcMedian"),
      mcP5: document.getElementById("mcP5"),
      mcP95: document.getElementById("mcP95"),
      // Phase 14 — confidence envelope
      mcP10: document.getElementById("mcP10"),
      mcP50: document.getElementById("mcP50"),
      mcP90: document.getElementById("mcP90"),
      // Phase D2 — ops envelope
      opsAttP10: document.getElementById("opsAttP10"),
      opsAttP50: document.getElementById("opsAttP50"),
      opsAttP90: document.getElementById("opsAttP90"),
      opsConP10: document.getElementById("opsConP10"),
      opsConP50: document.getElementById("opsConP50"),
      opsConP90: document.getElementById("opsConP90"),
      opsFinishP10: document.getElementById("opsFinishP10"),
      opsFinishP50: document.getElementById("opsFinishP50"),
      opsFinishP90: document.getElementById("opsFinishP90"),
      opsMissProb: document.getElementById("opsMissProb"),
      opsMissTag: document.getElementById("opsMissTag"),
      mcMoS: document.getElementById("mcMoS"),
      mcDownside: document.getElementById("mcDownside"),
      mcES10: document.getElementById("mcES10"),
      mcShiftP50: document.getElementById("mcShiftP50"),
      mcShiftP10: document.getElementById("mcShiftP10"),
      mcFragility: document.getElementById("mcFragility"),
      mcCliff: document.getElementById("mcCliff"),
      // Phase 14.1 — advisor completion
      mcRiskGrade: document.getElementById("mcRiskGrade"),
      mcShift60: document.getElementById("mcShift60"),
      mcShift70: document.getElementById("mcShift70"),
      mcShift80: document.getElementById("mcShift80"),
      mcShock10: document.getElementById("mcShock10"),
      mcShock25: document.getElementById("mcShock25"),
      mcShock50: document.getElementById("mcShock50"),
      mcRiskLabel: document.getElementById("mcRiskLabel"),
      mcSensitivity: document.getElementById("mcSensitivity"),
    
      // Lightweight visuals (SVG)
      svgWinProb: document.getElementById("svgWinProb"),
      svgWinProbMarker: document.getElementById("svgWinProbMarker"),
      vizWinProbNote: document.getElementById("vizWinProbNote"),
      svgMargin: document.getElementById("svgMargin"),
      svgMarginBars: document.getElementById("svgMarginBars"),
      svgMarginWinShade: document.getElementById("svgMarginWinShade"),
      svgMarginZero: document.getElementById("svgMarginZero"),
      svgMarginMin: document.getElementById("svgMarginMin"),
      svgMarginMax: document.getElementById("svgMarginMax"),
        // Phase 4 — budget + ROI
        roiDoorsEnabled: document.getElementById("roiDoorsEnabled"),
        roiDoorsCpa: document.getElementById("roiDoorsCpa"),
        roiDoorsKind: document.getElementById("roiDoorsKind"),
        roiDoorsCr: document.getElementById("roiDoorsCr"),
        roiDoorsSr: document.getElementById("roiDoorsSr"),
        roiPhonesEnabled: document.getElementById("roiPhonesEnabled"),
        roiPhonesCpa: document.getElementById("roiPhonesCpa"),
        roiPhonesKind: document.getElementById("roiPhonesKind"),
        roiPhonesCr: document.getElementById("roiPhonesCr"),
        roiPhonesSr: document.getElementById("roiPhonesSr"),
        roiTextsEnabled: document.getElementById("roiTextsEnabled"),
        roiTextsCpa: document.getElementById("roiTextsCpa"),
        roiTextsKind: document.getElementById("roiTextsKind"),
        roiTextsCr: document.getElementById("roiTextsCr"),
        roiTextsSr: document.getElementById("roiTextsSr"),
        roiOverheadAmount: document.getElementById("roiOverheadAmount"),
        roiIncludeOverhead: document.getElementById("roiIncludeOverhead"),
        roiRefresh: document.getElementById("roiRefresh"),
        roiTbody: document.getElementById("roiTbody"),
        roiBanner: document.getElementById("roiBanner"),
    
      // Phase 5 — optimization
      optMode: document.getElementById("optMode"),
        optObjective: document.getElementById("optObjective"),
      tlOptEnabled: document.getElementById("tlOptEnabled"),
      tlOptObjective: document.getElementById("tlOptObjective"),
      tlOptResults: document.getElementById("tlOptResults"),
      tlOptGoalFeasible: document.getElementById("tlOptGoalFeasible"),
      tlOptMaxNetVotes: document.getElementById("tlOptMaxNetVotes"),
      tlOptRemainingGap: document.getElementById("tlOptRemainingGap"),
      tlOptBinding: document.getElementById("tlOptBinding"),
      tlMvPrimary: document.getElementById("tlMvPrimary"),
      tlMvSecondary: document.getElementById("tlMvSecondary"),
      tlMvTbody: document.getElementById("tlMvTbody"),
      optBudget: document.getElementById("optBudget"),
      optCapacity: document.getElementById("optCapacity"),
      optStep: document.getElementById("optStep"),
      optUseDecay: document.getElementById("optUseDecay"),
      optRun: document.getElementById("optRun"),
      optTbody: document.getElementById("optTbody"),
      optBanner: document.getElementById("optBanner"),
      optTotalAttempts: document.getElementById("optTotalAttempts"),
      optTotalCost: document.getElementById("optTotalCost"),
      optTotalVotes: document.getElementById("optTotalVotes"),
      optBinding: document.getElementById("optBinding"),
      optGapContext: document.getElementById("optGapContext"),
    
      // Phase 7 — timeline / production
      timelineEnabled: document.getElementById("timelineEnabled"),
      timelineWeeksAuto: document.getElementById("timelineWeeksAuto"),
      timelineActiveWeeks: document.getElementById("timelineActiveWeeks"),
      timelineGotvWeeks: document.getElementById("timelineGotvWeeks"),
      timelineStaffCount: document.getElementById("timelineStaffCount"),
      timelineStaffHours: document.getElementById("timelineStaffHours"),
      timelineVolCount: document.getElementById("timelineVolCount"),
      timelineVolHours: document.getElementById("timelineVolHours"),
      timelineRampEnabled: document.getElementById("timelineRampEnabled"),
      timelineRampMode: document.getElementById("timelineRampMode"),
      timelineDoorsPerHour: document.getElementById("timelineDoorsPerHour"),
      timelineCallsPerHour: document.getElementById("timelineCallsPerHour"),
      timelineTextsPerHour: document.getElementById("timelineTextsPerHour"),
      tlPercent: document.getElementById("tlPercent"),
      tlCompletionWeek: document.getElementById("tlCompletionWeek"),
      tlShortfallAttempts: document.getElementById("tlShortfallAttempts"),
      tlConstraint: document.getElementById("tlConstraint"),
      tlShortfallVotes: document.getElementById("tlShortfallVotes"),
      tlWeekList: document.getElementById("tlWeekList"),
      tlBanner: document.getElementById("tlBanner"),
    
      validationList: document.getElementById("validationList"),
    
      kpiTurnoutVotes: document.getElementById("kpiTurnoutVotes"),
      kpiTurnoutBand: document.getElementById("kpiTurnoutBand"),
      kpiWinThreshold: document.getElementById("kpiWinThreshold"),
      kpiYourVotes: document.getElementById("kpiYourVotes"),
      kpiYourVotesShare: document.getElementById("kpiYourVotesShare"),
      kpiPersuasionNeed: document.getElementById("kpiPersuasionNeed"),
      kpiPersuasionStatus: document.getElementById("kpiPersuasionStatus"),
    
      miniEarlyVotes: document.getElementById("miniEarlyVotes"),
      miniEarlyNote: document.getElementById("miniEarlyNote"),
      miniEDVotes: document.getElementById("miniEDVotes"),
      miniPersUniverse: document.getElementById("miniPersUniverse"),
      miniPersCheck: document.getElementById("miniPersCheck"),
    
      stressBox: document.getElementById("stressBox"),
      explainCard: document.getElementById("explainCard"),
    
      assumptionsSnapshot: document.getElementById("assumptionsSnapshot"),
      guardrails: document.getElementById("guardrails"),
    
      btnSaveJson: document.getElementById("btnSaveJson"),
      loadJson: document.getElementById("loadJson"),
      btnExportCsv: document.getElementById("btnExportCsv"),
      btnCopySummary: document.getElementById("btnCopySummary"),
      btnResetAll: document.getElementById("btnResetAll"),
    
      toggleTraining: document.getElementById("toggleTraining"),
      toggleDark: document.getElementById("toggleDark"),
      toggleAdvDiag: document.getElementById("toggleAdvDiag"),
      advDiagBox: document.getElementById("advDiagBox"),
      snapshotHash: document.getElementById("snapshotHash"),
      importHashBanner: document.getElementById("importHashBanner"),
      importWarnBanner: document.getElementById("importWarnBanner"),
    
      // Phase 12 — Decision Intelligence
      diWarn: document.getElementById("diWarn"),
      diPrimary: document.getElementById("diPrimary"),
      diSecondary: document.getElementById("diSecondary"),
      diNotBinding: document.getElementById("diNotBinding"),
      diRecVol: document.getElementById("diRecVol"),
      diRecCost: document.getElementById("diRecCost"),
      diRecProb: document.getElementById("diRecProb"),
      diVolTbody: document.getElementById("diVolTbody"),
      diCostTbody: document.getElementById("diCostTbody"),
      diProbTbody: document.getElementById("diProbTbody"),
    
      // Phase 15 — Sensitivity Surface
      surfaceLever: document.getElementById("surfaceLever"),
      surfaceMode: document.getElementById("surfaceMode"),
      surfaceMin: document.getElementById("surfaceMin"),
      surfaceMax: document.getElementById("surfaceMax"),
      surfaceSteps: document.getElementById("surfaceSteps"),
      surfaceTarget: document.getElementById("surfaceTarget"),
      btnComputeSurface: document.getElementById("btnComputeSurface"),
      surfaceStatus: document.getElementById("surfaceStatus"),
      surfaceTbody: document.getElementById("surfaceTbody"),
      surfaceSummary: document.getElementById("surfaceSummary"),
  };
}

export function wireUI(els, ctx){
  const {
    state,
    setState,
    setUI,
    persist,
    render,
    markMcStale,
    safeCall,
    refreshBackupDropdown,
    restoreBackupByIndex,
    openDiagnostics,
    closeDiagnostics,
    copyDebugBundle,
    exportDailyLog,
    mergeDailyLogIntoState,
    applyRollingRateToAssumption,
    undoLastWeeklyAction,
    applyStateToUI,
    applyThemeFromState,
    initThemeSystemListener,
    DEFAULTS_BY_TEMPLATE,
    uid,
    rebuildCandidateTable,
    rebuildUserSplitInputs,
    rebuildYourCandidateSelect,
    syncGotvModeUI,
    syncMcModeUI,
    runMonteCarloNow,
    safeNum,
    fmtInt,
    clamp,
    downloadText,
  } = ctx;

    // Phase 11 — safety rails controls (fail-soft)
    safeCall(() => {
      if (els.toggleStrictImport){
        els.toggleStrictImport.checked = !!state?.ui?.strictImport;
        wireCheckbox(els.toggleStrictImport, {
          set: (v) => {
            setUI((ui) => { ui.strictImport = !!v; }, { render: false });
            persist();
          }
        });
      }
      if (els.restoreBackup){
        refreshBackupDropdown();
        els.restoreBackup.addEventListener("change", () => {
          const v = els.restoreBackup.value;
          if (!v) return;
          restoreBackupByIndex(v);
          els.restoreBackup.value = "";
        });
      }
      if (els.btnDiagnostics) els.btnDiagnostics.addEventListener("click", openDiagnostics);
      if (els.btnDiagClose) els.btnDiagClose.addEventListener("click", closeDiagnostics);
      if (els.diagModal){
        els.diagModal.addEventListener("click", (e) => {
          const t = e?.target;
          if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeDiagnostics();
        });
      }
      if (els.btnCopyDebug) els.btnCopyDebug.addEventListener("click", () => { safeCall(() => { copyDebugBundle(); }); });
  
      // Daily log import/export
      if (els.dailyLogExportBtn) els.dailyLogExportBtn.addEventListener("click", () => { safeCall(() => { exportDailyLog(); }); });
      if (els.dailyLogImportBtn) els.dailyLogImportBtn.addEventListener("click", () => {
        safeCall(() => {
          const raw = String(els.dailyLogImportText?.value || "").trim();
          if (!raw){
            if (els.dailyLogImportMsg) els.dailyLogImportMsg.textContent = "Paste JSON first";
            return;
          }
          let parsed = null;
          try{ parsed = JSON.parse(raw); } catch {
            if (els.dailyLogImportMsg) els.dailyLogImportMsg.textContent = "Invalid JSON";
            return;
          }
          const r = mergeDailyLogIntoState(parsed);
          if (els.dailyLogImportMsg) els.dailyLogImportMsg.textContent = r.msg;
        });
      });
  
      if (els.dailyLogImportText){
        wireInput(els.dailyLogImportText, {
          event: "input",
          get: (x) => String(x.value || ""),
          set: () => {
            if (els.dailyLogImportMsg) els.dailyLogImportMsg.textContent = "";
          }
        });
      }
  
      // Analyst tools: align assumptions to rolling actuals
      if (els.applyRollingCRBtn) els.applyRollingCRBtn.addEventListener("click", () => { safeCall(() => { applyRollingRateToAssumption("contact"); }); });
      if (els.applyRollingSRBtn) els.applyRollingSRBtn.addEventListener("click", () => { safeCall(() => { applyRollingRateToAssumption("support"); }); });
      if (els.wkUndoActionBtn) els.wkUndoActionBtn.addEventListener("click", () => { safeCall(() => { undoLastWeeklyAction(); }); });
    });
  
  
    els.scenarioName.addEventListener("input", () => { state.scenarioName = els.scenarioName.value; persist(); });
  
    els.raceType.addEventListener("change", () => {
      state.raceType = els.raceType.value;
      const defs = DEFAULTS_BY_TEMPLATE[state.raceType] || DEFAULTS_BY_TEMPLATE.state_leg;
      if (!state.bandWidth && state.bandWidth !== 0) state.bandWidth = defs.bandWidth;
      state.bandWidth = state.bandWidth || defs.bandWidth;
      state.persuasionPct = state.persuasionPct || defs.persuasionPct;
      state.earlyVoteExp = state.earlyVoteExp || defs.earlyVoteExp;
      applyStateToUI();
    applyThemeFromState();
    initThemeSystemListener();
      render();
      persist();
    });
  
    els.electionDate.addEventListener("change", () => { state.electionDate = els.electionDate.value; render(); persist(); });
    els.weeksRemaining.addEventListener("input", () => { state.weeksRemaining = els.weeksRemaining.value; render(); persist(); });
    els.mode.addEventListener("change", () => { state.mode = els.mode.value; persist(); });
  
    els.universeBasis.addEventListener("change", () => { state.universeBasis = els.universeBasis.value; render(); persist(); });
    els.universeSize.addEventListener("input", () => { state.universeSize = safeNum(els.universeSize.value); render(); persist(); });
    els.sourceNote.addEventListener("input", () => { state.sourceNote = els.sourceNote.value; persist(); });
  
    els.turnoutA.addEventListener("input", () => { state.turnoutA = safeNum(els.turnoutA.value); render(); persist(); });
    els.turnoutB.addEventListener("input", () => { state.turnoutB = safeNum(els.turnoutB.value); render(); persist(); });
    els.bandWidth.addEventListener("input", () => { state.bandWidth = safeNum(els.bandWidth.value); render(); persist(); });
  
    els.btnAddCandidate.addEventListener("click", () => {
      state.candidates.push({ id: uid(), name: `Candidate ${String.fromCharCode(65 + state.candidates.length)}`, supportPct: 0 });
      rebuildCandidateTable();
      render();
      persist();
    });
  
    els.yourCandidate.addEventListener("change", () => { state.yourCandidateId = els.yourCandidate.value; render(); persist(); });
    els.undecidedPct.addEventListener("input", () => { state.undecidedPct = safeNum(els.undecidedPct.value); render(); persist(); });
  
    els.undecidedMode.addEventListener("change", () => {
      state.undecidedMode = els.undecidedMode.value;
      rebuildUserSplitInputs();
      render();
      persist();
    });
  
    els.persuasionPct.addEventListener("input", () => { state.persuasionPct = safeNum(els.persuasionPct.value); render(); persist(); });
    els.earlyVoteExp.addEventListener("input", () => { state.earlyVoteExp = safeNum(els.earlyVoteExp.value); render(); persist(); });
  
    // Phase 2 — conversion + capacity
    if (els.goalSupportIds) els.goalSupportIds.addEventListener("input", () => { state.goalSupportIds = els.goalSupportIds.value; markMcStale(); render(); persist(); });
    if (els.supportRatePct) els.supportRatePct.addEventListener("input", () => { state.supportRatePct = safeNum(els.supportRatePct.value); markMcStale(); render(); persist(); });
    if (els.contactRatePct) els.contactRatePct.addEventListener("input", () => { state.contactRatePct = safeNum(els.contactRatePct.value); markMcStale(); render(); persist(); });
    if (els.doorsPerHour) els.doorsPerHour.addEventListener("input", () => { state.doorsPerHour = safeNum(els.doorsPerHour.value); render(); persist(); });
    if (els.hoursPerShift) els.hoursPerShift.addEventListener("input", () => { state.hoursPerShift = safeNum(els.hoursPerShift.value); render(); persist(); });
    if (els.shiftsPerVolunteerPerWeek) els.shiftsPerVolunteerPerWeek.addEventListener("input", () => { state.shiftsPerVolunteerPerWeek = safeNum(els.shiftsPerVolunteerPerWeek.value); render(); persist(); });
  
    // Phase 16 — universe composition + retention
    if (els.universe16Enabled) els.universe16Enabled.addEventListener("change", () => { state.universeLayerEnabled = !!els.universe16Enabled.checked; markMcStale(); render(); persist(); });
    if (els.universe16DemPct) els.universe16DemPct.addEventListener("input", () => { state.universeDemPct = safeNum(els.universe16DemPct.value); markMcStale(); render(); persist(); });
    if (els.universe16RepPct) els.universe16RepPct.addEventListener("input", () => { state.universeRepPct = safeNum(els.universe16RepPct.value); markMcStale(); render(); persist(); });
    if (els.universe16NpaPct) els.universe16NpaPct.addEventListener("input", () => { state.universeNpaPct = safeNum(els.universe16NpaPct.value); markMcStale(); render(); persist(); });
    if (els.universe16OtherPct) els.universe16OtherPct.addEventListener("input", () => { state.universeOtherPct = safeNum(els.universe16OtherPct.value); markMcStale(); render(); persist(); });
    if (els.retentionFactor) els.retentionFactor.addEventListener("input", () => { state.retentionFactor = safeNum(els.retentionFactor.value); markMcStale(); render(); persist(); });
  
    // Phase 3 — execution + risk
    if (els.orgCount) els.orgCount.addEventListener("input", () => { state.orgCount = safeNum(els.orgCount.value); markMcStale(); render(); persist(); });
    if (els.orgHoursPerWeek) els.orgHoursPerWeek.addEventListener("input", () => { state.orgHoursPerWeek = safeNum(els.orgHoursPerWeek.value); markMcStale(); render(); persist(); });
    if (els.volunteerMultBase) els.volunteerMultBase.addEventListener("input", () => { state.volunteerMultBase = safeNum(els.volunteerMultBase.value); markMcStale(); render(); persist(); });
    if (els.channelDoorPct) els.channelDoorPct.addEventListener("input", () => { state.channelDoorPct = safeNum(els.channelDoorPct.value); markMcStale(); render(); persist(); });
    if (els.doorsPerHour3) els.doorsPerHour3.addEventListener("input", () => { state.doorsPerHour3 = safeNum(els.doorsPerHour3.value); markMcStale(); render(); persist(); });
    if (els.callsPerHour3) els.callsPerHour3.addEventListener("input", () => { state.callsPerHour3 = safeNum(els.callsPerHour3.value); markMcStale(); render(); persist(); });
    if (els.turnoutReliabilityPct) els.turnoutReliabilityPct.addEventListener("input", () => { state.turnoutReliabilityPct = safeNum(els.turnoutReliabilityPct.value); markMcStale(); render(); persist(); });
  
    // Phase 6 — turnout / GOTV inputs
    if (els.turnoutEnabled) els.turnoutEnabled.addEventListener("change", () => { state.turnoutEnabled = !!els.turnoutEnabled.checked; markMcStale(); render(); persist(); });
    if (els.turnoutBaselinePct) els.turnoutBaselinePct.addEventListener("input", () => { state.turnoutBaselinePct = safeNum(els.turnoutBaselinePct.value); markMcStale(); render(); persist(); });
    if (els.turnoutTargetOverridePct) els.turnoutTargetOverridePct.addEventListener("input", () => { state.turnoutTargetOverridePct = els.turnoutTargetOverridePct.value; markMcStale(); render(); persist(); });
  
    if (els.gotvMode) els.gotvMode.addEventListener("change", () => { state.gotvMode = els.gotvMode.value; syncGotvModeUI(); markMcStale(); render(); persist(); });
  
    if (els.gotvLiftPP) els.gotvLiftPP.addEventListener("input", () => { state.gotvLiftPP = safeNum(els.gotvLiftPP.value); markMcStale(); render(); persist(); });
    if (els.gotvMaxLiftPP) els.gotvMaxLiftPP.addEventListener("input", () => { state.gotvMaxLiftPP = safeNum(els.gotvMaxLiftPP.value); markMcStale(); render(); persist(); });
    if (els.gotvDiminishing) els.gotvDiminishing.addEventListener("change", () => { state.gotvDiminishing = !!els.gotvDiminishing.checked; markMcStale(); render(); persist(); });
  
    if (els.gotvLiftMin) els.gotvLiftMin.addEventListener("input", () => { state.gotvLiftMin = safeNum(els.gotvLiftMin.value); markMcStale(); render(); persist(); });
    if (els.gotvLiftMode) els.gotvLiftMode.addEventListener("input", () => { state.gotvLiftMode = safeNum(els.gotvLiftMode.value); markMcStale(); render(); persist(); });
    if (els.gotvLiftMax) els.gotvLiftMax.addEventListener("input", () => { state.gotvLiftMax = safeNum(els.gotvLiftMax.value); markMcStale(); render(); persist(); });
    if (els.gotvMaxLiftPP2) els.gotvMaxLiftPP2.addEventListener("input", () => { state.gotvMaxLiftPP2 = safeNum(els.gotvMaxLiftPP2.value); markMcStale(); render(); persist(); });
    if (els.gotvDiminishing2) els.gotvDiminishing2.addEventListener("change", () => { state.gotvDiminishing2 = !!els.gotvDiminishing2.checked; markMcStale(); render(); persist(); });
  
  
    if (els.mcMode) els.mcMode.addEventListener("change", () => { state.mcMode = els.mcMode.value; syncMcModeUI(); markMcStale(); persist(); });
    if (els.mcVolatility) els.mcVolatility.addEventListener("change", () => { state.mcVolatility = els.mcVolatility.value; markMcStale(); persist(); });
    if (els.mcSeed) els.mcSeed.addEventListener("input", () => { state.mcSeed = els.mcSeed.value; markMcStale(); persist(); });
  
    const advWatch = (el, key) => {
      if (!el) return;
      el.addEventListener("input", () => {
        state[key] = safeNum(el.value);
        markMcStale();
        persist();
      });
    };
    advWatch(els.mcContactMin, "mcContactMin");
    advWatch(els.mcContactMode, "mcContactMode");
    advWatch(els.mcContactMax, "mcContactMax");
    advWatch(els.mcPersMin, "mcPersMin");
    advWatch(els.mcPersMode, "mcPersMode");
    advWatch(els.mcPersMax, "mcPersMax");
    advWatch(els.mcReliMin, "mcReliMin");
    advWatch(els.mcReliMode, "mcReliMode");
    advWatch(els.mcReliMax, "mcReliMax");
    advWatch(els.mcDphMin, "mcDphMin");
    advWatch(els.mcDphMode, "mcDphMode");
    advWatch(els.mcDphMax, "mcDphMax");
    advWatch(els.mcCphMin, "mcCphMin");
    advWatch(els.mcCphMode, "mcCphMode");
    advWatch(els.mcCphMax, "mcCphMax");
    advWatch(els.mcVolMin, "mcVolMin");
    advWatch(els.mcVolMode, "mcVolMode");
    advWatch(els.mcVolMax, "mcVolMax");
  
    if (els.mcRun) els.mcRun.addEventListener("click", () => runMonteCarloNow());
    if (els.mcRerun) els.mcRerun.addEventListener("click", () => runMonteCarloNow());
  
  
      // Phase 4 — ROI inputs
      const ensureBudget = () => {
        if (!state.budget) state.budget = { overheadAmount: 0, includeOverhead: false, tactics: { doors:{enabled:true,cpa:0,crPct:null,srPct:null,kind:"persuasion"}, phones:{enabled:true,cpa:0,crPct:null,srPct:null,kind:"persuasion"}, texts:{enabled:false,cpa:0,crPct:null,srPct:null,kind:"persuasion"} }, optimize: { mode:"budget", budgetAmount:10000, capacityAttempts:"", step:25, useDecay:false, objective:"net", tlConstrainedEnabled:false, tlConstrainedObjective:"max_net" } };
        if (!state.budget.tactics) state.budget.tactics = { doors:{enabled:true,cpa:0,crPct:null,srPct:null}, phones:{enabled:true,cpa:0,crPct:null,srPct:null}, texts:{enabled:false,cpa:0,crPct:null,srPct:null} };
        if (!state.budget.optimize) state.budget.optimize = { mode:"budget", budgetAmount:10000, capacityAttempts:"", step:25, useDecay:false, objective:"net", tlConstrainedEnabled:false, tlConstrainedObjective:"max_net" };
        if (!state.budget.tactics.doors) state.budget.tactics.doors = { enabled:true, cpa:0, crPct:null, srPct:null };
        if (!state.budget.tactics.phones) state.budget.tactics.phones = { enabled:true, cpa:0, crPct:null, srPct:null };
        if (!state.budget.tactics.texts) state.budget.tactics.texts = { enabled:false, cpa:0, crPct:null, srPct:null };
      };
  
      const watchBool = (el, fn) => {
        if (!el) return;
        el.addEventListener("change", () => { ensureBudget(); fn(); render(); persist(); });
      };
      const watchNum = (el, fn) => {
        if (!el) return;
        el.addEventListener("input", () => { ensureBudget(); fn(); render(); persist(); });
      };
  
      watchBool(els.roiDoorsEnabled, () => state.budget.tactics.doors.enabled = !!els.roiDoorsEnabled.checked);
      watchNum(els.roiDoorsCpa, () => state.budget.tactics.doors.cpa = safeNum(els.roiDoorsCpa.value) ?? 0);
      watchNum(els.roiDoorsCr, () => state.budget.tactics.doors.crPct = safeNum(els.roiDoorsCr.value));
      watchNum(els.roiDoorsSr, () => state.budget.tactics.doors.srPct = safeNum(els.roiDoorsSr.value));
  
  
      watchBool(els.roiPhonesEnabled, () => state.budget.tactics.phones.enabled = !!els.roiPhonesEnabled.checked);
      watchNum(els.roiPhonesCpa, () => state.budget.tactics.phones.cpa = safeNum(els.roiPhonesCpa.value) ?? 0);
      watchNum(els.roiPhonesCr, () => state.budget.tactics.phones.crPct = safeNum(els.roiPhonesCr.value));
      watchNum(els.roiPhonesSr, () => state.budget.tactics.phones.srPct = safeNum(els.roiPhonesSr.value));
  
  
      watchBool(els.roiTextsEnabled, () => state.budget.tactics.texts.enabled = !!els.roiTextsEnabled.checked);
      watchNum(els.roiTextsCpa, () => state.budget.tactics.texts.cpa = safeNum(els.roiTextsCpa.value) ?? 0);
      watchNum(els.roiTextsCr, () => state.budget.tactics.texts.crPct = safeNum(els.roiTextsCr.value));
      watchNum(els.roiTextsSr, () => state.budget.tactics.texts.srPct = safeNum(els.roiTextsSr.value));
  
  
      watchNum(els.roiOverheadAmount, () => state.budget.overheadAmount = safeNum(els.roiOverheadAmount.value) ?? 0);
      watchBool(els.roiIncludeOverhead, () => state.budget.includeOverhead = !!els.roiIncludeOverhead.checked);
  
      
  // Phase 5 — optimization controls (top-layer only; does not change Phase 1–4 math)
  const watchOpt = (el, fn, evt="input") => {
    if (!el) return;
    el.addEventListener(evt, () => { ensureBudget(); fn(); render(); persist(); });
  };
  
  watchOpt(els.optMode, () => state.budget.optimize.mode = els.optMode.value, "change");
  watchOpt(els.optObjective, () => state.budget.optimize.objective = els.optObjective.value, "change");
  watchOpt(els.tlOptEnabled, () => state.budget.optimize.tlConstrainedEnabled = !!els.tlOptEnabled.checked, "change");
  watchOpt(els.tlOptObjective, () => state.budget.optimize.tlConstrainedObjective = els.tlOptObjective.value || "max_net", "change");
  watchOpt(els.optBudget, () => state.budget.optimize.budgetAmount = safeNum(els.optBudget.value) ?? 0);
  watchOpt(els.optCapacity, () => state.budget.optimize.capacityAttempts = els.optCapacity.value ?? "");
  watchOpt(els.optStep, () => state.budget.optimize.step = safeNum(els.optStep.value) ?? 25);
  watchOpt(els.optUseDecay, () => state.budget.optimize.useDecay = !!els.optUseDecay.checked, "change");
  
  // Phase 7 — timeline / production (feasibility only; never re-optimizes)
  const watchTL = (el, fn, evt="input") => {
    if (!el) return;
    el.addEventListener(evt, () => { fn(); render(); persist(); });
  };
  
  watchTL(els.timelineEnabled, () => state.timelineEnabled = !!els.timelineEnabled.checked, "change");
  watchTL(els.timelineActiveWeeks, () => state.timelineActiveWeeks = els.timelineActiveWeeks.value ?? "");
  watchTL(els.timelineGotvWeeks, () => state.timelineGotvWeeks = safeNum(els.timelineGotvWeeks.value));
  watchTL(els.timelineStaffCount, () => state.timelineStaffCount = safeNum(els.timelineStaffCount.value) ?? 0);
  watchTL(els.timelineStaffHours, () => state.timelineStaffHours = safeNum(els.timelineStaffHours.value) ?? 0);
  watchTL(els.timelineVolCount, () => state.timelineVolCount = safeNum(els.timelineVolCount.value) ?? 0);
  watchTL(els.timelineVolHours, () => state.timelineVolHours = safeNum(els.timelineVolHours.value) ?? 0);
  watchTL(els.timelineRampEnabled, () => state.timelineRampEnabled = !!els.timelineRampEnabled.checked, "change");
  watchTL(els.timelineRampMode, () => state.timelineRampMode = els.timelineRampMode.value || "linear", "change");
  watchTL(els.timelineDoorsPerHour, () => state.timelineDoorsPerHour = safeNum(els.timelineDoorsPerHour.value) ?? 0);
  watchTL(els.timelineCallsPerHour, () => state.timelineCallsPerHour = safeNum(els.timelineCallsPerHour.value) ?? 0);
  watchTL(els.timelineTextsPerHour, () => state.timelineTextsPerHour = safeNum(els.timelineTextsPerHour.value) ?? 0);
  
  if (els.optRun) els.optRun.addEventListener("click", () => { render(); });
  if (els.roiRefresh) els.roiRefresh.addEventListener("click", () => { render(); });
  
    document.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.getAttribute("data-tab");
        state.ui.activeTab = tab;
  
        document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
        document.getElementById(`tab-${tab}`).classList.add("active");
  
        persist();
      });
    });
  
    if (els.btnSaveJson) els.btnSaveJson.addEventListener("click", () => {
      const scenarioClone = structuredClone(state);
      const snapshot = { modelVersion: engine.snapshot.MODEL_VERSION, schemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION, scenarioState: scenarioClone, appVersion: APP_VERSION, buildId: BUILD_ID };
      snapshot.snapshotHash = engine.snapshot.computeSnapshotHash(snapshot);
      lastExportHash = snapshot.snapshotHash;
      const payload = engine.snapshot.makeScenarioExport(snapshot);
      if (engine.snapshot.hasNonFiniteNumbers(payload)){
        alert("Export blocked: scenario contains NaN/Infinity.");
        return;
      }
      const filename = engine.snapshot.makeTimestampedFilename("field-path-scenario", "json");
      const text = engine.snapshot.deterministicStringify(payload, 2);
      downloadText(text, filename, "application/json");
    });
  
    if (els.btnExportCsv) els.btnExportCsv.addEventListener("click", () => {
      if (!lastResultsSnapshot){
        alert("Nothing to export yet. Run a scenario first.");
        return;
      }
      const csv = engine.snapshot.planRowsToCsv(lastResultsSnapshot);
      if (/NaN|Infinity/.test(csv)){
        alert("CSV export blocked: contains NaN/Infinity.");
        return;
      }
      const filename = engine.snapshot.makeTimestampedFilename("field-path-plan", "csv");
      downloadText(csv, filename, "text/csv");
    });
  
    if (els.btnCopySummary) els.btnCopySummary.addEventListener("click", async () => {
      if (!lastResultsSnapshot){
        alert("Nothing to copy yet. Run a scenario first.");
        return;
      }
      const text = engine.snapshot.formatSummaryText(lastResultsSnapshot);
      const r = await engine.snapshot.copyTextToClipboard(text);
      if (!r.ok) alert(r.reason || "Copy failed.");
    });
  
    if (els.btnResetAll) els.btnResetAll.addEventListener("click", () => {
      const ok = confirm("Reset all fields to defaults? This will clear the saved scenario in this browser.");
      if (!ok) return;
      state = makeDefaultState();
      ensureScenarioRegistry();
      ensureDecisionScaffold();
      try{
        const b = state.ui.scenarios?.[SCENARIO_BASELINE_ID];
        if (b){
          b.inputs = scenarioInputsFromState(state);
          b.outputs = scenarioOutputsFromState(state);
        }
      } catch {}
      clearState();
      applyStateToUI();
      rebuildCandidateTable();
      document.body.classList.toggle("training", !!state.ui.training);
      document.body.classList.toggle("dark", !!state.ui.dark);
      if (els.explainCard) els.explainCard.hidden = !state.ui.training;
      render();
      safeCall(() => { renderScenarioManagerC1(); });
      safeCall(() => { renderDecisionSessionD1(); });
      persist();
    });
  
    els.loadJson.addEventListener("change", async () => {
      const file = els.loadJson.files?.[0];
      if (!file) return;
  
      const loaded = await readJsonFile(file);
      if (!loaded || typeof loaded !== "object"){
        alert("Import failed: invalid JSON.");
        els.loadJson.value = "";
        return;
  
      // Phase 11 — strict import: block newer schema before migration (optional)
      const prePolicy = engine.snapshot.checkStrictImportPolicy({
        strictMode: !!state?.ui?.strictImport,
        importedSchemaVersion: loaded.schemaVersion || null,
        currentSchemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
        hashMismatch: false
      });
      if (!prePolicy.ok){
        alert(prePolicy.issues.join(" "));
        els.loadJson.value = "";
        return;
      }
  
      }
  
      const mig = engine.snapshot.migrateSnapshot(loaded);
      if (els.importWarnBanner){
        if (mig.warnings && mig.warnings.length){
          els.importWarnBanner.hidden = false;
          els.importWarnBanner.textContent = mig.warnings.join(" ");
        } else {
          els.importWarnBanner.hidden = true;
          els.importWarnBanner.textContent = "";
        }
      }
  
      const v = engine.snapshot.validateScenarioExport(mig.snapshot, engine.snapshot.MODEL_VERSION);
      if (!v.ok){
        alert(`Import failed: ${v.reason}`);
        els.loadJson.value = "";
        return;
      }
  
      const missing = requiredScenarioKeysMissing(v.scenario);
      if (missing.length){
        alert("Import failed: scenario is missing required fields: " + missing.join(", "));
        els.loadJson.value = "";
        return;
      }
  
      // Phase 9B — snapshot integrity verification (+ Phase 11 strict option)
      let hashMismatch = false;
      try{
        const exportedHash = (loaded && typeof loaded === "object") ? (loaded.snapshotHash || null) : null;
        // Hash must be tied to the normalized snapshot used by the engine (after migration).
        const recomputed = engine.snapshot.computeSnapshotHash({ modelVersion: v.modelVersion, scenarioState: v.scenario });
        hashMismatch = !!(exportedHash && exportedHash !== recomputed);
  
        if (hashMismatch){
          if (els.importHashBanner){
            els.importHashBanner.hidden = false;
            els.importHashBanner.textContent = "Snapshot hash differs from exported hash.";
          }
          console.warn("Snapshot hash mismatch", { exportedHash, recomputed });
        } else {
          if (els.importHashBanner) els.importHashBanner.hidden = true;
        }
  
        const policy = engine.snapshot.checkStrictImportPolicy({
          strictMode: !!state?.ui?.strictImport,
          importedSchemaVersion: (mig?.snapshot?.schemaVersion || loaded.schemaVersion || null),
          currentSchemaVersion: engine.snapshot.CURRENT_SCHEMA_VERSION,
          hashMismatch
        });
        if (!policy.ok){
          alert(policy.issues.join(" "));
          els.loadJson.value = "";
          return;
        }
      } catch {
        // If hashing fails for any reason, do not block import unless strict explicitly requires it.
        if (state?.ui?.strictImport){
          alert("Import blocked: could not verify integrity hash in strict mode.");
          els.loadJson.value = "";
          return;
        }
      }
  
  
      // Replace entire state safely (no partial merge with current state)
      state = normalizeLoadedState(v.scenario);
      ensureScenarioRegistry();
      ensureDecisionScaffold();
      try{
        const b = state.ui.scenarios?.[SCENARIO_BASELINE_ID];
        if (b){
          b.inputs = scenarioInputsFromState(state);
          b.outputs = scenarioOutputsFromState(state);
        }
      } catch {}
      applyStateToUI();
      rebuildCandidateTable();
      document.body.classList.toggle("training", !!state.ui.training);
      document.body.classList.toggle("dark", !!state.ui.dark);
      if (els.explainCard) els.explainCard.hidden = !state.ui.training;
      render();
      safeCall(() => { renderDecisionSessionD1(); });
      persist();
      els.loadJson.value = "";
    });
  
    if (els.toggleTraining) els.toggleTraining.addEventListener("change", () => {
      state.ui.training = els.toggleTraining.checked;
      document.body.classList.toggle("training", !!state.ui.training);
      if (els.snapshotHash) els.snapshotHash.textContent = lastResultsSnapshot?.snapshotHash || "—";
    if (els.importHashBanner && els.importHashBanner.hidden === false){ /* keep until next import clears */ }
      els.explainCard.hidden = !state.ui.training;
      persist();
    });
  
    if (els.toggleDark) els.toggleDark.addEventListener("change", () => {
    // checked => force dark, unchecked => follow system
    if (!state.ui) state.ui = {};
    state.ui.themeMode = els.toggleDark.checked ? "dark" : "system";
    applyThemeFromState();
    persist();
  });
  
    if (els.toggleAdvDiag) els.toggleAdvDiag.addEventListener("change", () => {
      state.ui.advDiag = els.toggleAdvDiag.checked;
      if (els.advDiagBox) els.advDiagBox.hidden = !state.ui.advDiag;
      persist();
    });
  
  }
}
