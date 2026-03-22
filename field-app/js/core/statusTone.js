// @ts-check

/**
 * @typedef {"ok"|"warn"|"bad"|"neutral"} StatusTone
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeStatusText(value){
  return String(value || "").trim().toLowerCase();
}

const STATUS_BAD_PATTERN =
  /(unavailable|failed|broken|error|invalid|missing|incomplete|behind|shortfall|severe|high risk|high-risk|at risk|fragile|attention|required|run failed|rejected|denied|not ready|not loaded|not set|not available|check import|check totals|check shares|check distribution|no tactics|recovery\s+plan|needs(?:[-\s]+)?evidence)/;

const STATUS_WARN_PATTERN =
  /(awaiting|pending|watch|warning|risk|competitive|tight|constrained|binding|module off|override|drift|needs|need path|in progress|run targeting|awaiting run|no compare|strict|catalog empty|no rows|partial|guarded|locked|gap focus|weighting off|session active|parser active|ready to attach|observed captured|bias watch|delta(?:[-\s]+)?tracked)/;

const STATUS_OK_PATTERN =
  /(ready|active|stable|healthy|complete|configured|current|compared|linked|loaded|sourced|balanced|feasible|favored|quiet|clear|on pace|model-based|drift-aware|external ready|strict local|steady|export ready|surface ready|drivers ranked|options ready|diagnostics ready|recommendation set|constraints set|session linked|ranks ready|anchored|helpful|in context|browser storage|folder linked|restore ready|guidance ready|review ready|brief ready|sim ready)/;

/**
 * @param {string} source
 * @param {Array<string|RegExp>} patterns
 * @returns {boolean}
 */
function matchesAnyPattern(source, patterns){
  return patterns.some((pattern) => {
    if (pattern instanceof RegExp){
      return pattern.test(source);
    }
    const token = normalizeStatusText(pattern);
    return token ? source.includes(token) : false;
  });
}

/**
 * Shared status-tone classifier used by all rebuilt surfaces.
 *
 * @param {unknown} text
 * @param {{
 *   extraOk?: Array<string|RegExp>,
 *   extraWarn?: Array<string|RegExp>,
 *   extraBad?: Array<string|RegExp>,
 * }=} options
 * @returns {StatusTone}
 */
export function classifyUnifiedStatusTone(text, options = {}){
  const source = normalizeStatusText(text);
  if (!source){
    return "neutral";
  }

  const extraBad = Array.isArray(options?.extraBad) ? options.extraBad : [];
  const extraWarn = Array.isArray(options?.extraWarn) ? options.extraWarn : [];
  const extraOk = Array.isArray(options?.extraOk) ? options.extraOk : [];

  if (STATUS_BAD_PATTERN.test(source) || matchesAnyPattern(source, extraBad)){
    return "bad";
  }
  if (STATUS_WARN_PATTERN.test(source) || matchesAnyPattern(source, extraWarn)){
    return "warn";
  }
  if (STATUS_OK_PATTERN.test(source) || matchesAnyPattern(source, extraOk)){
    return "ok";
  }
  return "neutral";
}
