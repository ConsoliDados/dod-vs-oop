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
 * FEAT-003 desync e2e — the failure mode ADR-0003 promised to demonstrate.
 *
 * With the swallow-and-log refinement in place (handler-level try/catch + typed
 * `OptimisticLockError`), a downstream cache-update failure must NOT fail the
 * producer (`POST /transactions` still 201) — the cached `availableBalance`
 * goes stale (desynced) and a warning is logged with the `accountId`. The
 * postings remain authoritative (NFR-DATA-001) and the desync is recoverable
 * by recompute (FEAT-006 `ConsolidateAccountBalance`).
 */
describe('Reflect balance desync (e2e)', () => {
  let app: INestApplication
  let server: Parameters<typeof request>[0]

  const warnings: Array<{ message: string; context?: Record<string, unknown> }> = []
  const spyLogger: Logger = {
    warn: (message, context) => {
      warnings.push({ message, ...(context !== undefined ? { context } : {}) })
    },
    error: () => {},
    info: () => {},
  }

  const throwingUpdate: UpdateAccountRepository = {
    update: async (account) => {
      throw new OptimisticLockError(account.getId().getValue())
    },
  }

  async function openAccount(ownerId: string, currency: string): Promise<string> {
    const res = await request(server).post('/accounts').send({ ownerId, currency })
    return res.body.id as string
  }

  async function balanceOf(id: string): Promise<number> {
    const res = await request(server).get(`/accounts/${id}/balance`)
    return res.body.availableBalance as number
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

  it('POST /transactions still returns 201 when the cache update fails (producer not failed)', async () => {
    const from = await openAccount('owner-from', 'BRL')
    const to = await openAccount('owner-to', 'BRL')

    const res = await request(server)
      .post('/transactions')
      .send({
        postings: [
          { accountId: from, amount: 1000, direction: 'debit' },
          { accountId: to, amount: 1000, direction: 'credit' },
        ],
      })

    // Producer succeeds: posting persisted, transaction id returned.
    expect(res.status).toBe(201)
    expect(res.body.postings).toHaveLength(2)

    // Cached balances stay stale (desynced) — the source of truth (postings)
    // is intact and would yield {-1000, +1000} on recompute (FEAT-006).
    expect(await balanceOf(from)).toBe(0)
    expect(await balanceOf(to)).toBe(0)

    // The warning fired once per affected account, with the accountId in context.
    const reflectWarnings = warnings.filter((w) => w.message.startsWith('reflect-balance:'))
    expect(reflectWarnings.length).toBeGreaterThanOrEqual(2)
    const warnedAccountIds = new Set(
      reflectWarnings.map((w) => (w.context?.accountId as string | undefined) ?? ''),
    )
    expect(warnedAccountIds.has(from)).toBe(true)
    expect(warnedAccountIds.has(to)).toBe(true)
    // The OptimisticLockError surfaced via the logged `cause`.
    expect(
      reflectWarnings.some((w) =>
        ((w.context?.cause as string | undefined) ?? '').includes('Optimistic lock conflict'),
      ),
    ).toBe(true)
  })
})
