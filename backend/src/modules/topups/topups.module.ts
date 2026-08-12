import { Module } from '@nestjs/common';
import { LedgerModule } from '@/modules/ledger/ledger.module';
import { AdminTopupsController } from './admin-topups.controller';
import { PromptPayService } from './promptpay.service';
import { TopupsController } from './topups.controller';
import { TopupsService } from './topups.service';

/**
 * Wallet top-ups: QR generation, slip submission, and the admin review queue.
 * The money itself is posted by LedgerModule's WalletService.
 */
@Module({
  imports: [LedgerModule],
  controllers: [TopupsController, AdminTopupsController],
  providers: [TopupsService, PromptPayService],
  exports: [TopupsService],
})
export class TopupsModule {}
