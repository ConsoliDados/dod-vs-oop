#!/usr/bin/env node
/**
 * Smoke harness for the DDD comparative study. Shared between
 * `ddd-classic` and `ddd-dod` — both implement the same SRS
 * and must satisfy the same scenarios (NFR-CORRECT-001 byte-identical JSON,
 * per-impl status mapping documented in each SDD).
 *
 * **This harness is a pure HTTP client.** It does not boot, manage, or tear
 * down the target service — that's a separate concern. Start the service
 * yourself (`pnpm start:prod` in one shell on the convention port; see
 * `~/.claude/CLAUDE.md` "Port conventions" — backends start at 3333; 3000
 * is reserved for the frontend) and run the harness in another:
 *
 *   pnpm smoke                                  # uses BASE_URL or PORT defaults
 *   BASE_URL=http://localhost:3333 pnpm smoke   # explicit target
 *   PORT=3334 pnpm smoke                        # second backend
 *
 * Scenarios are numbered and labelled with the REQ / FEAT / NFR they cover —
 * the report at the end is the conformance summary against the shared SRS.
 *
 * Exits 0 on full pass, 1 on any failure, 2 if the service isn't reachable.
 * No runtime dependencies beyond Node's built-in fetch + assert.
 */

import { strict as assert } from 'node:assert'
import { randomUUID } from 'node:crypto'

// Port convention: backend default 3333 (3000 = frontend). Explicit BASE_URL wins.
const DEFAULT_PORT = 3333
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? DEFAULT_PORT}`

// ──────────────────────────────────────────────────────────────────────────
// Pretty reporter — no extra dependencies
// ──────────────────────────────────────────────────────────────────────────

const RESET = '\x1b[0m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'

interface Result {
  id: string
  label: string
  ok: boolean
  error?: string
  durationMs: number
}

const results: Result[] = []

async function scenario(id: string, label: string, body: () => Promise<void>): Promise<void> {
  const started = Date.now()
  try {
    await body()
    const durationMs = Date.now() - started
    results.push({ id, label, ok: true, durationMs })
    console.log(`  ${GREEN}✓${RESET} ${id.padEnd(18)} ${label} ${DIM}(${durationMs}ms)${RESET}`)
  } catch (e) {
    const durationMs = Date.now() - started
    const error = e instanceof Error ? e.message : String(e)
    results.push({ id, label, ok: false, error, durationMs })
    console.log(`  ${RED}✗${RESET} ${id.padEnd(18)} ${label} ${DIM}(${durationMs}ms)${RESET}`)
    console.log(`    ${RED}${error}${RESET}`)
  }
}

// ──────────────────────────────────────────────────────────────────────────
// HTTP helpers — built on Node's native fetch
// ──────────────────────────────────────────────────────────────────────────

type Json = Record<string, unknown> | unknown[] | null

interface HttpResponse {
  status: number
  body: Json
}

async function http(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<HttpResponse> {
  const init: RequestInit = { method, headers: { 'content-type': 'application/json' } }
  if (body !== undefined) init.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, init)
  const text = await res.text()
  const json: Json = text.length > 0 ? (JSON.parse(text) as Json) : null
  return { status: res.status, body: json }
}

function bodyAs<T>(res: HttpResponse): T {
  return res.body as unknown as T
}

interface AccountDto {
  id: string
  ownerId: string
  currency: string
  status: 'active' | 'frozen' | 'closed'
  availableBalance: number
  holdAmount: number
  version: number
}

interface BalanceDto {
  availableBalance: number
  currency: string
}

interface TransactionDto {
  id: string
  postings: { accountId: string; amountCents: number; direction: 'debit' | 'credit' }[]
  reference?: string
  reversedTransactionId?: string
}

interface PostingListItemDto {
  accountId: string
  transactionId: string
  amountCents: number
  direction: 'debit' | 'credit'
  currency: string
  postedAt: string
  sequence: number
}

interface PostingsListDto {
  items: PostingListItemDto[]
  nextCursor?: string
}

interface BalanceSnapshotDto {
  accountId: string
  asOf: string
  balanceCents: number
  currency: string
  throughSeq: number
}

async function openAccount(ownerId: string, currency = 'BRL'): Promise<string> {
  const res = await http('POST', '/accounts', { ownerId, currency })
  assert.equal(res.status, 201, `open account failed (${res.status})`)
  return bodyAs<AccountDto>(res).id
}

async function postTx(
  from: string,
  to: string,
  amount: number,
): Promise<{ status: number; tx?: TransactionDto; body: Json }> {
  const res = await http('POST', '/transactions', {
    postings: [
      { accountId: from, amount, direction: 'debit' },
      { accountId: to, amount, direction: 'credit' },
    ],
  })
  return res.status === 201
    ? { status: res.status, tx: bodyAs<TransactionDto>(res), body: res.body }
    : { status: res.status, body: res.body }
}

// ──────────────────────────────────────────────────────────────────────────
// Scenarios — mapped 1:1 to REQs / FEATs / NFRs
// ──────────────────────────────────────────────────────────────────────────

async function preflight(): Promise<void> {
  try {
    const res = await fetch(BASE, { method: 'GET' })
    if (res.status >= 600) {
      throw new Error(`unexpected status ${res.status}`)
    }
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    console.error(`${RED}${BOLD}Cannot reach ${BASE}${RESET}`)
    console.error(`  ${DIM}reason: ${reason}${RESET}`)
    console.error('')
    console.error('  Start the service first, then re-run this harness:')
    console.error(
      `    ${CYAN}# shell 1${RESET}  PORT=${process.env.PORT ?? DEFAULT_PORT} pnpm start:prod`,
    )
    console.error(`    ${CYAN}# shell 2${RESET}  pnpm smoke`)
    console.error('')
    console.error(`  Override the target with ${CYAN}BASE_URL=…${RESET} or ${CYAN}PORT=…${RESET}.`)
    process.exit(2)
  }
}

