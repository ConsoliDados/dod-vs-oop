import { Column, Entity, Index, PrimaryColumn } from 'typeorm'

/**
 * Persistence row for an account's consolidated balance snapshot (FEAT-006,
 * ADR-0006). **Append-only by design** — no `updatedAt`, no `deletedAt`, no
 * `version`. Idempotency is enforced by `ConsolidateAccountBalance` (the
 * domain service), not a DB unique constraint, so a retry races a no-op
 * rather than a constraint violation.
 *
 * `balanceCents` is signed integer minor units (ADR-0004; TypeORM surfaces
 * `bigint` as string, mapper coerces). The `(accountId, throughSeq)` index
 * supports "latest by accountId" via `ORDER BY throughSeq DESC LIMIT 1`.
 */
@Entity('balance_snapshots')
@Index(['accountId', 'throughSeq'])
export class BalanceSnapshotTypeOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string

  @Column({ type: 'varchar', length: 36 })
  accountId!: string

  @Column({ type: 'datetime' })
  asOf!: Date

  @Column({ type: 'bigint' })
  balanceCents!: string

  @Column({ type: 'varchar', length: 3 })
  currency!: string

  @Column({ type: 'integer' })
  throughSeq!: number

  @Column({ type: 'datetime' })
  createdAt!: Date
}
