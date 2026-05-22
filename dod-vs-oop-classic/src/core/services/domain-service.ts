/**
 * Domain Service Base
 *
 * Domain Services encapsulate domain logic that doesn't naturally fit within
 * an Entity or Value Object. They represent operations or processes in the
 * domain that involve multiple entities or require coordination.
 *
 * When to use Domain Services:
 * - The operation is a significant process in the domain
 * - The operation involves multiple aggregates
 * - The operation doesn't naturally belong to any entity
 * - Domain experts recognize it as a distinct concept
 *
 * When NOT to use Domain Services:
 * - For simple CRUD operations (use repositories)
 * - For application orchestration (use Use Cases)
 * - For infrastructure concerns (use Infrastructure Services)
 *
 * Key characteristics:
 * - Stateless (no instance state)
 * - Named after domain concepts
 * - Part of the domain layer
 * - Coordinates entities and value objects
 *
 * @see {@link https://martinfowler.com/bliki/EvansClassification.html | Martin Fowler - Evans Classification}
 *
 * @example
 * ```typescript
 * // Transfer money between accounts (domain service)
 * class MoneyTransferService {
 *   transfer(
 *     from: Account,
 *     to: Account,
 *     amount: Money
 *   ): Result<void, DomainError> {
 *     // 1. Validate transfer rules
 *     if (!from.canWithdraw(amount)) {
 *       return Err(new InsufficientFundsError(from.getId(), amount));
 *     }
 *
 *     if (!to.canDeposit(amount)) {
 *       return Err(new DepositLimitExceededError(to.getId(), amount));
 *     }
 *
 *     // 2. Execute the transfer (coordinating two aggregates)
 *     from.withdraw(amount);
 *     to.deposit(amount);
 *
 *     // 3. Add domain events
 *     from.addDomainEvent(
 *       new MoneyTransferredEvent(from.getId(), to.getId(), amount)
 *     );
 *
 *     return Ok(undefined);
 *   }
 * }
 *
 * // Pricing service (domain service)
 * class PricingService {
 *   calculateTotal(items: OrderItem[], customer: Customer): Money {
 *     let total = Money.zero('BRL');
 *
 *     // Calculate items total
 *     for (const item of items) {
 *       total = total.add(item.getSubtotal());
 *     }
 *
 *     // Apply customer discount
 *     const discount = this.calculateDiscount(total, customer);
 *     total = total.subtract(discount);
 *
 *     return total;
 *   }
 *
 *   private calculateDiscount(total: Money, customer: Customer): Money {
 *     if (customer.isPremium()) {
 *       return total.multiply(0.1); // 10% discount
 *     }
 *     return Money.zero(total.getCurrency());
 *   }
 * }
 * ```
 */

/**
 * Marker type for Domain Services.
 *
 * Use this to tag classes as domain services for type safety and
 * documentation purposes. No required methods — it's intentionally empty.
 */
// biome-ignore lint/complexity/noBannedTypes: marker type for DDD domain services (no required surface)
export type DomainService = {}

/**
 * Domain Service Documentation Decorator
 *
 * This is a conceptual example showing how domain services should be documented.
 * The actual implementation uses JSDoc comments.
 *
 * @example
 * ```typescript
 * // Password Hashing Service (Infrastructure - not domain!)
 * // This is an example of what NOT to put in domain layer
 * class PasswordHasher {
 *   hash(password: string): Promise<string> {
 *     // Infrastructure concern
 *   }
 * }
 *
 * // Order Fulfillment Service (Domain Service)
 * class OrderFulfillmentService implements DomainService {
 *   fulfill(order: Order, inventory: Inventory): Result<void, DomainError> {
 *     // 1. Check inventory
 *     for (const item of order.getItems()) {
 *       if (!inventory.hasStock(item.getProductId(), item.getQuantity())) {
 *         return Err(new InsufficientStockError(item.getProductId()));
 *       }
 *     }
 *
 *     // 2. Reserve inventory
 *     for (const item of order.getItems()) {
 *       inventory.reserve(item.getProductId(), item.getQuantity());
 *     }
 *
 *     // 3. Mark order as fulfilled
 *     order.markAsFulfilled();
 *
 *     return Ok(undefined);
 *   }
 * }
 *
 * // User Authentication Service (Domain Service)
 * class UserAuthenticationService implements DomainService {
 *   authenticate(
 *     user: User,
 *     providedPassword: string,
 *     passwordHasher: PasswordHasher
 *   ): Promise<Result<AuthToken, AuthenticationError>> {
 *     // Note: PasswordHasher is injected (infrastructure service)
 *     // This service coordinates domain logic with infrastructure
 *
 *     // 1. Check if user is active
 *     if (!user.isActive()) {
 *       return Promise.resolve(Err(new UserNotActiveError(user.getId())));
 *     }
 *
 *     // 2. Verify password (using infrastructure service)
 *     const isValid = await passwordHasher.verify(
 *       providedPassword,
 *       user.getPasswordHash()
 *     );
 *
 *     if (!isValid) {
 *       user.recordFailedLogin();
 *       return Promise.resolve(Err(new InvalidCredentialsError()));
 *     }
 *
 *     // 3. Generate auth token (domain logic)
 *     user.recordSuccessfulLogin();
 *     const token = AuthToken.generate(user);
 *
 *     return Promise.resolve(Ok(token));
 *   }
 * }
 * ```
 */

