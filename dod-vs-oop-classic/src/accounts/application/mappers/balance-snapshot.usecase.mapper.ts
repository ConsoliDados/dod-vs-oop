import type { Currency } from '../../../shared/value-objects'
import type { BalanceSnapshot } from '../../domain/value-objects/balance-snapshot'

/**
 * Client-facing representation of a consolidated balance snapshot (FEAT-006).
 * `balanceCents` is signed integer minor units (ADR-0004); `asOf` is ISO-8601.
 */
export interface BalanceSnapshotDto {
  accountId: string
  asOf: string
  balanceCents: number
  currency: Currency
  throughSeq: number
}

/** Domain → DTO mapper (application layer). */
export class BalanceSnapshotUseCaseMapper {
  static toDto(snapshot: BalanceSnapshot): BalanceSnapshotDto {
    return {
      accountId: snapshot.getAccountId(),
      asOf: snapshot.getAsOf().toISOString(),
      balanceCents: snapshot.getBalance().getCents(),
      currency: snapshot.getBalance().getCurrency(),
      throughSeq: snapshot.getThroughSeq(),
    }
  }
}
