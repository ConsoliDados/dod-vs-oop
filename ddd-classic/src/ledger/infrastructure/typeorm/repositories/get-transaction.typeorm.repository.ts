import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import type { GetTransactionRepository } from '../../../application/repositories/get-transaction.repository'
import type { TransactionAggregate } from '../../../domain/entities/transaction.aggregate'
import { PostingTypeOrmEntity } from '../entities/posting.typeorm.entity'
import { TransactionTypeOrmEntity } from '../entities/transaction.typeorm.entity'
import { TransactionTypeOrmMapper } from '../mappers/transaction.typeorm.mapper'

/**
 * Reads a transaction by id (FEAT-004), rehydrated with its postings in
 * `sequence` order — the order each posting was assigned at insert (ADR-0006
 * checkpoint key). Filters soft-deleted transactions so they read as absent
 * (postings themselves are never deleted — REQ-011 — but the soft-delete
 * column exists on `transactions` for base-Entity parity).
 */
@Injectable()
export class GetTransactionTypeOrmRepository implements GetTransactionRepository {
  constructor(
    @InjectRepository(TransactionTypeOrmEntity)
    private readonly transactions: Repository<TransactionTypeOrmEntity>,
    @InjectRepository(PostingTypeOrmEntity)
    private readonly postings: Repository<PostingTypeOrmEntity>,
  ) {}

  async findById(id: string): Promise<TransactionAggregate | null> {
    const row = await this.transactions.findOne({ where: { id, deletedAt: IsNull() } })
    if (!row) return null
    const postingRows = await this.postings.find({
      where: { transactionId: id },
      order: { sequence: 'ASC' },
    })
    return TransactionTypeOrmMapper.toDomain(row, postingRows)
  }
}
