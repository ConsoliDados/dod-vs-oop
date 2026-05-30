import { CommandUseCase } from '../../../core/use-cases/use-case'
import { AccountNotFoundError } from '../errors/account-not-found.error'
import { type AccountDto, AccountUseCaseMapper } from '../mappers/account.usecase.mapper'
import type { GetAccountRepository } from '../repositories/get-account.repository'
import type { UpdateAccountRepository } from '../repositories/update-account.repository'

export namespace FreezeAccount {
  export interface Input {
    id: string
  }
  export type Output = AccountDto
}

/**
 * Transitions an account to `frozen` (REQ-012, ADR-0010).
 *
 * Framework-agnostic (ADR-0005). Orchestration:
 * 1. Load via `GetAccountRepository` → 404 if absent.
 * 2. `account.freeze()` — aggregate guards the transition (illegal → 422).
 * 3. Persist via `UpdateAccountRepository` (optimistic lock on prior `version`).
 */
export class FreezeAccountUseCase extends CommandUseCase<
  FreezeAccount.Input,
  FreezeAccount.Output
> {
  constructor(
    private readonly getAccount: GetAccountRepository,
    private readonly updateAccount: UpdateAccountRepository,
  ) {
    super()
  }

  async execute(input: FreezeAccount.Input): Promise<FreezeAccount.Output> {
    const account = await this.getAccount.findById(input.id)
    if (!account) {
      throw new AccountNotFoundError(input.id)
    }
    account.freeze()
    await this.updateAccount.update(account)
    return AccountUseCaseMapper.toDto(account)
  }
}
