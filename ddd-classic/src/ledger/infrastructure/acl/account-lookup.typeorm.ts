import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { AccountTypeOrmEntity } from '../../../accounts/infrastructure/typeorm/entities/account.typeorm.entity'
import type { Currency } from '../../../shared/value-objects'
import type {
  AccountLookup,
  AccountLookupStatus,
  AccountView,
} from '../../application/ports/account-lookup.port'

/**
 * Anti-corruption layer: implements the ledger's `AccountLookup` port by reading
 * the `accounts` table **read-only** and projecting to the ledger-local
 * {@link AccountView}. This is the single place where the two contexts' infra
 * touch (it imports the accounts persistence entity, never `accounts/domain`).
 * Filters soft-deleted accounts so they read as absent (→ 404). Projects
 * `status` (FEAT-007) so `PostTransactionUseCase` can reject non-`active`
 * accounts (REQ-006, ADR-0010).
 */
@Injectable()
export class AccountLookupTypeOrm implements AccountLookup {
  constructor(
    @InjectRepository(AccountTypeOrmEntity)
    private readonly accounts: Repository<AccountTypeOrmEntity>,
  ) {}

  async findById(id: string): Promise<AccountView | null> {
    const row = await this.accounts.findOne({ where: { id, deletedAt: IsNull() } })
    if (!row) return null
    return {
      id: row.id,
      currency: row.currency as Currency,
      status: row.status as AccountLookupStatus,
    }
  }
}
