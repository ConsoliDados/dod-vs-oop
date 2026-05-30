import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import type { CreateTransactionRepository } from '../../../application/repositories/create-transaction.repository'
import type { TransactionAggregate } from '../../../domain/entities/transaction.aggregate'
import { PostingTypeOrmEntity } from '../entities/posting.typeorm.entity'
import { TransactionTypeOrmEntity } from '../entities/transaction.typeorm.entity'
import { TransactionTypeOrmMapper } from '../mappers/transaction.typeorm.mapper'

/**
 * Writes a transaction and its postings **atomically** (one DB transaction), so
 * a balanced set of postings is all-or-nothing. The saved postings carry their
 * DB-generated `sequence`, which the mapper folds back into the rehydrated
 * aggregate. No update/delete path — postings are immutable (REQ-011).
 */
@Injectable()
export class CreateTransactionTypeOrmRepository implements CreateTransactionRepository {
  constructor(private readonly dataSource: DataSource) {}

  async insert(transaction: TransactionAggregate): Promise<TransactionAggregate> {
    const { transaction: txEntity, postings } = TransactionTypeOrmMapper.toPersistence(transaction)

    const savedPostings = await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(TransactionTypeOrmEntity).save(txEntity)
      return manager.getRepository(PostingTypeOrmEntity).save(postings)
    })

    return TransactionTypeOrmMapper.toDomain(txEntity, savedPostings)
  }
}
