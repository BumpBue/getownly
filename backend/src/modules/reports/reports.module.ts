import { Module } from '@nestjs/common';
import { AdminReportsController, InstructorReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/** Reporting, for the platform and for one instructor. Read-only throughout. */
@Module({
  controllers: [AdminReportsController, InstructorReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
