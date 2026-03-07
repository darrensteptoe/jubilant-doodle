// @ts-check

/**
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
function isObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function str(v){
  return String(v == null ? "" : v).trim();
}

/**
 * @param {unknown} scenario
 * @returns {Record<string, any>}
 */
function cloneScenario(scenario){
  if (!isObject(scenario)) return {};
  try{
    if (typeof structuredClone === "function"){
      return structuredClone(scenario);
    }
  } catch {
    // fall through
  }
  try{
    return JSON.parse(JSON.stringify(scenario));
  } catch {
    return { ...scenario };
  }
}

/**
 * Apply data-ref selection policy at runtime for import/restore paths.
 * - `latest_verified`: resolve IDs to latest verified catalog entries when needed.
 * - `pinned_verified` and `manual`: keep explicit refs unchanged.
 *
 * @param {{
 *   engine: Record<string, any>,
 *   scenario: unknown,
 *   stageLabel?: string
 * }} args
 * @returns {{
 *   scenario: Record<string, any>,
 *   warnings: string[],
 *   resolution: Record<string, any> | null
 * }}
 */
export function applyDataRefPolicyRuntime(args){
  const scenarioIn = cloneScenario(args?.scenario);
  const warnings = [];
  const stageLabel = str(args?.stageLabel) || "Import";
  const resolver = args?.engine?.snapshot?.resolveDataRefsByPolicy;
  if (typeof resolver !== "function"){
    return { scenario: scenarioIn, warnings, resolution: null };
  }

  const resolution = resolver({
    dataRefs: scenarioIn.dataRefs,
    dataCatalog: scenarioIn.dataCatalog,
    scenario: scenarioIn,
  });
  if (!isObject(resolution)){
    return { scenario: scenarioIn, warnings, resolution: null };
  }
  if (!isObject(scenarioIn.dataRefs)) scenarioIn.dataRefs = {};
  const mode = str(resolution.mode).toLowerCase();
  const selected = isObject(resolution.selected) ? resolution.selected : {};
  if (mode === "latest_verified"){
    scenarioIn.dataRefs.boundarySetId = selected.boundarySetId ?? null;
    scenarioIn.dataRefs.crosswalkVersionId = selected.crosswalkVersionId ?? null;
    scenarioIn.dataRefs.censusDatasetId = selected.censusDatasetId ?? null;
    scenarioIn.dataRefs.electionDatasetId = selected.electionDatasetId ?? null;

    if (isObject(scenarioIn.dataCatalog)){
      scenarioIn.dataCatalog.activeBoundarySetId = selected.boundarySetId ?? null;
      scenarioIn.dataCatalog.activeCrosswalkVersionId = selected.crosswalkVersionId ?? null;
    }
  }

  const notes = Array.isArray(resolution.notes)
    ? resolution.notes.map((x) => str(x)).filter(Boolean)
    : [];
  if (notes.length){
    if (mode === "latest_verified"){
      warnings.push(`${stageLabel}: latest_verified policy applied. ${notes.join(" ")}`);
    } else {
      warnings.push(`${stageLabel}: data-ref policy note. ${notes.join(" ")}`);
    }
  }

  return { scenario: scenarioIn, warnings, resolution };
}
