# FPE UI 3.0 Legacy Retirement Checklist

Date: 2026-03-11  
Scope: Phase 12+ retirement planning for legacy stage containers and legacy shell wrappers.

Reference artifact:
- `checkpoints/legacy_dependency_matrix.tsv` (generated 2026-03-11; per-surface legacy ID -> stage location map).

## Current operating decision
- Shell/cutover migration is frozen unless a named blocker appears.
- Use `FPE_UI3_CLOSURE_STATUS.md` as the current stop/go reference for this phase.
- Do not reopen shell micro-seams for cleanup value alone.

## Non-negotiable guardrails
- Do not touch `js/core/*` math or engine formulas.
- Keep right rail behavior/content frozen until final cutover.
- Remove legacy containers only when bridge dependency count is zero for that container.
- Keep each retirement step reversible (one PR/checkpoint per stage cluster).

## Current blocker inventory (must clear before deleting legacy shell)
- Legacy setup compose fallback shell is retired; setup compose hook/module has been removed from runtime boot and legacy inline init paths.
- `js/app/v3/stageMount.js` still mounts legacy right rail (`#legacyResultsSidebar`) into `#v3RightRailSlot`.
- v3 `Training` toggle parity is now QA-gated end-to-end (`training-toggle-roundtrip`) and no longer tracked as an open shell holdout.
- Legacy right rail still remains a runtime compatibility dependency, but it now follows a direct canonical attach path (`#legacyResultsSidebar` -> `#v3RightRailSlot`) with no dedicated right-rail host shim.
- Most v3 surfaces are still bridge-driven from legacy IDs (by design for B->C migration), so legacy containers remain runtime dependencies.
- Scenarios surface is now runtime-native in v3 (no direct legacy ID bridge targets).
- Legacy scenario manager bindings now short-circuit when scenario DOM is absent, so `stage-scenarios` can be removed without requiring legacy scenario event wiring at boot.
- Legacy decision-session bindings now short-circuit when decision DOM is absent, preventing boot-time coupling to removed Decision Log legacy markup.
- Decision Log controls, summaries, and sensitivity snapshot execution now run through runtime decision API (`window.__FPE_DECISION_API__`) with a DOM-independent sensitivity compute path.
- v3 boot no longer hard-requires the legacy shell root wrapper to exist just to mount v3; legacy wrapper is now optional during boot and only used when present for fallback visibility.
- Legacy wrapper remains hidden by default in markup during v3 sessions.
- Explicit legacy mode (`?ui=legacy`) is retired; runtime no longer initializes inline legacy shell mode.
- Boot fallback now opens emergency diagnostics instead of switching into legacy inline shell mode.
- Legacy shell root hook is retired; wrapper retirement state is now validated through DOM marker checks in QA.
- Wrapper-scaffold cleanup: right-rail host/hooks are retired; v3 now attaches canonical `#legacyResultsSidebar` directly into `#v3RightRailSlot`.
- Wrapper-scaffold cleanup: shell-action host is retired; training fallback now uses canonical `#toggleTraining` directly.
- Wrapper-scaffold cleanup: compat-node global hook is retired; legacy compatibility lookups no longer depend on `__FPE_GET_LEGACY_COMPAT_NODE__`.

