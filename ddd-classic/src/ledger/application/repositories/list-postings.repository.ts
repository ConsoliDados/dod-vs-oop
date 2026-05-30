import type { CursorPoint } from '../cursor'
import type { PostingListItem } from '../mappers/posting-list.mapper'

/**
 * Segregated read-side query port (CQRS-flavored): list an account's postings
 * ordered by `(postedAt ASC, sequence ASC)`, filtered by an optional window
 * and paged via an opaque cursor (FEAT-005, REQ-008). Returns `nextCursor`
 * (decoded) only when more rows exist beyond `limit`.
 *
 * The cursor and window are validated by the use case; the repo trusts its
 * inputs and only translates to SQL. Framework-agnostic — DI token + binding
 * live in `infrastructure/provider/repositories/`.
 */
export interface ListPostingsRepository {
  list(input: ListPostingsRepository.Input): Promise<ListPostingsRepository.Output>
}

export namespace ListPostingsRepository {
  export interface Input {
    accountId: string
    from?: Date
    to?: Date
    limit: number
    cursor?: CursorPoint
  }
  export interface Output {
    items: PostingListItem[]
    nextCursor?: CursorPoint
  }
}
