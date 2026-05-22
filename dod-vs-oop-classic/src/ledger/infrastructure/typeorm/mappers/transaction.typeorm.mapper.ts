import type { Currency } from '../../../../shared/value-objects'
import { TransactionAggregate } from '../../../domain/entities/transaction.aggregate'
import { PostingTypeOrmEntity } from '../entities/posting.typeorm.entity'
import { TransactionTypeOrmEntity } from '../entities/transaction.typeorm.entity'

/** Bidirectional static mapper between the transaction aggregate and its persistence rows (playbook §6). */
export class TransactionTypeOrmMapper {
  static toPersistence(transaction: TransactionAggregate): {
    transaction: TransactionTypeOrmEntity
    postings: PostingTypeOrmEntity[]
  } {
    const entity = new TransactionTypeOrmEntity()
    entity.id = transaction.getId().getValue()
    entity.reference = transaction.getReference() ?? null
    entity.metadata = transaction.getMetadata()
    entity.postedAt = transaction.getPostedAt()
    entity.createdAt = transaction.getCreatedAt()
    entity.updatedAt = transaction.getUpdatedAt()
    entity.deletedAt = transaction.getDeletedAt() ?? null

    const postings = transaction.getPostings().map((posting) => {
      const row = new PostingTypeOrmEntity()
      row.id = posting.getId().getValue()
      row.transactionId = transaction.getId().getValue()
      row.accountId = posting.getAccountId().getValue()
      row.amountCents = String(posting.getSignedCents())
      row.currency = posting.getAmount().getCurrency()
      row.postedAt = posting.getPostedAt()
      row.createdAt = posting.getCreatedAt()
      row.updatedAt = posting.getUpdatedAt()
      // `sequence` is DB-generated on insert; left unset here.
      return row
    })

    return { transaction: entity, postings }
  }

  static toDomain(
    transaction: TransactionTypeOrmEntity,
    postings: PostingTypeOrmEntity[],
  ): TransactionAggregate {
    return TransactionAggregate.buildExisting({
      id: transaction.id,
      reference: transaction.reference ?? undefined,
      metadata: transaction.metadata ?? {},
      postedAt: new Date(transaction.postedAt),
      createdAt: new Date(transaction.createdAt),
      updatedAt: new Date(transaction.updatedAt),
      deletedAt: transaction.deletedAt ? new Date(transaction.deletedAt) : undefined,
      postings: postings.map((row) => ({
        id: row.id,
        accountId: row.accountId,
        amountCents: Number(row.amountCents),
        currency: row.currency as Currency,
        postedAt: new Date(row.postedAt),
        sequence: Number(row.sequence),
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      })),
    })
  }
}
