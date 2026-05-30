import type { Provider } from '@nestjs/common'
import { AccountLookupTypeOrm } from '../../acl/account-lookup.typeorm'

/** NestJS DI token for the `AccountLookup` port (cross-context ACL). */
export const ACCOUNT_LOOKUP = Symbol('AccountLookup')

/** Binds the `AccountLookup` port to its TypeORM (ACL) implementation. */
export const accountLookupProvider: Provider = {
  provide: ACCOUNT_LOOKUP,
  useClass: AccountLookupTypeOrm,
}
