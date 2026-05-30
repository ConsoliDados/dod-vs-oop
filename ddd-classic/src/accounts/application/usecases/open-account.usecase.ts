import { CommandUseCase } from '../../../core/use-cases/use-case'
import type { EventBus } from '../../../shared/application/event-bus'
import type { Currency } from '../../../shared/value-objects'
import { AccountAggregate } from '../../domain/entities/account.aggregate'
import { type AccountDto, AccountUseCaseMapper } from '../mappers/account.usecase.mapper'
import type { CreateAccountRepository } from '../repositories/create-account.repository'

export namespace OpenAccount {
  export interface Input {
    ownerId: string
    currency: Currency
  }
  export type Output = AccountDto
}

/**
 * Opens a single-currency account (REQ-001).
 *
 * Framework-agnostic: a plain class taking its dependencies (a repository port
 * and the `EventBus` port) as constructor arguments. NestJS wiring lives in
 * `infrastructure/provider/usecases/`.
 *
 * Orchestration: build the aggregate (validator throws on invalid input,
 * ADR-0002) → persist via the segregated repository → publish the
 * `AccountOpened` event on the synchronous in-memory bus (ADR-0003) → return DTO.
 */
export class OpenAccountUseCase extends CommandUseCase<OpenAccount.Input, OpenAccount.Output> {
  constructor(
    private readonly createAccountRepository: CreateAccountRepository,
    private readonly eventBus: EventBus,
  ) {
    super()
  }

  async execute(input: OpenAccount.Input): Promise<OpenAccount.Output> {
    const account = AccountAggregate.create(input.ownerId, input.currency)
    const persisted = await this.createAccountRepository.insert(account)
    // Events live on the in-memory instance built by `create`; the repository
    // round-trips through persistence and returns a freshly rehydrated
    // aggregate (via `buildExisting`) that carries no events.
    await this.eventBus.publishAll(account.pullDomainEvents())
    return AccountUseCaseMapper.toDto(persisted)
  }
}
