import { randomUUID } from 'node:crypto'
import { type Currency, Money } from '../../../../shared/value-objects'
import { BalanceSnapshot } from '../../../domain/value-objects/balance-snapshot'
import { BalanceSnapshotTypeOrmEntity } from '../entities/balance-snapshot.typeorm.entity'

/**
 * Bidirectional static mapper between the `BalanceSnapshot` VO and its
 * persistence row (playbook §6). The VO has no `id` of its own (it's a
 * Value Object, identity-by-value) — the persistence row needs one for the
 * primary key, so the mapper mints a uuid at write time.
 */
export class BalanceSnapshotTypeOrmMapper {
  static toPersistence(snapshot: BalanceSnapshot): BalanceSnapshotTypeOrmEntity {
    const entity = new BalanceSnapshotTypeOrmEntity()
    entity.id = randomUUID()
    entity.accountId = snapshot.getAccountId()
    entity.asOf = snapshot.getAsOf()
    entity.balanceCents = String(snapshot.getBalance().getCents())
    entity.currency = snapshot.getBalance().getCurrency()
    entity.throughSeq = snapshot.getThroughSeq()
    entity.createdAt = new Date()
    return entity
  }

  static toDomain(row: BalanceSnapshotTypeOrmEntity): BalanceSnapshot {
    return BalanceSnapshot.buildExisting({
      accountId: row.accountId,
      asOf: new Date(row.asOf),
      balance: Money.fromCents(Number(row.balanceCents), row.currency as Currency),
      throughSeq: row.throughSeq,
    })
  }
}
