import type { TransactionAggregate } from '../../domain/entities/transaction.aggregate'

/**
 * Segregated repository port (playbook §5): persist a transaction and its
 * postings atomically, returning the rehydrated aggregate (postings carry their
 * assigned global `sequence`). Postings are immutable — there is no update path
 * (REQ-011). Framework-agnostic: DI token + binding live in
 * `infrastructure/provider/repositories/`.
 */
export interface CreateTransactionRepository {
  insert(input: CreateTransactionRepository.Input): Promise<CreateTransactionRepository.Output>
}

export namespace CreateTransactionRepository {
  export type Input = TransactionAggregate
  export type Output = TransactionAggregate
}
