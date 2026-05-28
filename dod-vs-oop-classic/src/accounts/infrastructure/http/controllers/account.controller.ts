import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common'
import type { AccountDto } from '../../../application/mappers/account.usecase.mapper'
import type { ActivateAccountUseCase } from '../../../application/usecases/activate-account.usecase'
import type { CloseAccountUseCase } from '../../../application/usecases/close-account.usecase'
import type { FreezeAccountUseCase } from '../../../application/usecases/freeze-account.usecase'
import type { GetAccountUseCase } from '../../../application/usecases/get-account.usecase'
import type {
  GetBalance,
  GetBalanceUseCase,
} from '../../../application/usecases/get-balance.usecase'
import type { OpenAccountUseCase } from '../../../application/usecases/open-account.usecase'
import { ACTIVATE_ACCOUNT_USE_CASE } from '../../provider/usecases/activate-account.provider'
import { CLOSE_ACCOUNT_USE_CASE } from '../../provider/usecases/close-account.provider'
import { FREEZE_ACCOUNT_USE_CASE } from '../../provider/usecases/freeze-account.provider'
import { GET_ACCOUNT_USE_CASE } from '../../provider/usecases/get-account.provider'
import { GET_BALANCE_USE_CASE } from '../../provider/usecases/get-balance.provider'
import { OPEN_ACCOUNT_USE_CASE } from '../../provider/usecases/open-account.provider'
import type { OpenAccountRequest } from '../dtos/open-account.dto'

/**
 * HTTP surface for the accounts context (REQ-001/002/003, REQ-012/013).
 * Use cases injected by token. Lifecycle endpoints are **named-behavior**
 * routes — not REST CRUD — so the intent (freeze / activate / closure) shows
 * up at the URL.
 */
@Controller('accounts')
export class AccountController {
  constructor(
    @Inject(OPEN_ACCOUNT_USE_CASE) private readonly openAccountUseCase: OpenAccountUseCase,
    @Inject(GET_ACCOUNT_USE_CASE) private readonly getAccountUseCase: GetAccountUseCase,
    @Inject(GET_BALANCE_USE_CASE) private readonly getBalanceUseCase: GetBalanceUseCase,
    @Inject(FREEZE_ACCOUNT_USE_CASE) private readonly freezeAccountUseCase: FreezeAccountUseCase,
    @Inject(ACTIVATE_ACCOUNT_USE_CASE)
    private readonly activateAccountUseCase: ActivateAccountUseCase,
    @Inject(CLOSE_ACCOUNT_USE_CASE) private readonly closeAccountUseCase: CloseAccountUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  async open(@Body() body: OpenAccountRequest): Promise<AccountDto> {
    return this.openAccountUseCase.execute({ ownerId: body.ownerId, currency: body.currency })
  }

  @Get(':id')
  async read(@Param('id') id: string): Promise<AccountDto> {
    return this.getAccountUseCase.execute({ id })
  }

  @Get(':id/balance')
  async balance(@Param('id') id: string): Promise<GetBalance.Output> {
    return this.getBalanceUseCase.execute({ id })
  }

  /** REQ-012: transition `active → frozen`. Illegal transitions → 422. */
  @Patch(':id/freeze')
  async freeze(@Param('id') id: string): Promise<AccountDto> {
    return this.freezeAccountUseCase.execute({ id })
  }

  /** REQ-012: transition `frozen → active`. Illegal transitions → 422. */
  @Patch(':id/activate')
  async activate(@Param('id') id: string): Promise<AccountDto> {
    return this.activateAccountUseCase.execute({ id })
  }

  /**
   * REQ-013, ADR-0010: transition `active|frozen → closed`, gated by a
   * ledger-recomputed zero balance via `CloseAccountService`. Non-zero balance
   * → 422 (`ACCOUNT_NOT_CLOSABLE`); already-closed → 422 (illegal transition).
   */
  @Post(':id/closure')
  @HttpCode(200)
  async close(@Param('id') id: string): Promise<AccountDto> {
    return this.closeAccountUseCase.execute({ id })
  }
}
