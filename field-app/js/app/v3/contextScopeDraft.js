import {
  DEFAULT_CAMPAIGN_ID,
  normalizeCampaignId,
  normalizeOfficeId,
} from "../activeContext.js";

function cleanText(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeScopeSlugNoFallback(value) {
  return cleanText(value).toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Validate editable context-scope fields before submitting a scope-switch patch.
 * Campaign ID and Office ID are scope keys; invalid raw values should not
 * silently collapse to fallback scope ids.
 *
 * @param {{ campaignId?: unknown, officeId?: unknown }=} input
 */
export function validateContextScopeDraft(input = {}) {
  const campaignIdInput = cleanText(input?.campaignId);
  const officeIdInput = cleanText(input?.officeId);
  const normalizedCampaignWithoutFallback = normalizeScopeSlugNoFallback(campaignIdInput);
  const normalizedOfficeWithoutFallback = normalizeScopeSlugNoFallback(officeIdInput);
  const issues = [];

  if (campaignIdInput && !normalizedCampaignWithoutFallback) {
    issues.push({
      field: "campaignId",
      code: "invalid_campaign_id",
      message: "Campaign ID is invalid. Use letters, numbers, dots, underscores, or dashes.",
    });
  }
  if (officeIdInput && !normalizedOfficeWithoutFallback) {
    issues.push({
      field: "officeId",
      code: "invalid_office_id",
      message: "Office ID is invalid. Use letters, numbers, dots, underscores, or dashes.",
    });
  }

  return {
    ok: issues.length === 0,
    issues,
    campaignIdInput,
    officeIdInput,
    normalizedCampaignId: campaignIdInput
      ? normalizeCampaignId(campaignIdInput, DEFAULT_CAMPAIGN_ID)
      : DEFAULT_CAMPAIGN_ID,
    normalizedOfficeId: officeIdInput ? normalizedOfficeWithoutFallback : "",
  };
}

/**
 * @param {unknown} result
 * @returns {{ statusText: string }}
 */
export function resolveContextPatchFailureStatus(result) {
  const src = result && typeof result === "object" ? result : {};
  const code = cleanText(src?.code).toLowerCase();
  if (code === "campaign_locked") {
    return { statusText: "Campaign scope is locked by URL. Open an unlocked link to change Campaign ID." };
  }
  if (code === "office_locked") {
    return { statusText: "Office scope is locked by URL. Open an unlocked link to change Office ID." };
  }
  if (code === "scenario_locked") {
    return { statusText: "Scenario scope is locked by URL. Open an unlocked link to change scenario scope." };
  }
  if (code === "invalid_campaign_id") {
    return { statusText: "Campaign ID is invalid. Use letters, numbers, dots, underscores, or dashes." };
  }
  if (code === "invalid_office_id") {
    return { statusText: "Office ID is invalid. Use letters, numbers, dots, underscores, or dashes." };
  }
  return {
    statusText: "Context update did not apply. Review Campaign ID and Office ID, then retry.",
  };
}
