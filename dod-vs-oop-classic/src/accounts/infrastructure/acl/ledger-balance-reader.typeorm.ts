import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { PostingTypeOrmEntity } from '../../../ledger/infrastructure/typeorm/entities/posting.typeorm.entity'
import { type Currency, Money } from '../../../shared/value-objects'
import type { LedgerBalanceReader } from '../../application/ports/ledger-balance-reader.port'

/**
 * Anti-corruption layer: implements `accounts`' `LedgerBalanceReader` port by
 * summing the ledger `postings` table read-only and returning **both** the
 * net balance and `throughSeq = max(sequence)` summed (FEAT-006 needs the
 * sequence for idempotency; FEAT-007 just destructures `.balance`). Single
 * query — single round-trip; ADR-0009 distribution seam.
 *
 * Returns `{ balance: Money.zero(currency), throughSeq: 0 }` when an account
 * has no postings yet (honest zero — no posted activity to sum).
 *
 * `amountCents` and `sequence` are integers in JS safe-integer range for the
 * study (ADR-0004 documents the forward-looking-policy if that ever changes).
 */
@Injectable()
export class LedgerBalanceReaderTypeOrm implements LedgerBalanceReader {
  constructor(
    @InjectRepository(PostingTypeOrmEntity)
    private readonly postings: Repository<PostingTypeOrmEntity>,
  ) {}

  async balanceAndThroughSeqOf(
    accountId: string,
    currency: Currency,
  ): Promise<{ balance: Money; throughSeq: number }> {
    const row = await this.postings
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amountCents), 0)', 'sum')
      .addSelect('COALESCE(MAX(p.sequence), 0)', 'throughSeq')
      .where('p.accountId = :accountId', { accountId })
      .getRawOne<{ sum: string | number | null; throughSeq: string | number | null }>()
    const sum = Number(row?.sum ?? 0)
    const throughSeq = Number(row?.throughSeq ?? 0)
    return { balance: Money.fromCents(sum, currency), throughSeq }
  }
}
