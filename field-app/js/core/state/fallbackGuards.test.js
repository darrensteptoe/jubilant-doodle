// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import { FIELD_OWNERSHIP_REGISTRY } from "./schema.js";
import {
  createFallbackGuardContext,
  guardDeprecatedCompatibilityWrapperUsage,
  guardMissingCanonicalReader,
  guardMissingDerivedReader,
  guardMissingModuleContract,
  guardRequiredSelectorInputs,
  guardUnknownFieldOwnership,
} from "./fallbackGuards.js";

test("fallback guards: test mode throws for missing canonical/derived readers", () => {
  const ctx = createFallbackGuardContext({
    moduleName: "districtBridge",
    runtimeEnv: "test",
  });
  assert.throws(
    () => guardMissingCanonicalReader(ctx, { bridgeName: "__FPE_DISTRICT_API__", api: { getView() {} } }),
    /Missing canonical reader/,
  );
  assert.throws(
    () => guardMissingDerivedReader(ctx, { bridgeName: "__FPE_DISTRICT_API__", api: { getCanonicalView() {} } }),
    /Missing derived reader/,
  );
});

test("fallback guards: missing module contract throws loudly in test mode", () => {
  const ctx = createFallbackGuardContext({
    moduleName: "outcomeBridge",
    runtimeEnv: "test",
  });
  assert.throws(
    () => guardMissingModuleContract(ctx, {
      contractName: "__FPE_OUTCOME_API__",
      moduleRef: { getView() {} },
      requiredMethods: ["getCanonicalView", "getDerivedView", "setField"],
    }),
    /missing required methods/,
  );
});

test("fallback guards: selector input and unknown ownership fail loudly in test mode", () => {
  const ctx = createFallbackGuardContext({
    moduleName: "targetingDerived",
    runtimeEnv: "test",
  });
  assert.throws(
    () => guardRequiredSelectorInputs(ctx, {
      selectorName: "selectTargetingDerivedView",
      input: { domains: { targeting: {} } },
      requiredPaths: ["domains.targeting.config", "domains.district.form", "domains.census.config"],
    }),
    /missing required paths/,
  );
  assert.throws(
    () => guardUnknownFieldOwnership(ctx, {
      field: "district.unknownField",
      ownershipRegistry: FIELD_OWNERSHIP_REGISTRY,
    }),
    /Unknown field ownership/,
  );
});

test("fallback guards: deprecated wrapper usage warns (non-throw) in production mode", () => {
  const issues = [];
  const warnings = [];
  const ctx = createFallbackGuardContext({
    moduleName: "outcomeBridge",
    runtimeEnv: "production",
    onIssue: (issue) => issues.push(issue),
    logger: {
      warn: (text) => warnings.push(text),
      error: () => {},
    },
  });
  const row = guardDeprecatedCompatibilityWrapperUsage(ctx, {
    wrapperName: "readOutcomeBridgeView",
    replacement: "readOutcomeCanonicalBridgeView/readOutcomeDerivedBridgeView",
  });
  assert.ok(row);
  assert.equal(row.level, "warn");
  assert.equal(issues.length, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Deprecated compatibility wrapper/);
});

test("fallback guards: production mode logs errors without throwing", () => {
  const errors = [];
  const ctx = createFallbackGuardContext({
    moduleName: "eventCalendarBridge",
    runtimeEnv: "production",
    logger: {
      warn: () => {},
      error: (text) => errors.push(text),
    },
  });
  const row = guardMissingModuleContract(ctx, {
    contractName: "__FPE_DECISION_API__",
    moduleRef: null,
    requiredMethods: ["getView", "setEventFilter"],
  });
  assert.ok(row);
  assert.equal(row.level, "error");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Module contract object is missing/);
});

