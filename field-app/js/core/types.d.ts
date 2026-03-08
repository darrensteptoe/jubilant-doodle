export type NullableNumber = number | null;

export interface BaseRates {
  cr: NullableNumber;
  sr: NullableNumber;
  tr: NullableNumber;
}

export interface CapacityDecayConfig {
  enabled: boolean;
  type: string;
  weeklyDecayPct: NullableNumber;
  floorPctOfBaseline: NullableNumber;
}

export interface OperationsCapacityInput {
  rates: BaseRates;
  capacity: {
    orgCount: NullableNumber;
    orgHoursPerWeek: NullableNumber;
    volunteerMult: NullableNumber;
    doorSharePct: NullableNumber;
    doorShare: NullableNumber;
    doorsPerHour: NullableNumber;
    callsPerHour: NullableNumber;
    capacityDecay: CapacityDecayConfig;
  };
  meta: {
    source: string;
    twCapOverrideEnabled: boolean;
    twCapOverrideMode: "baseline" | "ramp" | "scheduled" | "max";
    twCapOverrideTargetAttemptsPerWeek: NullableNumber;
  };
}

export interface ModelInputCandidate {
  id: string;
  name: string;
  supportPct: NullableNumber;
}

export interface ModelInput {
  universeSize: NullableNumber;
  turnoutA: NullableNumber;
  turnoutB: NullableNumber;
  bandWidth: NullableNumber;
  candidates: ModelInputCandidate[];
  undecidedPct: NullableNumber;
  yourCandidateId: string;
  undecidedMode: string;
  userSplit: Record<string, unknown>;
  persuasionPct: NullableNumber;
  earlyVoteExp: NullableNumber;
}

export interface TurnoutContext {
  enabled: boolean;
  gotvLiftPP: number;
  gotvMaxLiftPP: number;
  baselineTurnoutPct: number;
  maxAdditionalPP: number;
  liftAppliedPP: number;
}

export interface DataRefs {
  version: string;
  mode: "pinned_verified" | "latest_verified" | "manual";
  censusDatasetId: string | null;
  electionDatasetId: string | null;
  boundarySetId: string | null;
  crosswalkVersionId: string | null;
  electionStrictSimilarity: boolean;
  electionMaxYearDelta: number | null;
  electionMinCoveragePct: number | null;
  pinnedAt: string | null;
  lastCheckedAt: string | null;
}

export interface DataCatalogBoundarySet {
  id: string;
  label: string;
  geographyType: string;
  vintage: string | null;
  source: string | null;
  refreshedAt: string | null;
  hash: string | null;
  isVerified: boolean;
  isLatest: boolean;
}

export interface DataCatalogCrosswalk {
  id: string;
  fromBoundarySetId: string;
  toBoundarySetId: string;
  unit: "tract" | "block_group" | "precinct" | "vtd";
  method: "area" | "population" | "vap" | "hybrid";
  rowsUrl?: string | null;
  quality: {
    coveragePct: number | null;
    unmatchedPct: number | null;
    weightDriftPct: number | null;
    isVerified: boolean;
  };
  source: string | null;
  refreshedAt: string | null;
  hash: string | null;
  isLatest: boolean;
}

export interface DataCatalogDataset {
  id: string;
  kind: "census" | "election";
  label: string;
  source: string | null;
  manifestUrl?: string | null;
  rowsUrl?: string | null;
  vintage: string | null;
  electionDate?: string | null;
  officeType?: string | null;
  raceType?: string | null;
  cycleYear?: number | null;
  boundarySetId: string | null;
  granularity: string;
  refreshedAt: string | null;
  hash: string | null;
  quality: {
    coveragePct: number | null;
    isVerified: boolean;
  };
  isLatest: boolean;
}

export interface DataCatalog {
  version: string;
  boundarySets: DataCatalogBoundarySet[];
  crosswalks: DataCatalogCrosswalk[];
  censusDatasets: DataCatalogDataset[];
  electionDatasets: DataCatalogDataset[];
  activeBoundarySetId: string | null;
  activeCrosswalkVersionId: string | null;
}

