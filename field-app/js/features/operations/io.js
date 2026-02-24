// js/features/operations/io.js
// Canonical operations import/export API with legacy-compatible aliases.

import * as legacy from "../thirdWing/io.js";

export const validateOperationsSnapshot = legacy.validateThirdWingSnapshot;
export const exportOperationsSnapshot = legacy.exportThirdWingSnapshot;
export async function downloadOperationsSnapshot(filename = "operations-snapshot.json"){
  return legacy.downloadThirdWingSnapshot(filename);
}
export const importOperationsSnapshot = legacy.importThirdWingSnapshot;

export const recordsToCsv = legacy.recordsToCsv;
export const exportStoreCsv = legacy.exportStoreCsv;
export const downloadStoreCsv = legacy.downloadStoreCsv;
export const csvToRecords = legacy.csvToRecords;
export const importStoreCsv = legacy.importStoreCsv;

// Legacy aliases (backward compatibility).
export const validateThirdWingSnapshot = validateOperationsSnapshot;
export const exportThirdWingSnapshot = exportOperationsSnapshot;
export const downloadThirdWingSnapshot = downloadOperationsSnapshot;
export const importThirdWingSnapshot = importOperationsSnapshot;
