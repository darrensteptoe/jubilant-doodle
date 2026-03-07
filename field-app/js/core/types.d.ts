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
  pinnedAt: string | null;
  lastCheckedAt: string | null;
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