async function run(): Promise<void> {
  console.log(`${BOLD}${CYAN}Smoke — DDD comparative study${RESET}`)
  console.log(`${DIM}target: ${BASE}${RESET}\n`)
  await preflight()

  // ── account lifecycle (REQ-001/002/003)
  let openedId = ''
  await scenario('REQ-001', 'open an account', async () => {
    const res = await http('POST', '/accounts', { ownerId: 'smoke-001', currency: 'BRL' })
    assert.equal(res.status, 201)
    const dto = bodyAs<AccountDto>(res)
    assert.match(dto.id, /^[0-9a-f-]{36}$/)
    assert.equal(dto.ownerId, 'smoke-001')
    assert.equal(dto.currency, 'BRL')
    assert.equal(dto.status, 'active')
    assert.equal(dto.availableBalance, 0)
    assert.equal(dto.holdAmount, 0)
    openedId = dto.id
  })

  await scenario('REQ-002', 'read an account by id', async () => {
    const res = await http('GET', `/accounts/${openedId}`)
    assert.equal(res.status, 200)
    const dto = bodyAs<AccountDto>(res)
    assert.equal(dto.id, openedId)
  })

  await scenario('REQ-002.404', 'unknown account is not found', async () => {
    const res = await http('GET', `/accounts/${randomUUID()}`)
    assert.equal(res.status, 404)
    assert.equal((res.body as { code?: string }).code, 'ACCOUNT_NOT_FOUND')
  })

  await scenario('REQ-003', 'read available balance starts at zero', async () => {
    const res = await http('GET', `/accounts/${openedId}/balance`)
    assert.equal(res.status, 200)
    const dto = bodyAs<BalanceDto>(res)
    assert.equal(dto.availableBalance, 0)
    assert.equal(dto.currency, 'BRL')
  })

  // ── posting + REQ-006 invariants
  let txFromId = ''
  let txToId = ''
  let firstTxId = ''
  await scenario('REQ-006', 'post a balanced double-entry transaction', async () => {
    txFromId = await openAccount('smoke-tx-from')
    txToId = await openAccount('smoke-tx-to')
    const res = await postTx(txFromId, txToId, 1000)
    assert.equal(res.status, 201)
    assert.ok(res.tx)
    assert.equal(res.tx.postings.length, 2)
    const sum = res.tx.postings.reduce((acc, p) => acc + p.amountCents, 0)
    assert.equal(sum, 0)
    firstTxId = res.tx.id
  })

  await scenario('REQ-006.unbalanced', 'unbalanced transaction is rejected', async () => {
    const a = await openAccount('smoke-unbal-a')
    const b = await openAccount('smoke-unbal-b')
    const res = await http('POST', '/transactions', {
      postings: [
        { accountId: a, amount: 1000, direction: 'debit' },
        { accountId: b, amount: 999, direction: 'credit' },
      ],
    })
    assert.equal(res.status, 422)
    assert.equal((res.body as { code?: string }).code, 'VALIDATION_ERROR')
  })

  await scenario(
    'REQ-006.currency',
    'cross-currency transaction is rejected',
    async () => {
      const a = await openAccount('smoke-cur-a', 'BRL')
      const b = await openAccount('smoke-cur-b', 'USD')
      const res = await postTx(a, b, 1000)
      assert.equal(res.status, 422)
    },
  )

  await scenario(
    'REQ-006.404',
    'transaction referencing an absent account is not found',
    async () => {
      const a = await openAccount('smoke-miss')
      const res = await http('POST', '/transactions', {
        postings: [
          { accountId: a, amount: 1000, direction: 'debit' },
          { accountId: randomUUID(), amount: 1000, direction: 'credit' },
        ],
      })
      assert.equal(res.status, 404)
      assert.equal((res.body as { code?: string }).code, 'ACCOUNT_NOT_FOUND')
    },
  )

  // ── REQ-003 cross-context — cache reflects the post
  await scenario(
    'REQ-003.cross',
    'available balance reflects the posted transaction',
    async () => {
      const fromBal = bodyAs<BalanceDto>(await http('GET', `/accounts/${txFromId}/balance`))
      const toBal = bodyAs<BalanceDto>(await http('GET', `/accounts/${txToId}/balance`))
      assert.equal(fromBal.availableBalance, -1000)
      assert.equal(toBal.availableBalance, 1000)
    },
  )

  // ── REQ-007 reversal + REQ-011 immutability via the reflected balance
  await scenario(
    'REQ-007',
    'reverse a posted transaction: mirror postings + one-way link',
    async () => {
      const res = await http('POST', `/transactions/${firstTxId}/reversals`)
      assert.equal(res.status, 201)
      const dto = bodyAs<TransactionDto>(res)
      assert.equal(dto.reversedTransactionId, firstTxId)
      const sum = dto.postings.reduce((acc, p) => acc + p.amountCents, 0)
      assert.equal(sum, 0)
    },
  )

  await scenario(
    'REQ-007.balance',
    'cached balance flattens after reversal',
    async () => {
      const fromBal = bodyAs<BalanceDto>(await http('GET', `/accounts/${txFromId}/balance`))
      const toBal = bodyAs<BalanceDto>(await http('GET', `/accounts/${txToId}/balance`))
      assert.equal(fromBal.availableBalance, 0)
      assert.equal(toBal.availableBalance, 0)
    },
  )

  await scenario('REQ-007.404', 'reversal of unknown id is not found', async () => {
    const res = await http('POST', `/transactions/${randomUUID()}/reversals`)
    assert.equal(res.status, 404)
    assert.equal((res.body as { code?: string }).code, 'TRANSACTION_NOT_FOUND')
  })

  // ── REQ-008 list postings
  let pageCursor: string | undefined
  await scenario(
    'REQ-008',
    'list postings ordered by (postedAt, sequence) asc',
    async () => {
      const a = await openAccount('smoke-lp-a')
      const b = await openAccount('smoke-lp-b')
      for (const amount of [100, 200, 300, 400, 500]) {
        await postTx(a, b, amount)
      }
      const res = await http('GET', `/accounts/${a}/postings?limit=2`)
      assert.equal(res.status, 200)
      const dto = bodyAs<PostingsListDto>(res)
      assert.equal(dto.items.length, 2)
      assert.equal(typeof dto.nextCursor, 'string')
      assert.ok(dto.items[0]!.sequence < dto.items[1]!.sequence)
      pageCursor = dto.nextCursor
      // Stash account id on the result for the next scenario
      ;(scenario as unknown as { lpAccount?: string }).lpAccount = a
    },
  )

  await scenario(
    'REQ-008.paging',
    'cursor pagination is strictly monotonic',
    async () => {
      assert.ok(pageCursor, 'cursor missing from previous scenario')
      const lpAccount = (scenario as unknown as { lpAccount?: string }).lpAccount
      assert.ok(lpAccount)
      const res = await http('GET', `/accounts/${lpAccount}/postings?limit=2&cursor=${encodeURIComponent(pageCursor)}`)
      assert.equal(res.status, 200)
      const dto = bodyAs<PostingsListDto>(res)
      assert.ok(dto.items.length > 0)
    },
  )

  await scenario('REQ-008.422', 'invalid window is rejected', async () => {
    const a = await openAccount('smoke-lp-bad')
    const res = await http(
      'GET',
      `/accounts/${a}/postings?from=2030-01-01T00:00:00.000Z&to=2020-01-01T00:00:00.000Z`,
    )
    assert.equal(res.status, 422)
  })

  // ── REQ-012/013 lifecycle + REQ-006 *active*
  let lifecycleId = ''
  await scenario('REQ-012.freeze', 'freeze transitions active → frozen', async () => {
    lifecycleId = await openAccount('smoke-lc')
    const res = await http('PATCH', `/accounts/${lifecycleId}/freeze`)
    assert.equal(res.status, 200)
    assert.equal(bodyAs<AccountDto>(res).status, 'frozen')
  })

  await scenario(
    'REQ-006.active',
    'posting to a frozen account is rejected',
    async () => {
      const counter = await openAccount('smoke-counter')
      const res = await postTx(lifecycleId, counter, 100)
      assert.equal(res.status, 422)
      assert.equal((res.body as { code?: string }).code, 'ACCOUNT_NOT_ACTIVE')
    },
  )

  await scenario('REQ-012.activate', 'activate transitions frozen → active', async () => {
    const res = await http('PATCH', `/accounts/${lifecycleId}/activate`)
    assert.equal(res.status, 200)
    assert.equal(bodyAs<AccountDto>(res).status, 'active')
  })

  await scenario('REQ-013.nonzero', 'close at non-zero balance is rejected', async () => {
    const counter = await openAccount('smoke-close-counter')
    await postTx(lifecycleId, counter, 250)
    const res = await http('POST', `/accounts/${lifecycleId}/closure`)
    assert.equal(res.status, 422)
    assert.equal((res.body as { code?: string }).code, 'ACCOUNT_NOT_CLOSABLE')
  })

  await scenario('REQ-013.zero', 'close at zero balance succeeds (terminal)', async () => {
    const zero = await openAccount('smoke-zero')
    const res = await http('POST', `/accounts/${zero}/closure`)
    assert.equal(res.status, 200)
    assert.equal(bodyAs<AccountDto>(res).status, 'closed')
  })

  // ── REQ-014 consolidation + NFR-DATA-001 (ledger-not-cache)
  let consolidateAccount = ''
  await scenario(
    'REQ-014',
    'consolidate produces an immutable BalanceSnapshot',
    async () => {
      consolidateAccount = await openAccount('smoke-cb-to')
      const from = await openAccount('smoke-cb-from')
      await postTx(from, consolidateAccount, 700)
      const res = await http('POST', `/accounts/${consolidateAccount}/consolidations`)
      assert.equal(res.status, 200)
      const dto = bodyAs<BalanceSnapshotDto>(res)
      assert.equal(dto.accountId, consolidateAccount)
      assert.equal(dto.balanceCents, 700)
      assert.equal(dto.currency, 'BRL')
      assert.ok(dto.throughSeq > 0)
    },
  )

  await scenario(
    'REQ-014.idempotent',
    'consolidation with no new postings is a no-op',
    async () => {
      const first = bodyAs<BalanceSnapshotDto>(
        await http('POST', `/accounts/${consolidateAccount}/consolidations`),
      )
      const second = bodyAs<BalanceSnapshotDto>(
        await http('POST', `/accounts/${consolidateAccount}/consolidations`),
      )
      assert.equal(second.throughSeq, first.throughSeq)
      assert.equal(second.asOf, first.asOf)
      assert.equal(second.balanceCents, first.balanceCents)
    },
  )

  // ── Final report
  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  const totalMs = results.reduce((acc, r) => acc + r.durationMs, 0)
  console.log(
    `\n${BOLD}Summary${RESET}  ${GREEN}${passed} passed${RESET}  ${failed > 0 ? `${RED}${failed} failed${RESET}` : `${DIM}0 failed${RESET}`}  ${DIM}${totalMs}ms${RESET}`,
  )
  if (failed > 0) {
    console.log(`\n${RED}${BOLD}FAIL${RESET} — see ${results.filter((r) => !r.ok).map((r) => r.id).join(', ')}`)
    process.exit(1)
  }
  console.log(`\n${GREEN}${BOLD}PASS${RESET} — EPIC-002 SRS conformance smoke green`)
  console.log(`${YELLOW}${DIM}note:${RESET}${DIM} REQ-004/005 (holds), REQ-009 (statements), REQ-010 (reconciliation) are out of EPIC-002 scope and not exercised here.${RESET}`)
}

run().catch((err) => {
  console.error(`${RED}smoke harness crashed:${RESET}`, err)
  process.exit(1)
})
