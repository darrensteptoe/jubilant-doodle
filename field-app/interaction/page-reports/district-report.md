# District Interaction Integrity Report

Generated: 2026-03-22T01:56:41.365Z
Tier: tier1
Surface key: district

## Summary
- Controls audited: 56
- Controls failing A-F: 0
- Surface status: PASS

## A-F Matrix
| control | A Population | B State write | C Recompute | D Render | E Persistence | F Legacy | persistence contract | canonical owner | root cause | defect class |
|---|---|---|---|---|---|---|---|---|---|---|
| template_archetype_dropdown (Race template dropdown) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.raceType | none | none |
| district_electorate_weighting_toggle (Electorate weighting toggle) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.universeLayerEnabled | none | none |
| census_metric_set_selector (Census metric set selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.metricSet | none | none |
| census_apply_adjustments_toggle (Census apply adjustments toggle) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.applyAdjustedAssumptions | none | none |
| district_mode_selector (District mode selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.mode | none | none |
| district_office_level_selector (Office level selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.templateMeta.officeLevel | none | none |
| district_election_type_selector (Election type selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.templateMeta.electionType | none | none |
| district_seat_context_selector (Seat context selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.templateMeta.seatContext | none | none |
| district_partisanship_mode_selector (Partisanship mode selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.templateMeta.partisanshipMode | none | none |
| district_salience_level_selector (Salience level selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.templateMeta.salienceLevel | none | none |
| district_election_date_input (Election date input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.electionDate | none | none |
| district_weeks_remaining_input (Weeks remaining input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.weeksRemaining | none | none |
| district_universe_size_input (Universe size input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.universeSize | none | none |
| district_universe_basis_selector (Universe basis selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.universeBasis | none | none |
| district_source_note_input (Source note input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.sourceNote | none | none |
| district_dem_pct_input (Electorate Dem percent input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.universeDemPct | none | none |
| district_rep_pct_input (Electorate Rep percent input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.universeRepPct | none | none |
| district_npa_pct_input (Electorate NPA percent input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.universeNpaPct | none | none |
| district_other_pct_input (Electorate Other percent input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.universeOtherPct | none | none |
| district_retention_factor_input (Retention factor input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.retentionFactor | none | none |
| district_turnout_a_input (Turnout cycle A input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.turnoutA | none | none |
| district_turnout_b_input (Turnout cycle B input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.turnoutB | none | none |
| district_band_width_input (Turnout band width input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.bandWidth | none | none |
| district_your_candidate_selector (Your candidate selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.yourCandidateId | none | none |
| district_undecided_pct_input (Undecided percent input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.undecidedPct | none | none |
| district_undecided_mode_selector (Undecided mode selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.undecidedMode | none | none |
| district_candidate_name_input (Candidate name input rows) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.candidates[].name | none | none |
| district_candidate_support_input (Candidate support percent input rows) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.candidates[].supportPct | none | none |
| district_user_split_input (User split input rows) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.userSplit[candidateId] | none | none |
| census_api_key_input (Census API key input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.bridgeApiKey | none | none |
| census_acs_year_selector (Census ACS year selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.year | none | none |
| census_resolution_selector (Census resolution selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.resolution | none | none |
| census_state_fips_selector (Census state selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.stateFips | none | none |
| census_county_fips_selector (Census county selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.countyFips | none | none |
| census_place_fips_selector (Census place selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.placeFips | none | none |
| census_geo_search_input (Census GEO search input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.geoSearch | none | none |
| census_tract_filter_selector (Census tract filter selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.tractFilter | none | none |
| census_geo_paste_input (Census GEO paste input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.bridgeGeoPaste | none | none |
| census_selection_set_name_input (Selection set draft name input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.selectionSetDraftName | none | none |
| census_selection_set_selector (Selection set selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.selectedSelectionSetKey | none | none |
| census_election_precinct_filter_input (Election CSV precinct filter input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.bridgeElectionCsvPrecinctFilter | none | none |
| census_map_qa_vtd_toggle (Map QA VTD overlay toggle) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.mapQaVtdOverlay | none | none |
| census_geo_select_multiselect (GEO multi-select selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.census.selectedGeoids[] | none | none |
| census_election_csv_file_input (Election CSV file input) | PASS | PASS | PASS | PASS | PASS | PASS | session:file_object | runtime.censusRuntimeFileCache.electionCsvFile | none | none |
| census_map_vtd_zip_file_input (Map QA VTD ZIP file input) | PASS | PASS | PASS | PASS | PASS | PASS | session:file_object | runtime.censusRuntimeFileCache.mapQaVtdZip | none | none |
| district_candidate_history_add_button (Candidate history add-row button) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.candidateHistory[] | none | none |
| district_candidate_history_office_input (Candidate history office input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.candidateHistory[].office | none | none |
| district_candidate_history_cycle_year_input (Candidate history cycle year input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.candidateHistory[].cycleYear | none | none |
| district_candidate_history_election_type_selector (Candidate history election type selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.candidateHistory[].electionType | none | none |
| district_candidate_history_candidate_name_input (Candidate history candidate name input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.candidateHistory[].candidateName | none | none |
| district_candidate_history_party_input (Candidate history party input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.candidateHistory[].party | none | none |
| district_candidate_history_incumbency_selector (Candidate history incumbency selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.candidateHistory[].incumbencyStatus | none | none |
| district_candidate_history_vote_share_input (Candidate history vote share input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.candidateHistory[].voteShare | none | none |
| district_candidate_history_margin_turnout_inputs (Candidate history margin/turnout inputs) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.candidateHistory[].margin\|state.candidateHistory[].turnoutContext | none | none |
| district_candidate_history_repeat_over_under_controls (Candidate history repeat/over-under controls) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.candidateHistory[].repeatCandidate\|state.candidateHistory[].overUnderPerformancePct | none | none |
| district_candidate_history_remove_button (Candidate history remove-row button) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.candidateHistory[] | none | none |

## Classification
- No open A-F interaction integrity defects on this surface.
