import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { OptimisticLockError } from '../../src/accounts/application/errors/optimistic-lock.error'
import type { UpdateAccountRepository } from '../../src/accounts/application/repositories/update-account.repository'
import { UPDATE_ACCOUNT_REPOSITORY } from '../../src/accounts/infrastructure/provider/repositories/update-account.provider'
import { AppModule } from '../../src/app.module'
import type { Logger } from '../../src/shared/application/logger'
import { LOGGER } from '../../src/shared/infrastructure/logger/logger.provider'

/**
 * FEAT-006 end-to-end (NestJS in-process, sqlite `:memory:`).
 *
 * Proves the consolidation slice (ADR-0006, NFR-DATA-001) end-to-end:
 *   - first consolidate appends a snapshot (even with throughSeq=0 / balance 0)
 *   - consolidating with no new postings is a no-op (no new row; returns the
 *     same `throughSeq`)
 *   - consolidating after new postings advances `throughSeq` and balance
 *   - the snapshot's balance reflects the **ledger**, not the cache —
 *     demonstrated under the FEAT-003 swallow-and-log path with a throwing
 *     update repo (cache stays at 0; snapshot matches the ledger sum)
 *   - 404 on an unknown account id
 */
describe('Consolidate balance (e2e)', () => {
  let app: INestApplication
  let server: Parameters<typeof request>[0]

  async function openAccount(ownerId: string, currency: string): Promise<string> {
    const res = await request(server).post('/accounts').send({ ownerId, currency })
    return res.body.id as string
  }

  async function postTx(from: string, to: string, amount: number) {
    return request(server)
      .post('/transactions')
      .send({
        postings: [
          { accountId: from, amount, direction: 'debit' },
          { accountId: to, amount, direction: 'credit' },
        ],
      })
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()
    app = moduleFixture.createNestApplication()
    await app.init()
    server = app.getHttpServer() as Parameters<typeof request>[0]
  })

  afterAll(async () => {
    await app.close()
  })

  it('appends a first snapshot even at honest zero (throughSeq=0, balance=0)', async () => {
    const id = await openAccount('cb-first', 'BRL')
    const res = await request(server).post(`/accounts/${id}/consolidations`)
    expect(res.status).toBe(200)
    expect(res.body.accountId).toBe(id)
    expect(res.body.balanceCents).toBe(0)
    expect(res.body.throughSeq).toBe(0)
    expect(res.body.currency).toBe('BRL')
    expect(typeof res.body.asOf).toBe('string')
  })

  it('advances throughSeq and balance after new postings', async () => {
    const from = await openAccount('cb-adv-from', 'BRL')
    const to = await openAccount('cb-adv-to', 'BRL')
    const first = await request(server).post(`/accounts/${to}/consolidations`)
    expect(first.body.throughSeq).toBe(0)
    expect(first.body.balanceCents).toBe(0)

    await postTx(from, to, 1500)

    const second = await request(server).post(`/accounts/${to}/consolidations`)
    expect(second.status).toBe(200)
    expect(second.body.balanceCents).toBe(1500)
    expect(second.body.throughSeq).toBeGreaterThan(first.body.throughSeq)
  })

  it('is a no-op when consolidated again with no new postings (same throughSeq + asOf)', async () => {
    const from = await openAccount('cb-noop-from', 'BRL')
    const to = await openAccount('cb-noop-to', 'BRL')
    await postTx(from, to, 500)

    const first = await request(server).post(`/accounts/${to}/consolidations`)
    expect(first.status).toBe(200)
    const second = await request(server).post(`/accounts/${to}/consolidations`)
    expect(second.status).toBe(200)
    // Same snapshot returned — throughSeq unchanged + asOf unchanged
    // (proves no new row was written; the prior snapshot was returned verbatim).
    expect(second.body.throughSeq).toBe(first.body.throughSeq)
    expect(second.body.asOf).toBe(first.body.asOf)
    expect(second.body.balanceCents).toBe(first.body.balanceCents)
  })

  it('returns 404 ACCOUNT_NOT_FOUND on an unknown account', async () => {
    const res = await request(server).post(`/accounts/${randomUUID()}/consolidations`)
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND')
  })
})

/**
 * FEAT-006 + NFR-DATA-001 — under the FEAT-003 swallow-and-log path, the
 * cached balance can desync (the producer wins on a failed cache write).
 * Consolidation must read the **ledger** (postings), not the cache —
 * proving the snapshot is the recovery surface ADR-0006 promises.
 */
describe('Consolidate balance reflects the LEDGER, not the cache (e2e)', () => {
  let app: INestApplication
  let server: Parameters<typeof request>[0]

  const warnings: Array<{ message: string }> = []
  const spyLogger: Logger = {
    warn: (message) => {
      warnings.push({ message })
    },
    error: () => {},
    info: () => {},
  }

  const throwingUpdate: UpdateAccountRepository = {
    update: async (account) => {
      throw new OptimisticLockError(account.getId().getValue())
    },
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UPDATE_ACCOUNT_REPOSITORY)
      .useValue(throwingUpdate)
      .overrideProvider(LOGGER)
      .useValue(spyLogger)
      .compile()
    app = moduleFixture.createNestApplication()
    await app.init()
    server = app.getHttpServer() as Parameters<typeof request>[0]
  })

  afterAll(async () => {
    await app.close()
  })

  it('snapshot.balance matches the ledger sum even when the cache stayed at 0', async () => {
    const res1 = await request(server)
      .post('/accounts')
      .send({ ownerId: 'cb-recov-from', currency: 'BRL' })
    const res2 = await request(server)
      .post('/accounts')
      .send({ ownerId: 'cb-recov-to', currency: 'BRL' })
    const from = res1.body.id as string
    const to = res2.body.id as string

    const posted = await request(server)
      .post('/transactions')
      .send({
        postings: [
          { accountId: from, amount: 700, direction: 'debit' },
          { accountId: to, amount: 700, direction: 'credit' },
        ],
      })
    expect(posted.status).toBe(201) // producer not failed
    // Cache stayed at 0 (the swallow-and-log path swallowed the throw).
    const cached = await request(server).get(`/accounts/${to}/balance`)
    expect(cached.body.availableBalance).toBe(0)
    expect(warnings.some((w) => w.message.startsWith('reflect-balance:'))).toBe(true)

    // Consolidate reads the LEDGER — snapshot.balanceCents is +700 (the
    // ledger truth), not 0 (the desynced cache).
    const consolidated = await request(server).post(`/accounts/${to}/consolidations`)
    expect(consolidated.status).toBe(200)
    expect(consolidated.body.balanceCents).toBe(700)
    expect(consolidated.body.throughSeq).toBeGreaterThan(0)
  })
})
