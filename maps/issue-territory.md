# Issue Territory

This file tracks the current known territory for the War Room foundation and SDK app split. GitHub issues remain the source of truth for execution state.

## Known Territory

| Issue | Repo | Status | Purpose |
| --- | --- | --- | --- |
| TeamFloPay/infra#4 | infra | parent epic | War Room foundation and cross-repo command center. |
| TeamFloPay/infra#11 | infra | done | Phase-1 War Room skeleton and repo map. |
| TeamFloPay/sdk#55 | sdk | done | Move docs and demo to their own repos. |
| TeamFloPay/sdk#60 | sdk | done | Extract app repos and make them standalone. |
| TeamFloPay/sdk#59 | sdk | done | Clean SDK repo after app extraction. |
| TeamFloPay/infra#10 | infra | done | Implement SDK-to-demo local dev link after standalone demo exists. |

## Critical Path

1. Complete the remaining TeamFloPay/infra#4 War Room MVP command surface.
2. Keep post-MVP investigations separate: Major Gowen MCP service, intelligence scheduling, issue creation/fortification, autonomous Sergeant subagents, and post-victory metrics.

## Boundary

War Room can coordinate local workflows, but product repos must remain standalone. App repos should commit normal dependency ranges and deployment configs. Local SDK linking is a local-only War Room workflow after the app split.
