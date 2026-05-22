/**
 * Base interface for all domain events
 */
export interface DomainEvent {
  /**
   * Unique identifier for the event instance
   */
  readonly eventId: string

  /**
   * Type/name of the event (e.g., 'UserCreated', 'OrderPlaced')
   */
  readonly eventType: string

  /**
   * Timestamp when the event occurred
   */
  readonly occurredAt: Date

  /**
   * ID of the aggregate that produced this event
   */
  readonly aggregateId: string

  /**
   * Optional metadata for the event
   */
  readonly metadata?: Record<string, unknown>
}

/**
 * Abstract base class for domain events
 * Provides common functionality and ensures consistent event structure
 */
export abstract class BaseDomainEvent implements DomainEvent {
  public readonly eventId: string
  public readonly occurredAt: Date

  constructor(
    public readonly eventType: string,
    public readonly aggregateId: string,
    public readonly metadata: Record<string, unknown> = {},
  ) {
    this.eventId = crypto.randomUUID()
    this.occurredAt = new Date()
  }

  /**
   * Serializes the event to a plain object
   */
  public toJSON(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      aggregateId: this.aggregateId,
      occurredAt: this.occurredAt.toISOString(),
      metadata: this.metadata,
    }
  }

  /**
   * Returns a string representation of the event
   */
  public toString(): string {
    return JSON.stringify(this.toJSON(), null, 2)
  }
}