/**
 * Example Domain Services
 *
 * Below are common patterns and examples of domain services:
 */

/**
 * Validation Service Example
 *
 * Used when validation logic spans multiple aggregates or requires
 * external data that shouldn't be in the entity.
 *
 * @example
 * ```typescript
 * class UsernameUniquenessService implements DomainService {
 *   constructor(private userRepository: UserRepository) {}
 *
 *   async isUnique(username: string): Promise<boolean> {
 *     const spec = new UsernameSpecification(username);
 *     const users = await this.userRepository.findBy(spec);
 *     return users.length === 0;
 *   }
 * }
 * ```
 */

/**
 * Calculation Service Example
 *
 * Used for complex calculations that involve multiple entities
 * and business rules.
 *
 * @example
 * ```typescript
 * class ShippingCostCalculator implements DomainService {
 *   calculate(
 *     order: Order,
 *     origin: Address,
 *     destination: Address
 *   ): Money {
 *     const weight = order.getTotalWeight();
 *     const distance = this.calculateDistance(origin, destination);
 *     const baseRate = this.getBaseRate(distance);
 *
 *     let cost = baseRate.multiply(weight.getValue());
 *
 *     // Apply weight-based discount
 *     if (weight.getValue() > 50) {
 *       cost = cost.multiply(0.9); // 10% discount
 *     }
 *
 *     return cost;
 *   }
 *
 *   private calculateDistance(from: Address, to: Address): number {
 *     // Domain logic for distance calculation
 *     // Or delegate to a specialized service
 *     return 0; // Simplified
 *   }
 *
 *   private getBaseRate(distance: number): Money {
 *     if (distance < 100) return Money.create(10, 'BRL').unwrap();
 *     if (distance < 500) return Money.create(25, 'BRL').unwrap();
 *     return Money.create(50, 'BRL').unwrap();
 *   }
 * }
 * ```
 */

/**
 * Policy Service Example
 *
 * Encapsulates complex business policies that determine outcomes
 * based on multiple factors.
 *
 * @example
 * ```typescript
 * class RefundPolicyService implements DomainService {
 *   canRefund(order: Order, requestDate: Date): boolean {
 *     // 1. Check order status
 *     if (!order.isDelivered()) {
 *       return false;
 *     }
 *
 *     // 2. Check time window (30 days)
 *     const daysSinceDelivery = this.calculateDaysSince(
 *       order.getDeliveredAt()!,
 *       requestDate
 *     );
 *
 *     if (daysSinceDelivery > 30) {
 *       return false;
 *     }
 *
 *     // 3. Check product categories
 *     const nonRefundableItems = order.getItems().filter(
 *       item => item.getProduct().isNonRefundable()
 *     );
 *
 *     return nonRefundableItems.length === 0;
 *   }
 *
 *   private calculateDaysSince(from: Date, to: Date): number {
 *     const diff = to.getTime() - from.getTime();
 *     return Math.floor(diff / (1000 * 60 * 60 * 24));
 *   }
 * }
 * ```
 */

/**
 * Best Practices for Domain Services:
 *
 * 1. **Keep them stateless**: Don't store instance state
 * 2. **Name them carefully**: Use domain language
 * 3. **Don't overuse**: Prefer putting logic in entities when possible
 * 4. **Inject dependencies**: Use constructor injection
 * 5. **Return domain objects**: Not DTOs or primitives
 * 6. **Use Result type**: For operations that can fail
 * 7. **Document the "why"**: Explain why it's a service, not an entity method
 *
 * Anti-patterns to avoid:
 * - Anemic entities with fat services
 * - Infrastructure concerns in domain services
 * - Services that just delegate to repositories (use use cases instead)
 * - Services with only one method (might belong in an entity)
 */
