export function renderOutcomeSensitivityRows(rows, context = {}) {
  const { formatOutcomeSensitivityImpact } = context;

  if (typeof formatOutcomeSensitivityImpact !== "function") {
    return;
  }

  const tbody = document.getElementById("v3OutcomeSensitivityTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }

  tbody.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    tbody.innerHTML = '<tr><td class="muted">Run simulations to rank drivers.</td><td class="num muted">-</td></tr>';
    return;
  }

  for (const row of list) {
    const tr = document.createElement("tr");
    const td0 = document.createElement("td");
    td0.textContent = String(row?.label || "—");
    const td1 = document.createElement("td");
    td1.className = "num";
    td1.textContent = formatOutcomeSensitivityImpact(row?.impact, 2);
    tr.append(td0, td1);
    tbody.appendChild(tr);
  }
}
