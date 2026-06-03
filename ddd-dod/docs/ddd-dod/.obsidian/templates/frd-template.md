<%*
const id = await tp.system.prompt("FRD ID (e.g. 001)");
const title = await tp.system.prompt("Functionality name");
const sdd = await tp.system.prompt("Parent SDD ID (the domain bible, e.g. SDD-001)");
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
await tp.file.rename(`frd-${slug}`);
await tp.file.move(`/frds/frd-${slug}`);
const date = tp.date.now("YYYY-MM-DD");
-%>
---
id: FRD-<% id %>
slug: <% slug %>
title: <% title %>
sdd: <% sdd %>
status: draft
date: <% date %>
depends-on: []
blocks: []
---

# FRD-<% id %> — <% title %>

<!--
An FRD (Feature Requirements Document) is the "what" of ONE functionality inside a domain. It is
1:1 with the management Feature that realizes it. It is the LAST doc in architecture/ and is
management-AGNOSTIC: it carries NO `epic:`/`milestone:` field. Its only upward link is `sdd:` (the
parent domain bible) — reference the SDD, never duplicate the model.

DEFAULT = this ONE flat file `architecture/frds/frd-<slug>.md`. RPA (Research → Plan → Act) is a
MENTAL discipline here — there are NO `research.md`/`plan.md` siblings and NO folder. Durable
decisions go to an ADR. RARE EXCEPTION (audit / sensitive handoff): promote this one node to a
folder + a single `research.md`; default = no research file. (See project_templates/AGENTS.md and
the frds/ README.)

At prototype/small tiers the FRD is ABSORBED into the SDD's "Functionalities" section (this file
does not exist there).
-->

## 1. Intent

<!-- What this functionality delivers, in business terms. The "why now". -->

## 2. Inherited domain context

<!-- Reference (don't copy) the parent SDD: which aggregate(s) / entities / value objects this
touches, which invariants apply, which ubiquitous-language terms are in play.
Link: [[../sdds/sdd-<slug>|SDD-NNN]]. -->

## 3. Acceptance criteria

<!-- Checkboxes. Each one is testable. These flow down into the Feature's README. -->

- [ ]

## 4. Validation rules (fine-grained)

<!-- Field- and behaviour-level rules the SDD's invariants don't already pin. -->

## 5. Tasks (1–2 day units)

<!--
The smallest management units (DAYS; internal checklist = HOURS) that realize this FRD. Built
BOTTOM-UP & LAYERED: entity A · entity B · aggregate + repository + use-cases + domain/application
services · infra (repository impl, DI, controllers, HTTP/gRPC routes). These are pulled into the
Feature build README as a `- [ ]` checklist (the README is the live trail; the code is the Act).
-->

- [ ] <task>

## 6. Behavioral API surface

<!-- Routes expose the use-case / intent, NOT status patches:
`POST /appointments/:id/confirm`, `…/cancel` — NOT `PATCH /appointments/:id {status}`.
See playbook-base.md §6.1. One row per route. -->

| Method | Route | Use case | Aggregate |
|--------|-------|----------|-----------|
|        |       |          |           |

## 7. Out of scope

## 8. Open questions

<!-- Surface to open-questions.md if they affect the plan. -->
