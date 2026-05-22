import type { Identifier } from '../../shared/value-objects/identifier'
import type { DomainEvent } from '../events/domain-event'
import type { Validator } from '../services/validator'
import { Entity, type ValidatorEntity, type ValidatorError } from './entity'

/**
 * Abstract base class for Aggregate Roots in Domain-Driven Design
 *
 * An Aggregate Root is a special type of Entity that serves as the entry point to
 * an aggregate cluster. An aggregate is a group of related entities and value objects
 * that are treated as a single unit for data changes.
 *
 * Key responsibilities:
 * - **Consistency Boundary**: Enforces invariants across all entities within the aggregate
 * - **Transaction Boundary**: All changes to the aggregate happen through the root
 * - **Domain Events**: Collects and publishes domain events when state changes occur
 * - **External Access**: Only the aggregate root can be directly accessed from outside
 *
 * Domain Events:
 * - Events are collected during state changes
 * - Events should be published after successful persistence
 * - Events represent facts that have happened in the domain
 *
 * Design Principles:
 * - Keep aggregates small (prefer small, focused aggregates)
 * - Reference other aggregates by ID only (not direct references)
 * - Enforce invariants only within aggregate boundaries
 * - Use domain events for eventual consistency between aggregates
 *
 * @template V - The Validator type for this aggregate root
 * @template E - The error type for validation failures (must extend Error)
 *
 * @example
 * ```typescript
 * class Order extends AggregateRoot<OrderValidator, InvalidEntityError> {
 *   private constructor(
 *     id: Identifier,
 *     private customerId: string,
 *     private total: number,
 *     private status: 'pending' | 'confirmed' | 'cancelled',
 *     createdAt: Date,
 *     updatedAt: Date,
 *     deletedAt?: Date
 *   ) {
 *     super(id, createdAt, updatedAt, deletedAt);
 *     this.validator = new OrderValidator(this);
 *   }
 *
 *   static create(customerId: string, total: number): Result<Order, InvalidEntityError> {
 *     const idResult = Identifier.create();
 *     if (idResult.isErr()) {
 *       return Err(new InvalidEntityError('Order', [idResult.unwrapErr()]));
 *     }
 *
 *     const now = new Date();
 *     const order = new Order(
 *       idResult.unwrap(),
 *       customerId,
 *       total,
 *       'pending',
 *       now,
 *       now
 *     );
 *
 *     // Add domain event for order creation
 *     order.addDomainEvent(
 *       new OrderCreatedEvent(order.getId().getValue(), customerId, total)
 *     );
 *
 *     const validationResult = order.validator.validate();
 *     if (validationResult.isErr()) {
 *       return validationResult;
 *     }
 *
 *     return Ok(order);
 *   }
 *
 *   public confirm(): void {
 *     this.status = 'confirmed';
 *     this.updateUpdatedAt();
 *     this.addDomainEvent(
 *       new OrderConfirmedEvent(this.getId().getValue(), new Date())
 *     );
 *   }
 *
 *   // ... other methods
 * }
 *
 * // Usage
 * const orderResult = Order.create('customer-123', 100);
 * if (orderResult.isOk()) {
 *   const order = orderResult.unwrap();
 *   order.confirm();
 *
 *   // Publish domain events after saving to database
 *   const events = order.pullDomainEvents();
 *   await eventPublisher.publishAll(events);
 * }
 * ```
 *
 * @see {@link https://martinfowler.com/bliki/DDD_Aggregate.html | Martin Fowler - DDD Aggregate}
 */
export abstract class AggregateRoot<
  V extends Validator<ValidatorEntity<V>, ValidatorError<V>>,
  E extends Error,
> extends Entity<V, E> {
  /**
   * Collection of domain events that occurred during state changes
   * These events should be published after the aggregate is successfully persisted
   * @private
   */
  private domainEvents: DomainEvent[] = []

  /**
   * Protected constructor to enforce factory method pattern
   *
   * Initializes the aggregate root with identity and lifecycle timestamps.
   * Inherits all entity validation from the base Entity class.
   *
   * @param id - The unique identifier for the aggregate root
   * @param createdAt - The date and time when the aggregate was created
   * @param updatedAt - The date and time when the aggregate was last updated
   * @param deletedAt - The date and time when the aggregate was deleted (optional)
   */
  protected constructor(id: Identifier, createdAt: Date, updatedAt: Date, deletedAt?: Date) {
    super(id, createdAt, updatedAt, deletedAt)
  }

  /**
   * Adds a domain event to the aggregate's event collection
   *
   * Call this method whenever an important state change occurs that other
   * parts of the system might be interested in. Events represent facts
   * that have already happened.
   *
   * @param event - The domain event to add
   * @protected
   *
   * @example
   * ```typescript
   * public confirm(): void {
   *   this.status = 'confirmed';
   *   this.updateUpdatedAt();
   *   this.addDomainEvent(
   *     new OrderConfirmedEvent(this.getId().getValue(), new Date())
   *   );
   * }
   * ```
   */
  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event)
  }

  /**
   * Retrieves all domain events and clears the collection
   *
   * This method is typically called after successfully persisting the aggregate
   * to get the events for publishing. The events are cleared to prevent
   * re-publishing the same events.
   *
   * @returns Array of domain events that occurred during state changes
   *
   * @example
   * ```typescript
   * // After saving the aggregate
   * const events = order.pullDomainEvents();
   * await eventPublisher.publishAll(events);
   * ```
   */
  public pullDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents]
    this.domainEvents = []
    return events
  }

  /**
   * Retrieves all domain events without clearing the collection
   *
   * Use this when you need to inspect events without consuming them.
   * Returns a copy of the events array to prevent external modification.
   *
   * @returns Array copy of current domain events
   *
   * @example
   * ```typescript
   * const events = order.getDomainEvents();
   * console.log(`Order has ${events.length} events`);
   * // Events are still in the aggregate's collection
   * ```
   */
  public getDomainEvents(): DomainEvent[] {
    return [...this.domainEvents]
  }

  /**
   * Clears all domain events without returning them
   *
   * Use this to discard events if a transaction is rolled back or
   * if events should not be published for some reason.
   *
   * @example
   * ```typescript
   * try {
   *   await repository.save(order);
   *   const events = order.pullDomainEvents();
   *   await eventPublisher.publishAll(events);
   * } catch (error) {
   *   // Clear events on failure
   *   order.clearDomainEvents();
   *   throw error;
   * }
   * ```
   */
  public clearDomainEvents(): void {
    this.domainEvents = []
  }

  /**
   * Checks if the aggregate has any pending domain events
   *
   * @returns `true` if there are domain events, `false` otherwise
   *
   * @example
   * ```typescript
   * if (order.hasDomainEvents()) {
   *   const events = order.pullDomainEvents();
   *   await eventPublisher.publishAll(events);
   * }
   * ```
   */
  public hasDomainEvents(): boolean {
    return this.domainEvents.length > 0
  }
}
