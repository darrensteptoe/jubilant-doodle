// @ts-check

export const OPERATIONS_MAP_CONTEXT_STORAGE_KEY = "fpe.operations.mapContext.v1";
export const OPERATIONS_MAP_CONTEXT_EVENT = "vice:operations-map-context-updated";
export const WORKED_ACTIVITY_MODE_ID = "worked_activity_context";

const FOCUS_TYPE_ORGANIZER = "organizer";
const FOCUS_TYPE_OFFICE = "office";

function clean(value){
  return String(value == null ? "" : value).trim();
}

function cleanLower(value){
  return clean(value).toLowerCase();
}

function safeParseJson(raw){
  try{
    const parsed = JSON.parse(String(raw || ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function readStorageValue(){
  try{
    if (typeof localStorage === "undefined") return "";
    return clean(localStorage.getItem(OPERATIONS_MAP_CONTEXT_STORAGE_KEY));
  } catch {
    return "";
  }
}

function writeStorageValue(next){
  try{
    if (typeof localStorage === "undefined") return;
    if (!clean(next)){
      localStorage.removeItem(OPERATIONS_MAP_CONTEXT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(OPERATIONS_MAP_CONTEXT_STORAGE_KEY, String(next));
  } catch {
    // ignore storage access errors
  }
}

function notifyUpdate(detail){
  try{
    if (typeof window === "undefined" || typeof window.dispatchEvent !== "function"){
      return;
    }
    window.dispatchEvent(new CustomEvent(OPERATIONS_MAP_CONTEXT_EVENT, {
      detail: detail && typeof detail === "object" ? detail : {},
    }));
  } catch {
    // ignore event dispatch failures
  }
}

/**
 * @param {any=} input
 */
export function normalizeOperationsMapContext(input = {}){
  const src = input && typeof input === "object" && !Array.isArray(input)
    ? input
    : {};
  const focusTypeRaw = cleanLower(src.focusType);
  const focusType = (focusTypeRaw === FOCUS_TYPE_ORGANIZER || focusTypeRaw === FOCUS_TYPE_OFFICE)
    ? focusTypeRaw
    : "";
  const organizerId = clean(src.organizerId);
  const organizerName = clean(src.organizerName);
  const officeId = clean(src.officeId);
  const campaignId = clean(src.campaignId);
  const campaignName = clean(src.campaignName);
  const requestedMode = clean(src.requestedMode) === WORKED_ACTIVITY_MODE_ID
    ? WORKED_ACTIVITY_MODE_ID
    : "";
  const source = clean(src.source);
  const requestId = clean(src.requestId);
  const updatedAt = clean(src.updatedAt);

  if (focusType === FOCUS_TYPE_ORGANIZER && !organizerId){
    return {
      focusType: "",
      organizerId: "",
      organizerName: "",
      officeId,
      campaignId,
      campaignName,
      requestedMode: "",
      source,
      requestId: "",
      updatedAt: "",
    };
  }
  if (focusType === FOCUS_TYPE_OFFICE && !officeId){
    return {
      focusType: "",
      organizerId: "",
      organizerName: "",
      officeId: "",
      campaignId,
      campaignName,
      requestedMode: "",
      source,
      requestId: "",
      updatedAt: "",
    };
  }
  return {
    focusType,
    organizerId,
    organizerName,
    officeId,
    campaignId,
    campaignName,
    requestedMode: focusType ? (requestedMode || WORKED_ACTIVITY_MODE_ID) : "",
    source,
    requestId: focusType ? requestId : "",
    updatedAt: focusType ? updatedAt : "",
  };
}

export function readOperationsMapContext(){
  const raw = readStorageValue();
  if (!raw){
    return normalizeOperationsMapContext({});
  }
  const parsed = safeParseJson(raw);
  return normalizeOperationsMapContext(parsed);
}

/**
 * @param {any=} patch
 * @param {{ replace?: boolean }=} options
 */
export function writeOperationsMapContext(patch = {}, options = {}){
  const opts = options && typeof options === "object" ? options : {};
  const base = opts.replace ? {} : readOperationsMapContext();
  const merged = normalizeOperationsMapContext({
    ...base,
    ...(patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {}),
  });
  if (!merged.focusType){
    writeStorageValue("");
    notifyUpdate({ context: merged, cleared: true });
    return merged;
  }
  const nowIso = new Date().toISOString();
  const next = normalizeOperationsMapContext({
    ...merged,
    requestId: clean(merged.requestId) || nowIso,
    updatedAt: nowIso,
  });
  writeStorageValue(JSON.stringify(next));
  notifyUpdate({ context: next, cleared: false });
  return next;
}

export function clearOperationsMapContext(){
  const cleared = normalizeOperationsMapContext({});
  writeStorageValue("");
  notifyUpdate({ context: cleared, cleared: true });
  return cleared;
}

/**
 * @param {any=} context
 * @param {any=} scope
 */
export function operationsMapContextAppliesToScope(context = {}, scope = {}){
  const ctx = normalizeOperationsMapContext(context);
  if (!ctx.focusType){
    return false;
  }
  const src = scope && typeof scope === "object" ? scope : {};
  const scopeCampaignId = clean(src.campaignId);
  const scopeOfficeId = clean(src.officeId);
  if (ctx.campaignId && scopeCampaignId && cleanLower(ctx.campaignId) !== cleanLower(scopeCampaignId)){
    return false;
  }
  if (ctx.officeId && scopeOfficeId && cleanLower(ctx.officeId) !== cleanLower(scopeOfficeId)){
    return false;
  }
  return true;
}
