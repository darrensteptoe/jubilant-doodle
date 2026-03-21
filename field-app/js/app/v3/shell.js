import { V3_STAGE_REGISTRY } from "./stageRegistry.js";
import {
  PRODUCT_ABBREVIATION,
  PRODUCT_NAME,
  buildSidebarCopyrightText,
} from "../brand.js";

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
          <span class="fpe-brand">${PRODUCT_NAME}</span>
          <span class="fpe-brand-short">${PRODUCT_ABBREVIATION}</span>
          <span class="fpe-build" id="v3BuildStamp">UI 3.0</span>
        </div>
        <div class="fpe-topbar__actions">
          <button class="fpe-btn fpe-btn--ghost" id="v3BtnDiagnostics" type="button">Diagnostics</button>
          <button class="fpe-btn fpe-btn--danger" id="v3BtnReset" type="button">Reset scenario</button>
        </div>
      </header>

      <div class="fpe-layout">
        <aside class="fpe-nav" aria-label="Primary navigation">
          <div class="fpe-nav__scroll">
            ${renderNavGroups()}
          </div>
          <footer class="fpe-nav__footer">${buildSidebarCopyrightText(currentYear)}</footer>
        </aside>

        <main class="fpe-main">
          <section class="fpe-context" aria-label="Campaign context">
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
            <div class="fpe-context__intel">
              <div class="fpe-context__label">Glossary shortcuts</div>
              <div class="fpe-context__chips" aria-label="Glossary shortcuts">
                <button class="fpe-intel-chip" data-intel-glossary="variance" type="button">Variance</button>
                <button class="fpe-intel-chip" data-intel-glossary="lift" type="button">Lift</button>
                <button class="fpe-intel-chip" data-intel-glossary="persuasion" type="button">Persuasion</button>
                <button class="fpe-intel-chip" data-intel-glossary="turnoutOpportunity" type="button">Turnout opportunity</button>
                <button class="fpe-intel-chip" data-intel-glossary="contactProbability" type="button">Contact probability</button>
                <button class="fpe-intel-chip" data-intel-glossary="saturation" type="button">Saturation</button>
                <button class="fpe-intel-chip" data-intel-glossary="confidence" type="button">Confidence</button>
                <button class="fpe-intel-chip" data-intel-glossary="realism" type="button">Realism</button>
                <button class="fpe-intel-chip" data-intel-glossary="signal" type="button">Signal</button>
                <button class="fpe-intel-chip" data-intel-glossary="noise" type="button">Noise</button>
                <button class="fpe-intel-chip" data-intel-glossary="ageCohort" type="button">Age cohort</button>
                <button class="fpe-intel-chip" data-intel-glossary="ballotBaseline" type="button">Ballot baseline</button>
              </div>
            </div>
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
