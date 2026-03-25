# Defaults

## Templates and office context

### What this is
Templates are operating presets. They do not tell the model what to believe. They give the system a realistic starting posture based on office type, contest context, and campaign environment.

### How to think about it
The template is not the answer. It is the opening frame. Good operators start from the closest honest context, then tighten or widen assumptions based on local evidence. The danger is not using a template. The danger is using the wrong one and forgetting what it quietly implies.

### Why this matters
A state house race, a governor's race, and a U.S. Senate race can all be competitive without behaving the same way. Geography, vote mode, message environment, field repeatability, and coalition breadth all change with office type.

### When to override
Override when local data, polling, historical turnout behavior, or operational evidence clearly support a better assumption than the template default. Do not override simply to make the plan look easier.

## Planning default bands

These are planning defaults, not truths and not hard caps.

| Template | Band width (low/default/high) | Persuasion % (low/default/high) | Early vote % (low/default/high) |
| --- | --- | --- | --- |
| City / Municipal Executive | 2 / 4 / 6 | 8 / 12 / 18 | 15 / 25 / 40 |
| City / Municipal Legislative | 2 / 4 / 6 | 7 / 10 / 15 | 15 / 25 / 40 |
| Countywide | 3 / 5 / 8 | 8 / 12 / 18 | 20 / 35 / 50 |
| State House | 3 / 5 / 8 | 7 / 11 / 17 | 20 / 35 / 55 |
| State Senate | 3 / 6 / 9 | 8 / 12 / 18 | 20 / 40 / 60 |
| U.S. House / Congressional | 4 / 6 / 10 | 9 / 13 / 20 | 25 / 45 / 65 |
| Governor / Statewide Executive | 5 / 8 / 12 | 10 / 15 / 22 | 25 / 45 / 70 |
| U.S. Senate / Statewide Federal | 5 / 8 / 12 | 10 / 15 / 22 | 25 / 50 / 75 |
| Judicial / Other | 4 / 7 / 11 | 5 / 9 / 15 | 20 / 35 / 60 |
| Custom | Preserve current user-entered values | Preserve current user-entered values | Preserve current user-entered values |

## Interpretation rules

- `bandWidth` is uncertainty spread around turnout baseline, not vote share.
- `persuasionPct` is plausible persuadable share of the reachable universe, not a promise.
- `earlyVoteExp` is expected vote share arriving before Election Day, subject to state law and race conditions.

Defaults are scaffolding, not conclusions.
