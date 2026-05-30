import type { Provider } from '@nestjs/common'
import { LedgerBalanceReaderTypeOrm } from '../../acl/ledger-balance-reader.typeorm'

/** NestJS DI token for the `LedgerBalanceReader` port (accounts→ledger ACL). */
export const LEDGER_BALANCE_READER = Symbol('LedgerBalanceReader')

/** Binds the `LedgerBalanceReader` port to its TypeORM ACL implementation. */
export const ledgerBalanceReaderProvider: Provider = {
  provide: LEDGER_BALANCE_READER,
  useClass: LedgerBalanceReaderTypeOrm,
}
