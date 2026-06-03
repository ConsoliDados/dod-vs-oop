# AGENTS.md — `<module-path>`

<!--
Per-module AGENTS.md template. Copy to your module root (e.g.
`apps/web/AGENTS.md`, `crates/<context>/AGENTS.md`, `packages/<pkg>/AGENTS.md`)
and trim sections that don't apply.

A module is a unit of compilation/distribution that the team treats as one
deploy/test target: an app, a service, a library package, a Rust crate, etc.
-->

<!-- Optional warning banner for sharp edges. Examples:
> ⚠️  This package depends on <X>'s pre-release API. The consumer side breaks
> if you bump <X> beyond <version> without coordinating.
-->

## Responsibility

<!-- One sentence: what this module owns. Be specific about the boundary. -->

Owns <X>. Consumes <Y> via <interface>. **Does not own** <Z>.

## Boundaries

<!-- What depends on this; what this depends on. Helps reason about blast
radius of changes. -->

- **Depends on:** <upstream-1>, <upstream-2>.
- **Consumed by:** <downstream-1>, <downstream-2>.
- **Cross-context comms:** <none / via published events / via repository trait owned here>.

## Layout

```
<module-path>/
├── <file-or-folder> — <purpose>
├── <file-or-folder> — <purpose>
└── <file-or-folder> — <purpose>
```

## Commands

```bash
<test-cmd>            # e.g. cargo test -p <crate> / bun test <pkg>
<lint-cmd>            # e.g. cargo clippy -p <crate> / bun run lint
<build-cmd>           # if non-trivial
<run-cmd>             # if applicable (apps/services)
```

## Conventions specific to this module

<!-- Overrides / refinements of the root AGENTS.md or playbook. Keep this short:
if a rule is generic, push it up to the playbook instead. Examples:
- "All public errors are `<Module>Error` variants — no `anyhow` even in tests."
- "Internal helpers stay in `internal/`; nothing imports across the boundary."
- "DB queries are written as Drizzle expressions, never raw SQL strings."
-->

## Points of attention

<!-- Invariants, gotchas, ADR pointers. The "if you forget this, things break
silently" list. Examples: -->

- <!-- e.g. "Dispatcher must hold a transaction for the duration of save_with_events; see ADR-014." -->
- <!-- e.g. "ID generation lives in shared/ids.rs — never define a local newtype here." -->
- <!-- e.g. "Public surface is the `pub` re-exports in lib.rs / index.ts — adding here is a breaking change." -->

## References

<!-- Hyperlinks to ADRs, SDDs, or external docs that govern this module. Use
vault-relative paths so Obsidian renders them as backlinks. -->

- [[docs/ddd-dod/architecture/adrs/adr-NNNN-<title>.md]] — <one-line relevance>
- [[docs/ddd-dod/architecture/sdds/sdd-<slug>.md]] — tactical bible for this domain (an Epic references it via `sdd:`)
- [[docs/ddd-dod/architecture/frds/frd-<slug>.md]] — the "what" of a functionality here (medium+; 1:1 with a Feature)
