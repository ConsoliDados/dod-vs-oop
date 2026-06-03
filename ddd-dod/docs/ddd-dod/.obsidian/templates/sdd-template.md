<%*
const id = await tp.system.prompt("SDD ID (e.g. 001)");
const title = await tp.system.prompt("Domain / bounded-context name");
const subdomainType = await tp.system.prompt("Subdomain type (core | supporting | generic)", "core");
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
await tp.file.rename(`sdd-${slug}`);
await tp.file.move(`/sdds/sdd-${slug}`);
const date = tp.date.now("YYYY-MM-DD");
-%>
---
id: SDD-<% id %>
slug: <% slug %>
title: <% title %>
subdomain-type: <% subdomainType %>
status: draft
date: <% date %>
---

# SDD-<% id %> — <% title %>

<!--
The SDD is the tactical-design "bible" of ONE coherent DOMAIN (knowledge + architecture).
It is a management-AGNOSTIC doc: it carries NO `epic:`/`milestone:` field and never points at
management constructs. An Epic *references* this SDD via its `sdd:` field (Epic : SDD ≈ 1 : 1);
a cross-cutting refactor/infra epic references none.

`subdomain-type`: core (the differentiating heart) · supporting (specific but not the edge) ·
generic (off-the-shelf-shaped, e.g. auth).

DEFAULT = this ONE flat file `architecture/sdds/sdd-<slug>.md`. RPA (Research → Plan → Act) is
a MENTAL discipline here — there are NO `research.md`/`plan.md` siblings and NO folder. The
single artifact is this doc; durable decisions surfaced while authoring go to an ADR.
RARE EXCEPTION (audit / sensitive handoff): promote this one node to a folder and keep a single
`research.md` next to it. This is RARE but exists; default = no research file. (See
project_templates/AGENTS.md and the sdds/ README.)

At prototype/small the FRD layer is ABSORBED here (see "Functionalities"); at medium+ each
functionality splits into its own flat FRD `../frds/frd-<slug>.md` (1:1 with a management Feature).
-->

## 1. Domain / context

<!-- What does this domain own? Where does it live in the repo? Dependencies on other contexts. -->

## 2. Aggregates / domain types

<!-- For DDD: name aggregate roots, list fields, invariants. For lighter projects: list the public types this area exposes. -->

## 3. Use cases / operations

<!-- One row per operation: input, output, errors. Use cases are free functions returning Result<T, E>. -->

| Operation | Input | Output | Errors |
|-----------|-------|--------|--------|
|           |       |        |        |

## 4. Invariants

<!-- Each invariant gets at least one explicit test. Number them. -->

1.

## 5. Errors

<!-- Variants of this area's `Error` enum. Tie back to ADR-N if there's an architectural decision behind a variant. -->

## 6. Ports / external dependencies

<!-- Crates, daemons, FS layout, third-party APIs, SDK boundaries. Where adapters live. -->

## 7. Behavioral API surface

<!--
Routes expose the use-case / intent, NOT status patches:
`POST /appointments/:id/confirm`, `…/cancel` — NOT `PATCH /appointments/:id {status: confirmed}`.
This makes the API a vocabulary of domain intentions. One row per route. (playbook §6.1)
-->

| Method | Route | Use case | Aggregate |
|--------|-------|----------|-----------|
|        |       |          |           |

## 8. Functionalities (child FRDs — doc→doc links)

<!--
The functionalities of this domain. At prototype/small the FRD layer lives HERE: one block per
functionality with its intent · acceptance criteria · validation rules · Tasks. At medium+ each
block is promoted to its own flat FRD `../frds/frd-<slug>.md` (1:1 with a Feature) and this becomes
a list of links: [[../frds/frd-<slug>|FRD-NNN]].
-->

## 9. Open items

<!-- Tracked in open-questions.md. Reference by ID. -->
