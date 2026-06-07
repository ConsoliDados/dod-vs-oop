---
id: FEAT-006
slug: http-app
status: done
kind: infra
epic: 002-active-foundation
milestone: 001-bootstrap
frd: http-app
sdd: null
---

# FEAT-006 — http-app

The Elysia boundary — error envelope, request-id + request-scoped logger, health/readiness — built with the named-controller pattern (no `app` passed to controllers).

- **Spec:** [[../../architecture/frds/frd-http-app|frd-http-app]].
- **Decisions:** [[../../architecture/adrs/0014-infra-placement-tier-folder-organization|ADR-0014]] (inbound layer).
- **Code:** `apps/api/src/http/`.
- **Branch:** `feat/http-app` → merged into the epic.
