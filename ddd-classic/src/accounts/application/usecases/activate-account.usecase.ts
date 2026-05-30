import { CommandUseCase } from '../../../core/use-cases/use-case'
import { AccountNotFoundError } from '../errors/account-not-found.error'
import { type AccountDto, AccountUseCaseMapper } from '../mappers/account.usecase.mapper'
import type { GetAccountRepository } from '../repositories/get-account.repository'
import type { UpdateAccountRepository } from '../repositories/update-account.repository'

export namespace ActivateAccount {
  export interface Input {
    id: string
  }
  export type Output = AccountDto
}

/**
 * Transitions a `frozen` account back to `active` (REQ-012, ADR-0010).
 *
 * Framework-agnostic (ADR-0005). Symmetric to `FreezeAccountUseCase`; the
 * aggregate's transition guard rejects activation from non-`frozen` states.
 */
export class ActivateAccountUseCase extends CommandUseCase<
  ActivateAccount.Input,
  ActivateAccount.Output
> {
  constructor(
    private readonly getAccount: GetAccountRepository,
    private readonly updateAccount: UpdateAccountRepository,
  ) {
    super()
  }

  async execute(input: ActivateAccount.Input): Promise<ActivateAccount.Output> {
    const account = await this.getAccount.findById(input.id)
    if (!account) {
      throw new AccountNotFoundError(input.id)
    }
    account.activate()
    await this.updateAccount.update(account)
    return AccountUseCaseMapper.toDto(account)
  }
}
