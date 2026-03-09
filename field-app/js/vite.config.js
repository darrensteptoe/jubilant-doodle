const { defineConfig } = require("vite");
const path = require("node:path");

module.exports = defineConfig({
  build: {
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
