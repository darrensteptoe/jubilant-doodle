import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyCardFromChild, mountLegacyNode } from "../compat.js";

export function renderPlanSurface(mount) {
  const frame = createSurfaceFrame("two-col");
  const left = createColumn("primary");
  const right = createColumn("secondary");

  const workloadCard = createCard({
    title: "Workload translator",
    description: "Converts support goals into conversations, doors, shifts, and volunteer load."
  });

  const optimizerCard = createCard({
    title: "Optimization & timeline",
    description: "Budget/capacity allocation and timeline-constrained optimization outputs."
  });

  const freshnessCard = createCard({
    title: "Execution log freshness",
    description: "Rolling operations signal and calibration controls from organizer updates."
  });

  mountLegacyCardFromChild({
    key: "v3-plan-workload",
    childSelector: "#goalSupportIds",
    target: getCardBody(workloadCard)
  });

  mountLegacyCardFromChild({
    key: "v3-plan-optimizer",
    childSelector: "#optRun",
    target: getCardBody(optimizerCard)
  });

  mountLegacyNode({
    key: "v3-plan-freshness",
    selector: "#weeklyOpsFreshnessCard",
    target: getCardBody(freshnessCard)
  });

  left.append(workloadCard, optimizerCard);
  right.append(freshnessCard);

  frame.append(left, right);
  mount.append(frame);
  mount.append(
    createWhyPanel([
      "Plan translates model assumptions into concrete weekly execution burden.",
      "Optimization should be evaluated against staffing and timeline constraints, not budget alone.",
      "Freshness signals protect against stale plans when field reality changes."
    ])
  );

  return () => {};
}
