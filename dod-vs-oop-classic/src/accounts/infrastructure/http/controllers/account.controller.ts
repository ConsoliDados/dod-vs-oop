import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common'
import type { AccountDto } from '../../../application/mappers/account.usecase.mapper'
import type { GetAccountUseCase } from '../../../application/usecases/get-account.usecase'
import type {
  GetBalance,
  GetBalanceUseCase,
} from '../../../application/usecases/get-balance.usecase'
import type { OpenAccountUseCase } from '../../../application/usecases/open-account.usecase'
import { GET_ACCOUNT_USE_CASE } from '../../provider/usecases/get-account.provider'
import { GET_BALANCE_USE_CASE } from '../../provider/usecases/get-balance.provider'
import { OPEN_ACCOUNT_USE_CASE } from '../../provider/usecases/open-account.provider'
import type { OpenAccountRequest } from '../dtos/open-account.dto'

/** HTTP surface for the accounts context (REQ-001/002/003). Use cases injected by token. */
@Controller('accounts')
export class AccountController {
  constructor(
    @Inject(OPEN_ACCOUNT_USE_CASE) private readonly openAccountUseCase: OpenAccountUseCase,
    @Inject(GET_ACCOUNT_USE_CASE) private readonly getAccountUseCase: GetAccountUseCase,
    @Inject(GET_BALANCE_USE_CASE) private readonly getBalanceUseCase: GetBalanceUseCase,
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
}
