import type { AccountId, TransactionId } from "./ids";

/**
 * Published cross-context event contracts. These are the **only** types that
 * cross a bounded-context boundary (SAD §3) — owned here in the shared kernel,
 * versioned (`v`), and never mutated in place (deprecate + add a new version).
 * Delivered via the transactional outbox (ADR-0003).
 *
 * At bootstrap only the first cross-context contract is defined; the union
 * grows as contexts publish more.
 */

/** A single balanced movement carried by a posted transaction. */
export interface PostedEntry {
  readonly accountId: AccountId;
  readonly amountMinor: number;
  readonly currency: string;
}

/**
 * `ledger` → `accounts`: a transaction has been posted; the consuming context
 * reflects it onto cached balances. Idempotent by `eventId` on the consumer.
 */
export interface TransactionPostedV1 {
  readonly type: "ledger.transaction.posted";
  readonly v: 1;
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly transactionId: TransactionId;
  readonly entries: readonly PostedEntry[];
}

/** The closed union of published events (grows per published contract). */
export type PublishedEvent = TransactionPostedV1;
