import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { GetLatestBalanceSnapshotRepository } from '../../../application/ports/get-latest-balance-snapshot.repository'
import type { BalanceSnapshot } from '../../../domain/value-objects/balance-snapshot'
import { BalanceSnapshotTypeOrmEntity } from '../entities/balance-snapshot.typeorm.entity'
import { BalanceSnapshotTypeOrmMapper } from '../mappers/balance-snapshot.typeorm.mapper'

/**
 * Returns the **latest** snapshot for an account by `throughSeq DESC`
 * (FEAT-006). `throughSeq` is monotonic over the append-only trail, so it's
 * the right tiebreak — not `createdAt` (wall-clock drift would lie about
 * order).
 */
@Injectable()
export class GetLatestBalanceSnapshotTypeOrmRepository
  implements GetLatestBalanceSnapshotRepository
{
  constructor(
    @InjectRepository(BalanceSnapshotTypeOrmEntity)
    private readonly snapshots: Repository<BalanceSnapshotTypeOrmEntity>,
  ) {}

  async findLatestByAccountId(accountId: string): Promise<BalanceSnapshot | null> {
    const row = await this.snapshots.findOne({
      where: { accountId },
      order: { throughSeq: 'DESC' },
    })
    return row ? BalanceSnapshotTypeOrmMapper.toDomain(row) : null
  }
}
