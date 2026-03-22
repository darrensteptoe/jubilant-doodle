import { V3_STAGE_REGISTRY } from "./stageRegistry.js";
import {
  PRODUCT_ABBREVIATION,
  PRODUCT_NAME,
  buildSidebarCopyrightText,
} from "../brand.js";
import usaFlagImage from "../../../assets/AdobeStock_271073143.jpeg";

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
  const currentYear = new Date().getFullYear();
  root.innerHTML = `
    <div class="fpe-shell">
      <header class="fpe-topbar">
        <div class="fpe-topbar__brand">
          <img class="fpe-brand-flag" src="${usaFlagImage}" alt="" aria-hidden="true" />
          <span class="fpe-brand">${PRODUCT_NAME}</span>
          <span class="fpe-brand-short">${PRODUCT_ABBREVIATION}</span>
        </div>
        <div class="fpe-topbar__actions">
          <button class="fpe-btn fpe-btn--ghost" id="v3BtnDiagnostics" type="button">Diagnostics</button>
          <button class="fpe-btn fpe-btn--danger" id="v3BtnReset" type="button">Reset scenario</button>
        </div>
      </header>
      <div class="fpe-runtime-diag" id="v3RuntimeDiagnostics" aria-live="polite" hidden></div>

      <div class="fpe-layout">
        <aside class="fpe-nav" aria-label="Primary navigation">
          <div class="fpe-nav__scroll">
            ${renderNavGroups()}
          </div>
          <footer class="fpe-nav__footer">${buildSidebarCopyrightText(currentYear)}</footer>
        </aside>

        <main class="fpe-main">
          <section class="fpe-page-head" aria-label="Page heading">
            <div class="fpe-page-head__meta">
              <span class="fpe-page-head__eyebrow" id="v3PageEyebrow">Model</span>
              <h1 class="fpe-page-head__title" id="v3PageTitle">District Reality</h1>
            </div>
            <p class="fpe-page-head__subtitle" id="v3PageSubtitle"></p>
          </section>

          <section class="fpe-context" aria-label="Campaign context" id="v3DataContextSection" hidden>
            <div class="fpe-context__grid">
              <div>
                <div class="fpe-context__label">Campaign ID</div>
                <input class="fpe-context__input" id="v3CampaignId" placeholder="e.g., il-hd-21" type="text" />
              </div>
              <div>
                <div class="fpe-context__label">Campaign name</div>
                <input class="fpe-context__input" id="v3CampaignName" placeholder="Campaign label" type="text" />
              </div>
              <div>
                <div class="fpe-context__label">Office ID</div>
                <input class="fpe-context__input" id="v3OfficeId" placeholder="e.g., west-field" type="text" />
              </div>
              <div>
                <div class="fpe-context__label">Active scenario</div>
                <input class="fpe-context__input" id="v3ScenarioName" placeholder="Scenario name..." type="text" />
              </div>
            </div>
            <div class="fpe-context__status" id="v3ContextStatus"></div>
          </section>

          <section class="fpe-kpis" id="v3KpiStrip" aria-label="Core metrics" hidden></section>

          <section class="fpe-surface" id="v3SurfaceMount" aria-live="polite"></section>
        </main>

        <aside class="fpe-right-rail-slot" id="v3RightRailSlot" aria-label="Persistent results rail"></aside>
      </div>
    </div>
  `;
}
