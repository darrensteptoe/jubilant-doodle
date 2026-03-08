// @ts-check
// Deterministic URL adapter for Stage 9 auto-pull.
// This module never fetches network data; it only resolves URL plans from data refs/catalog.

/**
 * @param {unknown} v
 * @returns {string}
 */
function str(v){
  return String(v == null ? "" : v).trim();
}

/**
 * @param {unknown} v
 * @returns {"manual" | "pinned_verified" | "latest_verified"}
 */
function normalizeMode(v){
  const m = str(v).toLowerCase();
  if (m === "manual" || m === "latest_verified" || m === "pinned_verified") return m;
  return "pinned_verified";
}

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function httpUrlOrNull(v){
  const s = str(v);
  if (!s) return null;
  try{
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * @param {unknown[]} rows
 * @param {string | null | undefined} id
 * @returns {Record<string, any> | null}
 */
function findById(rows, id){
  const list = Array.isArray(rows) ? rows : [];
  const key = str(id);
  if (!key) return null;
  return /** @type {Record<string, any> | null} */ (
    list.find((row) => str(row && typeof row === "object" ? row.id : "") === key) || null
  );
}

/**
 * @param {Record<string, any> | null} row
 * @returns {string | null}
 */
function pickManifestUrl(row){
  if (!row || typeof row !== "object") return null;
  return (
    httpUrlOrNull(row.manifestUrl) ||
    httpUrlOrNull(row.manifest_url) ||
    httpUrlOrNull(row.sourceManifestUrl) ||
    httpUrlOrNull(row.source_manifest_url) ||
    null
  );
}

/**
 * @param {Record<string, any> | null} row
 * @returns {string | null}
 */
function pickRowsUrl(row){
  if (!row || typeof row !== "object") return null;
  return (
    httpUrlOrNull(row.rowsUrl) ||
    httpUrlOrNull(row.rows_url) ||
    httpUrlOrNull(row.dataUrl) ||
    httpUrlOrNull(row.data_url) ||
    httpUrlOrNull(row.sourceRowsUrl) ||
    httpUrlOrNull(row.source_rows_url) ||
    null
  );
}

const AUTO_PULL_URL_KEYS = [
  "censusManifestUrl",
  "electionManifestUrl",
  "crosswalkRowsUrl",
  "precinctResultsUrl",
  "censusGeoRowsUrl",
];

function digits(v){
  return str(v).replace(/\D+/g, "");
}

function normalizeResolution(v){
  const s = str(v).toLowerCase();
  return s === "block_group" ? "block_group" : "tract";
}

function yearOrNull(v){
  const s = str(v);
  if (!s) return null;
  const m = s.match(/(19|20)\d{2}/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function normalizeVariableRefs(v){
  const list = Array.isArray(v) ? v : String(v || "").split(",");
  const out = [];
  const seen = new Set();
  for (const raw of list){
    const next = str(raw).toUpperCase();
    if (!next) continue;
    if (!/^[A-Z0-9_]+$/.test(next)) continue;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function normalizeStateCountyPair(stateFips, countyFips){
  const st = digits(stateFips).slice(0, 2).padStart(2, "0");
  const co = digits(countyFips).slice(-3).padStart(3, "0");
  if (!/^\d{2}$/.test(st) || !/^\d{3}$/.test(co)) return null;
  return { stateFips: st, countyFips: co };
}

function collectCountyPairsFromGeoUnits(geoUnits){
  const list = Array.isArray(geoUnits) ? geoUnits : [];
  const out = [];
  const seen = new Set();
  for (const row of list){
    const geoid = digits(row && typeof row === "object" ? row.geoid : row);
    if (geoid.length < 5) continue;
    const st = geoid.slice(0, 2);
    const co = geoid.slice(2, 5);
    if (!/^\d{2}$/.test(st) || !/^\d{3}$/.test(co)) continue;
    const key = `${st}${co}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ stateFips: st, countyFips: co });
  }
  out.sort((a, b) => {
    const ak = `${a.stateFips}${a.countyFips}`;
    const bk = `${b.stateFips}${b.countyFips}`;
    return ak.localeCompare(bk);
  });
  return out;
}

function buildCensusApiUrl(year, resolution, variables, stateFips, countyFips, apiKey){
  const base = `https://api.census.gov/data/${year}/acs/acs5`;
  const params = new URLSearchParams();
  params.set("get", ["NAME", ...variables].join(","));
  params.set("for", `${resolution === "block_group" ? "block group" : "tract"}:*`);
  params.set("in", `state:${stateFips}+county:${countyFips}`);
  params.set("key", str(apiKey));
  return `${base}?${params.toString()}`;
}

/**
 * @param {unknown} urls
 * @returns {{
 *   censusManifestUrl: string | null,
 *   electionManifestUrl: string | null,
 *   crosswalkRowsUrl: string | null,
 *   precinctResultsUrl: string | null,
 *   censusGeoRowsUrl: string | null
 * }}
 */
function normalizeAutoPullUrls(urls){
  const u = (urls && typeof urls === "object") ? /** @type {Record<string, any>} */ (urls) : {};
  return {
    censusManifestUrl: httpUrlOrNull(u.censusManifestUrl),
    electionManifestUrl: httpUrlOrNull(u.electionManifestUrl),
    crosswalkRowsUrl: httpUrlOrNull(u.crosswalkRowsUrl),
    precinctResultsUrl: httpUrlOrNull(u.precinctResultsUrl),
    censusGeoRowsUrl: httpUrlOrNull(u.censusGeoRowsUrl),
  };
}

/**
 * @param {{
 *   mode?: unknown,
 *   selected?: unknown,
 *   urls?: unknown
 * }} args
 * @returns {{
 *   mode: "manual" | "pinned_verified" | "latest_verified",
 *   selected: {
 *     boundarySetId: string | null,
 *     crosswalkVersionId: string | null,
 *     censusDatasetId: string | null,
 *     electionDatasetId: string | null
 *   },
 *   urls: {
 *     censusManifestUrl: string | null,
 *     electionManifestUrl: string | null,
 *     crosswalkRowsUrl: string | null,
 *     precinctResultsUrl: string | null,
 *     censusGeoRowsUrl: string | null
 *   }
 * }}
 */
function normalizePlanIdentity(args = {}){
  const selectedIn = (args.selected && typeof args.selected === "object") ? /** @type {Record<string, any>} */ (args.selected) : {};
  return {
    mode: normalizeMode(args.mode),
    selected: {
      boundarySetId: str(selectedIn.boundarySetId) || null,
      crosswalkVersionId: str(selectedIn.crosswalkVersionId) || null,
      censusDatasetId: str(selectedIn.censusDatasetId) || null,
      electionDatasetId: str(selectedIn.electionDatasetId) || null,
    },
    urls: normalizeAutoPullUrls(args.urls),
  };
}

/**
 * @param {{
 *   mode?: unknown,
 *   selected?: unknown,
 *   urls?: unknown
 * }} args
 * @returns {string}
 */
export function buildAutoPullPlanFingerprint(args = {}){
  const normalized = normalizePlanIdentity(args);
  return JSON.stringify(normalized);
}

/**
 * @param {{
 *   dataRefs?: Record<string, any> | null,
 *   dataCatalog?: Record<string, any> | null,
 *   scenario?: Record<string, any> | null,
 *   resolveDataRefsByPolicy?: ((args: {
 *     dataRefs?: Record<string, any> | null,
 *     dataCatalog?: Record<string, any> | null,
 *     scenario?: Record<string, any> | null
 *   }) => any) | null
 * }} args
 * @returns {{
 *   mode: "manual" | "pinned_verified" | "latest_verified",
 *   policyLabel: string,
 *   selected: {
 *     boundarySetId: string | null,
 *     crosswalkVersionId: string | null,
 *     censusDatasetId: string | null,
 *     electionDatasetId: string | null
 *   },
 *   urls: {
 *     censusManifestUrl: string | null,
 *     electionManifestUrl: string | null,
 *     crosswalkRowsUrl: string | null,
 *     precinctResultsUrl: string | null,
 *     censusGeoRowsUrl: string | null
 *   },
 *   availableCount: number,
 *   missingCount: number,
 *   notes: string[]
 * }}
 */
export function buildAutoPullUrlPlan(args = {}){
  const refs = (args && typeof args.dataRefs === "object" && args.dataRefs) || {};
  const catalog = (args && typeof args.dataCatalog === "object" && args.dataCatalog) || {};
  const mode = normalizeMode(refs.mode);
  const resolveByPolicy = typeof args.resolveDataRefsByPolicy === "function"
    ? args.resolveDataRefsByPolicy
    : null;
  const resolved = resolveByPolicy
    ? resolveByPolicy({
      dataRefs: refs,
      dataCatalog: catalog,
      scenario: args.scenario || null,
    })
    : null;
  const selected = {
    boundarySetId: str((resolved && resolved.selected && resolved.selected.boundarySetId) ?? refs.boundarySetId) || null,
    crosswalkVersionId: str((resolved && resolved.selected && resolved.selected.crosswalkVersionId) ?? refs.crosswalkVersionId) || null,
    censusDatasetId: str((resolved && resolved.selected && resolved.selected.censusDatasetId) ?? refs.censusDatasetId) || null,
    electionDatasetId: str((resolved && resolved.selected && resolved.selected.electionDatasetId) ?? refs.electionDatasetId) || null,
  };

  const censusDataset = findById(catalog.censusDatasets, selected.censusDatasetId);
  const electionDataset = findById(catalog.electionDatasets, selected.electionDatasetId);
  const crosswalk = findById(catalog.crosswalks, selected.crosswalkVersionId);

  const urls = {
    censusManifestUrl: pickManifestUrl(censusDataset),
    electionManifestUrl: pickManifestUrl(electionDataset),
    crosswalkRowsUrl: pickRowsUrl(crosswalk),
    precinctResultsUrl: pickRowsUrl(electionDataset),
    censusGeoRowsUrl: pickRowsUrl(censusDataset),
  };

  /** @type {string[]} */
  const notes = [];
  if (selected.censusDatasetId && !urls.censusManifestUrl){
    notes.push(`No census manifest URL on dataset '${selected.censusDatasetId}'.`);
  }
  if (selected.electionDatasetId && !urls.electionManifestUrl){
    notes.push(`No election manifest URL on dataset '${selected.electionDatasetId}'.`);
  }
  if (selected.crosswalkVersionId && !urls.crosswalkRowsUrl){
    notes.push(`No crosswalk rows URL on crosswalk '${selected.crosswalkVersionId}'.`);
  }
  if (selected.electionDatasetId && !urls.precinctResultsUrl){
    notes.push(`No precinct rows URL on election dataset '${selected.electionDatasetId}'.`);
  }
  if (selected.censusDatasetId && !urls.censusGeoRowsUrl){
    notes.push(`No census GEO rows URL on dataset '${selected.censusDatasetId}'.`);
  }

  const availableCount = Object.values(urls).filter(Boolean).length;
  const missingCount = 5 - availableCount;
  const policyLabel = mode === "latest_verified"
    ? "latest_verified (resolved at pull time)"
    : (mode === "manual" ? "manual (explicit refs)" : "pinned_verified (fixed refs)");

  return {
    mode,
    policyLabel,
    selected,
    urls,
    availableCount,
    missingCount,
    notes,
  };
}

export function buildCensusApiPullPlan(args = {}){
  const scenario = (args && typeof args.scenario === "object" && args.scenario) ? args.scenario : {};
  const refs = (args && typeof args.dataRefs === "object" && args.dataRefs) ? args.dataRefs : (scenario.dataRefs || {});
  const catalog = (args && typeof args.dataCatalog === "object" && args.dataCatalog) ? args.dataCatalog : (scenario.dataCatalog || {});
  const geoPack = (scenario && typeof scenario.geoPack === "object" && scenario.geoPack) ? scenario.geoPack : {};
  const area = (geoPack && typeof geoPack.area === "object" && geoPack.area) ? geoPack.area : {};
  const resolution = normalizeResolution(args.resolution ?? geoPack.resolution);
  const apiKey = str(args.apiKey);
  const selectedCensusId = str(refs?.censusDatasetId);
  const selectedDataset = findById(catalog?.censusDatasets, selectedCensusId);
  const datasetYear = yearOrNull(args.vintageYear) ?? yearOrNull(selectedDataset?.vintage);
  const variables = normalizeVariableRefs(args.variableRefs);
  const finalVariables = variables.length ? variables : ["B01003_001E", "B25001_001E"];
  const geoUnits = Array.isArray(geoPack?.units) ? geoPack.units : [];
  const pairs = collectCountyPairsFromGeoUnits(geoUnits);
  const areaType = str(area?.type).toUpperCase();
  const areaCountyRaw = digits(area?.countyFips);
  if (pairs.length === 0 && areaType === "COUNTY"){
    if (areaCountyRaw.length >= 5){
      const one = normalizeStateCountyPair(areaCountyRaw.slice(0, 2), areaCountyRaw.slice(-3));
      if (one) pairs.push(one);
    } else {
      const one = normalizeStateCountyPair(area?.stateFips, areaCountyRaw);
      if (one) pairs.push(one);
    }
  }
  const seen = new Set();
  const countyPairs = [];
  for (const row of pairs){
    const key = `${row.stateFips}${row.countyFips}`;
    if (seen.has(key)) continue;
    seen.add(key);
    countyPairs.push(row);
  }
  countyPairs.sort((a, b) => `${a.stateFips}${a.countyFips}`.localeCompare(`${b.stateFips}${b.countyFips}`));
  const notes = [];
  if (!apiKey) notes.push("Census API key is required.");
  if (!datasetYear) notes.push("Census dataset vintage year is missing on selected refs/catalog.");
  if (!countyPairs.length) notes.push("No county scope found. Set County area or load GEO units first.");
  const requests = [];
  if (apiKey && datasetYear && countyPairs.length){
    for (const row of countyPairs){
      requests.push({
        stateFips: row.stateFips,
        countyFips: row.countyFips,
        url: buildCensusApiUrl(datasetYear, resolution, finalVariables, row.stateFips, row.countyFips, apiKey),
      });
    }
  }
  const ready = requests.length > 0;
  const status = ready ? (notes.length ? "warn" : "ok") : "bad";
  const summaryLine = ready
    ? `Census API plan: ${requests.length} county request(s) · ${finalVariables.length} variable(s) · ${resolution}.`
    : `Census API plan unavailable: ${notes[0] || "missing inputs"}`;
  return {
    ready,
    status,
    summaryLine,
    datasetYear: datasetYear || null,
    resolution,
    variables: finalVariables,
    countyPairs,
    requests,
    notes,
  };
}

export function censusGeoRowsFromApiPayload(args = {}){
  const payload = args.payload;
  const table = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === "object" && Array.isArray(payload.data) ? payload.data : []);
  if (!Array.isArray(table) || table.length < 2){
    return {
      ok: false,
      rows: [],
      warning: "Census API payload is empty or not tabular JSON.",
    };
  }
  const header = Array.isArray(table[0]) ? table[0].map((x) => str(x)) : [];
  const resolution = normalizeResolution(args.resolution);
  const normalizedVariables = normalizeVariableRefs(args.variableRefs);
  const variables = normalizedVariables.length
    ? normalizedVariables
    : header.filter((k) => {
      const t = str(k).toLowerCase();
      return t !== "name" && t !== "state" && t !== "county" && t !== "tract" && t !== "block group";
    }).map((k) => str(k).toUpperCase());
  const index = new Map();
  for (let i = 0; i < header.length; i += 1){
    index.set(header[i], i);
    index.set(str(header[i]).toUpperCase(), i);
  }
  const idxState = index.get("state");
  const idxCounty = index.get("county");
  const idxTract = index.get("tract");
  const idxBlockGroup = index.get("block group");
  if (!Number.isInteger(idxState) || !Number.isInteger(idxCounty) || !Number.isInteger(idxTract)){
    return {
      ok: false,
      rows: [],
      warning: "Census API payload missing state/county/tract columns.",
    };
  }
  if (resolution === "block_group" && !Number.isInteger(idxBlockGroup)){
    return {
      ok: false,
      rows: [],
      warning: "Census API payload missing block group column for block_group resolution.",
    };
  }
  const variableIndexes = variables
    .map((key) => ({ key, idx: index.get(key) }))
    .filter((x) => Number.isInteger(x.idx));
  if (!variableIndexes.length){
    return {
      ok: false,
      rows: [],
      warning: "Census API payload has no requested variable columns.",
    };
  }
  const geoidFilter = new Set(
    (Array.isArray(args.geoidFilter) ? args.geoidFilter : [])
      .map((x) => digits(x))
      .filter((x) => !!x)
  );
  const byGeoid = new Map();
  for (let r = 1; r < table.length; r += 1){
    const row = Array.isArray(table[r]) ? table[r] : [];
    const st = digits(row[idxState]).slice(0, 2).padStart(2, "0");
    const co = digits(row[idxCounty]).slice(-3).padStart(3, "0");
    const tr = digits(row[idxTract]).slice(-6).padStart(6, "0");
    const bg = resolution === "block_group"
      ? digits(row[idxBlockGroup]).slice(-1).padStart(1, "0")
      : "";
    if (!/^\d{2}$/.test(st) || !/^\d{3}$/.test(co) || !/^\d{6}$/.test(tr)) continue;
    const geoid = `${st}${co}${tr}${bg}`;
    if (geoidFilter.size && !geoidFilter.has(geoid)) continue;
    const values = {};
    for (const v of variableIndexes){
      const raw = row[Number(v.idx)];
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      values[v.key] = n;
      if (v.key === "B01003_001E") values.pop = n;
      if (v.key === "B25001_001E") values.housing_units = n;
    }
    if (!Object.keys(values).length) continue;
    byGeoid.set(geoid, { geoid, values });
  }
  const rows = Array.from(byGeoid.values()).sort((a, b) => String(a.geoid).localeCompare(String(b.geoid)));
  return {
    ok: rows.length > 0,
    rows,
    warning: rows.length ? "" : "Census API payload returned no matching GEO rows.",
  };
}

/**
 * @param {{
 *   nowIso?: string | null,
 *   mode?: string | null,
 *   selected?: Record<string, any> | null,
 *   urls?: Record<string, any> | null,
 *   results?: Array<{ source: string, url: string | null, ok: boolean, message: string }> | null
 * }} args
 * @returns {{
 *   ts: string,
 *   mode: "manual" | "pinned_verified" | "latest_verified",
 *   selected: {
 *     boundarySetId: string | null,
 *     crosswalkVersionId: string | null,
 *     censusDatasetId: string | null,
 *     electionDatasetId: string | null
 *   },
 *   urls: {
 *     censusManifestUrl: string | null,
 *     electionManifestUrl: string | null,
 *     crosswalkRowsUrl: string | null,
 *     precinctResultsUrl: string | null,
 *     censusGeoRowsUrl: string | null
 *   },
 *   requestedCount: number,
 *   successCount: number,
 *   warningCount: number,
 *   warnings: string[],
 *   status: "ok" | "warn" | "bad",
 *   planFingerprint: string,
 *   fingerprint: string
 * }}
 */
export function createAutoPullReceipt(args = {}){
  const identity = normalizePlanIdentity(args);
  const mode = identity.mode;
  const selected = identity.selected;
  const urls = identity.urls;
  const resultsIn = Array.isArray(args.results) ? args.results : [];
  const ts = str(args.nowIso) || new Date().toISOString();
  const planFingerprint = buildAutoPullPlanFingerprint(identity);

  const warnings = [];
  let requestedCount = 0;
  let successCount = 0;
  for (const row of resultsIn){
    const source = str(row && typeof row === "object" ? row.source : "");
    if (!source) continue;
    requestedCount += 1;
    const ok = !!(row && typeof row === "object" && row.ok);
    if (ok){
      successCount += 1;
    } else {
      const msg = str(row && typeof row === "object" ? row.message : "");
      warnings.push(`${source}: ${msg || "failed"}`);
    }
  }

  const warningCount = warnings.length;
  const status = successCount === requestedCount && warningCount === 0
    ? "ok"
    : (successCount > 0 ? "warn" : "bad");
  const fingerprint = JSON.stringify({
    planFingerprint,
    requestedCount,
    successCount,
    warningCount,
  });

  return {
    ts,
    mode,
    selected,
    urls,
    requestedCount,
    successCount,
    warningCount,
    warnings,
    status,
    planFingerprint,
    fingerprint,
  };
}

/**
 * @param {unknown} receipt
 * @returns {string}
 */
export function summarizeAutoPullReceipt(receipt){
  const r = (receipt && typeof receipt === "object") ? /** @type {Record<string, any>} */ (receipt) : null;
  if (!r) return "Auto-pull run: none.";
  const ts = str(r.ts) || "unknown time";
  const mode = normalizeMode(r.mode);
  const requested = Number(r.requestedCount);
  const success = Number(r.successCount);
  const warningCount = Number(r.warningCount);
  const reqText = Number.isFinite(requested) ? String(Math.max(0, Math.trunc(requested))) : "0";
  const okText = Number.isFinite(success) ? String(Math.max(0, Math.trunc(success))) : "0";
  const warnText = Number.isFinite(warningCount) ? String(Math.max(0, Math.trunc(warningCount))) : "0";
  return `Auto-pull run ${ts} · mode ${mode} · imported ${okText}/${reqText} · warnings ${warnText}`;
}

/**
 * @param {{
 *   receipt?: unknown,
 *   mode?: unknown,
 *   selected?: unknown,
 *   urls?: unknown
 * }} args
 * @returns {{
 *   aligned: boolean,
 *   status: "ok" | "warn" | "muted",
 *   summaryLine: string
 * }}
 */
export function assessAutoPullReceiptAlignment(args = {}){
  const receipt = (args.receipt && typeof args.receipt === "object")
    ? /** @type {Record<string, any>} */ (args.receipt)
    : null;
  if (!receipt){
    return {
      aligned: false,
      status: "muted",
      summaryLine: "Auto-pull receipt alignment: no receipt yet.",
    };
  }
  const expected = buildAutoPullPlanFingerprint({
    mode: args.mode,
    selected: args.selected,
    urls: args.urls,
  });
  const actual = str(receipt.planFingerprint);
  if (!actual){
    return {
      aligned: false,
      status: "warn",
      summaryLine: "Auto-pull receipt alignment: stale/legacy receipt (missing plan fingerprint).",
    };
  }
  if (actual !== expected){
    return {
      aligned: false,
      status: "warn",
      summaryLine: "Auto-pull receipt alignment: stale (current refs/URLs differ from last run).",
    };
  }
  return {
    aligned: true,
    status: "ok",
    summaryLine: "Auto-pull receipt alignment: current (matches refs/URLs).",
  };
}

/**
 * @param {{
 *   receipt?: unknown,
 *   mode?: unknown,
 *   selected?: unknown,
 *   urls?: unknown
 * }} args
 * @returns {{
 *   shouldRun: boolean,
 *   status: "ok" | "warn" | "bad" | "muted",
 *   summaryLine: string
 * }}
 */
export function evaluateAutoPullRunNeed(args = {}){
  const urls = normalizeAutoPullUrls(args.urls);
  const availableCount = Object.values(urls).filter(Boolean).length;
  if (availableCount <= 0){
    return {
      shouldRun: false,
      status: "bad",
      summaryLine: "Auto-pull run need: blocked (no URL slots available).",
    };
  }
  const alignment = assessAutoPullReceiptAlignment({
    receipt: args.receipt,
    mode: args.mode,
    selected: args.selected,
    urls,
  });
  if (alignment.status === "muted"){
    return {
      shouldRun: true,
      status: "warn",
      summaryLine: "Auto-pull run need: yes (no prior receipt).",
    };
  }
  if (alignment.status === "warn"){
    return {
      shouldRun: true,
      status: "warn",
      summaryLine: "Auto-pull run need: yes (stale refs/URLs vs last run).",
    };
  }
  const receipt = (args.receipt && typeof args.receipt === "object")
    ? /** @type {Record<string, any>} */ (args.receipt)
    : null;
  const requestedCount = Number(receipt?.requestedCount);
  const successCount = Number(receipt?.successCount);
  const warningCount = Number(receipt?.warningCount);
  if (
    Number.isFinite(requestedCount) &&
    Number.isFinite(successCount) &&
    Number.isFinite(warningCount) &&
    requestedCount > 0 &&
    successCount === requestedCount &&
    warningCount === 0
  ){
    return {
      shouldRun: false,
      status: "ok",
      summaryLine: "Auto-pull run need: no (current + previous run succeeded).",
    };
  }
  return {
    shouldRun: true,
    status: "warn",
    summaryLine: "Auto-pull run need: yes (current refs/URLs but previous run had warnings).",
  };
}

/**
 * @param {unknown} plan
 * @returns {{
 *   ready: boolean,
 *   status: "ok" | "warn" | "bad",
 *   availableCount: number,
 *   missingCount: number,
 *   missingKeys: string[],
 *   summaryLine: string
 * }}
 */
export function evaluateAutoPullPlan(plan){
  const p = (plan && typeof plan === "object") ? /** @type {Record<string, any>} */ (plan) : {};
  const urls = normalizeAutoPullUrls(p.urls);
  /** @type {string[]} */
  const missingKeys = [];
  for (const key of AUTO_PULL_URL_KEYS){
    if (!urls[key]) missingKeys.push(key);
  }
  const availableCount = AUTO_PULL_URL_KEYS.length - missingKeys.length;
  const missingCount = missingKeys.length;
  const mode = normalizeMode(p.mode);
  const ready = availableCount > 0;
  const status = availableCount === AUTO_PULL_URL_KEYS.length
    ? "ok"
    : (ready ? "warn" : "bad");
  const summaryLine = ready
    ? `Auto-pull plan (${mode}): ${availableCount}/${AUTO_PULL_URL_KEYS.length} URL slots available.`
    : `Auto-pull plan (${mode}): no URL slots available.`;
  return {
    ready,
    status,
    availableCount,
    missingCount,
    missingKeys,
    summaryLine,
  };
}

/**
 * @param {{
 *   plan?: unknown,
 *   overrides?: unknown
 * }} args
 * @returns {{
 *   mode: "manual" | "pinned_verified" | "latest_verified",
 *   urls: {
 *     censusManifestUrl: string | null,
 *     electionManifestUrl: string | null,
 *     crosswalkRowsUrl: string | null,
 *     precinctResultsUrl: string | null,
 *     censusGeoRowsUrl: string | null
 *   },
 *   availableCount: number,
 *   missingCount: number,
 *   sourceByKey: Record<string, "override" | "plan" | "none">
 * }}
 */
export function resolveAutoPullUrls(args = {}){
  const p = (args.plan && typeof args.plan === "object") ? /** @type {Record<string, any>} */ (args.plan) : {};
  const mode = normalizeMode(p.mode);
  const planUrls = normalizeAutoPullUrls(p.urls);
  const overrideUrls = normalizeAutoPullUrls(args.overrides);
  const urls = {
    censusManifestUrl: overrideUrls.censusManifestUrl || planUrls.censusManifestUrl || null,
    electionManifestUrl: overrideUrls.electionManifestUrl || planUrls.electionManifestUrl || null,
    crosswalkRowsUrl: overrideUrls.crosswalkRowsUrl || planUrls.crosswalkRowsUrl || null,
    precinctResultsUrl: overrideUrls.precinctResultsUrl || planUrls.precinctResultsUrl || null,
    censusGeoRowsUrl: overrideUrls.censusGeoRowsUrl || planUrls.censusGeoRowsUrl || null,
  };
  const sourceByKey = {};
  let availableCount = 0;
  let missingCount = 0;
  for (const key of AUTO_PULL_URL_KEYS){
    const hasOverride = !!overrideUrls[key];
    const hasPlan = !!planUrls[key];
    if (urls[key]){
      availableCount += 1;
      sourceByKey[key] = hasOverride ? "override" : (hasPlan ? "plan" : "none");
    } else {
      missingCount += 1;
      sourceByKey[key] = "none";
    }
  }
  return {
    mode,
    urls,
    availableCount,
    missingCount,
    sourceByKey,
  };
}
