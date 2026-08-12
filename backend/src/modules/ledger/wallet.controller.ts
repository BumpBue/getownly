import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { WalletQueryDto } from './dto/wallet-query.dto';
import type { WalletPageDto } from './dto/ledger-response.dto';
import { LedgerService } from './ledger.service';

const DEFAULT_PAGE_SIZE = 20;

/**
 * The wallet as its owner sees it: a balance and the movements behind it.
 *
 * The account is resolved from the token, so there is no id in the path to
 * tamper with and no way to ask for somebody else's statement.
 */
@Controller('wallet')
export class WalletController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  getWallet(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: WalletQueryDto,
  ): Promise<WalletPageDto> {
    return this.ledger.getWalletPage(user.id, query.page ?? 1, query.limit ?? DEFAULT_PAGE_SIZE);
  }
}
