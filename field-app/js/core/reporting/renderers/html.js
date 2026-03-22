// @ts-check

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMetricGrid(metrics) {
  const rows = asArray(metrics);
  if (!rows.length) {
    return `<div class="report-empty">No metrics available.</div>`;
  }
  const cells = rows
    .map((row) => {
      const label = escapeHtml(cleanText(row?.label || "Metric"));
      const value = escapeHtml(cleanText(row?.value || "—"));
      const note = escapeHtml(cleanText(row?.note || ""));
      return `
        <div class="report-metric-grid__cell">
          <div class="report-metric-grid__label">${label}</div>
          <div class="report-metric-grid__value">${value}</div>
          ${note ? `<div class="report-metric-grid__note">${note}</div>` : ""}
        </div>
      `;
    })
    .join("\n");
  return `<div class="report-metric-grid">${cells}</div>`;
}

function renderRowsList(rows, mapRow) {
  const list = asArray(rows);
  if (!list.length) {
    return `<div class="report-empty">No rows available.</div>`;
  }
  return `<ul class="report-list">${list.map(mapRow).join("")}</ul>`;
}

function renderBlock(block) {
  const type = cleanText(block?.type);

  if (type === "headline") {
    return `
      <div class="report-block report-block--headline">
        <h3>${escapeHtml(cleanText(block?.headline || ""))}</h3>
        ${cleanText(block?.subheadline) ? `<p>${escapeHtml(cleanText(block.subheadline))}</p>` : ""}
      </div>
    `;
  }

  if (type === "status") {
    return `
      <div class="report-block report-block--status">
        <div class="report-status__label">${escapeHtml(cleanText(block?.label || "Status"))}</div>
        <div class="report-status__value">${escapeHtml(cleanText(block?.value || "—"))}</div>
        ${cleanText(block?.note) ? `<div class="report-status__note">${escapeHtml(cleanText(block.note))}</div>` : ""}
      </div>
    `;
  }

  if (type === "metric_grid") {
    const title = cleanText(block?.title);
    return `
      <div class="report-block report-block--metric-grid">
        ${title ? `<h4>${escapeHtml(title)}</h4>` : ""}
        ${renderMetricGrid(block?.metrics)}
      </div>
    `;
  }

  if (type === "trend") {
    const title = cleanText(block?.label || "Trend");
    return `
      <div class="report-block report-block--trend">
        <h4>${escapeHtml(title)}</h4>
        ${renderRowsList(block?.rows, (row) => {
          const metric = escapeHtml(cleanText(row?.metric || "metric"));
          const delta = escapeHtml(cleanText(row?.delta || "—"));
          const direction = escapeHtml(cleanText(row?.direction || "flat"));
          return `<li><strong>${metric}</strong>: ${delta} <span class="report-pill">${direction}</span></li>`;
        })}
      </div>
    `;
  }

  if (type === "benchmark") {
    return `
      <div class="report-block report-block--benchmark">
        <div class="report-benchmark__head">
          <span class="report-benchmark__label">${escapeHtml(cleanText(block?.label || "Benchmark"))}</span>
          <span class="report-benchmark__value">${escapeHtml(cleanText(block?.value || "—"))}</span>
        </div>
        ${cleanText(block?.confidence) ? `<div class="report-benchmark__confidence">Confidence: ${escapeHtml(cleanText(block.confidence))}</div>` : ""}
        ${cleanText(block?.note) ? `<div class="report-benchmark__note">${escapeHtml(cleanText(block.note))}</div>` : ""}
      </div>
    `;
  }

  if (type === "risk") {
    return `
      <div class="report-block report-block--risk">
        <div class="report-risk__head">
          <span class="report-pill report-pill--risk">${escapeHtml(cleanText(block?.level || "risk"))}</span>
          <span>${escapeHtml(cleanText(block?.summary || "Risk item"))}</span>
        </div>
        ${cleanText(block?.mitigation) ? `<div class="report-risk__mitigation">Mitigation: ${escapeHtml(cleanText(block.mitigation))}</div>` : ""}
      </div>
    `;
  }

  if (type === "recommendation") {
    return `
      <div class="report-block report-block--recommendation">
        <div class="report-rec__head">
          ${cleanText(block?.priority) ? `<span class="report-pill report-pill--priority">${escapeHtml(cleanText(block.priority))}</span>` : ""}
          <span>${escapeHtml(cleanText(block?.text || "Recommendation"))}</span>
        </div>
        ${cleanText(block?.rationale) ? `<div class="report-rec__why">Why: ${escapeHtml(cleanText(block.rationale))}</div>` : ""}
      </div>
    `;
  }

  if (type === "action_owner") {
    return `
      <div class="report-block report-block--action-owner">
        <div><strong>${escapeHtml(cleanText(block?.action || "Action"))}</strong></div>
        <div class="report-action-owner__meta">
          ${cleanText(block?.owner) ? `<span>Owner: ${escapeHtml(cleanText(block.owner))}</span>` : ""}
          ${cleanText(block?.due) ? `<span>Due: ${escapeHtml(cleanText(block.due))}</span>` : ""}
          ${cleanText(block?.status) ? `<span>Status: ${escapeHtml(cleanText(block.status))}</span>` : ""}
        </div>
      </div>
    `;
  }

  if (type === "confidence_methodology") {
    return `
      <div class="report-block report-block--confidence">
        <div class="report-confidence__head">
          <span class="report-pill">${escapeHtml(cleanText(block?.confidenceBand || "unknown"))}</span>
          ${cleanText(block?.score) ? `<span>Score: ${escapeHtml(cleanText(block.score))}</span>` : ""}
        </div>
        ${renderRowsList(block?.methodologyNotes, (row) => `<li>${escapeHtml(cleanText(row))}</li>`)}
        ${asArray(block?.caveats).length ? `<div class="report-confidence__caveats"><strong>Caveats</strong>${renderRowsList(block?.caveats, (row) => `<li>${escapeHtml(cleanText(row))}</li>`)}</div>` : ""}
      </div>
    `;
  }

  if (type === "appendix") {
    return `
      <div class="report-block report-block--appendix">
        ${cleanText(block?.title) ? `<h4>${escapeHtml(cleanText(block.title))}</h4>` : ""}
        ${renderRowsList(block?.rows, (row) => {
          const label = escapeHtml(cleanText(row?.label || ""));
          const value = escapeHtml(cleanText(row?.value || "—"));
          return `<li><strong>${label}</strong>: ${value}</li>`;
        })}
      </div>
    `;
  }

  return `<div class="report-block report-block--unknown">${escapeHtml(cleanText(block?.text || "Unsupported block."))}</div>`;
}

