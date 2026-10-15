import { Controller, Get } from '@nestjs/common';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { StatisticsService } from './statistics.service';

@Controller('stats')
export class StatisticsController {
  constructor(private statsService: StatisticsService) {}

  @Get('dashboard')
  @Permissions('dashboard:view')
  getDashboard() {
    return this.statsService.getDashboard();
  }

  @Get('device/status')
  @Permissions('device:read')
  getDeviceStatus() {
    return this.statsService.getDeviceStatus();
  }

  @Get('risk/distribution')
  @Permissions('risk:read')
  getRiskDistribution() {
    return this.statsService.getRiskDistribution();
  }

  @Get('realtime')
  @Permissions('dashboard:view')
  getRealtime() {
    return this.statsService.getRealtime();
  }
}
