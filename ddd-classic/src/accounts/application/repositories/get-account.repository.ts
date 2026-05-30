import type { AccountAggregate } from '../../domain/entities/account.aggregate'

/**
 * Segregated repository port (playbook §5): fetch one account by id.
 * Returns `null` when absent or soft-deleted (REQ-002 → 404).
 *
 * Framework-agnostic: the DI token + binding live in
 * `infrastructure/provider/repositories/` so this layer stays free of NestJS.
 */
export interface GetAccountRepository {
  findById(id: GetAccountRepository.Input): Promise<GetAccountRepository.Output>
}

export namespace GetAccountRepository {
  export type Input = string
  export type Output = AccountAggregate | null
}
