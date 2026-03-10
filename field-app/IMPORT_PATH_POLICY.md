# Import Path Policy

## Canonical Rule
- New internal engine/math imports should use `js/core/*` paths.
- Root `js/*.js` compatibility shim modules for core math are removed.

## Why
- Prevents ambiguous duplicate paths to the same module.
- Keeps ownership clear: `core` is source-of-truth for engine/math modules.

## Allowed
- New code should prefer `./core/...` unless importing an intentional app facade.
- Entry-point facades are still allowed where runtime files were extracted for readability (e.g., `app.js`, `app/wireEvents.js`, `app/intelControls.js`).

## Enforcement
- Non-core modules must import math/engine helpers directly from `./core/...`.
- Do not re-introduce root shim aliases for core modules.
