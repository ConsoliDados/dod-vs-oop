import { Column, Entity, PrimaryColumn } from 'typeorm'

/**
 * Flat persistence row for an account (ADR-0001 stack).
 *
 * Money is stored as integer minor units in `bigint` columns (ADR-0004);
 * TypeORM surfaces `bigint` as `string`, so the mapper converts. Soft delete
 * via the nullable `deletedAt` column (playbook §9).
 */
@Entity('accounts')
export class AccountTypeOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string

  @Column({ type: 'varchar' })
  ownerId!: string

  @Column({ type: 'varchar', length: 3 })
  currency!: string

  @Column({ type: 'bigint' })
  availableBalanceCents!: string

  @Column({ type: 'bigint' })
  holdAmountCents!: string

  @Column({ type: 'varchar', length: 16 })
  status!: string

  @Column({ type: 'integer' })
  version!: number

  /** Checkpoint: highest posting `sequence` folded into `availableBalanceCents` (ADR-0006). */
  @Column({ type: 'integer', default: 0 })
  lastPostedSeq!: number

  @Column({ type: 'datetime' })
  createdAt!: Date

  @Column({ type: 'datetime' })
  updatedAt!: Date

  @Column({ type: 'datetime', nullable: true })
  deletedAt!: Date | null
}
