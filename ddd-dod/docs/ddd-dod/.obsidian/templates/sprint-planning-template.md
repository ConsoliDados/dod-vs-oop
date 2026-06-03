<%*
const sprint = await tp.system.prompt("Sprint folder (e.g. sprint-01)");
const epic = await tp.system.prompt("Active epic slug (e.g. 002-authentication)", "");
await tp.file.rename(`planning`);
await tp.file.move(`/sprints/${sprint}/planning`);
const date = tp.date.now("YYYY-MM-DD");
-%>
---
sprint: <% sprint %>
window:
active_epic: <% epic %>
capacity_days:
status: planning
---

# <% sprint %> — Planning

<!--
This document captures the *reasoning* at sprint start: who's available, why these
cards were picked, what risks were anticipated. It freezes once the sprint begins.
The sprint README is the live document; planning.md is history.

Skip this file in prototype/small tiers — fold the same content into a "Planning"
section inside the sprint README instead.
-->

## Capacity

<!-- Days available per person. Note OOO, holidays, on-call. -->

- <Person A>: N days
- <Person B>: N days

## Picks (justified)

<!--
For each card pulled from the roadmap, one bullet of reasoning. Make the
"why this card now" explicit.
-->

1. **[[../../roadmap/<id>-<slug>|<id> — <slug>]]** (<size>)
   - Why now: <unblocks X / time-sensitive / fits capacity gap>
   - Dependencies: <ADR / SDD / other card>

## Stretch (if capacity allows)

- **[[../../roadmap/<id>-<slug>|<id> — <slug>]]** — <why it's stretch, not core>

## Risks anticipated

<!-- Things that could derail the sprint. Mitigation if known. -->

- <risk> → <mitigation>

## Not picked, why

<!-- Cards considered but deferred. Captures the alternatives for future review. -->

- **[[../../roadmap/<id>-<slug>|<id> — <slug>]]** — <reason: waiting on SDD / lower priority / dependency not ready>

---

*Planning frozen on <% date %>. Live progress in `README.md`.*
