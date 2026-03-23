# Deploy Packaging Contract

This project keeps working-repo artifacts separate from runtime deployment artifacts.

## Runtime package command

Run:

```bash
npm run package:runtime
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
