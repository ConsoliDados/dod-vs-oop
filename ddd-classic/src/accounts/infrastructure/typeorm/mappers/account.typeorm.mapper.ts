import type { Currency } from '../../../../shared/value-objects'
import type { AccountStatus } from '../../../domain/account-status'
import { AccountAggregate } from '../../../domain/entities/account.aggregate'
import { AccountTypeOrmEntity } from '../entities/account.typeorm.entity'

/** Bidirectional static mapper between the account aggregate and its persistence row (playbook §6). */
export class AccountTypeOrmMapper {
  static toPersistence(account: AccountAggregate): AccountTypeOrmEntity {
    const entity = new AccountTypeOrmEntity()
    entity.id = account.getId().getValue()
    entity.ownerId = account.getOwnerId()
    entity.currency = account.getCurrency()
    entity.availableBalanceCents = String(account.getAvailableBalance().getCents())
    entity.holdAmountCents = String(account.getHoldAmount().getCents())
    entity.status = account.getStatus()
    entity.version = account.getVersion()
    entity.lastPostedSeq = account.getLastPostedSeq()
    entity.createdAt = account.getCreatedAt()
    entity.updatedAt = account.getUpdatedAt()
    entity.deletedAt = account.getDeletedAt() ?? null
    return entity
  }

  static toDomain(entity: AccountTypeOrmEntity): AccountAggregate {
    return AccountAggregate.buildExisting({
      id: entity.id,
      ownerId: entity.ownerId,
      currency: entity.currency as Currency,
      status: entity.status as AccountStatus,
      availableBalanceCents: Number(entity.availableBalanceCents),
      holdAmountCents: Number(entity.holdAmountCents),
      version: Number(entity.version),
      lastPostedSeq: Number(entity.lastPostedSeq),
      // Coerce to Date defensively: the sqlite `datetime` driver may hydrate
      // these as strings, which the throw-based validator would reject.
      createdAt: new Date(entity.createdAt),
      updatedAt: new Date(entity.updatedAt),
      deletedAt: entity.deletedAt ? new Date(entity.deletedAt) : undefined,
    })
  }
}
