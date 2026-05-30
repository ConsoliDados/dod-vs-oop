<%*
const id = await tp.system.prompt("SDD ID (e.g. 001)");
const title = await tp.system.prompt("Bounded context / area name");
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
await tp.file.rename(`sdd-${slug}`);
await tp.file.move(`/sdds/sdd-${slug}`);
const date = tp.date.now("YYYY-MM-DD");
-%>
---
id: SDD-<% id %>
title: <% title %>
status: draft
date: <% date %>
---

# SDD-<% id %> — <% title %>

## 1. Bounded context / area

<!-- What does this context own? Where does it live in the repo? Dependencies on other contexts. -->

## 2. Aggregates / domain types

<!-- For DDD: name aggregate roots, list fields, invariants. For lighter projects: list the public types this area exposes. -->

## 3. Use cases / operations

<!-- One row per operation: input, output, errors. Use cases are *injected `*UseCase` classes* with constructor DI + `execute()` method, **throwing** typed `InvalidEntityError`/`UseCaseError`/etc. on first violation (per project playbook §1-10). Do NOT use `Result` here — that's the DOD side, not this verbose-canonical OOP foil. -->

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

## 7. Open items

<!-- Tracked in open-questions.md. Reference by ID. -->
