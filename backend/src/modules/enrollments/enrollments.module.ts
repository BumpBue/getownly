import { Module } from '@nestjs/common';
import { LedgerModule } from '@/modules/ledger/ledger.module';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

/** Course purchase and the student's own course list. */
@Module({
  imports: [LedgerModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService],
})
export class EnrollmentsModule {}
