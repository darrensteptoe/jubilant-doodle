# Deploy Packaging Contract

This project keeps working-repo artifacts separate from runtime deployment artifacts.

## Runtime package command

Run:

```bash
npm run package:runtime
```

Preflight:

```bash
npm run build
npm run check:built-artifact
```

Output:

- `release/field-app-40-runtime-<timestamp>/dist`
- `release/field-app-40-runtime-<timestamp>/DEPLOY_MANIFEST.json`
- `release/field-app-40-runtime-<timestamp>/README_DEPLOY.txt`

## Packaging policy

Runtime deploy package includes built runtime assets only (`dist/**`).

Workspace artifacts are excluded by policy (`.deployignore`), including:

- `.git`
- `__MACOSX`
- `.DS_Store`
- `node_modules`
- `checkpoints`
- `recovery-snapshots`
- `audit`
- `interaction`
- `prune`

## Operational note

This is non-destructive. It does not delete any source files or checkpoints from the working repository.

## Release verification

This runtime package was built from the current source and verified against key visible UI markers. If the live app does not show recently added surfaces or wording, the most likely cause is that an older built artifact is still being served.

Release verification checklist:

- Rebuild the app before packaging.
- Deploy the newest `dist` output, not an older extracted folder.
- Hard refresh the browser after deploy.
- If a feature exists in source but not on screen, verify the built asset and hosting path before assuming the code is missing.

## Future delivery note

Future change deliveries must explicitly report:

- whether `dist` was regenerated,
- which built asset changed,
- whether required visible UI markers were found in the built bundle.
