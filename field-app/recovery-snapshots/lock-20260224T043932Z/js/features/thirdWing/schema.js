// js/features/thirdWing/schema.js
// Third Wing schema constants (static-host safe, local-first).

export const THIRD_WING_SCHEMA_VERSION = "1.1.0";

export const THIRD_WING_DB_NAME = "fieldPathThirdWing";
export const THIRD_WING_DB_VERSION = 2;

export const THIRD_WING_STORES = [
  "persons",
  "pipelineRecords",
  "interviews",
  "onboardingRecords",
  "trainingRecords",
  "shiftRecords",
  "turfEvents",
  "forecastConfigs",
  "meta",
];

export const PIPELINE_STAGES = [
  "Sourced",
  "Contacted",
  "Phone Screen",
  "Interviewed",
  "Offer Extended",
  "Offer Accepted",
  "Docs Submitted",
  "Background Passed",
  "Training Complete",
  "Active",
];

export const THIRD_WING_STORE_DEFS = {
  persons: {
    keyPath: "id",
    indexes: [
      { name: "office", keyPath: "office", options: { unique: false } },
      { name: "region", keyPath: "region", options: { unique: false } },
      { name: "active", keyPath: "active", options: { unique: false } },
      { name: "updatedAt", keyPath: "updatedAt", options: { unique: false } },
    ],
  },
  pipelineRecords: {
    keyPath: "id",
    indexes: [
      { name: "personId", keyPath: "personId", options: { unique: false } },
      { name: "stage", keyPath: "stage", options: { unique: false } },
      { name: "recruiter", keyPath: "recruiter", options: { unique: false } },
      { name: "office", keyPath: "office", options: { unique: false } },
      { name: "updatedAt", keyPath: "updatedAt", options: { unique: false } },
    ],
  },
  interviews: {
    keyPath: "id",
    indexes: [
      { name: "personId", keyPath: "personId", options: { unique: false } },
      { name: "scheduledAt", keyPath: "scheduledAt", options: { unique: false } },
      { name: "outcome", keyPath: "outcome", options: { unique: false } },
      { name: "interviewer", keyPath: "interviewer", options: { unique: false } },
      { name: "updatedAt", keyPath: "updatedAt", options: { unique: false } },
    ],
  },
  onboardingRecords: {
    keyPath: "id",
    indexes: [
      { name: "personId", keyPath: "personId", options: { unique: false } },
      { name: "backgroundStatus", keyPath: "backgroundStatus", options: { unique: false } },
      { name: "onboardingStatus", keyPath: "onboardingStatus", options: { unique: false } },
      { name: "updatedAt", keyPath: "updatedAt", options: { unique: false } },
    ],
  },
  trainingRecords: {
    keyPath: "id",
    indexes: [
      { name: "personId", keyPath: "personId", options: { unique: false } },
      { name: "trainingTrack", keyPath: "trainingTrack", options: { unique: false } },
      { name: "completionStatus", keyPath: "completionStatus", options: { unique: false } },
      { name: "updatedAt", keyPath: "updatedAt", options: { unique: false } },
    ],
  },
  shiftRecords: {
    keyPath: "id",
    indexes: [
      { name: "personId", keyPath: "personId", options: { unique: false } },
      { name: "date", keyPath: "date", options: { unique: false } },
      { name: "mode", keyPath: "mode", options: { unique: false } },
      { name: "office", keyPath: "office", options: { unique: false } },
      { name: "updatedAt", keyPath: "updatedAt", options: { unique: false } },
    ],
  },
  turfEvents: {
    keyPath: "id",
    indexes: [
      { name: "turfId", keyPath: "turfId", options: { unique: false } },
      { name: "precinct", keyPath: "precinct", options: { unique: false } },
      { name: "county", keyPath: "county", options: { unique: false } },
      { name: "date", keyPath: "date", options: { unique: false } },
      { name: "updatedAt", keyPath: "updatedAt", options: { unique: false } },
    ],
  },
  forecastConfigs: {
    keyPath: "id",
    indexes: [
      { name: "updatedAt", keyPath: "updatedAt", options: { unique: false } },
    ],
  },
  meta: {
    keyPath: "key",
    indexes: [],
  },
};

export const DEFAULT_FORECAST_CONFIG = {
  id: "default",
  stageConversionDefaults: {
    sourced_to_contacted: 0.7,
    contacted_to_phone_screen: 0.6,
    phone_screen_to_interviewed: 0.7,
    interviewed_to_offer_extended: 0.6,
    offer_extended_to_offer_accepted: 0.75,
    offer_accepted_to_docs_submitted: 0.9,
    docs_submitted_to_background_passed: 0.85,
    background_passed_to_training_complete: 0.9,
    training_complete_to_active: 0.95,
  },
  stageDurationDefaultsDays: {
    sourced_to_contacted: 2,
    contacted_to_phone_screen: 3,
    phone_screen_to_interviewed: 4,
    interviewed_to_offer_extended: 3,
    offer_extended_to_offer_accepted: 3,
    offer_accepted_to_docs_submitted: 2,
    docs_submitted_to_background_passed: 7,
    background_passed_to_training_complete: 4,
    training_complete_to_active: 1,
  },
  productivityDefaults: {
    doorsPerHour: 17,
    callsPerHour: 20,
    textsPerHour: 120,
  },
};
