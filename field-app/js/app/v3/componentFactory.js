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

export function setCardHeaderControl(card, control) {
  if (!card || !control) {
    return null;
  }

  const headMain = card.querySelector(".fpe-card__head-main");
  if (!headMain) {
    return null;
  }

  control.classList.add("fpe-card__head-control");
  headMain.append(control);
  return control;
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

export function createInstructionBlock(items = []) {
  const block = document.createElement("div");
  block.className = "fpe-contained-block fpe-contained-block--instruction";

  const list = document.createElement("ul");
  list.className = "bullets";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });
  block.appendChild(list);
  return block;
}

export function createStatusBlock({ label, value = "-", id = "" }) {
  const block = document.createElement("div");
  block.className = "fpe-contained-block fpe-contained-block--status";
  block.innerHTML = `
    <div class="fpe-control-label">${label}</div>
    <div class="fpe-help fpe-help--flush"${id ? ` id="${id}"` : ""}>${value}</div>
  `;
  return block;
}

export function createStatusStrip(columns = 2, blocks = []) {
  const strip = document.createElement("div");
  strip.className = `fpe-status-strip fpe-status-strip--${columns}`;
  blocks.forEach((block) => {
    if (block) {
      strip.appendChild(block);
    }
  });
  return strip;
}

export function createTableWrap({
  ariaLabel = "Data table",
  headers = [],
  tbodyId = "",
  emptyLabel = "No rows.",
  numericColumns = []
}) {
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";

  const table = document.createElement("table");
  table.className = "table";
  table.setAttribute("aria-label", ariaLabel);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((label, index) => {
    const th = document.createElement("th");
    th.textContent = label;
    if (numericColumns.includes(index)) {
      th.classList.add("num");
    }
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  if (tbodyId) {
    tbody.id = tbodyId;
  }
  const emptyRow = document.createElement("tr");
  emptyRow.className = "fpe-empty-row";
  const emptyCell = document.createElement("td");
  emptyCell.className = "fpe-empty-state";
  emptyCell.colSpan = Math.max(1, headers.length);
  emptyCell.textContent = emptyLabel;
  emptyRow.appendChild(emptyCell);
  tbody.appendChild(emptyRow);

  table.append(thead, tbody);
  wrap.appendChild(table);
  return wrap;
}
