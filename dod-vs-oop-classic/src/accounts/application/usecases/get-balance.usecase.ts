import { QueryUseCase } from '../../../core/use-cases/use-case'
import type { Currency } from '../../../shared/value-objects'
import { AccountNotFoundError } from '../errors/account-not-found.error'
import type { GetAccountRepository } from '../repositories/get-account.repository'

export namespace GetBalance {
  export interface Input {
    id: string
  }
  export interface Output {
    availableBalance: number
    currency: Currency
  }
}

/**
 * Reads an account's available balance in minor units (REQ-003).
 * Framework-agnostic; NestJS wiring lives in `infrastructure/provider/usecases/`.
 *
 * For FEAT-001 the cached `availableBalance` is always zero (no postings,
 * no holds yet). FEAT-003 will keep it in sync via the `TransactionPosted`
 * event; it remains recomputable from postings (NFR-DATA-001).
 */
export class GetBalanceUseCase extends QueryUseCase<GetBalance.Input, GetBalance.Output> {
  constructor(private readonly getAccountRepository: GetAccountRepository) {
    super()
  }

  async execute(input: GetBalance.Input): Promise<GetBalance.Output> {
    const account = await this.getAccountRepository.findById(input.id)
    if (!account) {
      throw new AccountNotFoundError(input.id)
    }
    return {
      availableBalance: account.getAvailableBalance().getCents(),
      currency: account.getCurrency(),
    }
  }
}
