/**
 * `@ddd-dod/platform` — technical plumbing with **zero domain knowledge**:
 * the functional logger, the token-based DI container, env config, the db
 * handle, the outbox ports, and the clock. Modules depend on these *ports*;
 * concrete wiring happens at the `apps/api` composition root (ADR-0004).
 */

export * as clock from "./clock";
export * as config from "./config";
export * as db from "./db";
export * as di from "./di";
export * as logger from "./logger";
export * as outbox from "./outbox";
export { tryAsync } from "./try-async";
