// @ts-check

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function readFromRepo(relPath){
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

test("operations training page: module nav and panel are registered", () => {
  const html = readFromRepo("operations.html");
  const js = readFromRepo("js/operations.js");
  assert.match(html, /data-module="operations_training"[^>]*>Operations Training</, "operations nav should include Operations Training page");
  assert.match(html, /data-module-panel="operations_training"/, "operations training panel should be present");
  assert.match(js, /"operations_training"/, "operations module list should register operations_training");
});

test("operations training page: authored sections and video shell are present", () => {
  const html = readFromRepo("operations.html");
  assert.match(html, /<h3>Operations Training<\/h3>/, "header intro section should be present");
  assert.match(html, /<h3>Video Walkthrough<\/h3>/, "video walkthrough section should be present");
  assert.match(html, /id="opsTrainingVideoHost"/, "video host should be present");
  assert.match(html, /id="opsTrainingVideoStatus"/, "video status text should be present");
  assert.match(html, /<h3>Quick Start Guide<\/h3>/, "quick start section should be present");
  assert.match(html, /<h3>How the Operations Hub Works<\/h3>/, "how-it-works section should be present");
  assert.match(html, /<h3>Page-by-Page Walkthrough<\/h3>/, "page walkthrough should be present");
  assert.match(html, /<h3>Metrics Glossary<\/h3>/, "metrics glossary should be present");
  assert.match(html, /<h3>Role-Based Guidance<\/h3>/, "role guidance should be present");
  assert.match(html, /<h3>Data Quality Standards<\/h3>/, "data quality section should be present");
  assert.match(html, /<h3>Common Mistakes to Avoid<\/h3>/, "mistakes section should be present");
  assert.match(html, /<h3>Frequently Asked Questions<\/h3>/, "faq section should be present");
});

test("operations training page: configured YouTube embed logic and graceful fallback are wired", () => {
  const js = readFromRepo("js/operations.js");
  assert.match(js, /function readOperationsTrainingVideoUrl\(/, "video config reader should exist");
  assert.match(js, /OPERATIONS_TRAINING_YOUTUBE_URL/, "config seam should support OPERATIONS_TRAINING_YOUTUBE_URL");
  assert.match(js, /function resolveOperationsTrainingVideoEmbedUrl\(/, "YouTube embed resolver should exist");
  assert.match(js, /function renderOperationsTrainingVideo\(/, "video renderer should exist");
  assert.match(js, /Training video coming soon/, "fallback copy should be present");
  assert.match(js, /wireOperationsTrainingAnchors\(/, "section jump wiring should be present");
});

test("operations training page: responsive training styles are defined", () => {
  const css = readFromRepo("styles.css");
  assert.match(css, /\.operations-training-anchor-nav/, "anchor nav styling should be present");
  assert.match(css, /\.operations-training-section/, "section container styling should be present");
  assert.match(css, /\.operations-training-video-embed[\s\S]*padding-top:\s*56\.25%/m, "video embed should keep responsive 16:9 ratio");
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*\.operations-training-anchor[\s\S]*flex:\s*1 1 190px;/m, "iPad layout support should be present");
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.operations-training-anchor[\s\S]*flex:\s*1 1 100%/m, "mobile layout support should be present");
});
