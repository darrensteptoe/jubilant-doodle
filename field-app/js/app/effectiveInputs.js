// @ts-check
import { validateOperationsCapacityInput } from "../features/operations/io.js";

/**
 * @typedef {Record<string, any>} AnyState
 * @typedef {{
 *   getState: () => AnyState,
 *   safeNum: (v: any) => number | null,
 *   clamp: (v: number, lo: number, hi: number) => number,
 *   canonicalDoorsPerHourFromSnap: (state: AnyState) => number | null,
 *   getEffectiveBaseRates: () => Record<string, any>,
 *   getEffectiveBaseRatesFromSnap: (state: AnyState) => Record<string, any>,
 *   twCapOverrideModeFromState: (state: AnyState) => string,
 *   twCapResolveOverrideAttempts: (state: AnyState) => number | null,
 *   twCapPerOrganizerAttemptsPerWeek: (args: Record<string, any>) => number,
 * }} EffectiveInputsControllerDeps
 */

/**
 * @param {EffectiveInputsControllerDeps} deps
 */
export function createEffectiveInputsController({
  getState,
  safeNum,
  clamp,
  canonicalDoorsPerHourFromSnap,
  getEffectiveBaseRates,
  getEffectiveBaseRatesFromSnap,
  twCapOverrideModeFromState,
  twCapResolveOverrideAttempts,
  twCapPerOrganizerAttemptsPerWeek,
} = {}){
  function getCapacityDecayConfigFromState(srcState = getState()){
    const s = srcState || {};
    const toggles = s?.intelState?.expertToggles || {};
    const model = toggles?.decayModel || {};
    return {
      enabled: !!toggles.capacityDecayEnabled,
      type: String(model.type || "linear"),
      weeklyDecayPct: safeNum(model.weeklyDecayPct),
      floorPctOfBaseline: safeNum(model.floorPctOfBaseline),
    };
  }

  function compileEffectiveInputs(srcState = getState()){
    const baseState = getState();
    const s = srcState || {};
    const eff = (s === baseState) ? getEffectiveBaseRates() : getEffectiveBaseRatesFromSnap(s);

    let orgCount = safeNum(s.orgCount);
    const orgHoursPerWeek = safeNum(s.orgHoursPerWeek);
    const volunteerMult = safeNum(s.volunteerMultBase);
    const doorSharePct = safeNum(s.channelDoorPct);
    const doorShare = (doorSharePct == null) ? null : clamp(doorSharePct, 0, 100) / 100;
    const doorsPerHour = canonicalDoorsPerHourFromSnap(s);
    const callsPerHour = safeNum(s.callsPerHour3);

    let source = "baseline-manual";
    let overrideTargetAttemptsPerWeek = null;
    const overrideEnabled = !!s.twCapOverrideEnabled;
    const overrideMode = twCapOverrideModeFromState(s);

    if (overrideEnabled){
      if (overrideMode === "baseline"){
        source = "baseline-manual (override-baseline)";
      } else {
        const targetAttempts = twCapResolveOverrideAttempts(s);
        const perOrganizerAttempts = twCapPerOrganizerAttemptsPerWeek({
          capacity: {
            orgCount: 1,
            orgHoursPerWeek,
            volunteerMult,
            doorShare,
            doorsPerHour,
            callsPerHour,
          }
        });
        if (targetAttempts != null && perOrganizerAttempts > 0){
          orgCount = targetAttempts / perOrganizerAttempts;
          overrideTargetAttemptsPerWeek = targetAttempts;
          source = `operations-${overrideMode}`;
        } else {
          source = `baseline-manual (override-${overrideMode}-fallback)`;
        }
      }
    }

    const compiled = {
      rates: {
        cr: eff.cr,
        sr: eff.sr,
        tr: eff.tr,
      },
      capacity: {
        orgCount,
        orgHoursPerWeek,
        volunteerMult,
        doorSharePct,
        doorShare,
        doorsPerHour,
        callsPerHour,
        capacityDecay: getCapacityDecayConfigFromState(s),
      },
      meta: {
        source,
        twCapOverrideEnabled: overrideEnabled,
        twCapOverrideMode: overrideMode,
        twCapOverrideTargetAttemptsPerWeek: overrideTargetAttemptsPerWeek,
      }
    };

    const seamCheck = validateOperationsCapacityInput(compiled);
    if (!seamCheck.ok){
      // Fail soft: preserve deterministic planner behavior via baseline capacity/rate path.
      return {
        rates: {
          cr: eff.cr,
          sr: eff.sr,
          tr: eff.tr,
        },
        capacity: {
          orgCount: safeNum(s.orgCount),
          orgHoursPerWeek: safeNum(s.orgHoursPerWeek),
          volunteerMult: safeNum(s.volunteerMultBase),
          doorSharePct,
          doorShare,
          doorsPerHour,
          callsPerHour,
          capacityDecay: getCapacityDecayConfigFromState(s),
        },
        meta: {
          source: "baseline-manual (seam-fallback)",
          twCapOverrideEnabled: false,
          twCapOverrideMode: "baseline",
          twCapOverrideTargetAttemptsPerWeek: null,
        }
      };
    }

    return compiled;
  }

  return {
    getCapacityDecayConfigFromState,
    compileEffectiveInputs,
  };
}
