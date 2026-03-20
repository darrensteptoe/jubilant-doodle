# Phase 21 - Canonical Targeting Law Lock

Date: 2026-03-19

## Scope
- Locked canonical targeting equation architecture in core scoring path.
- Removed uplift override as the canonical `expectedNetVoteValue` owner.
- Presets continue to control emphasis (weights), not architecture.

## Canonical Formula Lock (v1)
- `persuasionMultiplier = max(0, 1 - 2 * abs(0.5 - supportScore))`
- `adjustedPersuasion = persuasionIndex * persuasionMultiplier`
- `baseScore = voteWeight*votePotential + turnoutWeight*turnoutOpportunity + persuasionWeight*adjustedPersuasion + fieldWeight*fieldEfficiency + networkWeight*networkValue`
- `targetScore = baseScore * contactProbability * geographicMultiplier * saturationMultiplier`
- `expectedNetVoteValue = targetScore * expectedVotesReachable / costPerContact`

## Canonical Files Updated
- `js/core/targetFeatureRegistry.js`
- `js/core/targetFeatureEngine.js`
- `js/core/selfTestSuites/targeting.js`
- `js/app/modelRegistry.js`
- `js/app/moduleDoctrineRegistry.js`

## Notes
- `targetingLawVersion` now publishes as `v1` from canonical scoring output.
- `upliftAdjustedExpectedNetVoteValue` remains available for diagnostics/comparison, but canonical expected net vote value now comes from the locked law above.
- No final-hardening work started.
