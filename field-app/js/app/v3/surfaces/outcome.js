import {
  createCard,
  createColumn,
  createSurfaceFrame,
  createWhyPanel,
  getCardBody
} from "../componentFactory.js";
import { mountLegacyNode } from "../compat.js";

export function renderOutcomeSurface(mount) {
  const frame = createSurfaceFrame("two-col");
  const left = createColumn("primary");
  const right = createColumn("secondary");

  const forecastCard = createCard({
    title: "Forecast & confidence",
    description: "Monte Carlo distribution, confidence envelope, and sensitivity ranking."
  });

  const interpretationCard = createCard({
    title: "Drivers & interpretation",
    description: "Risk framing and explanatory links between assumptions and outputs."
  });

  const forecastNode = mountLegacyNode({
    key: "v3-outcome-forecast",
    selector: "#phase3Card",
    target: getCardBody(forecastCard)
  });

  const interpretationNode = mountLegacyNode({
    key: "v3-outcome-interpretation",
    selector: "#explainCard",
    target: getCardBody(interpretationCard),
    reveal: true
  });

  if (forecastNode) {
    forecastNode.removeAttribute("hidden");
  }
  if (interpretationNode) {
    interpretationNode.removeAttribute("hidden");
  }

  left.append(forecastCard);
  right.append(interpretationCard);

  frame.append(left, right);
  mount.append(frame);
  mount.append(
    createWhyPanel([
      "Outcome summarizes probability, not certainty.",
      "Sensitivity rankings identify which assumptions are worth validating in the field first.",
      "Interpretation should separate signal from model noise before decisions are logged."
    ])
  );

  return () => {};
}
