# Campaign Context Row Hardening (Data / V3 Shell)

Date: 2026-03-25

## Intended semantics

- `Campaign ID`: active scope key (storage/state isolation key) and persisted metadata field.
- `Office ID`: active scope key (sub-scope isolation key) and persisted metadata field.
- `Campaign Name`: label metadata for the active campaign scope; not an isolation key.

Current architecture keeps **immediate apply** on blur/change/Enter for Campaign ID + Office ID.
No separate Apply button was introduced in this pass to avoid broad workflow changes.

## Root cause of snap-back

Scope change rehydration in `shellBridgeRuntime.setContext(...)` called `normalizeLoadedScenarioRuntime(...)` without a target context override.
`normalizeLoadedScenarioRuntime(...)` then resolved active context from URL/default context, which could collapse campaign/office back to `default`/blank during normalization.

This created mixed behavior:

- `campaignName` could still stick (explicitly written post-normalization)
- `campaignId` / `officeId` could revert after blur or refresh

## Hardening changes

1. `shellBridgeRuntime` now normalizes rehydrated state with explicit target context and re-pins campaign/office scope fields after normalization.
2. `appRuntime.normalizeLoadedScenarioRuntime(...)` now accepts optional `{ context }` input so scope-aware normalization can be requested by callers.
3. V3 context-row input path now validates Campaign ID / Office ID before patch submit and surfaces explicit status for invalid values (no silent fallback).
4. Context patch failure statuses are mapped to user-readable messages (locked URL scope, invalid IDs, generic failure).

## Compatibility and constraints

- URL-locked scope behavior remains intentional: locked campaign/office still reject edits.
- Scoped storage behavior remains campaign+office scoped.
- Immediate apply is preserved; this pass clarifies behavior and removes silent fallback/reversion.

## Incognito relevance

Incognito may affect persistence longevity between sessions.
It is **not** the root cause of immediate blur-time snap-back; the rehydration context override bug was the primary cause.
