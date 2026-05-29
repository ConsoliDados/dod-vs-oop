import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import type { ListPostingsRepository } from '../../../application/repositories/list-postings.repository'
import { directionOf } from '../../../domain/posting-direction'
import { PostingTypeOrmEntity } from '../entities/posting.typeorm.entity'

/**
 * Reads postings for an account with cursor pagination over `(postedAt,
 * sequence)` — the deterministic order shared by REQ-008 and ADR-0006's
 * checkpoint. Fetches `limit + 1` rows to detect whether more pages exist;
 * the (limit+1)-th row, if present, drives `nextCursor`.
 *
 * Currency is `string` in persistence; the cast is the canonical narrowing
 * at the boundary. `amountCents` is signed (credit +, debit −, ADR-0004) and
 * stored as `bigint` → surfaced as `string` by TypeORM, coerced through
 * `Number` (within JS safe-integer range for the study).
 */
@Injectable()
export class ListPostingsTypeOrmRepository implements ListPostingsRepository {
  constructor(
    @InjectRepository(PostingTypeOrmEntity)
    private readonly postings: Repository<PostingTypeOrmEntity>,
  ) {}

  async list(input: ListPostingsRepository.Input): Promise<ListPostingsRepository.Output> {
    const qb = this.postings
      .createQueryBuilder('p')
      .where('p.accountId = :accountId', { accountId: input.accountId })

    if (input.from) qb.andWhere('p.postedAt >= :from', { from: input.from })
    if (input.to) qb.andWhere('p.postedAt <= :to', { to: input.to })
    if (input.cursor) {
      qb.andWhere(
        '(p.postedAt > :cursorPostedAt OR (p.postedAt = :cursorPostedAt AND p.sequence > :cursorSequence))',
        {
          cursorPostedAt: input.cursor.postedAt,
          cursorSequence: input.cursor.sequence,
        },
      )
    }

    qb.orderBy('p.postedAt', 'ASC')
      .addOrderBy('p.sequence', 'ASC')
      .take(input.limit + 1)

    const rows = await qb.getMany()
    const hasMore = rows.length > input.limit
    const page = hasMore ? rows.slice(0, input.limit) : rows

    const items = page.map((row) => {
      const signed = Number(row.amountCents)
      return {
        accountId: row.accountId,
        transactionId: row.transactionId,
        amountCents: signed,
        direction: directionOf(signed),
        currency: row.currency as ListPostingsRepository.Output['items'][number]['currency'],
        postedAt: new Date(row.postedAt).toISOString(),
        sequence: row.sequence,
      }
    })

    const output: ListPostingsRepository.Output = { items }
    if (hasMore) {
      const last = page[page.length - 1]
      if (last) {
        output.nextCursor = {
          postedAt: new Date(last.postedAt),
          sequence: last.sequence,
        }
      }
    }
    return output
  }
}
