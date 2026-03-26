// @ts-check

import test from "node:test";
import assert from "node:assert/strict";

import {
  __resetLatestAcs5YearCacheForTests,
  listAcsYears,
  resolveLatestAcs5Year,
} from "./censusModule.js";

function makeResponse({ ok = true, status = 200, statusText = "", json = {}, text = "" } = {}) {
  return {
    ok,
    status,
    statusText,
    async json() {
      return json;
    },
    async text() {
      return text || JSON.stringify(json);
    },
  };
}

test.beforeEach(() => {
  __resetLatestAcs5YearCacheForTests();
});

test("ACS latest-only: listAcsYears exposes only one active vintage", () => {
  const years = listAcsYears(2026);
  assert.equal(years.length, 1);
  assert.equal(years[0], "2024");
});

test("ACS latest-only: resolver falls back safely when metadata lookup fails", async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    return makeResponse({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: "missing",
    });
  };
  const result = await resolveLatestAcs5Year({
    nowYear: 2026,
    fetchImpl,
  });
  assert.ok(attempts > 0);
  assert.equal(result.year, "2024");
  assert.match(String(result.source || ""), /^fallback/);
  assert.deepEqual(listAcsYears(2026), ["2024"]);
});

test("ACS latest-only: resolver chooses newest metadata-supported vintage", async () => {
  const fetchedYears = [];
  const fetchImpl = async (url) => {
    const match = String(url).match(/\/data\/(\d{4})\/acs\/acs5\/variables\.json/);
    const year = match ? match[1] : "";
    fetchedYears.push(year);
    if (year === "2024") {
      return makeResponse({
        ok: true,
        status: 200,
        json: {
          variables: {
            B01003_001E: { label: "Total population" },
          },
        },
      });
    }
    return makeResponse({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: "missing",
    });
  };
  const result = await resolveLatestAcs5Year({
    nowYear: 2027,
    fetchImpl,
  });
  assert.equal(result.year, "2024");
  assert.equal(result.source, "metadata");
  assert.ok(fetchedYears.includes("2025"), "resolver should probe newest candidate first");
  assert.ok(fetchedYears.includes("2024"), "resolver should fall back to prior candidate when needed");
  assert.deepEqual(listAcsYears(2027), ["2024"]);
});

test("ACS latest-only: resolver caches successful result", async () => {
  let fetchCount = 0;
  const fetchImpl = async () => {
    fetchCount += 1;
    return makeResponse({
      ok: true,
      status: 200,
      json: {
        variables: {
          B01003_001E: { label: "Total population" },
        },
      },
    });
  };
  const first = await resolveLatestAcs5Year({ nowYear: 2026, fetchImpl });
  const second = await resolveLatestAcs5Year({ nowYear: 2026, fetchImpl });
  assert.equal(first.year, "2024");
  assert.equal(second.year, "2024");
  assert.equal(second.source, "cache");
  assert.equal(fetchCount, 1);
});
