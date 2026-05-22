# Software Design Documents (SDDs)

SDDs document the **tactical design** of a bounded context (or, for non-DDD projects, a major area). They are companions to the SAD: SAD is strategic (which contexts exist, how they communicate); SDD is tactical (inside one context, what types and operations).

## When to write an SDD

- A bounded context has more than ~3 aggregates / domain types.
- A non-trivial public API surface needs invariants documented.
- Multiple ADRs accumulate around one area; an SDD consolidates them.

For prototypes, design decisions live in code + ADRs. SDDs start at the `small` tier when they help.

## Naming

`sdds/sdd-<area-slug>.md`. Example: `sdd-billing.md`, `sdd-event-bus.md`.

## Template

Use the Templater snippet `.obsidian/templates/sdd-template.md`. Sections:

1. Bounded context / area
2. Aggregates / domain types
3. Use cases / operations
4. Invariants
5. Errors
6. Ports / external dependencies
7. Open items

## Index

| ID | Area | Status |
|----|------|--------|
| [SDD-001](./sdd-accounts.md) | accounts | draft |
