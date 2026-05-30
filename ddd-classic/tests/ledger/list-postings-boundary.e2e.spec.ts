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
 * FEAT-005 boundary / negative case spec — covers paths the happy-path e2e
 * doesn't reach. Documented in `architecture/error-contracts.md` §REQ-008.
 */
describe('List postings — boundary + invalid input (e2e)', () => {
  let app: INestApplication
  let server: Parameters<typeof request>[0]

  async function openAccount(ownerId: string): Promise<string> {
    const res = await request(server).post('/accounts').send({ ownerId, currency: 'BRL' })
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

  it("from === to at a posting's postedAt is INCLUSIVE (returns the row)", async () => {
    const a = await openAccount('lp-bnd-a')
    const b = await openAccount('lp-bnd-b')
    await postTx(a, b, 100)

    // Grab the posting's exact postedAt to use as a degenerate window.
    const all = await request(server).get(`/accounts/${a}/postings`)
    const target = all.body.items[0] as PostingListItem
    expect(target).toBeDefined()

    const res = await request(server)
      .get(`/accounts/${a}/postings`)
      .query({ from: target.postedAt, to: target.postedAt })
    expect(res.status).toBe(200)
    expect((res.body.items as PostingListItem[]).map((p) => p.sequence)).toContain(target.sequence)
  })

  it('cursor pointing past the last row returns an empty page with no nextCursor', async () => {
    const a = await openAccount('lp-bnd-past-a')
    const b = await openAccount('lp-bnd-past-b')
    await postTx(a, b, 100)

    const all = await request(server).get(`/accounts/${a}/postings`)
    const last = all.body.items[all.body.items.length - 1] as PostingListItem
    expect(last).toBeDefined()
    const beyondCursor = Buffer.from(`${last.postedAt}|${last.sequence + 10_000}`, 'utf8').toString(
      'base64',
    )

    const res = await request(server).get(`/accounts/${a}/postings`).query({ cursor: beyondCursor })
    expect(res.status).toBe(200)
    expect(res.body.items).toEqual([])
    expect(res.body.nextCursor).toBeUndefined()
  })

  it('invalid ISO-8601 from is rejected with 422 VALIDATION_ERROR', async () => {
    const a = await openAccount('lp-bnd-bad-from')
    const res = await request(server).get(`/accounts/${a}/postings`).query({ from: 'not-a-date' })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('invalid ISO-8601 to is rejected with 422 VALIDATION_ERROR', async () => {
    const a = await openAccount('lp-bnd-bad-to')
    const res = await request(server).get(`/accounts/${a}/postings`).query({ to: 'bogus' })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('VALIDATION_ERROR')
  })

  it('limit at the upper boundary (200) is accepted', async () => {
    const a = await openAccount('lp-bnd-max-limit')
    const res = await request(server).get(`/accounts/${a}/postings`).query({ limit: 200 })
    expect(res.status).toBe(200)
  })

  it('limit at the lower boundary (1) is accepted', async () => {
    const a = await openAccount('lp-bnd-min-limit')
    const b = await openAccount('lp-bnd-min-limit-b')
    await postTx(a, b, 50)
    await postTx(a, b, 60)

    const res = await request(server).get(`/accounts/${a}/postings`).query({ limit: 1 })
    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(1)
    expect(typeof res.body.nextCursor).toBe('string')
  })

  it('limit must be an integer — fractional limit is rejected with 422', async () => {
    const a = await openAccount('lp-bnd-frac-limit')
    const res = await request(server).get(`/accounts/${a}/postings`).query({ limit: 1.5 })
    expect(res.status).toBe(422)
  })

  it('a well-formed cursor for a non-existent past point yields the next page from there', async () => {
    // Cursor with postedAt before any posting + sequence 0 → returns everything.
    const a = await openAccount('lp-bnd-pre-a')
    const b = await openAccount('lp-bnd-pre-b')
    await postTx(a, b, 100)
    await postTx(a, b, 200)

    const preCursor = Buffer.from('2020-01-01T00:00:00.000Z|0', 'utf8').toString('base64')
    const res = await request(server).get(`/accounts/${a}/postings`).query({ cursor: preCursor })
    expect(res.status).toBe(200)
    expect(res.body.items.length).toBeGreaterThanOrEqual(2)
  })
})