## Completed retirements
- `stage-scenarios` removed from `index.html` (legacy nav item removed as part of the same pass).
- `stage-decisions` removed from `index.html` (legacy nav item removed; Decision Log runs from runtime API bridge in v3).
- Reach v3 surface no longer reads legacy stage-capacity DOM IDs; it now hard-fails to runtime API bridge (`window.__FPE_REACH_API__`) instead of mirroring legacy DOM.
- Legacy `stage-capacity` container has been fully removed from `index.html`; legacy nav item for capacity had already been removed.
- Turnout v3 surface no longer reads legacy `#mcP50` from `stage-results` for impact margin context; it now uses right-rail `#mcP50-sidebar`.
- Outcome v3 surface now sources core MC/risk display values (P10/P50/P90 + freshness + risk band) from right-rail sidebar IDs, reducing direct reads from `stage-results`.
- Outcome v3 surface now sources risk-grade/fragility/cliff context from right-rail risk IDs (`#riskBandTag-sidebar`, `#riskVolatility-sidebar`, `#riskPlainBanner-sidebar`) instead of legacy `#mcRiskGrade/#mcFragility/#mcCliff`.
- Outcome v3 surface now sources forecast median/upside/downside display from sidebar percentiles (`#mcP50-sidebar/#mcP90-sidebar/#mcP10-sidebar`) instead of legacy `#mcMedian/#mcP95/#mcP5`.
- Outcome v3 surface now uses native v3 copy for surface/impact helper text, removing direct reads from legacy `#surfaceStatus/#surfaceSummary/#impactTraceNote`.
- Outcome v3 confidence envelope now derives miss-risk label in v3 from `#opsMissProb`, removing direct read of legacy `#opsMissTag`.
- Outcome v3 now derives `Shift needed (P50/P10)` directly from sidebar margin values (`#mcP50-sidebar/#mcP10-sidebar`), removing direct reads from legacy `#mcShiftP50/#mcShiftP10`.
- Plan v3 surface now derives workload/optimizer/timeline status copy and decision-intel summary text in v3 logic, removing direct reads from legacy banner/recommendation IDs (`#convFeasBanner/#optBanner/#tlBanner/#di*`).
- Outcome v3 now reads win probability from v3 KPI (`#v3KpiWinProb`) and derives weekly gap from v3 note context, removing direct reads of `#mcWinProb-sidebar` and `#wkGapPerWeek`.
- Turnout v3 now uses turnout snapshot + v3 KPI for impact/status copy, removing direct reads of `#kpiTurnoutVotes-sidebar/#kpiPersuasionNeed-sidebar/#mcWinProb-sidebar/#turnoutSummary/#roiBanner`.
- Data v3 summary/status now derives from v3 controls/bridge UI state, removing direct reads of `#importHashBanner/#importWarnBanner/#usbStorageStatus`.
- Controls v3 now derives workflow/evidence/calibration/feedback status copy from v3 bridge state, removing direct reads from legacy `#intel*Status/#intel*Count` text nodes.
- Outcome v3 confidence adjunct text now derives in v3 (no direct reads of legacy `#opsAtt*`, `#opsCon*`, `#opsFinish*`, `#mcMoS/#mcDownside/#mcES10`, `#mcShift60/#mcShift70/#mcShift80`, `#mcShock10/#mcShock25/#mcShock50`, or `#impactTraceList`), and outcome capacity note no longer falls back to `stage-capacity` / `stage-setup` IDs.
- Turnout v3 margin context now resolves from v3 KPI (`#v3KpiMargin`) instead of `#mcP50-sidebar`, removing Turnout’s last `stage-integrity` dependency.
- Plan v3 timeline/optimizer adjunct copy now derives in v3 (no direct reads of legacy `#optTotalAttempts/#optTotalCost/#optTotalVotes`, `#tlOptGoalFeasible/#tlOptMaxNetVotes/#tlOptRemainingGap/#tlOptBinding`, `#tlCompletionWeek`, or `#tlWeekList`).
- Outcome v3 now derives risk-grade/freshness/fragility/cliff status copy in v3 logic (no direct reads from `#riskBandTag-sidebar/#riskVolatility-sidebar/#riskPlainBanner-sidebar/#mcFreshTag-sidebar/#mcLastRun-sidebar/#mcStale-sidebar`), and no longer reads legacy timeline weeks from ROI stage.
- Plan v3 decision-intel lever tables are now native v3 rows derived from current plan context (no legacy mirrors from `#diVolTbody/#diCostTbody/#diProbTbody`).
- Outcome v3 percentile context now reads directly from confidence-envelope IDs (`#mcP10/#mcP50/#mcP90`) rather than sidebar percentile tags, fully removing Outcome’s direct `stage-integrity` dependency.
- Plan v3 now derives optimizer/timeline binding and shortfall status (`optBinding/optGapContext/tlPercent/tlConstraint/tlShortfall*`) from v3 plan context instead of direct legacy ROI status IDs.
- Plan v3 workload row now derives `doors/shift`, `total shifts`, `shifts/week`, and `volunteers needed` from v3 workload/timeline inputs (no direct reads of legacy `#outDoorsPerShift/#outTotalShifts/#outShiftsPerWeek/#outVolunteersNeeded`).
- Plan v3 now reads `required conversations` and `required doors` from Reach runtime bridge view (`window.__FPE_REACH_API__.getView().weekly`) instead of direct legacy `#outConversationsNeeded/#outDoorsNeeded` reads.
- Plan v3 workload `Doors per hour (source)` field now mirrors from v3 timeline `Doors attempts / hour` (already synced to `timelineDoorsPerHour`), removing direct legacy `#doorsPerHour` read from `stage-gotv`.
- Plan v3 workload input controls (`goalSupportIds`, `hoursPerShift`, `shiftsPerVolunteerPerWeek`) now bind through Reach runtime bridge set/get (`window.__FPE_REACH_API__.setField/getView`) instead of direct legacy `stage-gotv` DOM IDs.
- Plan v3 optimizer/timeline controls now bind through runtime Plan API bridge (`window.__FPE_PLAN_API__.setField/runOptimize/getView`) instead of direct legacy `stage-roi` control IDs.
- Turnout v3 assumptions/lift/ROI controls now bind through runtime Turnout API bridge (`window.__FPE_TURNOUT_API__.setField/refreshRoi/getView`) instead of direct legacy `stage-roi` control IDs.
- Plan and Turnout v3 allocation/ROI tables now render from runtime bridge view caches (`state.ui.lastPlanRows`, `state.ui.lastRoiRows`) instead of mirroring legacy `#optTbody/#roiTbody`.
- Outcome v3 now reads percentile margins from v3 KPI + right-rail percentile tags (`#v3KpiMargin`, `#mcP10-sidebar/#mcP50-sidebar/#mcP90-sidebar`) instead of legacy confidence-envelope IDs (`#mcP10/#mcP50/#mcP90`), reducing direct `stage-results` dependency.
- Outcome v3 Monte Carlo run-count display (`v3OutcomeMcRuns`) is now native fixed UI state (`10000`) and no longer mirrors legacy `#mcRuns`.
- Outcome v3 sensitivity and surface tables now render directly from runtime outcome bridge cache (`window.__FPE_OUTCOME_API__`) with no legacy table mirror fallback.
- Outcome v3 forecast/confidence freshness values now source from runtime MC state via outcome bridge (`window.__FPE_OUTCOME_API__.getView().mc`) with sidebar/KPI fallback retained only as non-stage compatibility context.
- Outcome v3 controls/actions now bind exclusively through runtime Outcome API (`window.__FPE_OUTCOME_API__.setField/runMc/rerunMc/computeSurface/getView`) with no legacy proxy fallback path.
- Outcome runtime bridge now stores surface controls in v3 state cache (`state.ui.outcomeSurfaceInputs`) and runs sensitivity-surface compute directly from runtime state/engine (no hard dependency on legacy `#surface*` controls or `#btnComputeSurface` click path).
- KPI strip sync now uses runtime Outcome/Reach bridge views (`window.__FPE_OUTCOME_API__`, `window.__FPE_REACH_API__`) plus right-rail context for win probability, P50 margin, and bottleneck labels, removing `stage-results` selector fallback for those KPI fields.
- MC runtime renderers now support sidebar-only targets (`mcWinProb-sidebar`, `mcP10/50/90-sidebar`) and no longer hard-require legacy primary result nodes (`#mcWinProb/#mcP10/#mcP50/#mcP90`) to render confidence outputs.
- MC freshness/staleness runtime paths now support sidebar-only targets (`mcFreshTag-sidebar`, `mcLastRun-sidebar`, `mcStale-sidebar`) and no longer depend on legacy primary freshness nodes to update status.
- Risk framing runtime now supports sidebar-only targets (`riskBandTag-sidebar`, `riskWinProb-sidebar`, `riskMarginBand-sidebar`, `riskVolatility-sidebar`, `riskPlainBanner-sidebar`) and no longer hard-requires legacy primary risk nodes.
- Miss-risk runtime (`renderMissRiskD4`) now computes/cache-updates even when legacy `opsMiss*` DOM nodes are absent, removing DOM-presence gating for D4 risk state.
- Miss-risk runtime now dual-writes to right-rail mirror IDs (`#opsMissProb-sidebar`, `#opsMissTag-sidebar`) so active miss-risk readouts persist without `stage-results` table nodes.
- Ops/finish envelope runtime paths (`renderOpsEnvelopeD2`, `renderFinishEnvelopeD3`) now compute/cache-update without requiring legacy `opsAtt*` / `opsFinish*` DOM nodes.
- MC confidence adjunct outputs (`mcMoS`, downside/ES10, shift targets, shocks, risk grade/label, fragility/cliff) now dual-write to sidebar mirror IDs (`*-sidebar`) via runtime MC render paths.
- MC summary KPI outputs (`mcMedian`, `mcP95`, `mcP5`) now dual-write to sidebar mirror IDs (`#mcMedian-sidebar/#mcP95-sidebar/#mcP5-sidebar`) via runtime MC render paths.
- MC sensitivity rows now dual-render to hidden sidebar mirror target (`#mcSensitivity-sidebar`) to preserve runtime updates without primary sensitivity table nodes.
- Legacy `results`, `roi`, and `gotv` nav entries have been removed from legacy left-rail user flow.
- Legacy retired containers `stage-results`, `stage-roi`, and `stage-gotv` have now been removed from `index.html` after bridge dependency reached zero and runtime guards were hardened.
- Legacy retired container `stage-integrity` has now been removed from `index.html` (Data is runtime-native via `window.__FPE_DATA_API__`).
- Timeline runtime (`renderTimelineModule`) now computes and cache-updates without requiring legacy timeline DOM gates (`timelineEnabled`, `tlPercent`, `tl*` fields), reducing `stage-gotv` deletion risk.
- Phase3 runtime (`renderPhase3Module`) now computes and refreshes MC freshness/results without requiring legacy `p3*` DOM gates, reducing `stage-results` deletion risk.
- Compatibility MC phase3 panels (`js/app/render/monteCarlo.js`, `js/render/monteCarlo.js`) now run without hard `p3*` DOM gates, preserving freshness/results update paths if legacy result nodes are absent.
- Conversion runtime panel (`renderConversionPanel`) now computes and continues phase3 refresh without hard requiring legacy `out*`/`convFeasBanner` nodes, reducing `stage-gotv` deletion risk.
- ROI runtime panel (`renderRoiModule`) no longer hard-returns when `roiTbody` is absent; ROI caches/banner/summary updates now remain live without legacy table nodes.
- Sensitivity snapshot render/run paths now tolerate missing legacy E4 DOM (`sens*` nodes, run button), keeping snapshot-cache behavior usable during/after legacy stage retirement.
- Decision confidence/intelligence runtime panels now compute/cache-update without hard requiring legacy `conf*` / `di*` DOM nodes, reducing coupling to legacy ROI/GOTV panel blocks.
- Weekly ops insights/freshness runtime panels now render with guarded writes when legacy `wk*` nodes are partially absent, reducing coupling to legacy execution sub-panels.
- Weekly ops summary runtime module (`renderWeeklyOpsModule`) no longer hard-returns on missing `wkGoal`; summary and execution status now continue with guarded writes when weekly legacy nodes are absent.
- Assumption drift runtime panel now renders with guarded writes when `drift*` nodes are partially absent, keeping drift compute path active during legacy sub-panel retirement.
- Scenario comparison runtime panel now renders with guarded writes when `scm*` nodes are partially absent, reducing hard coupling to legacy compare card wrappers.
- Scenario comparison runtime panel now guards `state.ui` access and scenario-registry initialization calls, preventing early-boot null dereference.
- Stress summary runtime panel now uses guarded writes and resilient summary input handling (`res?.stressSummary`), preventing avoidable render short-circuits.
- Assumptions snapshot runtime panel now renders with guarded writes when `assumptionsSnapshot` is absent, preserving assumption-block compute flow during legacy panel retirement.
- Guardrails runtime panel now renders with guarded writes when `guardrails` target is absent, preserving guardrail compute flow during partial DOM retirement.
- MC margin-chart runtime renderers now render with guarded writes when `svgMargin*` targets are partially absent (app + compat panel paths), preventing avoidable short-circuit during staged results-panel retirement.
- Backup recovery dropdown refresh now renders with guarded writes when `restoreBackup` is absent, preventing avoidable early return during partial data-panel retirement.
- Decision session/options render paths now avoid hard returns on `decisionOptionSelect` and `decisionSessionSelect/decisionActiveLabel`, preserving non-select decision panel updates during staged Decision Log retirement.
- Sensitivity surface defaults now use guarded element refs for lever/range controls (`surfaceLever/surfaceMin/surfaceMax`) and avoid direct `els.*` hard-return gating.
- Runtime shell helpers in `appRuntime` now use guarded refs for weekly undo and mode toggle pills (`wkUndoActionBtn`, `mc* mode`, `gotv* mode`) instead of direct `els.*` hard-return gates.
- DOM preflight is now feature-aware for Census/Targeting groups (only enforces those ID sets when their feature anchors are present), reducing false `dom-preflight` errors during staged legacy retirement.
- DOM preflight now accepts legacy-or-v3 District core control IDs (race/election/weeks/mode/universe/candidate/turnout) to prevent false boot failures during setup-era retirement.
- DOM preflight District/Reach control checks are now stage-aware (enforced only when those surface anchors are present), preventing false boot failures when non-active surfaces are unmounted.
- Self-test UI smoke now accepts v3 fallbacks for legacy-only capacity/results/scenario-compare cards, preventing false red gates while retiring hidden legacy stage containers.
- Self-test UI smoke now treats District/Reach core controls as optional stage-scoped checks (uniqueness only when present), avoiding false failures after container retirement.
- Self-test UI smoke now treats Reach/Outcome/Scenario stage-card IDs as optional stage-scoped checks (uniqueness only when present), avoiding false failures when those surfaces are unmounted.
- DOM preflight now accepts legacy-or-v3 Census/Targeting IDs (phase card, controls, status rows, map host, targeting controls/results) to prevent false boot failures during staged legacy container retirement.
- Self-test UI smoke now accepts v3 fallback IDs for census + USB persistence controls (`v3DistrictCensusShell`, `v3Census*`, `v3DataBtnUsb*`, `v3DataUsbStatus`) to prevent false red gates while retiring `stage-checks`/`stage-integrity`.
- Self-test UI smoke census + USB checks are now stage-aware (only enforced when Census/Data anchors are present), reducing coupling to non-mounted surfaces.
- District electorate-structure derived/warning status is now computed natively in v3 using core universe-layer math (`computeUniverseAdjustedRates` + `normalizeUniversePercents`) instead of mirroring legacy `#universe16Derived/#universe16Warn`.
- Weekly ops runtime now caches derived execution summary in `state.ui.lastWeeklyOps`, keeping the weekly status model readable even when legacy `wk*` nodes are absent.
- Conversion runtime now caches workload/feasibility outputs in `state.ui.lastConversion`, reducing reliance on legacy `out*`/`convFeasBanner` nodes as the only source of truth.
- ROI runtime now updates turnout summary cache (`state.ui.lastTurnout`) without requiring legacy `turnoutSummary` DOM, and optimizer early-return paths now clear/normalize plan caches (`state.ui.lastPlanRows/lastPlanMeta/lastSummary`) to prevent stale v3 plan summaries when legacy ROI nodes are absent.
- KPI bottleneck inference now resolves weekly gap entirely from Reach runtime bridge view (legacy `#wkGapPerWeek` fallback removed).
- KPI strip no longer falls back to legacy `#wkConstraint/#optBinding` text for bottleneck label; bottleneck is bridge-derived.
- Turnout v3 no longer mounts helper copy from `#stage-roi .phase-p6 > .note`; helper text is now native in the v3 card.
- Turnout summary readout now resolves from sidebar/bridge context (`#kpiTurnoutBand-sidebar`) instead of legacy ROI summary text nodes.
- Turnout summary snapshot now resolves from bridge/sidebar context only (`#kpiTurnoutBand-sidebar`), removing the remaining legacy `#turnoutSummary` fallback path.
- Turnout snapshot votes/need now resolve from bridge/sidebar context only (`#kpiTurnoutVotes-sidebar`, `#kpiPersuasionNeed-sidebar`), removing non-sidebar fallback selector paths.
- District summary expected-turnout snapshot now resolves from turnout baseline/v3-derived average (`turnoutA`, `turnoutB`) rather than falling back to turnout-votes KPI text.
- KPI persuasion-need sync now resolves from sidebar-only target (`#kpiPersuasionNeed-sidebar`), removing legacy primary fallback selector path.
- Turnout ROI banner/readout now resolves from Turnout runtime bridge view (`__FPE_TURNOUT_API__.getView().roiBannerText`) instead of mirroring legacy `#roiBanner` / sibling note nodes.
- Turnout v3 summary values (status/votes/need) now resolve from Turnout runtime bridge summary (`__FPE_TURNOUT_API__.getView().summary`) backed by runtime cache (`state.ui.lastTurnout`) rather than relying only on sidebar/legacy text nodes.
- v3 state-bridge turnout snapshot (`js/app/v3/stateBridge.js`) now resolves Turnout summary values from runtime Turnout bridge first (`__FPE_TURNOUT_API__.getView().summary`) with selector fallback only for compatibility.
- DOM preflight now accepts legacy-or-v3 shell IDs for scenario/build/diagnostics/reset controls, reducing false boot failures during legacy shell retirement.
- Removed stale duplicate v3 turnout surface file (`js/app/v3/turnout.js`); active Turnout surface remains `js/app/v3/surfaces/turnout.js`.
- Legacy `integrity` nav entry has been removed from legacy left-rail user flow.
- Legacy `stage-integrity` retired stub has been removed from `index.html`.
- Data v3 bridge actions are now runtime-native (no legacy integrity control IDs required).
- Runtime apply-state helpers now guard writes for Reach assumptions (`persuasionPct`, `earlyVoteExp`) so boot/render stays stable after `stage-capacity` removal.
- Runtime apply-state/bootstrap wiring now guards legacy-shell baseline inputs (`scenarioName`, race/setup controls, turnout band controls, undecided controls) so missing legacy nodes do not hard-fail boot.
- Legacy left-rail entries for retired legacy stages (`capacity`, `results`, `roi`, `gotv`, `integrity`) are removed from legacy user flow and retired stage stubs are removed from `index.html`.
- Legacy shell section structure was rebalanced (missing `</section>` after structure stage fixed) to prevent DOM drift during staged retirement edits.
- Controls v3 evidence table now renders from scenario-bridge intel state (`window.__FPE_SCENARIO_API__`) instead of mirroring legacy `#intelEvidenceTbody`.
- Controls v3 benchmark table now renders from scenario-bridge intel state (`window.__FPE_SCENARIO_API__`) and remove actions route by benchmark id, instead of mirroring legacy `#intelBenchmarkTbody`.
- Controls v3 feedback previews (what-if + recommendations) now render from scenario-bridge intel state and no longer mirror legacy preview textareas (`#intelWhatIfPreview/#intelRecommendationPreview`).
- Controls v3 review-workflow actions (`Capture observed metrics`, `Generate drift recommendations`, `Parse what-if request`, `Apply top recommendation`) now run API-first through `window.__FPE_SCENARIO_API__` with no v3 legacy proxy fallback to `btnIntel*`/`intelWhatIfInput`.
- Controls v3 benchmark + evidence form/actions now run API-first through `window.__FPE_SCENARIO_API__` with no v3 legacy proxy fallback to `intelBenchmark*`, `intelAuditSelect`, `intelEvidence*`, or `btnIntelBenchmark*/btnIntelEvidenceAttach`.
- Controls v3 calibration action set (`Generate brief`, `Copy brief`, `Add/Import correlation`, `Add/Import shock`) now runs API-first through `window.__FPE_SCENARIO_API__` with no v3 legacy proxy fallback to `btnIntelCalibration*`, `btnIntelAddDefault*`, or `btnIntelImport*`.
- Controls v3 calibration field state (brief kind, MC distribution, correlated shocks, correlation model selection, capacity-decay toggles/inputs, shock enable) now syncs directly from scenario-bridge intel state with API patch updates, removing v3 legacy proxy fallback to `intel*` calibration IDs.
- Data v3 controls now execute through runtime data API bridge (`window.__FPE_DATA_API__`) with zero direct legacy selector bindings in the Data surface.
- Legacy Census/Targeting bridge isolation updated in `index.html`: v3 now mounts canonical `#censusPhase1Card` and `#targetingLabCard` nodes directly (no dedicated bridge-host container), reducing structural coupling between District bridge controls and the `stage-checks` container.
- Legacy `checks` nav entry has been removed from legacy user flow, and the `stage-checks` wrapper has been retired from static markup while preserving checks-source compatibility IDs.
- Legacy setup-era stage isolation hardening in `index.html`: setup source wrappers (`#stage-universe`, `#stage-ballot`) are removed from static markup; canonical setup source cards (`#universeCard`, `#ballotBaselineCard`, `#turnoutBaselineCard`) live in hidden `#legacySetupSourceSeed` during v3 boot.
- Legacy stage visibility hardening: setup/checks wrappers are retired from static markup; explicit legacy mode now relies on runtime setup-shell composition plus hidden compatibility source pools.
- Runtime setup composition hooks are retired; normal v3 boot and legacy inline init no longer invoke setup compose fallback paths.
- District summary snapshot in v3 now resolves through runtime District API bridge (`window.__FPE_DISTRICT_API__.getView().summary`) with compatibility fallback, reducing direct dependence on legacy summary DOM text mirrors.
- District targeting status/meta/results in v3 now resolve through runtime District API bridge payload (`window.__FPE_DISTRICT_API__.getView().targeting`) with compatibility fallback, reducing direct dependence on legacy `#targetingStatus/#targetingMeta/#targetingResultsTbody` mirrors.
- District Census status/guide/map text rows in v3 now resolve through runtime District API bridge payload (`window.__FPE_DISTRICT_API__.getView().census`) with compatibility fallback, reducing direct dependence on legacy `#census*Status/#census*Meta` text mirrors in the v3 surface.
- District Census aggregate/advisory/election preview tables in v3 now resolve through runtime District API bridge payload (`window.__FPE_DISTRICT_API__.getView().census.*Rows`) with compatibility fallback, reducing direct v3 table mirrors from legacy `#census*Tbody` nodes.
- District v3 Census/Targeting status + table rendering now uses bridge-only payload/default fallbacks (no direct v3 fallback reads of legacy `#targetingStatus/#targetingMeta/#targetingResultsTbody` or `#census*Status/#census*Tbody` selectors).
- District targeting control value sync in v3 now resolves from runtime District bridge config (`window.__FPE_DISTRICT_API__.getView().targeting.config`) with compatibility fallback, reducing direct v3 reads of legacy `#targeting*` value selectors.
- Targeting model behavior now uses preset bundles (`applyTargetModelPreset`) so model selection updates weights/thresholds/filters in state and v3 mirrors immediately (no longer model-label-only behavior).
- District Targeting Lab select controls (`geo/model/density`) now hydrate from runtime targeting option lists in v3 first (legacy option mirrors optional), removing a silent dependency on legacy select-option population.
- District targeting bridge config now includes `canRun/canExport/canResetWeights` guard flags so v3 button disable state remains correct even if legacy targeting control nodes are absent.
- District Census static select controls (`ACS year`, `resolution`, `metric set`) now hydrate from Census module registries in v3 first, reducing silent option-list coupling to legacy select mirrors.
- District bridge census payload now includes control-value config (`year/resolution/state/county/place/metric set/search/filters/toggles + controlsLocked`), and v3 applies bridge-first value sync so census field state does not rely solely on legacy control mirrors.
- District bridge Census status lines (`context/selection/status/geo-stats/last-fetch/footprint/provenance/capacity/apply-adjustments`) now derive state-first from runtime Census + footprint state, reducing direct reliance on legacy `#census*Status` text mirrors.
- District census runtime now caches bridge payload rows/status in state (`bridgeAggregateRows`, `bridgeAdvisoryRows`, `bridgeElectionPreviewRows`, and `bridge*StatusText` fields) during Census render, so District v3 can read bridge-safe values without direct legacy table/status scraping.
- District bridge census payload in `appRuntime` now reads cached census bridge fields from state first (aggregate/advisory/election rows + advisory/election/map status text) and no longer queries legacy `#census*` table/status nodes directly.
- District bridge census config now carries state-driven option payloads (`state/county/place/tract/saved-set/GEO` option lists) so v3 District census controls hydrate from bridge state rather than legacy select scraping.
- District bridge census option payload now resolves from canonical census bridge caches in state (`bridgeStateOptions`, `bridgeCountyOptions`, `bridgePlaceOptions`, `bridgeTractFilterOptions`, `bridgeSelectionSetOptions`, `bridgeGeoSelectOptions`) with state-derived fallback only, removing legacy select scraping from `appRuntime`.
- District bridge census config now sources bridge-safe field values (`apiKey`, `geoPaste`, `electionCsvPrecinctFilter`) from canonical census bridge state (`bridgeApiKey`, `bridgeGeoPaste`, `bridgeElectionCsvPrecinctFilter`) and no longer reads legacy field DOM directly in `appRuntime`.
- District census bridge write/actions now call runtime Census API methods (`__FPE_CENSUS_RUNTIME_API__.setField/setGeoSelection/setFile/triggerAction`) as the primary District execution path; appRuntime no longer issues direct legacy control-id dispatch for Census writes/actions.
- District census shell mount no longer hard-requires legacy `#censusPhase1Card` presence; v3 census surface renders independently with a native v3 map host (`#v3CensusMapHost`).
- District census bridge advisory/election preview row caches now persist from canonical computed row payloads in `censusPhase1` (no `censusAdvisoryTbody` / `censusElectionCsvPreviewTbody` DOM re-scrape for bridge rows).
- District census bridge status caches (`bridgeAdvisoryStatusText`, `bridgeMapStatusText`, `bridgeMapQaVtdZipStatusText`) now persist from canonical computed status views in `censusPhase1` (no DOM text readback from `#censusAdvisoryStatus/#censusMapStatus/#censusMapQaVtdZipStatus`).
- District bridge census config now carries a state-derived disabled map for v3 census controls/buttons; v3 applies this bridge map after legacy sync to reduce reliance on legacy disabled mirrors.
- District census runtime action bridge now routes through shared canonical action handlers in `censusPhase1` (used by both event listeners and runtime bridge dispatch) with no button-click fallback dependency.
- District census runtime field writes (`__FPE_CENSUS_RUNTIME_API__.setField` / `setGeoSelection`) now apply state-first canonical side effects in `censusPhase1` (lookup refresh, row-cache invalidation, apply-toggle gating, map QA toggle/status) with no input/select dispatch fallback dependency.
- District census runtime file writes (`__FPE_CENSUS_RUNTIME_API__.setFile`) now run through state-first file-cache handling for election dry-run and VTD ZIP QA flows with no file-input dispatch fallback dependency.
- District census `Apply GEOIDs` action now resolves paste input from canonical census bridge state (`bridgeGeoPaste`) instead of requiring legacy textarea DOM presence.
- District census load/fetch actions now resolve Census API key from canonical bridge state (`bridgeApiKey`) first, then local storage fallback, instead of depending on legacy field reads.
- District census bridge cache persistence is now state-first for `bridgeApiKey`/`bridgeGeoPaste` during render, preventing DOM-missing sessions from wiping canonical bridge values.
- District census map runtime now resolves map host from runtime/v3 containers (`#v3CensusMapHost` fallback) and no longer hard-requires legacy `els.censusMap` presence to load/resize boundary overlays.
- District bridge Census write paths in `appRuntime` now treat runtime Census API responses as authoritative when available (including explicit runtime `code` failures) and no longer dispatch legacy Census controls directly.
- District lock hardening: v3 lock-fallback no longer force-disables Census map action buttons (`Load boundaries`, `Clear map`, `Clear VTD ZIP`) so map open/clear remains available in locked mode.
- District v3 targeting controls now hydrate from bridge config/defaults first (no legacy value mirroring required for model/geo/density/weights/threshold defaults).
- District v3 Targeting Lab writes now route through runtime District bridge actions (`setTargetingField`, `applyTargetingPreset`, `resetTargetingWeights`, `runTargeting`, `exportTargetingCsv`, `exportTargetingJson`) with no per-control legacy proxy fallback in the v3 surface; `runTargeting` executes from canonical runtime census-row cache (`getCensusRowsForState`) via `runTargetRanking`/`applyTargetingRunResult`.
- District v3 surface now has zero legacy control-proxy bindings (`data-v3-legacy-id`), and QA gate `bridge-control-count` now enforces District as a no-legacy-control stage while legacy compatibility containers remain isolated outside the v3 pane.
- Stage-checks retirement gate hardening: `#stage-checks` wrapper is removed from static markup; checks source content now lives under hidden `#legacyChecksSourceSeed` while Census/Targeting cards continue to bridge independently.
- QA retirement gate hardening: v3 smoke now enforces `legacy-checks-bridge-unmounted`, `legacy-checks-stage-absent-or-retired`, and `legacy-checks-stage-pruned`, so checks-wrapper regressions fail fast before setup-shell retirement work.
- Setup-era gate hardening: compat-host prep no longer attempts to move missing `#stage-structure`, and v3 smoke now enforces structure-stage unmounted/absent-or-retired expectations (`legacy-structure-bridge-unmounted`, `legacy-structure-stage-absent-or-retired`).
- Setup-era gate hardening: v3 smoke now enforces setup/checks/universe/ballot absent-or-retired semantics plus explicit wrapper-prune checks (`legacy-setup-stage-pruned`, `legacy-checks-stage-pruned`, `legacy-universe-stage-pruned`, `legacy-ballot-stage-pruned`).
- Setup-era gate hardening: v3 smoke now enforces setup/universe/ballot stage shells as bridge-unmounted (`legacy-setup-bridge-unmounted`, `legacy-universe-bridge-unmounted`, `legacy-ballot-bridge-unmounted`) while Census/Targeting cards remain bridge-mounted.
- District setup-era hardening: v3 District training stack is now native-defined in `surfaces/district.js` and no longer clones legacy `#train-setup/#train-universe/#train-ballot/#train-checks` panels.
- Legacy mode retirement hardening: `setLegacyStageVisibility` helper has been removed; retired wrappers are no longer toggled at runtime.
- Setup compose extraction: `composeSetupStage` no longer hard-selects turnout source from `#stage-ballot`; turnout module source now resolves via canonical turnout field IDs (`turnoutA/turnoutB/bandWidth`) so compose is field-driven rather than stage-container driven.
- Setup compose extraction: universe/persuadable/electorate/ballot/turnout modules now compose into dedicated `setup*Module` cards instead of reusing source card wrappers from hidden shells, reducing wrapper-coupling before final source-shell retirement.
- Setup compose hardening: module append now requires real interactive/body content (not header-only wrappers), preventing empty setup module shells from being promoted during partial source-shell retirement.
- Runtime hardening: setup compose fallback hook and module are retired; setup fallback composition no longer runs in `appRuntime` or inline legacy init.
- Setup compose fallback hardening: composer now bootstraps a minimal `stage-setup` shell/body when missing, so legacy setup compose can still mount during future static-wrapper retirement.
- Setup source-pool hardening: setup source cards (`#universeCard`, `#ballotBaselineCard`, `#turnoutBaselineCard`) remain on hidden `#legacySetupSourceSeed` during v3 boot, keeping canonical IDs without host indirection.
- Setup wrapper retirement hardening: static `#stage-setup` wrapper is removed from markup; setup source content now resides in hidden source seeds and setup shell renders through runtime compose fallback when legacy mode is active.
- Legacy shell-root hardening: shell-root lookup and visibility now resolve from a root marker (`[data-legacy-shell-root="true"]`) instead of hardcoded `#app-shell-legacy` fallback selectors in runtime and QA.
- Setup wrapper retirement gate hardening: v3 smoke now enforces that retired setup-era wrappers carry no interactive controls (`legacy-universe-stage-no-controls`, `legacy-ballot-stage-no-controls`) after source-card extraction.
- Setup wrapper retirement gate hardening: v3 smoke now enforces runtime wrapper-prune checks (`legacy-universe-stage-pruned`, `legacy-ballot-stage-pruned`) so setup-era wrapper reintroduction fails fast.

