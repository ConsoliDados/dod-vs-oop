/**
 * `@ddd-dod/accounts` — aggregate balance, holds, lifecycle.
 *
 * Bootstrap skeleton: only the error contract exists so the package compiles
 * and is importable. The aggregate types, pure domain transitions, use cases,
 * and persistence adapter land in EPIC-002 (ledger-core), under
 * `src/{domain,application,infra}`.
 */
export { AccountsError, formatAccountsError } from "./error";
