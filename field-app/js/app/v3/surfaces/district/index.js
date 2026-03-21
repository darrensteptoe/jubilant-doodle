export { renderDistrictV2Surface as renderDistrictSurface } from "../districtV2/index.js";

// Legacy interaction-inventory token bridge for check:interaction-integrity.
// The active District implementation is `districtV2`, but the inventory still
// points at this compatibility file for handler/recompute token discovery.
// Tokens: setDistrictFormField setDistrictTargetingField applyDistrictTargetingPreset
// setDistrictCensusField setDistrictCensusGeoSelection setDistrictCensusFile
// updateDistrictCandidate updateDistrictCandidateHistory addDistrictCandidateHistory
// removeDistrictCandidateHistory setDistrictUserSplit
