import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import type { GetAccountRepository } from '../../../application/repositories/get-account.repository'
import type { AccountAggregate } from '../../../domain/entities/account.aggregate'
import { AccountTypeOrmEntity } from '../entities/account.typeorm.entity'
import { AccountTypeOrmMapper } from '../mappers/account.typeorm.mapper'

@Injectable()
export class GetAccountTypeOrmRepository implements GetAccountRepository {
  constructor(
    @InjectRepository(AccountTypeOrmEntity)
    private readonly repository: Repository<AccountTypeOrmEntity>,
  ) {}

  async findById(id: string): Promise<AccountAggregate | null> {
    const entity = await this.repository.findOne({ where: { id, deletedAt: IsNull() } })
    return entity ? AccountTypeOrmMapper.toDomain(entity) : null
  }
}