## Stage dependency map (current)
Counts below are unique legacy IDs referenced by each v3 surface.

| V3 Surface | Legacy Container(s) | Legacy ID Count |
| --- | --- | --- |
| District | runtime District bridge payload (no direct legacy ID bindings in v3 surface) | 0 |
| Reach | retired (`stage-capacity` removed) | 0 |
| Outcome | removed (`stage-results`) | 0 |
| Turnout | removed (`stage-roi`) | 0 |
| Plan | removed (`stage-roi`) | 0 |
| Plan | removed (`stage-gotv`) | 0 |
| Controls | retired wrapper (`legacyChecksSourceSeed`) | 0 |
| Scenarios | retired (`stage-scenarios`) | 0 |
| Decision Log | retired (`stage-decisions`) | 0 |
| Data | runtime data API bridge (`window.__FPE_DATA_API__`) | 0 |

## Safe delete order (enforced)
Delete only when the referenced surface(s) show zero bridge targets for that legacy container.

1. `stage-capacity` (completed)
Reason: isolated to Reach surface; removed after Reach bridge dependency reached zero.

2. `stage-results` (completed)
Reason: v3 Outcome bridge targets reached zero and runtime result paths now run with sidebar-only/guarded targets; retired container removed from `index.html`.

3. `stage-roi` (completed)
Reason: v3 bridge dependencies reached zero and the legacy section is now an empty retired stub anchor.