export interface DataSourceRegistryBoundary extends DataCatalogBoundarySet {}
export interface DataSourceRegistryCrosswalk extends DataCatalogCrosswalk {
  coveragePct: number | null;
  unmatchedPct: number | null;
  weightDriftPct: number | null;
}
export interface DataSourceRegistryDataset extends DataCatalogDataset {
  coveragePct: number | null;
}
export interface DataSourceRegistry {
  version: string;
  generatedAt: string;
  boundarySets: DataSourceRegistryBoundary[];
  crosswalks: DataSourceRegistryCrosswalk[];
  censusDatasets: DataSourceRegistryDataset[];
  electionDatasets: DataSourceRegistryDataset[];
  byId: {
    boundarySets: Record<string, DataSourceRegistryBoundary>;
    crosswalks: Record<string, DataSourceRegistryCrosswalk>;
    censusDatasets: Record<string, DataSourceRegistryDataset>;
    electionDatasets: Record<string, DataSourceRegistryDataset>;
  };
}

export interface GeoPackUnit {
  geoid: string;
  w: number;
}

export interface GeoPack {
  geoPackVersion: string;
  source: {
    dataset: string | null;
    vintage: string | null;
    refreshedAt: string | null;
  };
  area: {
    type: string;
    stateFips: string;
    district: string;
    countyFips: string;
    placeFips: string;
    label: string;
  };
  resolution: "tract" | "block_group";
  boundarySetId: string | null;
  units: GeoPackUnit[];
  district: Record<string, unknown>;
  quality: {
    coveragePct: number | null;
    weightSum: number | null;
    unmatchedUnits: number;
    crosswalkMethod: string;
    crosswalkQuality: number | null;
  };
  generatedAt: string | null;
}

export interface DistrictIntelPack {
  version: string;
  ready: boolean;
  indices: {
    fieldSpeed: number;
    persuasionEnv: number;
    turnoutElasticity: number;
    fieldDifficulty: number;
  };
  bounds: { min: number; max: number };
  derivedAssumptions: {
    doorsPerHour: { base: number | null; adjusted: number | null };
    persuasionRate: { base: number | null; adjusted: number | null };
    turnoutLift: { base: number | null; adjusted: number | null };
    organizerCapacity: { base: number | null; adjusted: number | null };
  };
  provenance: {
    censusDatasetId: string | null;
    electionDatasetId: string | null;
    boundarySetId: string | null;
    crosswalkVersionId: string | null;
  };
  generatedAt: string | null;
  warnings: string[];
}

export interface AreaSelection {
  type: "CD" | "SLDU" | "SLDL" | "COUNTY" | "PLACE" | "CUSTOM" | "";
  stateFips: string;
  district: string;
  countyFips: string;
  placeFips: string;
  label: string;
  boundarySetId: string | null;
  boundaryVintage: string | null;
  resolution: "tract" | "block_group";
}

export interface DistrictEvidenceCandidateTotal {
  candidateId: string;
  votes: number;
  sharePct: number;
}

export interface DistrictEvidencePersuasionSignal {
  index: number;
  totalVotes: number;
  leaderCandidateId: string | null;
  runnerUpCandidateId: string | null;
  marginVotes: number;
  marginPct: number | null;
  competitivenessPct: number | null;
  note: string;
}

export interface DistrictEvidenceGeoRow {
  geoid: string;
  districtWeight: number;
  totalVotes: number;
  candidateVotes: Record<string, number>;
  census: Record<string, number>;
  sourcePrecincts: number;
  hasElection: boolean;
  hasCensus: boolean;
}

export interface DistrictEvidencePrecinctLink {
  precinctId: string;
  geoid: string;
  crosswalkWeight: number;
  districtWeight: number;
  effectiveWeight: number;
}

