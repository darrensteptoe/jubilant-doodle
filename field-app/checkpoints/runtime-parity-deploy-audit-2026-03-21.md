# Runtime Parity Deploy Audit (2026-03-21)

## Local build artifact verification

- Built with `npm run build`.
- Served bundle referenced by `dist/index.html`: `/assets/index-CUmAMQ2r.js`.
- Bundle hash token: `CUmAMQ2r`.
- SHA-256: `0ad5e1121d57083b8998e9f4676c2cece0f33cc91316022d67fcef71dc888aeb`.
- Dist audit JSON: `checkpoints/runtime-parity-audit-2026-03-21.json`.

## Runtime marker verification (served preview)

- `curl http://127.0.0.1:4174/` returned `/assets/index-CUmAMQ2r.js`.
- Served JS and local dist JS SHA-256 match exactly.
- Served JS contains `[district_v2] mounted` marker string.
- Served JS contains `__FPE_RUNTIME_DIAGNOSTICS__` diagnostics bridge.
- Served JS does not contain `markDistrictPendingWrite`.

## Remote deploy-path status

- GitHub Pages/live remote artifact was not directly inspected in this run.
- This audit confirms local build and local preview parity only.

## Manual browser parity checklist

- Use: `checkpoints/runtime-parity-manual-checklist.md`.
