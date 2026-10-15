import { Controller, Get, Param, Query } from '@nestjs/common';
import { LogService } from './log.service';

@Controller('logs')
export class LogController {
  constructor(private logService: LogService) {}

  @Get()
  list(@Query() query: any) {
    return this.logService.list(query);
  }

  @Get('stats')
  getStats() {
    return this.logService.getStats();
  }

  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.logService.getDetail(id);
  }
}
