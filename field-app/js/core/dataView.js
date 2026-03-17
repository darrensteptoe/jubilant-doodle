// @ts-check

export const DATA_STATUS_AWAITING_STORAGE = "Awaiting storage";

/**
 * @param {boolean} strictEnabled
 * @param {string} hashBanner
 * @param {string} warnBanner
 * @param {number} backupCount
 * @returns {string}
 */
export function deriveDataPolicyCardStatus(strictEnabled, hashBanner, warnBanner, backupCount){
  if (hashBanner || warnBanner){
    return "Check import";
  }
  if (strictEnabled){
    return "Strict mode";
  }
  return backupCount > 0 ? "Restore ready" : "No backups";
}

/**
 * @param {string} importFileStatus
 * @returns {string}
 */
export function deriveDataExchangeCardStatus(importFileStatus){
  const lower = String(importFileStatus || "").toLowerCase();
  if (lower.includes("selected import:")){
    return "File staged";
  }
  return "Ready";
}

/**
 * @param {string} usbStatus
 * @returns {string}
 */
export function deriveDataStorageCardStatus(usbStatus){
  const lower = String(usbStatus || "").toLowerCase();
  if (lower.includes("browser storage")){
    return "Browser storage";
  }
  if (lower.includes("connected") || lower.includes("linked")){
    return "Folder linked";
  }
  if (lower.includes("connect")){
    return "Awaiting folder";
  }
  return "Folder linked";
}

/**
 * @param {string} sampleSizeText
 * @param {string} biasText
 * @param {string} archiveSummary
 * @returns {string}
 */
export function deriveDataAuditCardStatus(sampleSizeText, biasText, archiveSummary){
  const sampleSize = Number(String(sampleSizeText || "").replace(/[^\d.-]/g, ""));
  const bias = String(biasText || "").toLowerCase();
  const summary = String(archiveSummary || "").toLowerCase();
  if (!summary || summary.includes("no archive")){
    return "Awaiting archive";
  }
  if (!Number.isFinite(sampleSize) || sampleSize <= 0){
    return "Archive only";
  }
  if (bias.includes("overestimate") || bias.includes("underestimate")){
    return "Bias watch";
  }
  return "Learning active";
}

/**
 * @param {boolean} strictEnabled
 * @param {boolean} hasHashBanner
 * @param {boolean} hasWarnBanner
 * @param {string} usbStatus
 * @returns {string}
 */
export function deriveDataSummaryCardStatus(strictEnabled, hasHashBanner, hasWarnBanner, usbStatus){
  if (hasHashBanner || hasWarnBanner){
    return "Watch policy";
  }
  const lower = String(usbStatus || "").toLowerCase();
  if (strictEnabled){
    return lower.includes("browser storage") ? "Strict local" : "Strict external";
  }
  return lower.includes("browser storage") ? "Stable" : "External ready";
}

/**
 * @param {unknown} text
 * @returns {"ok"|"bad"|"warn"|"neutral"}
 */
export function classifyDataStatusTone(text){
  const lower = String(text || "").trim().toLowerCase();
  if (!lower){
    return "neutral";
  }
  if (/(restore ready|ready|browser storage|folder linked|stable|external ready|learning active|archive only)/.test(lower)){
    return "ok";
  }
  if (/(check import)/.test(lower)){
    return "bad";
  }
  if (/(strict|watch policy|file staged|awaiting folder|no backups|awaiting archive|bias watch)/.test(lower)){
    return "warn";
  }
  return "neutral";
}
