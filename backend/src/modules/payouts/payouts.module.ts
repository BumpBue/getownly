import { Module } from '@nestjs/common';
import { LedgerModule } from '@/modules/ledger/ledger.module';
import { AdminPayoutsController } from './admin-payouts.controller';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

/**
 * Instructor withdrawals: bank details, requests, and the admin review queue.
 * The money itself is posted by LedgerModule's WalletService, the only place
 * in the application allowed to move a balance.
 */
@Module({
  imports: [LedgerModule],
  controllers: [PayoutsController, AdminPayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
