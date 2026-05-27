import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { UpdateAccountRepository } from '../../../application/repositories/update-account.repository'
import type { AccountAggregate } from '../../../domain/entities/account.aggregate'
import { AccountTypeOrmEntity } from '../entities/account.typeorm.entity'
import { AccountTypeOrmMapper } from '../mappers/account.typeorm.mapper'

/**
 * Persists balance/checkpoint changes to an existing account, guarded by the
 * prior `version` (optimistic lock). The aggregate already bumped `version` in
 * `reflectPosting`, so the guard matches `version - 1`. A stale write (no row
 * affected) throws — the cache desync is recoverable by recompute (ADR-0003,
 * NFR-DATA-001).
 */
@Injectable()
export class UpdateAccountTypeOrmRepository implements UpdateAccountRepository {
  constructor(
    @InjectRepository(AccountTypeOrmEntity)
    private readonly repository: Repository<AccountTypeOrmEntity>,
  ) {}

  async update(account: AccountAggregate): Promise<void> {
    const entity = AccountTypeOrmMapper.toPersistence(account)
    const result = await this.repository.update(
      { id: entity.id, version: account.getVersion() - 1 },
      {
        availableBalanceCents: entity.availableBalanceCents,
        holdAmountCents: entity.holdAmountCents,
        status: entity.status,
        version: entity.version,
        lastPostedSeq: entity.lastPostedSeq,
        updatedAt: entity.updatedAt,
      },
    )
    if (!result.affected) {
      throw new Error(`Optimistic lock conflict updating account ${entity.id}`)
    }
  }
}
