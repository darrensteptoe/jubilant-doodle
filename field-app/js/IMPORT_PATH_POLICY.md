# Import Path Policy

## Canonical Rule
- New internal engine/math imports should use `js/core/*` paths.
- Root `js/*.js` shim modules are compatibility facades for legacy import paths.

## Why
- Prevents ambiguous duplicate paths to the same module.
- Keeps ownership clear: `core` is source-of-truth, root shims are transitional.

## Allowed
- Existing legacy imports may continue to use root shims until migrated.
- New code should prefer `./core/...` unless importing an intentional facade.

## Near-term Migration Target
- Gradually move internal imports in non-core files from root shims to `./core/...`.
- Keep shims in place for backward compatibility until migration is complete.