export interface DistrictEvidenceGeoMapPoint {
  geoid: string;
  lat: number;
  lon: number;
  totalVotes: number;
  sourcePrecincts: number;
  hasElection: boolean;
  hasCensus: boolean;
  leaderCandidateId: string | null;
  marginPct: number | null;
}

export interface DistrictEvidenceGeoMapBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface DistrictEvidenceGeoMapLayer {
  available: boolean;
  reason: string;
  bounds: DistrictEvidenceGeoMapBounds | null;
  points: DistrictEvidenceGeoMapPoint[];
}

export interface DistrictEvidencePrecinctLayerRow {
  precinctId: string;
  totalVotes: number;
  leaderCandidateId: string | null;
  leaderVotes: number;
  leaderSharePct: number | null;
  runnerUpCandidateId: string | null;
  runnerUpVotes: number;
  marginVotes: number;
  marginPct: number | null;
  candidateCount: number;
  mappedGeoCount: number;
  crosswalkWeightSum: number;
  effectiveWeightSum: number;
  districtWeightPct: number;
  topGeoLinks: Array<{
    geoid: string;
    effectiveWeightPct: number;
  }>;
}

export interface DistrictEvidenceGeoOpportunityRow {
  geoid: string;
  opportunityScore: number;
  competitiveness: number;
  voteMassNorm: number;
  densityNorm: number;
  totalVotes: number;
  sourcePrecincts: number;
  leaderCandidateId: string | null;
  marginPct: number | null;
  hasElection: boolean;
  hasCensus: boolean;
  reasons: string[];
}

export interface DistrictEvidenceInputSummary {
  sourceMode: "inline" | "refs" | "none";
  refs: {
    censusDatasetId: string;
    electionDatasetId: string;
    crosswalkVersionId: string;
  };
  counts: {
    precinctResults: number;
    crosswalkRows: number;
    censusGeoRows: number;
  };
  ready: boolean;
  notes: string[];
  summaryLine: string;
}

export interface DistrictEvidence {
  summary: {
    selectedGeoCount: number;
    geoRowsCount: number;
    totalVotes: number;
    totalPrecincts: number;
    totalPrecinctLinks: number;
    districtWeightSum: number;
  };
  candidateTotals: DistrictEvidenceCandidateTotal[];
  persuasionSignal: DistrictEvidencePersuasionSignal;
  precinctToGeo: DistrictEvidencePrecinctLink[];
  geoRows: DistrictEvidenceGeoRow[];
  censusTotals: Record<string, number>;
  reconciliation: {
    inputVotes: number;
    allocatedVotes: number;
    unmatchedVotes: number;
    coveragePct: number;
    deltaVotes: number;
    deltaPct: number;
  };
  warnings: string[];
}

export interface DistrictAutoPullPlan {
  mode: "manual" | "pinned_verified" | "latest_verified";
  policyLabel: string;
  selected: {
    boundarySetId: string | null;
    crosswalkVersionId: string | null;
    censusDatasetId: string | null;
    electionDatasetId: string | null;
  };
  urls: {
    censusManifestUrl: string | null;
    electionManifestUrl: string | null;
    crosswalkRowsUrl: string | null;
    precinctResultsUrl: string | null;
    censusGeoRowsUrl: string | null;
  };
  availableCount: number;
  missingCount: number;
  notes: string[];
}

export interface DistrictAutoPullReceipt {
  ts: string;
  mode: "manual" | "pinned_verified" | "latest_verified";
  selected: {
    boundarySetId: string | null;
    crosswalkVersionId: string | null;
    censusDatasetId: string | null;
    electionDatasetId: string | null;
  };
  urls: {
    censusManifestUrl: string | null;
    electionManifestUrl: string | null;
    crosswalkRowsUrl: string | null;
    precinctResultsUrl: string | null;
    censusGeoRowsUrl: string | null;
  };
  requestedCount: number;
  successCount: number;
  warningCount: number;
  warnings: string[];
  status: "ok" | "warn" | "bad";
  fingerprint: string;
}
