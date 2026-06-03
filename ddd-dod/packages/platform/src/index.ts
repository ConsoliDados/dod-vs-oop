/**
 * `@ddd-dod/platform` — technical plumbing with **zero domain knowledge**:
 * the functional logger, the token-based DI container, env config, the db
 * handle, the outbox ports, and the clock. Modules depend on these *ports*;
 * concrete wiring happens at the `apps/api` composition root (ADR-0004).
 */

export * from "./clock";
export * from "./config";
export * from "./db";
export * from "./di";
export * from "./logger";
export * from "./outbox";
export { tryAsync } from "./try-async";
