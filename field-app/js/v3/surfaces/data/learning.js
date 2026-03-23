export function syncDataLearningModule(context = {}) {
  const {
    archiveView,
    setText,
    buildDataArchiveLearningView,
    buildDataArchiveLearningSignalsView,
    formatDataSampleCount,
    formatDataPercentFromPct,
    formatDataSignedDecimal,
    formatDataArchiveDecimal,
    DATA_LEARNING_LABEL_FALLBACK,
    DATA_LEARNING_RECOMMENDATION_FALLBACK,
  } = context;

  if (
    typeof setText !== "function"
    || typeof buildDataArchiveLearningView !== "function"
    || typeof buildDataArchiveLearningSignalsView !== "function"
    || typeof formatDataSampleCount !== "function"
    || typeof formatDataPercentFromPct !== "function"
    || typeof formatDataSignedDecimal !== "function"
    || typeof formatDataArchiveDecimal !== "function"
  ) {
    return;
  }

  const archive = archiveView && typeof archiveView === "object" ? archiveView : {};
  const audit = archive?.modelAudit && typeof archive.modelAudit === "object"
    ? archive.modelAudit
    : {};
  const learning = archive?.learning && typeof archive.learning === "object"
    ? archive.learning
    : {};

  const learningView = buildDataArchiveLearningView(learning);
  const learningSignals = buildDataArchiveLearningSignalsView(learning);

  setText("v3DataAuditSampleSize", formatDataSampleCount(audit.sampleSize));
  setText("v3DataAuditWithin1", formatDataPercentFromPct(audit.within1ptPct, 1));
  setText("v3DataAuditWithin2", formatDataPercentFromPct(audit.within2ptPct, 1));
  setText("v3DataAuditMeanError", formatDataSignedDecimal(audit.meanErrorMargin, 2));
  setText("v3DataAuditMae", formatDataArchiveDecimal(audit.meanAbsErrorMargin, 2));
  setText("v3DataAuditBias", String(audit.biasDirection || "none"));
  setText("v3DataAuditLearningLabel", learningView.label || DATA_LEARNING_LABEL_FALLBACK);
  setText(
    "v3DataAuditLearningRecommendation",
    learningView.recommendation || DATA_LEARNING_RECOMMENDATION_FALLBACK,
  );
  setText("v3DataAuditLearningVoterRows", learningSignals.voterRows);
  setText("v3DataAuditLearningGeoCoverage", learningSignals.voterGeoCoverage);
  setText("v3DataAuditLearningContactableRate", learningSignals.voterContactableRate);
}
