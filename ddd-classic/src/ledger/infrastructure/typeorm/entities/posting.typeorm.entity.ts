import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * Persistence row for a posting (append-only; never updated/deleted — REQ-011).
 *
 * `sequence` is a DB-generated global monotonic order — the ADR-0006 balance
 * checkpoint key (`throughSeq`) — so it is the primary key; the domain posting
 * id (uuid) is a unique column. `amountCents` is **signed** (credit +, debit −),
 * stored as `bigint` (ADR-0004; TypeORM surfaces it as a string).
 */
@Entity('postings')
export class PostingTypeOrmEntity {
  @PrimaryGeneratedColumn()
  sequence!: number

  @Column({ type: 'varchar', length: 36, unique: true })
  id!: string

  @Index()
  @Column({ type: 'varchar', length: 36 })
  transactionId!: string

  @Index()
  @Column({ type: 'varchar', length: 36 })
  accountId!: string

  @Column({ type: 'bigint' })
  amountCents!: string

  @Column({ type: 'varchar', length: 3 })
  currency!: string

  @Column({ type: 'datetime' })
  postedAt!: Date

  @Column({ type: 'datetime' })
  createdAt!: Date

  @Column({ type: 'datetime' })
  updatedAt!: Date
}
