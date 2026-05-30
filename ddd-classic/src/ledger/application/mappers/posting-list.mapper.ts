import type { Currency } from '../../../shared/value-objects'
import type { PostingDirection } from '../../domain/posting-direction'

/**
 * Client-facing projection for a single posting on the list endpoint (REQ-008,
 * FEAT-005). Extends `PostingDto` with `postedAt`, `sequence`, and
 * `transactionId` — the fields a list consumer typically needs to join back to
 * the transaction and to page deterministically.
 *
 * Carried as plain data straight from the query repository — no domain →
 * projection mapper is needed (the query produces this shape directly).
 */
export interface PostingListItem {
  accountId: string
  transactionId: string
  amountCents: number
  direction: PostingDirection
  currency: Currency
  postedAt: string
  sequence: number
}
