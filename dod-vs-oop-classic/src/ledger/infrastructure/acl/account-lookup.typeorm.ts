import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import { AccountTypeOrmEntity } from '../../../accounts/infrastructure/typeorm/entities/account.typeorm.entity'
import type { Currency } from '../../../shared/value-objects'
import type { AccountLookup, AccountView } from '../../application/ports/account-lookup.port'

/**
 * Anti-corruption layer: implements the ledger's `AccountLookup` port by reading
 * the `accounts` table **read-only** and projecting to the ledger-local
 * {@link AccountView}. This is the single place where the two contexts' infra
 * touch (it imports the accounts persistence entity, never `accounts/domain`).
 * Filters soft-deleted accounts so they read as absent (→ 404).
 */
@Injectable()
export class AccountLookupTypeOrm implements AccountLookup {
  constructor(
    @InjectRepository(AccountTypeOrmEntity)
    private readonly accounts: Repository<AccountTypeOrmEntity>,
  ) {}

  async findById(id: string): Promise<AccountView | null> {
    const row = await this.accounts.findOne({ where: { id, deletedAt: IsNull() } })
    return row ? { id: row.id, currency: row.currency as Currency } : null
  }
}
