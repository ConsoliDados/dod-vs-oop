// Bun test preload (see bunfig.toml). Registers the `@consolidados/results`
// value-globals (Ok/Err/Some/None/match) before any test executes, so test
// files never need a per-file side-effect import.
import "@ddd-dod/types/globals";
