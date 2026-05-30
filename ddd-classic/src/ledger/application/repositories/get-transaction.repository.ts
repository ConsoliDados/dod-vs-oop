import type { TransactionAggregate } from '../../domain/entities/transaction.aggregate'

/**
 * Segregated repository port (playbook §5): read a transaction by id, rehydrated
 * with its postings in `sequence` order. Returns `null` when absent (or
 * soft-deleted, though postings are never deleted — REQ-011). Used today by
 * `ReverseTransactionUseCase` to load the original before mirroring its
 * postings (FEAT-004); framework-agnostic — DI token + binding live in
 * `infrastructure/provider/repositories/`.
 */
export interface GetTransactionRepository {
  findById(id: string): Promise<TransactionAggregate | null>
}
