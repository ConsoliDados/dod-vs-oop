import { InvalidEntityError, InvalidPropertyError } from '../../../core/errors'
import { QueryUseCase } from '../../../core/use-cases/use-case'
import { type CursorPoint, decodeCursor, encodeCursor } from '../cursor'
import { TransactionAccountNotFoundError } from '../errors/transaction-account-not-found.error'
import type { PostingListItem } from '../mappers/posting-list.mapper'
import type { AccountLookup } from '../ports/account-lookup.port'
import type { ListPostingsRepository } from '../repositories/list-postings.repository'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export namespace ListPostings {
  export interface Input {
    accountId: string
    /** ISO-8601 inclusive window start. */
    from?: string
    /** ISO-8601 inclusive window end. */
    to?: string
    /** 1..200; defaults to 50. */
    limit?: number
    /** Opaque base64 cursor produced by a prior page (FEAT-005). */
    cursor?: string
  }
  export interface Output {
    items: PostingListItem[]
    /** Pass back on the next request to fetch the following page. */
    nextCursor?: string
  }
}

/**
 * Lists an account's postings ordered by `(postedAt, sequence)`, paginated by
 * opaque cursor (REQ-008, FEAT-005). Framework-agnostic (ADR-0005).
 *
 * Validation lives here (not at the HTTP boundary) so the rule is enforceable
 * from any caller:
 *   - account existence via the `AccountLookup` ACL → 404 if absent (reuses
 *     `TransactionAccountNotFoundError`, code `ACCOUNT_NOT_FOUND`)
 *   - `limit` ∈ [1, 200], defaults to 50; invalid → 422
 *   - both `from` and `to` parse as ISO-8601 if provided; `from > to` → 422
 *   - `cursor` round-trips; malformed → 422 `INVALID_CURSOR`
 *
 * Pure read — no events, no domain mutation.
 */
export class ListPostingsUseCase extends QueryUseCase<ListPostings.Input, ListPostings.Output> {
  constructor(
    private readonly accountLookup: AccountLookup,
    private readonly listPostingsRepository: ListPostingsRepository,
  ) {
    super()
  }

  async execute(input: ListPostings.Input): Promise<ListPostings.Output> {
    const limit = this.normalizeLimit(input.limit)
    const from = this.parseDate(input.from, 'from')
    const to = this.parseDate(input.to, 'to')
    if (from && to && from.getTime() > to.getTime()) {
      throw InvalidEntityError.forAggregate('PostingListQuery', [
        new InvalidPropertyError(
          'to',
          `to must be on/after from (got from=${from.toISOString()}, to=${to.toISOString()})`,
        ),
      ])
    }

    const account = await this.accountLookup.findById(input.accountId)
    if (!account) {
      throw new TransactionAccountNotFoundError(input.accountId)
    }

    const cursor: CursorPoint | undefined = input.cursor ? decodeCursor(input.cursor) : undefined

    const repoInput: ListPostingsRepository.Input = { accountId: input.accountId, limit }
    if (from) repoInput.from = from
    if (to) repoInput.to = to
    if (cursor) repoInput.cursor = cursor
    const result = await this.listPostingsRepository.list(repoInput)

    const output: ListPostings.Output = { items: result.items }
    if (result.nextCursor) output.nextCursor = encodeCursor(result.nextCursor)
    return output
  }

  private normalizeLimit(raw: number | undefined): number {
    const limit = raw ?? DEFAULT_LIMIT
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw InvalidEntityError.forAggregate('PostingListQuery', [
        new InvalidPropertyError(
          'limit',
          `limit must be an integer in [1, ${MAX_LIMIT}] (got ${raw})`,
        ),
      ])
    }
    return limit
  }

  private parseDate(raw: string | undefined, field: 'from' | 'to'): Date | undefined {
    if (raw === undefined) return undefined
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) {
      throw InvalidEntityError.forAggregate('PostingListQuery', [
        new InvalidPropertyError(field, `${field} must be ISO-8601 (got ${raw})`),
      ])
    }
    return parsed
  }
}
