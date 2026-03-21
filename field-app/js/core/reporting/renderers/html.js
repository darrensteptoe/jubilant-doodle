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
          --report-soft: #edf2f7;
          --report-accent: #0e7490;
          --report-border: #d1d9e6;
          --report-risk: #a61b1b;
          --report-priority: #14532d;
        }
        body {
          margin: 24px;
          color: var(--report-ink);
          font-family: "Source Serif 4", "Iowan Old Style", Georgia, serif;
          line-height: 1.35;
          background: #fff;
        }
        .report-header { margin-bottom: 18px; border-bottom: 2px solid var(--report-soft); padding-bottom: 12px; }
        .report-header h1 { margin: 0; font-size: 26px; line-height: 1.15; }
        .report-header__meta { margin-top: 8px; color: var(--report-muted); font-size: 13px; display: flex; gap: 12px; flex-wrap: wrap; }
        .report-section { margin: 20px 0 0; padding-top: 10px; border-top: 1px solid var(--report-border); }
        .report-section h2 { margin: 0 0 10px; font-size: 19px; }
        .report-section__blocks { display: grid; gap: 10px; }
        .report-block { border: 1px solid var(--report-border); border-radius: 8px; padding: 10px 12px; background: #fff; }
        .report-block h3, .report-block h4 { margin: 0 0 6px; }
        .report-block p { margin: 0; color: var(--report-muted); }
        .report-metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; }
        .report-metric-grid__cell { background: var(--report-soft); border-radius: 6px; padding: 8px; }
        .report-metric-grid__label { font-size: 12px; color: var(--report-muted); }
        .report-metric-grid__value { font-size: 18px; font-weight: 600; }
        .report-list { margin: 8px 0 0 18px; padding: 0; }
        .report-list li { margin: 3px 0; }
        .report-pill { display: inline-block; border-radius: 999px; background: var(--report-soft); padding: 2px 8px; font-size: 12px; }
        .report-pill--risk { background: #fee2e2; color: var(--report-risk); }
        .report-pill--priority { background: #dcfce7; color: var(--report-priority); }
        .report-empty { color: var(--report-muted); font-style: italic; }
        .report-action-owner__meta { display: flex; gap: 10px; flex-wrap: wrap; color: var(--report-muted); margin-top: 4px; }
        .report-benchmark__head { display: flex; justify-content: space-between; gap: 10px; }
        .report-benchmark__label { color: var(--report-muted); }
        .report-benchmark__value { font-weight: 600; }
        @media print {
          body { margin: 12mm; }
          .report-section { break-inside: avoid-page; page-break-inside: avoid; }
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
  </body>
</html>
  `.trim();
}
