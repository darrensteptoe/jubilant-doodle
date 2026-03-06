import { renderTimelineModule } from "../renderTimeline.js";

// Compatibility wrapper: keep old import path stable while forcing a single
// implementation path for timeline rendering logic.
export function renderTimelinePanel(args){
  return renderTimelineModule(args || {});
}

export { renderTimelineModule };
