# Targeting Interaction Integrity Report

Generated: 2026-03-20T05:52:11.107Z
Tier: tier1
Surface key: targeting

## Summary
- Controls audited: 15
- Controls failing A-F: 0
- Surface status: PASS

## A-F Matrix
| control | A Population | B State write | C Recompute | D Render | E Persistence | F Legacy | persistence contract | canonical owner | root cause | defect class |
|---|---|---|---|---|---|---|---|---|---|---|
| targeting_model_dropdown (Target model dropdown) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.targeting.presetId\|state.targeting.modelId | none | none |
| district_geo_level_selector (Targeting geography level selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.targeting.geoLevel | none | none |
| district_density_floor_selector (Targeting density floor selector) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.targeting.criteria.densityFloor | none | none |
| district_targeting_top_n_input (Targeting top N input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.targeting.topN | none | none |
| district_targeting_min_housing_input (Targeting minimum housing units input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.targeting.minHousingUnits | none | none |
| district_targeting_min_population_input (Targeting minimum population input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.targeting.minPopulation | none | none |
| district_targeting_min_score_input (Targeting minimum score input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.targeting.minScore | none | none |
| district_targeting_only_race_footprint_toggle (Only race footprint toggle) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.targeting.onlyRaceFootprint | none | none |
| district_targeting_prioritize_young_toggle (Prioritize young toggle) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.targeting.criteria.prioritizeYoung | none | none |
| district_targeting_prioritize_renters_toggle (Prioritize renters toggle) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.targeting.criteria.prioritizeRenters | none | none |
| district_targeting_avoid_high_multi_unit_toggle (Avoid high multi-unit toggle) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.targeting.criteria.avoidHighMultiUnit | none | none |
| district_targeting_weight_vote_potential_input (Weight vote potential input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.targeting.weights.votePotential | none | none |
| district_targeting_weight_turnout_opportunity_input (Weight turnout opportunity input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.targeting.weights.turnoutOpportunity | none | none |
| district_targeting_weight_persuasion_index_input (Weight persuasion index input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.targeting.weights.persuasionIndex | none | none |
| district_targeting_weight_field_efficiency_input (Weight field efficiency input) | PASS | PASS | PASS | PASS | PASS | PASS | campaignId+officeId+scenarioId scoped state snapshot | state.targeting.weights.fieldEfficiency | none | none |

## Classification
- No open A-F interaction integrity defects on this surface.
