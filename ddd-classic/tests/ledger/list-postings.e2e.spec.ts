import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'
import { Test, type TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../../src/app.module'

interface PostingListItem {
  accountId: string
  transactionId: string
  amountCents: number
  direction: 'debit' | 'credit'
  currency: string
  postedAt: string
  sequence: number
}

/**
 * FEAT-005 end-to-end (NestJS in-process, sqlite `:memory:`).
 *
 * Proves `GET /accounts/:id/postings` (REQ-008) end-to-end: ordering by
 * `(postedAt, sequence)`, optional window filtering, cursor pagination,
 * absent-account 404, and validation 422s. Postings are immutable
 * (REQ-011); this is a pure read path with no events.
 */
describe('List postings (e2e)', () => {
  let app: INestApplication
  let server: Parameters<typeof request>[0]

  async function openAccount(ownerId: string, currency: string): Promise<string> {
    const res = await request(server).post('/accounts').send({ ownerId, currency })
    return res.body.id as string
  }

  async function postTx(from: string, to: string, amount: number, reference?: string) {
    return request(server)
      .post('/transactions')
      .send({
        ...(reference ? { reference } : {}),
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

  it('returns an empty list for an account with no postings', async () => {
    const id = await openAccount('lp-empty', 'BRL')
    const res = await request(server).get(`/accounts/${id}/postings`)
    expect(res.status).toBe(200)
    expect(res.body.items).toEqual([])
    expect(res.body.nextCursor).toBeUndefined()
  })

  it('lists postings ordered by (postedAt, sequence) asc', async () => {
    const a = await openAccount('lp-order-a', 'BRL')
    const b = await openAccount('lp-order-b', 'BRL')

    for (const amount of [100, 200, 300]) {
      const tx = await postTx(a, b, amount)
      expect(tx.status).toBe(201)
    }

    const res = await request(server).get(`/accounts/${a}/postings`)
    expect(res.status).toBe(200)
    const items: PostingListItem[] = res.body.items
    expect(items).toHaveLength(3)
    // Account a was debited in each → negative signed cents.
    expect(items.map((p) => p.amountCents)).toEqual([-100, -200, -300])
    expect(items.map((p) => p.direction)).toEqual(['debit', 'debit', 'debit'])
    // Deterministic order: sequences are strictly increasing.
    expect(items[0]!.sequence).toBeLessThan(items[1]!.sequence)
    expect(items[1]!.sequence).toBeLessThan(items[2]!.sequence)
    // Carries transactionId for client-side join.
    expect(items[0]!.transactionId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('filters by inclusive [from, to] window', async () => {
    const a = await openAccount('lp-window-a', 'BRL')
    const b = await openAccount('lp-window-b', 'BRL')
    await postTx(a, b, 10)
    await postTx(a, b, 20)
    await postTx(a, b, 30)

    const all = await request(server).get(`/accounts/${a}/postings`)
    const middle = all.body.items[1] as PostingListItem
    expect(middle).toBeDefined()
    // Pick a 1-ms window around the middle posting — yields exactly 1 row.
    const from = middle.postedAt
    const to = middle.postedAt
    const res = await request(server).get(`/accounts/${a}/postings`).query({ from, to })
    expect(res.status).toBe(200)
    const items: PostingListItem[] = res.body.items
    expect(items.length).toBeGreaterThanOrEqual(1)
    // Every returned row is within the window.
    for (const p of items) {
      expect(new Date(p.postedAt).getTime()).toBeGreaterThanOrEqual(new Date(from).getTime())
      expect(new Date(p.postedAt).getTime()).toBeLessThanOrEqual(new Date(to).getTime())
    }
  })

  it('paginates with limit + cursor; nextCursor only when more pages exist', async () => {
    const a = await openAccount('lp-page-a', 'BRL')
    const b = await openAccount('lp-page-b', 'BRL')
    for (const amount of [11, 12, 13, 14, 15]) {
      await postTx(a, b, amount)
    }

    const page1 = await request(server).get(`/accounts/${a}/postings`).query({ limit: 2 })
    expect(page1.status).toBe(200)
    expect(page1.body.items).toHaveLength(2)
    expect(typeof page1.body.nextCursor).toBe('string')

    const page2 = await request(server)
      .get(`/accounts/${a}/postings`)
      .query({ limit: 2, cursor: page1.body.nextCursor })
    expect(page2.status).toBe(200)
    expect(page2.body.items).toHaveLength(2)
    expect(typeof page2.body.nextCursor).toBe('string')

    const page3 = await request(server)
      .get(`/accounts/${a}/postings`)
      .query({ limit: 2, cursor: page2.body.nextCursor })
    expect(page3.status).toBe(200)
    expect(page3.body.items).toHaveLength(1) // 5 total - 4 fetched
    expect(page3.body.nextCursor).toBeUndefined()

    // Sequences across pages: strictly monotonic; no overlap.
    const sequences = [
      ...page1.body.items.map((p: PostingListItem) => p.sequence),
      ...page2.body.items.map((p: PostingListItem) => p.sequence),
      ...page3.body.items.map((p: PostingListItem) => p.sequence),
    ]
    for (let i = 1; i < sequences.length; i++) {
      const current = sequences[i]
      const previous = sequences[i - 1]
      if (current === undefined || previous === undefined) throw new Error('unreachable')
      expect(current).toBeGreaterThan(previous)
    }
    expect(new Set(sequences).size).toBe(sequences.length)
  })

  it('returns 404 ACCOUNT_NOT_FOUND for an unknown account id', async () => {
    const res = await request(server).get(`/accounts/${randomUUID()}/postings`)
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND')
  })

  it('rejects limit=0 and limit>200 with 422', async () => {
    const id = await openAccount('lp-bad-limit', 'BRL')
    const zero = await request(server).get(`/accounts/${id}/postings`).query({ limit: 0 })
    expect(zero.status).toBe(422)
    const huge = await request(server).get(`/accounts/${id}/postings`).query({ limit: 999 })
    expect(huge.status).toBe(422)
  })

  it('rejects from > to with 422', async () => {
    const id = await openAccount('lp-bad-window', 'BRL')
    const res = await request(server)
      .get(`/accounts/${id}/postings`)
      .query({ from: '2030-01-01T00:00:00.000Z', to: '2020-01-01T00:00:00.000Z' })
    expect(res.status).toBe(422)
  })

  it('rejects a malformed cursor with 422 INVALID_CURSOR', async () => {
    const id = await openAccount('lp-bad-cursor', 'BRL')
    const res = await request(server)
      .get(`/accounts/${id}/postings`)
      .query({ cursor: 'not-base64-!' })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('INVALID_CURSOR')
  })
})
