# ADR-0004 — Money as integer minor units (no Decimal library)

- **Status:** Accepted
- **Date:** 2026-05-21
- **Phase / Sprint:** EPIC-002 (ledger-core)

## Context

`Money` is the most precision-sensitive value object in a ledger: balances and postings must be exact, and a double-entry system sums thousands of them. JavaScript `number` is IEEE-754 double, so storing a fractional amount (e.g. `100.5`) and doing arithmetic on it accumulates rounding error.

The scaffolded `Money` VO (inherited from `ddd-templates`) currently stores the **full decimal value as a float** and rounds per operation — this contradicts the [`srs.md`](../srs.md) §6 constraint ("integer minor units only") and is the classic float-money bug. We must pick a representation before FEAT-001 (account balance is `Money`).

Future requirements not in the MVP — interest accrual, currency conversion, installment splitting — produce sub-cent fractions that need higher precision *during calculation*, which raises the "should we use a Decimal library?" question now.

## Decision

`Money` is an **integer-minor-units** value object at the currency's **natural scale** (2 decimal places for BRL/USD/EUR/GBP, 0 for JPY). Internally it stores integer minor units (cents), not a float. **No Decimal library** is added to the domain core for the MVP.

- Addition / subtraction are exact integer operations.
- Multiplication / division by a scalar round **half-even** (banker's rounding) to the natural minor unit, with the rounding made explicit at the call site.
- Parsing a decimal input (boundary only) converts to minor units and rounds half-even.
- `number` holds the minor units (safe to 2^53); BigInt is a future hardening path, not required now.

**High-precision policy (forward-looking, out of MVP scope):** when interest, FX conversion, or installment splitting enter scope, perform the calculation in a **higher-scale representation** (scaled-integer / BigInt at e.g. 4–8 dp, or a vetted Decimal library introduced behind a domain port) and **round to the currency's natural minor unit (half-even) at the posting boundary**. A posting that hits the ledger is always whole minor units; only intermediate derived values carry extra scale.

## Alternatives considered

- **(a) Float (current scaffold)** — rejected: precision drift over many operations; violates SRS §6.
- **(b) Decimal library (decimal.js / big.js / dinero.js) now** — rejected for MVP: adds a runtime dependency to the domain core that whole-cent ledger postings don't need; reserve it (behind a port) for when high-precision derived calculations actually arrive.
- **(c) Dynamic-scale scaled integer everywhere** (`{ minorUnits, scale, currency }`) — rejected as premature complexity; the ledger's postings/balances are always at natural scale. Revisit with the high-precision features.
- **(d) BigInt minor units** — deferred: correct for extreme ranges but complicates arithmetic/serialization; `number` minor units suffice for the study's value ranges.

## Consequences

- **Positive**: exact arithmetic for postings/balances; no domain dependency; aligns with SRS §6 and NFR-CORRECT-001 (both implementations agree on representation + rounding, so JSON stays byte-identical).
- **Negative**: multiply/divide require an explicit rounding decision (documented per call); high-precision features are not free — they will require introducing a higher-scale type/port later (captured in the forward policy above).
- **Follow-up (FEAT-001)**: refactor `src/shared/value-objects/money.ts` from float to integer minor units; update `money.spec.ts`; persist as `bigint` cents column with mapper conversion. The persistence column type (`bigint`) is a detail of ADR-0001's stack, not a new decision.
- **Shared contract**: this representation + rounding is part of the SRS (§6), so the `dod-vs-oop-dod` side adopts the same contract via its own ADR.

## References

- `../srs.md` §5.2, §6 — money is integer minor units; rounding contract
- `../sad.md` §5.4 — persistence (bigint cents column)
- ADR-0001 — stack (TypeORM column types)
- `src/shared/value-objects/money.ts` — the VO to refactor