4. `stage-gotv` (completed)
Reason: Plan bridge dependencies reached zero and runtime timeline/conversion guards were hardened; retired container removed from `index.html`.

5. `stage-checks` (completed)
Reason: wrapper removed from static markup; checks source content moved to hidden source seed and retirement gates now enforce absent-or-retired + pruned behavior in v3 mode.

6. `stage-integrity` (completed)
Reason: Data handlers run through runtime-native bridge actions, so legacy integrity control ID dependency was removed and retired container removed from `index.html`.

7. runtime `stage-setup` fallback shell (completed)
Reason: setup compose module/hook is removed, so runtime setup fallback shell no longer boots in v3 or inline legacy init paths.

8. setup source-card pool extraction from legacy wrapper (completed)
Reason: runtime now extracts `#legacySetupSourceSeed` out of `legacyShellRoot` before compat-host moves, and QA gates enforce setup-seed presence + detachment checks.

9. checks/source pool extraction from legacy wrapper (completed)
Reason: runtime now extracts `#legacyChecksSourceSeed` out of `legacyShellRoot` before bridge-host moves, and QA gates enforce checks-seed presence + detachment checks.

10. legacy shell root wrapper and legacy nav/stage switching (completed)
Reason: runtime now retires `legacyShellRoot` into hidden `legacyDomPool`, and legacy nav/stage switching + explicit legacy mode are removed.

## Per-stage retirement gate (must pass)
For each container before deletion:

1. Bridge targets for that container are zero in v3 surface code.
2. QA smoke passes:
   - `bridge-control-count`
   - `bridge-targets-exist`
   - stage selector checks in active pane
3. No console errors on:
   - stage switch loop (`district -> ... -> data -> district`)
   - control change loop (10+ edits)
4. Output parity:
   - same inputs -> same outputs as pre-delete checkpoint.
5. Rollback artifact created:
   - one zip/tag before deletion.

## Execution checklist (copy/paste sequence)
- [ ] Replace bridge reads/writes for one target container with native v3 state bindings.
- [ ] Run selector/bridge audits.
- [ ] Run v3 QA smoke from Diagnostics (`window.runV3QaSmoke()`).
- [ ] Manual parity sweep for affected surfaces.
- [ ] Delete target legacy container markup.
- [ ] Delete dead selectors/hooks tied to removed container.
- [ ] Re-run QA smoke and stage switching regression.
- [ ] Create checkpoint note and proceed to next container.

## Immediate next target
Recommended next retirement target: right-rail compatibility decoupling and wrapper-scaffold cleanup.  
Current blocker is preserving runtime right-rail parity while removing remaining wrapper-era helper hooks.
