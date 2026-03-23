export function renderOutcomeSurfaceRows(rows, context = {}) {
  const {
    formatPercentFromUnit,
    formatSignedWhole,
  } = context;

  if (
    typeof formatPercentFromUnit !== "function"
    || typeof formatSignedWhole !== "function"
  ) {
    return;
  }

  const tbody = document.getElementById("v3OutcomeSurfaceTbody");
  if (!(tbody instanceof HTMLElement)) {
    return;
  }

  tbody.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td class="muted">Run surface compute.</td>
        <td class="num muted">-</td>
        <td class="num muted">-</td>
        <td class="num muted">-</td>
        <td class="num muted">-</td>
      </tr>
    `;
    return;
  }

  for (const row of list) {
    const tr = document.createElement("tr");
    const td0 = document.createElement("td");
    td0.textContent = String(row?.leverValue ?? "—");

    const td1 = document.createElement("td");
    td1.className = "num";
    td1.textContent = formatPercentFromUnit(Number(row?.winProb), 1);

    const td2 = document.createElement("td");
    td2.className = "num";
    td2.textContent = formatSignedWhole(Number(row?.p10));

    const td3 = document.createElement("td");
    td3.className = "num";
    td3.textContent = formatSignedWhole(Number(row?.p50));

    const td4 = document.createElement("td");
    td4.className = "num";
    td4.textContent = formatSignedWhole(Number(row?.p90));

    tr.append(td0, td1, td2, td3, td4);
    tbody.appendChild(tr);
  }
}

export function syncOutcomeImpactTraceFallback({ targetId, outcomeGapNote, outcomeRiskLabel, outcomeWinProb }) {
  const target = document.getElementById(targetId);
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const rows = [
    `Capacity -> Gap note: ${String(outcomeGapNote || "—").trim() || "—"}`,
    `Risk posture -> ${String(outcomeRiskLabel || "—").trim() || "—"}`,
    `Win probability context -> ${String(outcomeWinProb || "—").trim() || "—"}`,
  ];
  target.innerHTML = rows.map((row) => `<li>${escapeHtml(row)}</li>`).join("");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
