// @ts-check

export const WORKED_ACTIVITY_STATE_NONE = "no_recorded_activity";
export const WORKED_ACTIVITY_STATE_RECORDED = "recorded_activity";
export const WORKED_ACTIVITY_STATE_HIGH = "higher_activity_concentration";

function clean(value){
  return String(value == null ? "" : value).trim();
}

function cleanLower(value){
  return clean(value).toLowerCase();
}

function asNonNegativeNumber(value){
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function quantileFromSorted(values, q){
  const rows = Array.isArray(values) ? values : [];
  if (!rows.length) return 0;
  const clamped = Math.max(0, Math.min(1, Number(q)));
  const idx = Math.min(rows.length - 1, Math.max(0, Math.floor((rows.length - 1) * clamped)));
  return asNonNegativeNumber(rows[idx]);
}

export function normalizeWorkedScopeFocusType(value){
  const token = cleanLower(value);
  if (token === "organizer") return "organizer";
  if (token === "office") return "office";
  return "campaign";
}

/**
 * Resolve worked activity evidence value from an area row using scope focus.
 * @param {any} row
 * @param {any} focusType
 */
export function resolveWorkedSignalValue(row = {}, focusType = "campaign"){
  const src = row && typeof row === "object" ? row : {};
  const scope = normalizeWorkedScopeFocusType(focusType);
  const officeTouches = asNonNegativeNumber(src.officeTouches);
  const organizerTouches = asNonNegativeNumber(src.organizerTouches);
  if (scope === "organizer"){
    return organizerTouches;
  }
  if (scope === "office"){
    return officeTouches;
  }
  return Math.max(officeTouches, organizerTouches);
}

function stateLabel(state){
  if (state === WORKED_ACTIVITY_STATE_HIGH) return "Higher activity concentration";
  if (state === WORKED_ACTIVITY_STATE_RECORDED) return "Recorded activity";
  return "No recorded activity";
}

/**
 * Build deterministic area-level worked activity states from joined activity evidence.
 * @param {Array<any>} rows
 * @param {{ focusType?: any, highQuantile?: number, minPositiveRowsForHigh?: number }=} options
 */
export function deriveWorkedActivityStateRows(rows = [], options = {}){
  const src = Array.isArray(rows) ? rows : [];
  const focusType = normalizeWorkedScopeFocusType(options?.focusType);
  const highQuantile = Number.isFinite(Number(options?.highQuantile)) ? Number(options.highQuantile) : 0.8;
  const minPositiveRowsForHigh = Number.isFinite(Number(options?.minPositiveRowsForHigh))
    ? Math.max(1, Math.floor(Number(options.minPositiveRowsForHigh)))
    : 3;

  const normalizedRows = src.map((raw) => {
    const row = raw && typeof raw === "object" ? raw : {};
    const signalValue = resolveWorkedSignalValue(row, focusType);
    return {
      geoid: clean(row.geoid),
      signalValue,
      officeTouches: asNonNegativeNumber(row.officeTouches),
      organizerTouches: asNonNegativeNumber(row.organizerTouches),
    };
  });
  const positiveSignals = normalizedRows
    .map((row) => row.signalValue)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const highThreshold = quantileFromSorted(positiveSignals, highQuantile);
  const minPositive = positiveSignals.length ? positiveSignals[0] : 0;
  const canClassifyHigh = positiveSignals.length >= minPositiveRowsForHigh && highThreshold > minPositive;

  const stateRows = normalizedRows.map((row) => {
    let state = WORKED_ACTIVITY_STATE_NONE;
    if (row.signalValue > 0){
      state = canClassifyHigh && row.signalValue >= highThreshold
        ? WORKED_ACTIVITY_STATE_HIGH
        : WORKED_ACTIVITY_STATE_RECORDED;
    }
    return {
      geoid: row.geoid,
      signalValue: row.signalValue,
      state,
      stateLabel: stateLabel(state),
      officeTouches: row.officeTouches,
      organizerTouches: row.organizerTouches,
    };
  });

  const stateCounts = {
    [WORKED_ACTIVITY_STATE_NONE]: 0,
    [WORKED_ACTIVITY_STATE_RECORDED]: 0,
    [WORKED_ACTIVITY_STATE_HIGH]: 0,
  };
  for (const row of stateRows){
    stateCounts[row.state] += 1;
  }

  return {
    focusType,
    rowCount: stateRows.length,
    positiveRowCount: positiveSignals.length,
    highThreshold,
    canClassifyHigh,
    stateCounts,
    rows: stateRows,
  };
}

function scopeLabel(scope = {}){
  const src = scope && typeof scope === "object" ? scope : {};
  const focusType = normalizeWorkedScopeFocusType(src.focusType);
  if (focusType === "organizer"){
    return `Organizer ${clean(src.organizerLabel) || clean(src.organizerId) || "selected"}`;
  }
  if (focusType === "office"){
    return `Office ${clean(src.officeId) || "selected"}`;
  }
  return "Campaign/office scope";
}

/**
 * Build manager-facing worked execution summary from existing worked-geography truth.
 * @param {{
 *   workedScope?: any,
 *   workedOfficeTotals?: any,
 *   workedJoinableEventCount?: any,
 *   workedConsideredEventCount?: any,
 *   workedStateCounts?: any,
 * }} input
 */
export function buildWorkedExecutionSummaryModel(input = {}){
  const src = input && typeof input === "object" ? input : {};
  const totals = src.workedOfficeTotals && typeof src.workedOfficeTotals === "object"
    ? src.workedOfficeTotals
    : {};
  const touches = asNonNegativeNumber(totals.touches);
  const attempts = asNonNegativeNumber(totals.attempts);
  const canvassed = asNonNegativeNumber(totals.canvassed);
  const vbms = asNonNegativeNumber(totals.vbms);
  const joinedUnitCount = asNonNegativeNumber(src.workedJoinableEventCount);
  const consideredEventCount = asNonNegativeNumber(src.workedConsideredEventCount);
  const states = src.workedStateCounts && typeof src.workedStateCounts === "object"
    ? src.workedStateCounts
    : {};
  const noRecordedActivityCount = asNonNegativeNumber(states[WORKED_ACTIVITY_STATE_NONE]);
  const recordedActivityCount = asNonNegativeNumber(states[WORKED_ACTIVITY_STATE_RECORDED]);
  const higherActivityCount = asNonNegativeNumber(states[WORKED_ACTIVITY_STATE_HIGH]);
  const activeAreaCount = recordedActivityCount + higherActivityCount;
  const hasEvidence = touches > 0 || joinedUnitCount > 0 || activeAreaCount > 0;
  const selectedScopeLabel = scopeLabel(src.workedScope);
  return {
    selectedScopeLabel,
    focusType: normalizeWorkedScopeFocusType(src?.workedScope?.focusType),
    joinedUnitCount,
    consideredEventCount,
    touches,
    attempts,
    canvassed,
    vbms,
    noRecordedActivityCount,
    recordedActivityCount,
    higherActivityCount,
    activeAreaCount,
    hasEvidence,
  };
}

