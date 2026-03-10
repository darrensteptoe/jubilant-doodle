import { createCard, createWhyPanel, getCardBody } from "../componentFactory.js";
import { mountLegacyStageBody } from "../compat.js";

export function renderScenariosSurface(mount) {
  const card = createCard({
    title: "Scenario planning",
    description: "Save, compare, and switch between alternative campaign paths."
  });

  mountLegacyStageBody({
    key: "v3-scenarios-stage-body",
    stageId: "scenarios",
    target: getCardBody(card)
  });

  mount.append(card);
  mount.append(
    createWhyPanel([
      "Scenarios preserve alternate assumptions without overwriting baseline work.",
      "Comparison should focus on tradeoffs in feasibility, risk, and resource burden.",
      "Decision sessions should reference explicit scenario IDs, not ad-hoc snapshots."
    ])
  );

  return () => {};
}
