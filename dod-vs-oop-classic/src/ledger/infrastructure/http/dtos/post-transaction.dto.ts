import type { PostingDirection } from '../../../domain/posting-direction'

/**
 * HTTP request body for `POST /transactions` (SRS §5.2 shape). `amount` is a
 * **positive** integer in minor units (cents); the sign comes from `direction`.
 * No class-validator — the domain throws on invalid input → 422 via the filter.
 */
export interface PostTransactionPostingRequest {
  accountId: string
  amount: number
  direction: PostingDirection
}

export interface PostTransactionRequest {
  reference?: string
  metadata?: Record<string, unknown>
  postings: PostTransactionPostingRequest[]
}
