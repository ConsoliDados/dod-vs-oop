import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PostingTypeOrmEntity } from '../../../ledger/infrastructure/typeorm/entities/posting.typeorm.entity'
import { type Currency, Money } from '../../../shared/value-objects'
import type { LedgerBalanceReader } from '../../application/ports/ledger-balance-reader.port'

/**
 * Anti-corruption layer: implements `accounts`' `LedgerBalanceReader` port by
 * summing the ledger `postings` table read-only — the reverse direction of
 * FEAT-002's `AccountLookup`. **Single place** `accounts` infra touches
 * ledger persistence (ADR-0009 distribution seam).
 *
 * Returns `Money.zero(currency)` when an account has no postings yet (the
 * recomputed balance is honestly zero — there's no posted activity to sum).
 * Signed cents per posting (credit +, debit −, ADR-0004) → the SUM yields the
 * net signed balance directly.
 *
 * Stored as `bigint` in sqlite via TypeORM, surfaced as string; we coerce
 * back through `Number` here because the ledger keeps cents in JS safe-integer
 * range for the study (no high-precision wrapper — ADR-0004 documents the
 * forward-looking-policy if we ever cross that threshold).
 */
@Injectable()
export class LedgerBalanceReaderTypeOrm implements LedgerBalanceReader {
  constructor(
    @InjectRepository(PostingTypeOrmEntity)
    private readonly postings: Repository<PostingTypeOrmEntity>,
  ) {}

  async balanceOf(accountId: string, currency: Currency): Promise<Money> {
    const row = await this.postings
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amountCents), 0)', 'sum')
      .where('p.accountId = :accountId', { accountId })
      .getRawOne<{ sum: string | number | null }>()
    const sum = Number(row?.sum ?? 0)
    return Money.fromCents(sum, currency)
  }
}
