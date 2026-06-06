---
id: FEAT-005
slug: persistence
status: done
kind: infra
epic: 002-active-foundation
milestone: 001-bootstrap
frd: null
sdd: null
---

# FEAT-005 — persistence

Driver-flexible Drizzle connection — sqlite `:memory:` (test) / Postgres (resolved `DATABASE_URL` or `DB_*` parts), ports/adapters. Shipped directly (no build folder at the time); card added in the roadmap reorg.

- **Decision:** [[../../architecture/adrs/0012-persistence-driver-flexible-ports-adapters|ADR-0012]] (+ its correction: `:memory:` is test-only).
- **Code:** `packages/platform/src/db/`.
- **Branch:** `feat/persistence` → merged into the epic.
