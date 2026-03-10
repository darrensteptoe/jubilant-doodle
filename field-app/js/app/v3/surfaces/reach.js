import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyNode } from "../compat.js";

export function renderReachSurface(mount) {
  const frame = createSurfaceFrame("three-col");
  const controls = createColumn("controls");
  const modelState = createColumn("state");
  const results = createColumn("results");

  const controlsCard = createCard({
    title: "Controls",
    description: "Primary staffing and production levers that change contact reach."
  });

  const weeklyCard = createCard({
    title: "Weekly production",
    description: "Required vs achievable attempts and conversation pace."
  });

  const universeCard = createCard({
    title: "Universe in play",
    description: "Movable electorate assumptions and early-vote pressure."
  });

  const outlookCard = createCard({
    title: "Capacity outlook",
    description: "Baseline, ramp, and scheduled-attempt comparisons."
  });

  const actionsCard = createCard({
    title: "Recommended actions",
    description: "Highest-value interventions under current constraints."
  });

  const conversionCard = createCard({
    title: "Persuasion math",
    description: "Contact and support rates that determine conversion efficiency."
  });

  mountLegacyNode({
    key: "v3-reach-controls",
    selector: "#weeklyOpsLeversCard",
    target: getCardBody(controlsCard)
  });

  mountLegacyNode({
    key: "v3-reach-weekly",
    selector: "#weeklyOpsCard",
    target: getCardBody(weeklyCard)
  });

  mountLegacyNode({
    key: "v3-reach-universe",
    selector: "#capacityUniverseCard",
    target: getCardBody(universeCard)
  });

  mountLegacyNode({
    key: "v3-reach-outlook",
    selector: "#operationsCapacityOutlookCard",
    target: getCardBody(outlookCard)
  });

  mountLegacyNode({
    key: "v3-reach-actions",
    selector: "#weeklyOpsActionsCard",
    target: getCardBody(actionsCard)
  });

  mountLegacyNode({
    key: "v3-reach-conversion",
    selector: "#conversionCard",
    target: getCardBody(conversionCard)
  });

  controls.append(controlsCard, weeklyCard);
  modelState.append(universeCard, outlookCard);
  results.append(actionsCard, conversionCard);

  frame.append(controls, modelState, results);
  mount.append(frame);
  mount.append(
    createWhyPanel([
      "Reach is bounded by throughput and conversion physics, not aspiration.",
      "This page should immediately show whether current capacity can close the modeled need.",
      "Use levers to resolve bottlenecks before changing outcome assumptions."
    ])
  );

  return () => {};
}
