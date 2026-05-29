import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { AppendBalanceSnapshotRepository } from '../../../application/ports/append-balance-snapshot.repository'
import type { BalanceSnapshot } from '../../../domain/value-objects/balance-snapshot'
import { BalanceSnapshotTypeOrmEntity } from '../entities/balance-snapshot.typeorm.entity'
import { BalanceSnapshotTypeOrmMapper } from '../mappers/balance-snapshot.typeorm.mapper'

/**
 * Append-only insert of a `BalanceSnapshot` row (FEAT-006). Trusts the
 * service to have enforced idempotency — the repo writes unconditionally.
 */
@Injectable()
export class AppendBalanceSnapshotTypeOrmRepository implements AppendBalanceSnapshotRepository {
  constructor(
    @InjectRepository(BalanceSnapshotTypeOrmEntity)
    private readonly snapshots: Repository<BalanceSnapshotTypeOrmEntity>,
  ) {}

  async append(snapshot: BalanceSnapshot): Promise<void> {
    const row = BalanceSnapshotTypeOrmMapper.toPersistence(snapshot)
    await this.snapshots.insert(row)
  }
}
