// @ts-check

const TRACE_KEY = "__FPE_BOOT_TRACE__";
const STATUS_KEY = "__FPE_BOOT_STATUS__";
const TRACE_MAX = 120;

function safeIsoNow(){
  try{
    return new Date().toISOString();
  } catch {
    return "";
  }
}

function safeObject(input){
  if (!input || typeof input !== "object") return {};
  return input;
}

/**
 * @returns {Array<Record<string, any>>}
 */
function readTrace(){
  try{
    const trace = globalThis?.[TRACE_KEY];
    if (Array.isArray(trace)) return trace;
  } catch {}
  return [];
}

/**
 * @param {Array<Record<string, any>>} trace
 */
function writeTrace(trace){
  try{
    globalThis[TRACE_KEY] = Array.isArray(trace) ? trace : [];
  } catch {}
}

/**
 * @param {string} step
 * @param {Record<string, any>=} extra
 */
export function bootProbeMark(step, extra = {}){
  try{
    const row = {
      t: safeIsoNow(),
      step: String(step || "unknown"),
      ...safeObject(extra),
    };
    const trace = readTrace();
    trace.unshift(row);
    if (trace.length > TRACE_MAX){
      trace.length = TRACE_MAX;
    }
    writeTrace(trace);
  } catch {}
}

/**
 * @param {string} status
 * @param {Record<string, any>=} extra
 */
export function bootProbeSetStatus(status, extra = {}){
  try{
    const nextStatus = {
      t: safeIsoNow(),
      status: String(status || "unknown"),
      ...safeObject(extra),
    };
    globalThis[STATUS_KEY] = nextStatus;
    bootProbeMark(`status.${nextStatus.status}`, extra);
  } catch {}
}

/**
 * @param {string} step
 * @param {unknown} err
 * @param {Record<string, any>=} extra
 */
export function bootProbeError(step, err, extra = {}){
  const message = err?.message ? String(err.message) : String(err || "Unknown boot error");
  bootProbeMark(step, {
    level: "error",
    message,
    ...safeObject(extra),
  });
}

/**
 * @returns {Record<string, any> | null}
 */
export function getBootProbeStatus(){
  try{
    const value = globalThis?.[STATUS_KEY];
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

