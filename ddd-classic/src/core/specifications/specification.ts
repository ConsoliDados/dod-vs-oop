/**
 * Specification Pattern for Domain-Driven Design
 *
 * The Specification Pattern allows you to encapsulate business rules
 * in reusable, composable objects that can be combined using logical operators.
 *
 * Benefits:
 * - Encapsulates business rules in testable units
 * - Promotes rule reusability across the domain
 * - Enables complex rule composition (AND, OR, NOT)
 * - Keeps domain logic separate from query logic
 * - Makes implicit concepts explicit
 *
 * @see {@link https://martinfowler.com/apsupp/spec.pdf | Martin Fowler - Specifications}
 */

/**
 * Base Specification interface
 *
 * All specifications must implement the `isSatisfiedBy` method to determine
 * if a candidate object satisfies the business rule.
 *
 * @template T - The type of object being evaluated
 *
 * @example
 * ```typescript
 * class AdultSpecification implements Specification<User> {
 *   isSatisfiedBy(user: User): boolean {
 *     return user.getAge() >= 18;
 *   }
 * }
 *
 * const spec = new AdultSpecification();
 * const user = User.create('John', 25).unwrap();
 * console.log(spec.isSatisfiedBy(user)); // true
 * ```
 */
export interface Specification<T> {
  /**
   * Checks if the candidate satisfies this specification
   *
   * @param candidate - The object to evaluate
   * @returns True if the candidate satisfies the specification
   */
  isSatisfiedBy(candidate: T): boolean

  /**
   * Combines this specification with another using AND logic
   *
   * @param other - Another specification to combine with
   * @returns A new specification that is satisfied only if both are satisfied
   *
   * @example
   * ```typescript
   * const adultSpec = new AdultSpecification();
   * const activeSpec = new ActiveUserSpecification();
   * const combined = adultSpec.and(activeSpec);
   *
   * // User must be both adult AND active
   * console.log(combined.isSatisfiedBy(user));
   * ```
   */
  and(other: Specification<T>): Specification<T>

  /**
   * Combines this specification with another using OR logic
   *
   * @param other - Another specification to combine with
   * @returns A new specification that is satisfied if either is satisfied
   *
   * @example
   * ```typescript
   * const vipSpec = new VipUserSpecification();
   * const adminSpec = new AdminUserSpecification();
   * const combined = vipSpec.or(adminSpec);
   *
   * // User must be either VIP OR admin
   * console.log(combined.isSatisfiedBy(user));
   * ```
   */
  or(other: Specification<T>): Specification<T>

  /**
   * Negates this specification using NOT logic
   *
   * @returns A new specification that is satisfied when this is not satisfied
   *
   * @example
   * ```typescript
   * const bannedSpec = new BannedUserSpecification();
   * const notBanned = bannedSpec.not();
   *
   * // User must NOT be banned
   * console.log(notBanned.isSatisfiedBy(user));
   * ```
   */
  not(): Specification<T>
}

/**
 * Abstract base class for specifications
 *
 * Provides default implementations for AND, OR, and NOT operations.
 * Subclasses only need to implement the `isSatisfiedBy` method.
 *
 * @template T - The type of object being evaluated
 *
 * @example
 * ```typescript
 * class PremiumUserSpecification extends BaseSpecification<User> {
 *   isSatisfiedBy(user: User): boolean {
 *     return user.getSubscriptionTier() === 'premium';
 *   }
 * }
 *
 * class ActiveUserSpecification extends BaseSpecification<User> {
 *   isSatisfiedBy(user: User): boolean {
 *     return user.isActive();
 *   }
 * }
 *
 * // Compose specifications
 * const premiumAndActive = new PremiumUserSpecification()
 *   .and(new ActiveUserSpecification());
 *
 * // Use in business logic
 * if (premiumAndActive.isSatisfiedBy(user)) {
 *   // Grant premium features
 * }
 * ```
 */
export abstract class BaseSpecification<T> implements Specification<T> {
  /**
   * Checks if the candidate satisfies this specification
   * Must be implemented by subclasses
   *
   * @param candidate - The object to evaluate
   * @returns True if the candidate satisfies the specification
   */
  abstract isSatisfiedBy(candidate: T): boolean

