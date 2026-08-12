import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

/**
 * Everything that moves money.
 *
 * Only the read side is exposed here (`GET /wallet`). The two write paths are
 * driven from the modules that own the surrounding decision: TopupsModule for
 * an admin approving a slip, EnrollmentsModule for a student buying a course.
 */
@Module({
  controllers: [WalletController],
  providers: [LedgerService, WalletService],
  exports: [LedgerService, WalletService],
})
export class LedgerModule {}
