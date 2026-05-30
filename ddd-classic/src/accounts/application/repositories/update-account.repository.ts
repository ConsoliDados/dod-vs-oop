import type { AccountAggregate } from '../../domain/entities/account.aggregate'

/**
 * Segregated repository port (playbook §5): persist balance/checkpoint changes
 * to an existing account. The implementation guards on the prior `version`
 * (optimistic lock).
 *
 * Framework-agnostic: the DI token + binding live in
 * `infrastructure/provider/repositories/` so this layer stays free of NestJS.
 */
export interface UpdateAccountRepository {
  update(input: UpdateAccountRepository.Input): Promise<void>
}

export namespace UpdateAccountRepository {
  export type Input = AccountAggregate
}
