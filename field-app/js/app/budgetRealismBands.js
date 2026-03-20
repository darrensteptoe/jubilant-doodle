// @ts-check

export const BUDGET_REALISM_BANDS_VERSION = "15.0.0";

/**
 * Channel-cost plausibility bands for Phase 15.
 * floor/ceiling => warning, outside extremeLow/extremeHigh => severe realism violation.
 */
export const BUDGET_REALISM_CHANNEL_BANDS = Object.freeze({
  doors: Object.freeze({
    tacticKey: "doors",
    floor: 0.08,
    ceiling: 0.80,
    extremeLow: 0.04,
    extremeHigh: 1.25,
  }),
  calls: Object.freeze({
    tacticKey: "phones",
    floor: 0.01,
    ceiling: 0.20,
    extremeLow: 0.005,
    extremeHigh: 0.40,
  }),
  texts: Object.freeze({
    tacticKey: "texts",
    floor: 0.005,
    ceiling: 0.15,
    extremeLow: 0.003,
    extremeHigh: 0.30,
  }),
  mail: Object.freeze({
    tacticKey: "mail",
    floor: 0.30,
    ceiling: 2.50,
    extremeLow: 0.20,
    extremeHigh: 4.00,
  }),
  litDrop: Object.freeze({
    tacticKey: "litDrop",
    floor: 0.06,
    ceiling: 0.65,
    extremeLow: 0.03,
    extremeHigh: 1.10,
  }),
});
