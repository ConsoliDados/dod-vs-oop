import type { Currency } from '../../../shared/value-objects'
import type { AccountStatus } from '../../domain/account-status'
import type { AccountAggregate } from '../../domain/entities/account.aggregate'

/**
 * Client-facing account representation. Monetary fields are integer minor units
 * (cents) per SRS §5.2; `createdAt` is an ISO-8601 string.
 */
export interface AccountDto {
  id: string
  ownerId: string
  currency: Currency
  status: AccountStatus
  availableBalance: number
  holdAmount: number
  version: number
  createdAt: string
}

/** Domain → DTO mapper (application layer). */
export class AccountUseCaseMapper {
  static toDto(account: AccountAggregate): AccountDto {
    return {
      id: account.getId().getValue(),
      ownerId: account.getOwnerId(),
      currency: account.getCurrency(),
      status: account.getStatus(),
      availableBalance: account.getAvailableBalance().getCents(),
      holdAmount: account.getHoldAmount().getCents(),
      version: account.getVersion(),
      createdAt: account.getCreatedAt().toISOString(),
    }
  }
}
