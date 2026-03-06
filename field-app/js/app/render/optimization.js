import { renderRoiModule } from "../renderRoi.js";
import { renderOptimizationModule } from "../renderOptimization.js";

// Compatibility wrapper: keep old import path stable while forcing a single
// implementation path for ROI/optimization rendering logic.
export function renderRoiPanel(args){
  return renderRoiModule(args || {});
}

// Compatibility wrapper: keep old import path stable while forcing a single
// implementation path for ROI/optimization rendering logic.
export function renderOptimizationPanel(args){
  return renderOptimizationModule(args || {});
}

export { renderRoiModule, renderOptimizationModule };
