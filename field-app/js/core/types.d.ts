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

