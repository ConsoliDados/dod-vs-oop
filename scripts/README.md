# Smoke harness — dod-vs-oop study

Shared harness for the comparative study (`dod-vs-oop-classic` + the
forthcoming `dod-vs-oop-dod`). Exercises a numbered scenario sequence
mapped 1:1 to the shared `srs.md` (REQs + NFRs) and to each implementation's
per-context SDD endpoints. Both implementations must satisfy it — that's
the **shape** of NFR-CORRECT-001 conformance at the smoke level (full
byte-identical JSON conformance is a separate suite once the DOD side lands).

## Run it

From the example root (`examples/dod-vs-oop-classic/` today):

```bash
pnpm smoke              # builds dist/ + boots + waits for the port + runs smoke.ts + tears down
```

Manual / debugging — boot the server yourself and run the harness in another
shell:

```bash
# shell 1
pnpm start:prod

# shell 2
BASE_URL=http://localhost:3000 tsx ../scripts/smoke.ts
```

Exits 0 on full pass, 1 on any failure. No runtime deps beyond Node's
built-in `fetch` + `assert`.

## What's covered (EPIC-002)

| Scenario id | Maps to | What it asserts |
|---|---|---|
| `REQ-001` | REQ-001 | open an account → 201; fresh state |
| `REQ-002` / `REQ-002.404` | REQ-002 | read by id → 200; unknown id → 404 `ACCOUNT_NOT_FOUND` |
| `REQ-003` | REQ-003 | balance starts at zero |
| `REQ-006` | REQ-006 | balanced double-entry posts |
| `REQ-006.unbalanced` | REQ-006 | unbalanced → 422 `VALIDATION_ERROR` |
| `REQ-006.currency` | REQ-006 | cross-currency → 422 |
| `REQ-006.404` | REQ-006 | absent account on a posting → 404 |
| `REQ-003.cross` | REQ-003 cross-context | cache reflects the post (FEAT-003 handler) |
| `REQ-007` | REQ-007, ADR-0011 | reversal has mirror postings + `reversedTransactionId` |
| `REQ-007.balance` | REQ-007 + REQ-003 | cached balance flattens after reversal |
| `REQ-007.404` | REQ-007 | unknown id → 404 `TRANSACTION_NOT_FOUND` |
| `REQ-008` | REQ-008 | list ordered by `(postedAt, sequence)` |
| `REQ-008.paging` | REQ-008 | cursor monotonic across pages |
| `REQ-008.422` | REQ-008 | `from > to` → 422 |
| `REQ-012.freeze` | REQ-012 | active → frozen |
| `REQ-006.active` | REQ-006 *active* | post to frozen → 422 `ACCOUNT_NOT_ACTIVE` |
| `REQ-012.activate` | REQ-012 | frozen → active |
| `REQ-013.nonzero` | REQ-013 | close at non-zero → 422 `ACCOUNT_NOT_CLOSABLE` |
| `REQ-013.zero` | REQ-013 | close at zero → 200 closed (terminal) |
| `REQ-014` | REQ-014 / FEAT-006 | consolidate appends a `BalanceSnapshot` matching the ledger sum |
| `REQ-014.idempotent` | REQ-014 | re-consolidate is a no-op (same `asOf` / `throughSeq`) |

## What's NOT covered (intentionally)

- **REQ-004/005** (holds) — out of EPIC-002.
- **REQ-009** (statements) — EPIC-003.
- **REQ-010** (reconciliation) — EPIC-004.

These will get smoke scenarios when their epics ship.

## The same sequence as a curl recipe (eyes-on)

For a human walk-through (or to debug a single scenario):

```bash
# Open accounts
ACCT_FROM=$(curl -s -X POST localhost:3000/accounts \
  -H 'content-type: application/json' \
  -d '{"ownerId":"manual-from","currency":"BRL"}' | jq -r .id)

ACCT_TO=$(curl -s -X POST localhost:3000/accounts \
  -H 'content-type: application/json' \
  -d '{"ownerId":"manual-to","currency":"BRL"}' | jq -r .id)

# Post a balanced tx
TX=$(curl -s -X POST localhost:3000/transactions \
  -H 'content-type: application/json' \
  -d "{\"postings\":[{\"accountId\":\"$ACCT_FROM\",\"amount\":1000,\"direction\":\"debit\"},{\"accountId\":\"$ACCT_TO\",\"amount\":1000,\"direction\":\"credit\"}]}" | jq -r .id)

# Balances reflect (REQ-003 cross-context)
curl -s localhost:3000/accounts/$ACCT_FROM/balance | jq
curl -s localhost:3000/accounts/$ACCT_TO/balance | jq

# Reverse (REQ-007)
curl -s -X POST localhost:3000/transactions/$TX/reversals | jq

# Balances flatten (REQ-007 + REQ-003)
curl -s localhost:3000/accounts/$ACCT_FROM/balance | jq

# List postings (REQ-008)
curl -s "localhost:3000/accounts/$ACCT_FROM/postings?limit=10" | jq

# Lifecycle (REQ-012)
curl -s -X PATCH localhost:3000/accounts/$ACCT_FROM/freeze | jq
curl -s -X PATCH localhost:3000/accounts/$ACCT_FROM/activate | jq

# Consolidate (REQ-014)
curl -s -X POST localhost:3000/accounts/$ACCT_TO/consolidations | jq

# Close at zero (REQ-013) — open a fresh one
ZERO=$(curl -s -X POST localhost:3000/accounts \
  -H 'content-type: application/json' \
  -d '{"ownerId":"manual-zero","currency":"BRL"}' | jq -r .id)
curl -s -X POST localhost:3000/accounts/$ZERO/closure | jq
```

## Adding scenarios

The script is intentionally flat — each scenario is a `scenario(id, label, body)`
call. Add yours next to the appropriate REQ block. Keep the `id` short and
greppable; the report uses it as the failure pointer.
