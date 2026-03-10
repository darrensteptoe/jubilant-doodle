import { createCard, createWhyPanel, getCardBody } from "../componentFactory.js";
import { mountLegacyStageBody } from "../compat.js";

export function renderDecisionLogSurface(mount) {
  const card = createCard({
    title: "Decision log",
    description: "Structured rationale, constraints, and follow-up actions."
  });

  mountLegacyStageBody({
    key: "v3-decisions-stage-body",
    stageId: "decisions",
    target: getCardBody(card)
  });

  mount.append(card);
  mount.append(
    createWhyPanel([
      "Decision logs convert model output into accountable operating choices.",
      "Every decision entry should tie to a scenario and explicit assumptions set.",
      "This record keeps rationale auditable across version and staffing changes."
    ])
  );

  return () => {};
}
