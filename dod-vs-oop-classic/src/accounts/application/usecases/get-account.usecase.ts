import { QueryUseCase } from '../../../core/use-cases/use-case'
import { AccountNotFoundError } from '../errors/account-not-found.error'
import { type AccountDto, AccountUseCaseMapper } from '../mappers/account.usecase.mapper'
import type { GetAccountRepository } from '../repositories/get-account.repository'

export namespace GetAccount {
  export interface Input {
    id: string
  }
  export type Output = AccountDto
}

/**
 * Reads an account by id (REQ-002); throws `AccountNotFoundError` (→ 404) when absent.
 * Framework-agnostic; NestJS wiring lives in `infrastructure/provider/usecases/`.
 */
export class GetAccountUseCase extends QueryUseCase<GetAccount.Input, GetAccount.Output> {
  constructor(private readonly getAccountRepository: GetAccountRepository) {
    super()
  }

  async execute(input: GetAccount.Input): Promise<GetAccount.Output> {
    const account = await this.getAccountRepository.findById(input.id)
    if (!account) {
      throw new AccountNotFoundError(input.id)
    }
    return AccountUseCaseMapper.toDto(account)
  }
}
