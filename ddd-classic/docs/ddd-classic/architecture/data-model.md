# DDD Classic — Data Model

> **Optional at the `medium` tier.** Keep if your project has a non-trivial schema (database, file format, message format). Required at `large` tier.

## 1. Overview

<!-- One paragraph. What entities, what relationships, what storage. -->

## 2. Entities

| Entity | Purpose | Owning context | Storage |
|--------|---------|----------------|---------|
| <name> | <one sentence> | <bounded context> | <table / file / cache> |

## 3. Schema

### `<entity>` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | <type> | PK, not null | |
| ... | | | |

(Repeat per entity. Or link to `migrations/` if those are authoritative.)

## 4. Relationships

```
<entity-a> ──1:N──▶ <entity-b>
```

Or use `[[mermaid]]`/PlantUML if the diagram needs to be richer.

## 5. Invariants

<!-- Cross-table invariants the DB cannot enforce. Each one points to the use case / repository that maintains it. -->

## 6. Migration policy

<!-- Tool, naming convention, rollback story. -->

## 7. References

- `sdds/sdd-<area>.md` — operations that touch each entity
- `adrs/` — schema-shape decisions (e.g. UUIDv7 vs serial id)
