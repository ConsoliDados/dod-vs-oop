import type { Currency } from '../../../../shared/value-objects'

/**
 * HTTP request body for `POST /accounts`.
 *
 * No class-validator decorators: structural validity is enforced by the domain
 * (`AccountAggregate` / `Money` throw on invalid input, ADR-0002), which the
 * exception filter maps to 422. Boundary DTO validation can be layered later if
 * a dependency on class-validator is introduced.
 */
export interface OpenAccountRequest {
  ownerId: string
  currency: Currency
}
