import { Column, Entity, PrimaryColumn } from 'typeorm'

/**
 * Persistence row for a transaction (ADR-0001 stack). Postings live in their own
 * table (`postings`) keyed by `transactionId`; the repository writes both within
 * a single DB transaction. Soft-delete column present for base-Entity parity,
 * but transactions/postings are never deleted (REQ-011) — corrections are reversals.
 */
@Entity('transactions')
export class TransactionTypeOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string

  @Column({ type: 'varchar', nullable: true })
  reference!: string | null

  @Column({ type: 'simple-json' })
  metadata!: Record<string, unknown>

  @Column({ type: 'datetime' })
  postedAt!: Date

  /**
   * One-way link to the original (FEAT-004, ADR-0011): set only when this row
   * is a reversal. The original row never gains a `reversedBy` pointer
   * (REQ-011 hard — the original is never mutated).
   */
  @Column({ type: 'varchar', length: 36, nullable: true })
  reversedTransactionId!: string | null

  @Column({ type: 'datetime' })
  createdAt!: Date

  @Column({ type: 'datetime' })
  updatedAt!: Date

  @Column({ type: 'datetime', nullable: true })
  deletedAt!: Date | null
}
