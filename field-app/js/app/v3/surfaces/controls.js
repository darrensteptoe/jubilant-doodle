import { createCard, createWhyPanel, getCardBody } from "../componentFactory.js";
import { mountLegacyStageBody } from "../compat.js";

export function renderControlsSurface(mount) {
  const card = createCard({
    title: "Model controls",
    description: "Governance workflows, integrity checks, and evidence review."
  });

  mountLegacyStageBody({
    key: "v3-controls-stage-body",
    stageId: "checks",
    target: getCardBody(card)
  });

  mount.append(card);
  mount.append(
    createWhyPanel([
      "Controls provide governance over assumptions before decisions are made.",
      "Validation and guardrails should be reviewed before sharing outcomes.",
      "This surface keeps confidence infrastructure separate from forecast tuning."
    ])
  );

  return () => {};
}