  /**
   * Combines this specification with another using AND logic
   *
   * @param other - Another specification to combine with
   * @returns A new AND specification
   */
  public and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other)
  }

  /**
   * Combines this specification with another using OR logic
   *
   * @param other - Another specification to combine with
   * @returns A new OR specification
   */
  public or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other)
  }

  /**
   * Negates this specification using NOT logic
   *
   * @returns A new NOT specification
   */
  public not(): Specification<T> {
    return new NotSpecification(this)
  }
}

/**
 * AND Specification
 *
 * A composite specification that is satisfied only when both
 * specifications are satisfied.
 *
 * @template T - The type of object being evaluated
 * @internal
 */
class AndSpecification<T> extends BaseSpecification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super()
  }

  public isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate)
  }
}

/**
 * OR Specification
 *
 * A composite specification that is satisfied when at least one
 * specification is satisfied.
 *
 * @template T - The type of object being evaluated
 * @internal
 */
class OrSpecification<T> extends BaseSpecification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>,
  ) {
    super()
  }

  public isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate)
  }
}

/**
 * NOT Specification
 *
 * A specification that negates another specification.
 * It is satisfied when the wrapped specification is not satisfied.
 *
 * @template T - The type of object being evaluated
 * @internal
 */
class NotSpecification<T> extends BaseSpecification<T> {
  constructor(private readonly spec: Specification<T>) {
    super()
  }

  public isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate)
  }
}

/**
 * Composite Specification Helper
 *
 * Provides static utility methods for creating composite specifications
 * without directly instantiating the composite classes.
 *
 * @example
 * ```typescript
 * const spec = CompositeSpecification.all([
 *   new AdultSpecification(),
 *   new ActiveUserSpecification(),
 *   new VerifiedEmailSpecification()
 * ]);
 *
 * const anySpec = CompositeSpecification.any([
 *   new VipUserSpecification(),
 *   new AdminUserSpecification()
 * ]);
 * ```
 */
export class CompositeSpecification {
  /**
   * Creates a specification that is satisfied when ALL specifications are satisfied
   *
   * @template T - The type of object being evaluated
   * @param specs - Array of specifications to combine with AND
   * @returns A composite specification using AND logic
   *
   * @example
   * ```typescript
   * const spec = CompositeSpecification.all([
   *   new AdultSpecification(),
   *   new ActiveUserSpecification()
   * ]);
   * ```
   */
  public static all<T>(specs: Specification<T>[]): Specification<T> {
    if (specs.length === 0) {
      throw new Error('Cannot create composite specification from empty array')
    }

    return specs.reduce((acc, spec) => acc.and(spec))
  }

  /**
   * Creates a specification that is satisfied when ANY specification is satisfied
   *
   * @template T - The type of object being evaluated
   * @param specs - Array of specifications to combine with OR
   * @returns A composite specification using OR logic
   *
   * @example
   * ```typescript
   * const spec = CompositeSpecification.any([
   *   new VipUserSpecification(),
   *   new AdminUserSpecification()
   * ]);
   * ```
   */
  public static any<T>(specs: Specification<T>[]): Specification<T> {
    if (specs.length === 0) {
      throw new Error('Cannot create composite specification from empty array')
    }

    return specs.reduce((acc, spec) => acc.or(spec))
  }

  /**
   * Creates a specification that is satisfied when NONE of the specifications are satisfied
   *
   * @template T - The type of object being evaluated
   * @param specs - Array of specifications to negate
   * @returns A composite specification using NOT and AND logic
   *
   * @example
   * ```typescript
   * const spec = CompositeSpecification.none([
   *   new BannedUserSpecification(),
   *   new SuspendedUserSpecification()
   * ]);
   * // User must be neither banned NOR suspended
   * ```
   */
  public static none<T>(specs: Specification<T>[]): Specification<T> {
    if (specs.length === 0) {
      throw new Error('Cannot create composite specification from empty array')
    }

    return specs.map((spec) => spec.not()).reduce((acc, spec) => acc.and(spec))
  }
}
