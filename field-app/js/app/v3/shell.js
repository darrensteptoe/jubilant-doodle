import { V3_STAGE_REGISTRY } from "./stageRegistry.js";

function renderNavGroups() {
  const groups = ["Model", "Operations", "Decisions", "System"];

  return groups
    .map((group) => {
      if (group === "Operations") {
        return `
          <div class="fpe-nav__group">
            <div class="fpe-nav__label">${group}</div>
            <a class="fpe-nav__item" href="organizer.html">Organizer Log</a>
            <a class="fpe-nav__item" href="operations.html">Operations</a>
          </div>
        `;
      }

      const items = V3_STAGE_REGISTRY.filter((stage) => stage.group === group);
      return `
        <div class="fpe-nav__group">
          <div class="fpe-nav__label">${group}</div>
          ${items
            .map(
              (stage) => `
                <button class="fpe-nav__item" data-v3-stage="${stage.id}" type="button">
                  ${stage.navLabel}
                </button>
              `
            )
            .join("")}
        </div>
      `;
    })
    .join("");
}

export function renderV3Shell(root) {
  root.innerHTML = `
    <div class="fpe-shell">
      <header class="fpe-topbar">
        <div class="fpe-topbar__brand">
          <span class="fpe-brand">Steptoe Strategic Media LLC Campaign Engine</span>
          <span class="fpe-build" id="v3BuildStamp">UI 3.0</span>
        </div>
        <div class="fpe-topbar__actions">
          <button
            class="fpe-btn fpe-btn--ghost fpe-btn--training"
            id="v3BtnTraining"
            type="button"
            aria-pressed="false"
            title="Show training explanations for each section"
          >
            Training
          </button>
          <button class="fpe-btn fpe-btn--ghost" id="v3BtnDiagnostics" type="button">Diagnostics</button>
          <button class="fpe-btn fpe-btn--danger" id="v3BtnReset" type="button">Reset scenario</button>
          <button class="fpe-btn fpe-btn--ghost" id="v3SwitchLegacy" type="button">Legacy shell</button>
        </div>
      </header>

      <div class="fpe-layout">
        <aside class="fpe-nav" aria-label="Primary navigation">
          ${renderNavGroups()}
        </aside>

        <main class="fpe-main">
          <section class="fpe-context" aria-label="Scenario context">
            <div class="fpe-context__label">Active scenario</div>
            <input class="fpe-context__input" id="v3ScenarioName" placeholder="Scenario name..." type="text" />
          </section>

          <section class="fpe-page-head" aria-label="Page heading">
            <div class="fpe-page-head__meta">
              <span class="fpe-page-head__eyebrow" id="v3PageEyebrow">Model</span>
              <h1 class="fpe-page-head__title" id="v3PageTitle">District Reality</h1>
            </div>
            <p class="fpe-page-head__subtitle" id="v3PageSubtitle"></p>
          </section>

          <section class="fpe-kpis" id="v3KpiStrip" aria-label="Core metrics"></section>

          <section class="fpe-surface" id="v3SurfaceMount" aria-live="polite"></section>
        </main>

        <aside class="fpe-right-rail-slot" id="v3RightRailSlot" aria-label="Persistent results rail"></aside>
      </div>
    </div>
  `;
}
