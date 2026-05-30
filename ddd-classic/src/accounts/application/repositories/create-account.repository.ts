import type { AccountAggregate } from '../../domain/entities/account.aggregate'

/**
 * Segregated repository port (playbook §5): one interface per operation.
 * Persists a new account and returns the rehydrated aggregate.
 *
 * Framework-agnostic: the DI token + binding live in
 * `infrastructure/provider/repositories/` so this layer stays free of NestJS.
 */
export interface CreateAccountRepository {
  insert(input: CreateAccountRepository.Input): Promise<CreateAccountRepository.Output>
}

export namespace CreateAccountRepository {
  export type Input = AccountAggregate
  export type Output = AccountAggregate
}
