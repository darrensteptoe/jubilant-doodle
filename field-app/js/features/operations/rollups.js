// js/features/operations/rollups.js
// Canonical operations rollups with legacy-compatible alias.

import {
  summarizeShiftProduction,
  summarizeTurfCoverage,
  computeOperationalRollups,
} from "../thirdWing/rollups.js";

export { summarizeShiftProduction, summarizeTurfCoverage, computeOperationalRollups };

export const computeOperationsRollups = computeOperationalRollups;
