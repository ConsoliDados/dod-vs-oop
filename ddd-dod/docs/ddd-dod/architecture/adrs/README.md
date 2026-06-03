# Architecture Decision Records (ADRs)

ADRs capture decisions that have lasting structural consequences. Short, dated, and linked from the playbook / SAD when relevant.

## Status legend

- **Draft** — title and context noted; decision not yet made or not yet written down.
- **Proposed** — content drafted, awaiting review.
- **Accepted** — decision is in force; implementation reflects it.
- **Superseded** — replaced by a later ADR (link to successor).

## Index

| # | Title | Status | Milestone / Sprint |
|---|-------|--------|----------------|
| 0001 | <e.g. "Choose Rust as the implementation language"> | Draft | 0 |

## Template

```markdown
# ADR-NNNN — Title

- **Status:** Draft | Proposed | Accepted | Superseded by ADR-XXXX
- **Date:** YYYY-MM-DD
- **Milestone / Sprint:** N

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

The Templater plugin (in `.obsidian/templates/adr-template.md`) auto-generates this skeleton with prompts for ID, title, and milestone.

## When to write a new ADR

See `../playbook/playbook-base.md` § "ADRs". In short: changing a default that affects security posture, adding a new external dep, changing a public surface, or picking between approaches with lasting trade-offs.
