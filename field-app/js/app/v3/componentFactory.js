export function createSurfaceFrame(layout = "three-col") {
  const frame = document.createElement("div");
  frame.className = `fpe-surface-frame fpe-surface-frame--${layout}`;
  return frame;
}

export function createColumn(name) {
  const col = document.createElement("div");
  col.className = `fpe-col fpe-col--${name}`;
  return col;
}

export function createCard({ title, description = "", status = "" }) {
  const card = document.createElement("section");
  card.className = "fpe-card";

  card.innerHTML = `
    <header class="fpe-card__head">
      <div class="fpe-card__head-main">
        <h2 class="fpe-card__title">${title}</h2>
        ${status ? `<span class="fpe-card__status">${status}</span>` : ""}
      </div>
      ${description ? `<p class="fpe-card__desc">${description}</p>` : ""}
    </header>
    <div class="fpe-card__body"></div>
  `;

  return card;
}

export function getCardBody(card) {
  return card.querySelector(".fpe-card__body");
}

export function createWhyPanel(items = []) {
  const panel = document.createElement("section");
  panel.className = "fpe-why";

  panel.innerHTML = `
    <h3 class="fpe-why__title">Why this result</h3>
    <ul class="fpe-why__list">
      ${items.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;

  return panel;
}

export function createKpiCard(label, id = "") {
  const el = document.createElement("div");
  el.className = "fpe-kpi";
  if (id) {
    el.id = id;
  }

  el.innerHTML = `
    <div class="fpe-kpi__label">${label}</div>
    <div class="fpe-kpi__value">-</div>
  `;

  return el;
}
