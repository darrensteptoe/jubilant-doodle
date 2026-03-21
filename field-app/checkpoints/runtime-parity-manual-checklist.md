# Runtime Parity Checklist (District)

Date: 2026-03-21

## Browser-side verification

1. Open browser DevTools and run:

```js
window.__FPE_RUNTIME_DIAGNOSTICS__.print()
```

2. Confirm the following in the printed payload:
- `assetHash` matches the latest local build hash from `dist/index.html` / `dist/assets/*`.
- `activeStage` is `district` when District is selected.
- `activeSurfaceId` is `districtV2`.
- `districtV2Mounted` is `true`.
- `storage.backends.localStorage` is `true`.
- `persisted.schemaVersion` (or `persistedSchemaVersion`) is present and expected.

3. Confirm console mount marker appears:
- Look for `[district_v2] mounted`.

4. Hard-reload with cache disabled:
- DevTools Network tab -> check `Disable cache`.
- Reload while DevTools stays open.
- Re-run `window.__FPE_RUNTIME_DIAGNOSTICS__.print()` and compare `activeBundleId` / `assetHash`.

5. Clear client state before retest:
- Application tab -> clear Local Storage and Session Storage for the app origin.
- If IndexedDB is present for the origin, clear it.
- Reload and re-run diagnostics.

6. Validate District runtime parity panel:
- In District V2, open `Runtime parity debug`.
- Confirm for `raceTemplate` and `universeSize`:
  - `dom` value matches the typed/selected control value.
  - `canonical` value matches the selector-driven value.
  - `persisted` value matches expected saved value after blur/commit + refresh.

## Deploy-path checklist

1. Build local artifacts:

```bash
npm run build
npm run debug:runtime-parity
```

2. Confirm output report fields:
- `selectedBundle.ref` exists under `dist/assets/`.
- `selectedBundle.containsDistrictV2MountMarker` is `true`.
- `selectedBundle.containsRuntimeParityBridge` is `true`.
- `htmlChecks.referencesOnlyOneIndexBundle` is `true`.
- `htmlChecks.containsLegacyQueryBundleRefs` is `false`.

3. Deploy verification (host-specific):
- Confirm the uploaded artifact source is exactly current `dist/`.
- Confirm served HTML references the same `activeBundleId` hash as local build.
- Confirm no alternate stale HTML page references an older JS bundle.

