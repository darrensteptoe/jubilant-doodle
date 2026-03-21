# Render/Control Contract (Cleanse Constitution)

Date: 2026-03-21
Scope: Rebuilt editable subsystems

## Standard Editable Control Lifecycle

1. Controls mount once at subsystem mount.
2. Controls bind once (`dataset` guard or equivalent).
3. Edit events dispatch domain actions only.
4. Canonical selectors remain the only control truth source.
5. Refresh sync updates existing control nodes in place.
6. Ordinary edits never replace control nodes.
7. Ordinary edits never rebuild card roots/module bodies.
8. Structural rerender is allowed only for:
   - row add/remove
   - module mount/unmount
   - route/stage navigation

## Allowed Rerender Cases

- Structural row membership change (`ids` signature change).
- Route/stage mount change.
- Module init/teardown.

## Forbidden Patterns (for rebuilt subsystems)

- `innerHTML` replacement for live editable sections in ordinary edit flows.
- Root/card/module replacement in ordinary blur/change/input flows.
- Module-local shadow truth owning editable values.
- Module/page-specific pending-write hold semantics for rebuilt modules.
- Hidden compatibility UI paths that own editable truth.

## Standard Binder API Shape

- `bind<Form|Module><ControlType>(id, field)`
- Must include bind-once guard.
- Must dispatch to domain action (`set*`, `update*`, `add*`, `remove*`).

## Standard Sync API Shape

- `syncSelectControlInPlace(control, options, selectedValue, opts)`
- `syncMultiSelectControlInPlace(control, options, selectedOptions)`
- `syncInputControlInPlace(control, rawValue)`
- `syncCheckboxControlInPlace(control, rawValue)`

Rules:
- never replace control element instance during ordinary sync
- preserve active element edits (`document.activeElement` guard)
- apply disabled/enabled state in place

## DOM Identity Test Requirements

For each cleansed subsystem:
1. select node identity survives blur
2. date node identity survives blur
3. number node identity survives blur
4. node identity survives ordinary canonical sync
5. structural actions may replace only affected row nodes
6. ordinary edit must not replace card/module roots

## Persistence/Parity Requirements

1. value persists on blur
2. value persists on navigation
3. value persists on refresh/reopen
4. visible DOM value matches canonical selector value after blur
5. derived updates do not clobber editable control value

## Containment and Freeze Rules

- Work one subsystem at a time.
- Shared helper edits must list impacted subsystems.
- After a subsystem passes tests + parity checklist, freeze it before moving on.

