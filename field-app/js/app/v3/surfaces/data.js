import { createCard, createWhyPanel, getCardBody } from "../componentFactory.js";
import { mountLegacyStageBody } from "../compat.js";

export function renderDataSurface(mount) {
  const card = createCard({
    title: "Data & recovery",
    description: "Import/export, backups, restore workflows, and storage policy."
  });

  mountLegacyStageBody({
    key: "v3-data-stage-body",
    stageId: "integrity",
    target: getCardBody(card)
  });

  mount.append(card);
  mount.append(
    createWhyPanel([
      "Data operations are infrastructure tasks and should stay isolated from modeling surfaces.",
      "Recovery workflows should be validated before any destructive import/export step.",
      "Policy clarity prevents accidental drift between local, removable, and exported state."
    ])
  );

  return () => {};
}
