<%*
const id = await tp.system.prompt("Milestone ID (e.g. 001)");
const title = await tp.system.prompt("Milestone title (e.g. Auth, MVP, v1)");
const window = await tp.system.prompt("Target window (e.g. 2026-Q3, or a date range)", "");
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
await tp.file.rename(`${id}-${slug}`);
await tp.file.move(`/roadmap/milestones/${id}-${slug}`);
const date = tp.date.now("YYYY-MM-DD");
-%>
---
id: MILESTONE-<% id %>
slug: <% slug %>
title: <% title %>
window: <% window %>
status: planned
date: <% date %>
---

# MILESTONE-<% id %> — <% title %>

<!--
A Milestone is a ROADMAP-level delivery grouping — the construct that replaces the dead "phase"
(playbook §22.1, §25). It is MANAGEMENT, not a doc: it spans 1..N SDDs/epics plus cross-cutting
work (Milestone : SDD = 1 : N) and REFERENCES the docs it delivers (`sdd:`/epic refs); the docs
never point back. Lives under `roadmap/milestones/` (or as a section in `roadmap/`).

Portability (playbook §25): Jira Initiative · Linear Project.
-->

## Goal

<!-- One paragraph: the coherent outcome this milestone delivers. Why this grouping, why now. -->

## Delivers (SDDs / epics it groups)

<!--
The domains and epics this milestone delivers, by reference. A milestone like "auth" spans several
SDDs. Link them; the link is one-way (milestone → docs/epics).
-->

- [[../../architecture/sdds/sdd-<slug>|SDD-NNN]] — <domain> · via EPIC-<id>
- …

## Cross-cutting items (no SDD)

<!-- Infra / refactor work that sits in this milestone but maps to no bounded context (no SDD). -->

- EPIC-<id> — <cross-cutting work>

## Exit

<!-- The formal "done" of this milestone: observable / testable conditions. When all are met, the
milestone closes. -->

- [ ]
