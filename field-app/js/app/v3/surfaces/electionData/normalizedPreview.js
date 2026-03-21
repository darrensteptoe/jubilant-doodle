import { setText } from "../../surfaceUtils.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function toFinite(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function renderElectionDataNormalizedPreviewCard({ previewCard, getCardBody }) {
  getCardBody(previewCard).innerHTML = `
    <div class="fpe-help fpe-help--flush" id="v3ElectionDataPreviewMeta">No normalized rows yet.</div>
    <div class="table-wrap">
      <table class="table" aria-label="Normalized election data preview">
        <thead>
          <tr>
            <th>Cycle</th>
            <th>Office</th>
            <th>District</th>
            <th>Geography</th>
            <th>Candidate</th>
            <th class="num">Votes</th>
            <th class="num">Turnout</th>
          </tr>
        </thead>
        <tbody id="v3ElectionDataPreviewTbody">
          <tr class="fpe-empty-row"><td class="fpe-empty-state" colspan="7">No normalized rows.</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

export function syncElectionDataNormalizedPreview(canonical, derived) {
  const previewRows = asArray(derived?.normalizedPreviewRows).length
    ? asArray(derived.normalizedPreviewRows)
    : asArray(canonical?.normalizedRows).slice(0, 25);

  const tbody = document.getElementById("v3ElectionDataPreviewTbody");
  if (!(tbody instanceof HTMLElement)) return;

  if (!previewRows.length) {
    tbody.innerHTML = `<tr class="fpe-empty-row"><td class="fpe-empty-state" colspan="7">No normalized rows.</td></tr>`;
  } else {
    tbody.innerHTML = previewRows.map((row) => {
      const cycleYear = toFinite(row?.cycleYear, null);
      const voteTotal = toFinite(row?.voteTotal, null);
      const turnoutTotal = toFinite(row?.turnoutTotal, null);
      const candidateLabel = cleanText(row?.candidateName || row?.candidateId) || "—";
      return `
        <tr>
          <td>${cycleYear == null ? "—" : cycleYear}</td>
          <td>${cleanText(row?.office) || "—"}</td>
          <td>${cleanText(row?.districtId) || "—"}</td>
          <td>${cleanText(row?.geographyId) || "—"}</td>
          <td>${candidateLabel}</td>
          <td class="num">${voteTotal == null ? "—" : voteTotal.toLocaleString("en-US")}</td>
          <td class="num">${turnoutTotal == null ? "—" : turnoutTotal.toLocaleString("en-US")}</td>
        </tr>
      `;
    }).join("");
  }

  const canonicalCount = asArray(canonical?.normalizedRows).length;
  const previewCount = previewRows.length;
  setText(
    "v3ElectionDataPreviewMeta",
    canonicalCount > 0
      ? `Showing ${previewCount.toLocaleString("en-US")} of ${canonicalCount.toLocaleString("en-US")} normalized row(s).`
      : "No normalized rows yet.",
  );
}
