/**
 * Lifecycle status of an account.
 *
 * Only `active` is produced in FEAT-001 (open-account). `frozen` / `closed`
 * transitions belong to a later accounts-deepening epic; the field exists now
 * so the persistence shape and validator are stable.
 */
export type AccountStatus = 'active' | 'frozen' | 'closed'

export const ACCOUNT_STATUSES: readonly AccountStatus[] = ['active', 'frozen', 'closed']
