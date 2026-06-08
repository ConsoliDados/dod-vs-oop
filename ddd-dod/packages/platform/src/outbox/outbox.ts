import type { PublishedEvent } from "@ddd-dod/shared-kernel";
import { defineError, type EnumValues } from "@ddd-dod/types";

/**
 * Transactional Outbox ports (ADR-0003). The **write side** persists events in
 * the same transaction as the state change (`OutboxWriter`); a separate
 * **dispatcher** drains pending events to idempotent consumers
 * (`OutboxDispatcher`). Concrete, drizzle-backed implementations land with each
 * context's persistence adapter in EPIC-002 — this file fixes the contracts.
 */

export type OutboxStatus = "pending" | "processed";

export interface OutboxRecord {
  readonly eventId: string;
  readonly type: string;
  readonly payload: unknown;
  readonly status: OutboxStatus;
  readonly occurredAt: Date;
}

const errorVariants = {
  outboxFailure: (cause: unknown) => ({ OutboxFailure: { cause } }) as const,
} as const;

/**
 * Outbox port failure (ADR-0003, ADR-0008). Returned by the writer/dispatcher
 * ports; concrete drizzle-backed impls construct it in EPIC-002. Carries its
 * renderers (ADR-0009): `OutboxError.format` (Display) and `OutboxError.serialize`
 * (structured). The native cause is stringified at the boundary, never leaked raw.
 */
export type OutboxError = EnumValues<typeof errorVariants>;

export const OutboxError = defineError(errorVariants, {
  format: (e: OutboxError) =>
    match(e, {
      OutboxFailure: (x) => `outbox failure: ${String(x.cause)}`,
    }),
  serialize: (e: OutboxError) =>
    match(e, {
      OutboxFailure: (x) => ({ kind: "OutboxFailure", cause: String(x.cause) }),
    }),
});

/** Enqueue published events atomically with the owning state change. */
export interface OutboxWriter {
  enqueue(events: readonly PublishedEvent[]): Promise<Result<void, OutboxError>>;
}

/** Drain pending events to consumers; returns the count processed. */
export interface OutboxDispatcher {
  drain(): Promise<Result<number, OutboxError>>;
}

/** Idempotent consumer of a published event (deduped by `eventId`). */
export type EventHandler<E extends PublishedEvent = PublishedEvent> = (
  event: E,
) => Promise<Result<void, OutboxError>>;
