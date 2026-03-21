import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  build: {
    // Explicit rebuild-gate budget for current bundle topology.
    // Keep strict warning behavior while avoiding known non-actionable noise
    // at the default 2000 kB threshold.
    chunkSizeWarningLimit: 2300,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "index.html"),
        organizer: path.resolve(__dirname, "organizer.html"),
        operations: path.resolve(__dirname, "operations.html"),
        operationsPipeline: path.resolve(__dirname, "operations-pipeline.html"),
        operationsShifts: path.resolve(__dirname, "operations-shifts.html"),
        operationsTurf: path.resolve(__dirname, "operations-turf.html"),
        operationsRamp: path.resolve(__dirname, "operations-ramp.html"),
        thirdWingPipeline: path.resolve(__dirname, "third-wing-pipeline.html"),
        thirdWingShifts: path.resolve(__dirname, "third-wing-shifts.html"),
        thirdWingTurf: path.resolve(__dirname, "third-wing-turf.html"),
        thirdWingRamp: path.resolve(__dirname, "third-wing-ramp.html"),
        camio: path.resolve(__dirname, "camio.html")
      }
    }
  }
});
