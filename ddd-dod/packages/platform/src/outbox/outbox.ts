import type { PublishedEvent } from "@ddd-dod/shared-kernel";

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

export type OutboxError = {
  readonly type: "OutboxFailure";
  readonly cause: unknown;
};

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
