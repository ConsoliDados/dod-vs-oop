# Architecture Decision Records (ADRs)

ADRs capture decisions that have lasting structural consequences. Short, dated, and linked from the playbook / SAD when relevant.

## Status legend

- **Draft** — title and context noted; decision not yet made or not yet written down.
- **Proposed** — content drafted, awaiting review.
- **Accepted** — decision is in force; implementation reflects it.
- **Superseded** — replaced by a later ADR (link to successor).

## Index

| # | Title | Status | Phase / Sprint |
|---|-------|--------|----------------|
| [0001](./0001-stack-nestjs-typeorm-sqlite.md) | Stack: NestJS + Express + TypeORM + better-sqlite3 (`:memory:`) | Accepted | 0 |
| [0002](./0002-throw-on-first-violation.md) | Throw on first violation (no `Result<T, E>`) | Accepted | 0 |
| [0003](./0003-sync-in-memory-eventbus-no-outbox.md) | Synchronous in-memory EventBus (no Outbox) | Accepted | 0 |
| [0004](./0004-money-integer-minor-units.md) | Money as integer minor units (no Decimal library) | Accepted | EPIC-002 |
| [0005](./0005-framework-agnostic-application-layer.md) | Framework-agnostic application layer (DI wiring in infrastructure) | Accepted | EPIC-002 |
| [0006](./0006-balance-snapshot-and-consolidation.md) | Balance as immutable snapshots + consolidation domain service | Accepted | EPIC-002 |

## Template

```markdown
# ADR-NNNN — Title

- **Status:** Draft | Proposed | Accepted | Superseded by ADR-XXXX
- **Date:** YYYY-MM-DD
- **Phase / Sprint:** N

## Context

What problem are we solving? What constraints exist?

## Decision

State as a sentence: "We will use X."

## Alternatives considered

- (a) ... — rejected because ...
- (b) ... — rejected because ...

## Consequences

Positive and negative. What becomes easier? What becomes harder? What needs follow-up?

## References

Links to issues, prior art, related ADRs.
```

The Templater plugin (in `.obsidian/templates/adr-template.md`) auto-generates this skeleton with prompts for ID, title, and phase.

## When to write a new ADR

See `../playbook/playbook.md` § "ADRs". In short: changing a default that affects security posture, adding a new external dep, changing a public surface, or picking between approaches with lasting trade-offs.
