/**
 * A posting either debits or credits an account. Per the FEAT-002 model
 * (see ADR-0006 / the feature research), a posting stores a **signed** amount:
 * **credit = positive, debit = negative**. A transaction is balanced when the
 * signed amounts sum to zero (`Σ debits == Σ credits`).
 */
export type PostingDirection = 'debit' | 'credit'

export const POSTING_DIRECTIONS: readonly PostingDirection[] = ['debit', 'credit']

/** Converts a positive magnitude + direction to signed minor units (credit +, debit −). */
export function toSignedCents(amountCents: number, direction: PostingDirection): number {
  return direction === 'credit' ? amountCents : -amountCents
}

/** Derives the direction from a signed amount (zero is treated as credit; postings are non-zero by invariant). */
export function directionOf(signedCents: number): PostingDirection {
  return signedCents >= 0 ? 'credit' : 'debit'
}