export function renderReportHtmlDocument(reportDocument = {}, { includeStyles = true } = {}) {
  const title = cleanText(reportDocument?.title || reportDocument?.reportLabel || "Report");
  const generatedAt = cleanText(reportDocument?.generatedAt || "");
  const reportType = cleanText(reportDocument?.reportType || "");
  const sections = asArray(reportDocument?.sections);

  const sectionHtml = sections
    .map((section) => {
      const sectionId = cleanText(section?.id || "section");
      const sectionTitle = cleanText(section?.title || sectionId || "Section");
      const blocks = asArray(section?.blocks);
      const blocksHtml = blocks.length
        ? blocks.map((block) => renderBlock(block)).join("\n")
        : `<div class="report-empty">No section content.</div>`;
      return `
        <section class="report-section" data-section-id="${escapeHtml(sectionId)}">
          <h2>${escapeHtml(sectionTitle)}</h2>
          <div class="report-section__blocks">${blocksHtml}</div>
        </section>
      `;
    })
    .join("\n");

  const styles = includeStyles
    ? `
      <style>
        :root {
          color-scheme: light;
          --report-ink: #101728;
          --report-muted: #4b5565;
          --report-soft: #eef3fb;
          --report-soft-2: #f7f9fd;
          --report-accent: #0e7490;
          --report-border: #ccd7e6;
          --report-border-strong: #b8c7dc;
          --report-risk: #a61b1b;
          --report-priority: #14532d;
          --report-section-gap: 14px;
        }
        body {
          margin: 20px auto 28px;
          max-width: 980px;
          color: var(--report-ink);
          font-family: "Source Serif 4", "Iowan Old Style", Georgia, serif;
          line-height: 1.46;
          background: #fff;
        }
        .report-header {
          margin-bottom: 20px;
          border: 1px solid var(--report-border);
          border-radius: 12px;
          background: linear-gradient(180deg, var(--report-soft-2), #ffffff);
          padding: 14px 16px;
        }
        .report-header h1 {
          margin: 0;
          font-size: 27px;
          line-height: 1.16;
          letter-spacing: 0.01em;
        }
        .report-header__meta {
          margin-top: 8px;
          color: var(--report-muted);
          font-size: 13px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .report-section {
          margin: 22px 0 0;
          padding-top: 12px;
          border-top: 1px solid var(--report-border);
        }
        .report-section h2 {
          margin: 0 0 11px;
          font-size: 20px;
          line-height: 1.2;
          letter-spacing: 0.01em;
        }
        .report-section__blocks {
          display: grid;
          gap: var(--report-section-gap);
        }
        .report-block {
          border: 1px solid var(--report-border);
          border-radius: 10px;
          padding: 12px 14px;
          background: #fff;
          break-inside: avoid-page;
          page-break-inside: avoid;
        }
        .report-block h3,
        .report-block h4 {
          margin: 0 0 7px;
          font-size: 16px;
        }
        .report-block p {
          margin: 0;
          color: var(--report-muted);
          line-height: 1.5;
        }
        .report-block--headline {
          border-color: var(--report-border-strong);
          background: linear-gradient(180deg, var(--report-soft-2), #ffffff);
        }
        .report-block--status,
        .report-block--benchmark,
        .report-block--confidence,
        .report-block--appendix {
          background: #fcfdff;
        }
        .report-block--recommendation {
          border-left: 4px solid color-mix(in srgb, var(--report-priority) 52%, var(--report-border));
          padding-left: 12px;
        }
        .report-block--risk {
          border-left: 4px solid color-mix(in srgb, var(--report-risk) 52%, var(--report-border));
          padding-left: 12px;
        }
        .report-metric-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 10px;
        }
        .report-metric-grid__cell {
          background: var(--report-soft);
          border-radius: 8px;
          border: 1px solid color-mix(in srgb, var(--report-border) 74%, transparent);
          padding: 9px;
        }
        .report-metric-grid__label {
          font-size: 12px;
          color: var(--report-muted);
        }
        .report-metric-grid__value {
          font-size: 19px;
          font-weight: 650;
        }
        .report-metric-grid__note {
          margin-top: 3px;
          color: var(--report-muted);
          font-size: 12px;
          line-height: 1.4;
        }
        .report-list {
          margin: 9px 0 0 18px;
          padding: 0;
        }
        .report-list li {
          margin: 4px 0;
          line-height: 1.45;
        }
        .report-pill {
          display: inline-block;
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--report-border) 72%, transparent);
          background: var(--report-soft);
          padding: 2px 8px;
          font-size: 12px;
        }
        .report-pill--risk { background: #fee2e2; color: var(--report-risk); }
        .report-pill--priority { background: #dcfce7; color: var(--report-priority); }
        .report-empty { color: var(--report-muted); font-style: italic; }
        .report-status__label,
        .report-benchmark__label {
          color: var(--report-muted);
          font-size: 13px;
        }
        .report-status__value,
        .report-benchmark__value {
          font-size: 16px;
          font-weight: 650;
          margin-top: 2px;
        }
        .report-status__note,
        .report-benchmark__note,
        .report-rec__why,
        .report-risk__mitigation {
          margin-top: 5px;
          color: var(--report-muted);
          font-size: 13px;
          line-height: 1.45;
        }
        .report-action-owner__meta {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          color: var(--report-muted);
          margin-top: 5px;
          font-size: 13px;
        }
        .report-benchmark__head {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }
        .report-footer {
          margin-top: 24px;
          padding-top: 10px;
          border-top: 1px solid var(--report-border);
          color: var(--report-muted);
          font-size: 12px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        @media print {
          body {
            margin: 10mm 11mm;
            max-width: none;
          }
          .report-header {
            background: #fff;
            border-color: #bfcadd;
          }
          .report-section { break-inside: avoid-page; page-break-inside: avoid; }
          .report-block {
            break-inside: avoid-page;
            page-break-inside: avoid;
          }
        }
      </style>
    `
    : "";

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    ${styles}
  </head>
  <body>
    <header class="report-header">
      <h1>${escapeHtml(title)}</h1>
      <div class="report-header__meta">
        <span>Type: ${escapeHtml(reportType || "—")}</span>
        <span>Generated: ${escapeHtml(generatedAt || "—")}</span>
      </div>
    </header>
    ${sectionHtml}
    <footer class="report-footer">
      <span>Vector Intelligence Campaign Engine</span>
      <span>Type: ${escapeHtml(reportType || "—")}</span>
      <span>Generated: ${escapeHtml(generatedAt || "—")}</span>
    </footer>
  </body>
</html>
  `.trim();
}
