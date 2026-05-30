import type { DomainService } from '../../../core/services/domain-service'
import type { Money } from '../../../shared/value-objects'
import { AccountNotClosableError } from '../../application/errors/account-not-closable.error'
import type { AccountAggregate } from '../entities/account.aggregate'

/**
 * `CloseAccountService` — the study's **first cross-aggregate domain service**
 * (ADR-0010, FEAT-007).
 *
 * Encodes the rule "an account closes only at a zero ledger-recomputed
 * balance" (REQ-013). The rule spans `accounts` (the aggregate) **and**
 * `ledger` (the recomputed balance), so it doesn't belong on either aggregate
 * alone. The aggregate stays the authority over the *transition*
 * (`account.close()`); this service holds the *precondition*.
 *
 * **Pure — no I/O.** The use case reads the recomputed balance from the
 * `LedgerBalanceReader` ACL and passes it in. That keeps this service
 * trivially unit-testable (no mocks of repositories or HTTP) and keeps
 * cross-context reads visible at the application layer.
 *
 * Throws {@link AccountNotClosableError} (→ 422) when the balance is non-zero.
 * Delegates the legal transition to `account.close()` (which throws on
 * `closed → closed`, ADR-0010 terminal state).
 */
export class CloseAccountService implements DomainService {
  /**
   * @throws AccountNotClosableError when `ledgerBalance` is non-zero.
   * @throws InvalidEntityError (from the aggregate) when the transition is
   *   illegal (e.g. closing an already-closed account).
   */
  close(account: AccountAggregate, ledgerBalance: Money): void {
    if (!ledgerBalance.isZero()) {
      throw new AccountNotClosableError(
        account.getId().getValue(),
        ledgerBalance.getCents(),
        ledgerBalance.getCurrency(),
      )
    }
    account.close()
  }
}
