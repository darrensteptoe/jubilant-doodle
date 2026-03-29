// @ts-check
import { validateOperationsCapacityInput } from "../features/operations/io.js";
import {
  aggregateRowsForSelection,
  buildCensusAssumptionAdvisory,
  clampCensusApplyMultipliers,
  evaluateCensusApplyMode,
} from "../core/censusModule.js";
import { resolveCanonicalCallsPerHour, resolveDoorShareUnitFromPct } from "../core/throughput.js";
import { deriveEventCapacityAdjustmentForState } from "./eventImpactRules.js";
import { isTodayOnlyAdjustmentActive } from "./weatherRiskRules.js";
import { resolveCensusRowsForState } from "./censusRowsRuntimeStore.js";

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

    const workforce = (s?.ui?.twCapOutlookLatest && typeof s.ui.twCapOutlookLatest === "object")
      ? (s.ui.twCapOutlookLatest.workforce || {})
      : {};
    const workforceOrganizerCount = safeNum(workforce.organizerCount);
    const paidCanvasserCount = safeNum(workforce.paidCanvasserCount);
    const activeVolunteerCount = safeNum(workforce.activeVolunteerCount);
    const activeHeadcount = safeNum(workforce.activeHeadcount);
    const missingRoleTypedCount = safeNum(workforce.missingRoleTypedCount);
    const roleTypingCoveragePct = safeNum(workforce.roleTypingCoveragePct);
    const activePaidHeadcount = safeNum(workforce.activePaidHeadcount);
    const activeStipendHeadcount = safeNum(workforce.activeStipendHeadcount);
    const activeVolunteerHeadcount = safeNum(workforce.activeVolunteerHeadcount);
    const volunteerShowRate = safeNum(workforce.volunteerShowRate);
    const organizerRecruitmentMultiplier = safeNum(workforce.organizerRecruitmentMultiplier);
    const organizerSupervisionCapacity = safeNum(workforce.organizerSupervisionCapacity);
    const paidCanvasserProductivity = safeNum(workforce.paidCanvasserProductivity);
    const volunteerProductivity = safeNum(workforce.volunteerProductivity);
    const paidRoleMultiplier = safeNum(workforce.paidRoleMultiplier);
    const volunteerRoleMultiplier = safeNum(workforce.volunteerRoleMultiplier);
    const roleCapacityMultiplier = safeNum(workforce.roleCapacityMultiplier);

    let orgCount = safeNum(s.orgCount);
    const baseOrgHoursPerWeek = safeNum(s.orgHoursPerWeek);
    let orgHoursPerWeek = baseOrgHoursPerWeek;
    let volunteerMult = safeNum(s.volunteerMultBase);
    const doorSharePct = safeNum(s.channelDoorPct);
    const doorShare = resolveDoorShareUnitFromPct(doorSharePct);
    const doorsPerHour = canonicalDoorsPerHourFromSnap(s);
    const callsPerHour = resolveCanonicalCallsPerHour(s, { toNumber: safeNum });
    let doorsPerHourAdjusted = doorsPerHour;
    let callsPerHourAdjusted = callsPerHour;
    const baseCr = eff.cr;
    const baseSr = eff.sr;
    const baseTr = eff.tr;
    let crAdjusted = baseCr;
    let srAdjusted = baseSr;
    let trAdjusted = baseTr;
    const censusState = (s?.census && typeof s.census === "object") ? s.census : {};
    const censusRows = resolveCensusRowsForState(censusState);
    const censusSelectedGeoids = Array.isArray(censusState?.selectedGeoids) ? censusState.selectedGeoids : [];
    const hasRows = !!Object.keys(censusRows).length && censusSelectedGeoids.length > 0 && !!String(censusState?.activeRowsKey || "").trim();
    const advisory = hasRows
      ? buildCensusAssumptionAdvisory({
          aggregate: aggregateRowsForSelection({
            rowsByGeoid: censusRows,
            selectedGeoids: censusSelectedGeoids,
            metricSet: censusState?.metricSet,
          }),
          doorShare,
          doorsPerHour,
          callsPerHour,
          rowsByGeoid: censusRows,
          selectedGeoids: censusSelectedGeoids,
        })
      : null;
    const censusApplyGate = evaluateCensusApplyMode({
      applyRequested: !!censusState?.applyAdjustedAssumptions,
      censusState,
      raceFootprint: s?.raceFootprint,
      assumptionsProvenance: s?.assumptionsProvenance,
      advisoryReady: !!advisory?.ready,
      hasRows,
    });
    let censusApply = {
      requested: censusApplyGate.requested,
      applied: false,
      reason: censusApplyGate.reason,
      multipliers: clampCensusApplyMultipliers({}),
      alignmentReason: censusApplyGate.alignment?.reason || "",
    };
    if (censusApplyGate.ready && advisory?.multipliers){
      const multipliers = clampCensusApplyMultipliers(advisory.multipliers);
      if (doorsPerHourAdjusted != null) doorsPerHourAdjusted = doorsPerHourAdjusted * multipliers.doorsPerHour;
      if (callsPerHourAdjusted != null) callsPerHourAdjusted = callsPerHourAdjusted * multipliers.doorsPerHour;
      if (orgHoursPerWeek != null && multipliers.organizerLoad > 0){
        orgHoursPerWeek = orgHoursPerWeek / multipliers.organizerLoad;
      }
      if (crAdjusted != null){
        crAdjusted = clamp(crAdjusted * multipliers.contactRate, 0, 1);
      }
      if (srAdjusted != null){
        srAdjusted = clamp(srAdjusted * multipliers.persuasion, 0, 1);
      }
      if (trAdjusted != null){
        trAdjusted = clamp(trAdjusted * multipliers.turnoutLift, 0, 1);
      }
      censusApply = {
        requested: true,
        applied: true,
        reason: "ready",
        multipliers,
        alignmentReason: censusApplyGate.alignment?.reason || "ready",
      };
    }

    let source = "baseline-manual";
    let overrideTargetAttemptsPerWeek = null;
    const overrideEnabled = !!s.twCapOverrideEnabled;
    const overrideMode = twCapOverrideModeFromState(s);
    const todayIso = new Date().toISOString().slice(0, 10);

    const weatherAdjustmentState = (s?.warRoom?.weatherAdjustment && typeof s.warRoom.weatherAdjustment === "object")
      ? s.warRoom.weatherAdjustment
      : null;
    const weatherAdjustmentActive = isTodayOnlyAdjustmentActive(weatherAdjustmentState, new Date());
    const weatherModifiers = weatherAdjustmentActive
      ? (weatherAdjustmentState?.modifiers && typeof weatherAdjustmentState.modifiers === "object"
        ? weatherAdjustmentState.modifiers
        : null)
      : null;
    if (weatherModifiers){
      const doorEfficiencyMultiplier = safeNum(weatherModifiers.doorEfficiencyMultiplier);
      const volunteerShowRateMultiplier = safeNum(weatherModifiers.volunteerShowRateMultiplier);
      const electionDayTurnoutRiskBump = safeNum(weatherModifiers.electionDayTurnoutRiskBump);
      if (doorsPerHourAdjusted != null && doorEfficiencyMultiplier != null && doorEfficiencyMultiplier > 0){
        doorsPerHourAdjusted = doorsPerHourAdjusted * doorEfficiencyMultiplier;
      }
      if (callsPerHourAdjusted != null && doorEfficiencyMultiplier != null && doorEfficiencyMultiplier > 0){
        callsPerHourAdjusted = callsPerHourAdjusted * doorEfficiencyMultiplier;
      }
      if (volunteerMult != null && volunteerShowRateMultiplier != null && volunteerShowRateMultiplier > 0){
        volunteerMult = volunteerMult * volunteerShowRateMultiplier;
      }
      if (trAdjusted != null && electionDayTurnoutRiskBump != null && electionDayTurnoutRiskBump > 0){
        trAdjusted = clamp(trAdjusted - electionDayTurnoutRiskBump, 0, 1);
      }
    }

    const eventCapacityAdjustment = deriveEventCapacityAdjustmentForState(s, {
      date: todayIso,
      scenarioId: s?.ui?.activeScenarioId || "",
    });
    if (eventCapacityAdjustment?.enabled){
      const volunteerMultiplier = safeNum(eventCapacityAdjustment.volunteerMultiplier);
      const doorsPerHourMultiplier = safeNum(eventCapacityAdjustment.doorsPerHourMultiplier);
      const callsPerHourMultiplier = safeNum(eventCapacityAdjustment.callsPerHourMultiplier);
      const shiftHoursMultiplier = safeNum(eventCapacityAdjustment.shiftHoursMultiplier);
      if (volunteerMult != null && volunteerMultiplier != null && volunteerMultiplier > 0){
        volunteerMult = volunteerMult * volunteerMultiplier;
      }
      if (doorsPerHourAdjusted != null && doorsPerHourMultiplier != null && doorsPerHourMultiplier > 0){
        doorsPerHourAdjusted = doorsPerHourAdjusted * doorsPerHourMultiplier;
      }
      if (callsPerHourAdjusted != null && callsPerHourMultiplier != null && callsPerHourMultiplier > 0){
        callsPerHourAdjusted = callsPerHourAdjusted * callsPerHourMultiplier;
      }
      if (orgHoursPerWeek != null && shiftHoursMultiplier != null && shiftHoursMultiplier > 0){
        orgHoursPerWeek = orgHoursPerWeek * shiftHoursMultiplier;
      }
    }

    if (overrideEnabled){
      if (workforceOrganizerCount != null && workforceOrganizerCount >= 0){
        orgCount = workforceOrganizerCount;
      }
      if (orgCount != null && roleCapacityMultiplier != null && roleCapacityMultiplier > 0){
        orgCount = orgCount * roleCapacityMultiplier;
      }
      if (volunteerMult != null && volunteerRoleMultiplier != null && volunteerRoleMultiplier >= 0){
        volunteerMult = volunteerMult * volunteerRoleMultiplier;
      } else if (volunteerMult != null && volunteerProductivity != null && volunteerProductivity >= 0){
        volunteerMult = volunteerMult * volunteerProductivity;
      }
      if (doorsPerHourAdjusted != null && paidRoleMultiplier != null && paidRoleMultiplier > 0){
        doorsPerHourAdjusted = doorsPerHourAdjusted * paidRoleMultiplier;
      } else if (doorsPerHourAdjusted != null && paidCanvasserProductivity != null && paidCanvasserProductivity > 0){
        doorsPerHourAdjusted = doorsPerHourAdjusted * paidCanvasserProductivity;
      }
      if (callsPerHourAdjusted != null && paidRoleMultiplier != null && paidRoleMultiplier > 0){
        callsPerHourAdjusted = callsPerHourAdjusted * paidRoleMultiplier;
      } else if (callsPerHourAdjusted != null && paidCanvasserProductivity != null && paidCanvasserProductivity > 0){
        callsPerHourAdjusted = callsPerHourAdjusted * paidCanvasserProductivity;
      }
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
            doorsPerHour: doorsPerHourAdjusted,
            callsPerHour: callsPerHourAdjusted,
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
        cr: crAdjusted,
        sr: srAdjusted,
        tr: trAdjusted,
      },
      capacity: {
        orgCount,
        orgHoursPerWeek,
        volunteerMult,
        organizerCount: workforceOrganizerCount,
        paidCanvasserCount,
        activeVolunteerCount,
        activeHeadcount,
        missingRoleTypedCount,
        roleTypingCoveragePct,
        activePaidHeadcount,
        activeStipendHeadcount,
        activeVolunteerHeadcount,
        volunteerShowRate,
        organizerRecruitmentMultiplier,
        organizerSupervisionCapacity,
        paidCanvasserProductivity,
        volunteerProductivity,
        paidRoleMultiplier,
        volunteerRoleMultiplier,
        roleCapacityMultiplier,
        doorSharePct,
        doorShare,
        doorsPerHour: doorsPerHourAdjusted,
        callsPerHour: callsPerHourAdjusted,
        capacityDecay: getCapacityDecayConfigFromState(s),
      },
      meta: {
        source,
        twCapOverrideEnabled: overrideEnabled,
        twCapOverrideMode: overrideMode,
        twCapOverrideTargetAttemptsPerWeek: overrideTargetAttemptsPerWeek,
        censusApply,
        weatherAdjustment: {
          enabled: !!weatherAdjustmentActive,
          date: weatherAdjustmentActive ? todayIso : "",
          mode: weatherAdjustmentActive ? String(weatherAdjustmentState?.mode || "today_only") : "observe_only",
          modifiers: weatherModifiers || null,
        },
        eventCapacityAdjustment: {
          enabled: !!eventCapacityAdjustment?.enabled,
          date: String(eventCapacityAdjustment?.date || todayIso),
          eventCount: Number(eventCapacityAdjustment?.eventCount || 0) || 0,
          appliedEventIds: Array.isArray(eventCapacityAdjustment?.appliedEventIds)
            ? eventCapacityAdjustment.appliedEventIds.slice()
            : [],
          volunteerMultiplier: safeNum(eventCapacityAdjustment?.volunteerMultiplier) ?? 1,
          doorsPerHourMultiplier: safeNum(eventCapacityAdjustment?.doorsPerHourMultiplier) ?? 1,
          callsPerHourMultiplier: safeNum(eventCapacityAdjustment?.callsPerHourMultiplier) ?? 1,
          shiftHoursMultiplier: safeNum(eventCapacityAdjustment?.shiftHoursMultiplier) ?? 1,
        },
      }
    };

    const seamCheck = validateOperationsCapacityInput(compiled);
    if (!seamCheck.ok){
      return {
        rates: {
          cr: eff.cr,
          sr: baseSr,
          tr: baseTr,
        },
        capacity: {
          orgCount: safeNum(s.orgCount),
          orgHoursPerWeek: baseOrgHoursPerWeek,
          volunteerMult: safeNum(s.volunteerMultBase),
          organizerCount: workforceOrganizerCount,
          paidCanvasserCount,
          activeVolunteerCount,
          activeHeadcount,
          missingRoleTypedCount,
          roleTypingCoveragePct,
          activePaidHeadcount,
          activeStipendHeadcount,
          activeVolunteerHeadcount,
          volunteerShowRate,
          organizerRecruitmentMultiplier,
          organizerSupervisionCapacity,
          paidCanvasserProductivity,
          volunteerProductivity,
          paidRoleMultiplier,
          volunteerRoleMultiplier,
          roleCapacityMultiplier,
          doorSharePct,
          doorShare,
          doorsPerHour: doorsPerHourAdjusted,
          callsPerHour: callsPerHourAdjusted,
          capacityDecay: getCapacityDecayConfigFromState(s),
        },
        meta: {
          source: "baseline-manual (seam-fallback)",
          twCapOverrideEnabled: false,
          twCapOverrideMode: "baseline",
          twCapOverrideTargetAttemptsPerWeek: null,
          censusApply: {
            ...censusApply,
            applied: false,
            reason: "seam_fallback",
          },
          weatherAdjustment: {
            enabled: !!weatherAdjustmentActive,
            date: weatherAdjustmentActive ? todayIso : "",
            mode: weatherAdjustmentActive ? String(weatherAdjustmentState?.mode || "today_only") : "observe_only",
            modifiers: weatherModifiers || null,
          },
          eventCapacityAdjustment: {
            enabled: !!eventCapacityAdjustment?.enabled,
            date: String(eventCapacityAdjustment?.date || todayIso),
            eventCount: Number(eventCapacityAdjustment?.eventCount || 0) || 0,
            appliedEventIds: Array.isArray(eventCapacityAdjustment?.appliedEventIds)
              ? eventCapacityAdjustment.appliedEventIds.slice()
              : [],
            volunteerMultiplier: safeNum(eventCapacityAdjustment?.volunteerMultiplier) ?? 1,
            doorsPerHourMultiplier: safeNum(eventCapacityAdjustment?.doorsPerHourMultiplier) ?? 1,
            callsPerHourMultiplier: safeNum(eventCapacityAdjustment?.callsPerHourMultiplier) ?? 1,
            shiftHoursMultiplier: safeNum(eventCapacityAdjustment?.shiftHoursMultiplier) ?? 1,
          },
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
