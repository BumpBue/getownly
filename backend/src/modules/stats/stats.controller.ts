import { Controller, Get } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';
import { PublicStatsDto, StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Public()
  @Get('public')
  publicStats(): Promise<PublicStatsDto> {
    return this.stats.publicStats();
  }
}
