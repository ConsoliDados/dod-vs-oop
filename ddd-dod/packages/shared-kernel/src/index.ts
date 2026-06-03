/**
 * `@ddd-dod/shared-kernel` — the shared **domain** vocabulary every bounded
 * context depends on: `Money` (integer minor units), branded ids, the published
 * cross-context event contracts, and the `Result` glue. No infrastructure lives
 * here (logger / DI / db / config belong to `@ddd-dod/platform`).
 *
 * `Result`/`Option` and `Ok`/`Err`/`Some`/`None`/`match` are ambient globals
 * delivered by `@ddd-dod/types` (ADR-0005); they need no import or re-export.
 */
export type { PostedEntry, PublishedEvent, TransactionPostedV1 } from "./events";
export { AccountId, PostingId, TransactionId } from "./ids";
export { type Currency, Money } from "./money";
export { InvalidInput, type InvalidProperty } from "./result";
