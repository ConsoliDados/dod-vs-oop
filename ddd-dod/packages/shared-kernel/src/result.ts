/**
 * Notification-pattern types for the shared kernel. The `Result`/`Option`
 * types and the `Ok`/`Err`/`Some`/`None`/`match` values are **ambient
 * globals** delivered by `@ddd-dod/types` (ADR-0005) — no import needed for
 * them anywhere in the workspace. This file only owns the domain-validation
 * error shapes that ride inside an `Err`.
 */

/**
 * A single accumulated validation failure — the unit of the Notification
 * pattern (ADR-0002). Smart constructors collect these into an array instead
 * of throwing on the first violation.
 */
export interface InvalidProperty {
  readonly property: string;
  readonly message: string;
}

/**
 * Roll-up of the violations gathered while constructing one entity/value
 * object. The `Err` payload of a smart constructor when more than the single
 * `InvalidProperty[]` shape is wanted at a boundary.
 */
export interface InvalidInput {
  readonly type: "InvalidInput";
  readonly entity: string;
  readonly violations: readonly InvalidProperty[];
}

export const InvalidInput = (
  entity: string,
  violations: readonly InvalidProperty[],
): InvalidInput => ({ type: "InvalidInput", entity, violations });
