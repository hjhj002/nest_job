import { Controller, Get, Query } from '@nestjs/common';
import { BigscreenService } from './bigscreen.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('bigscreen')
@Public()
export class BigscreenController {
  constructor(private readonly bigscreenService: BigscreenService) {}

  @Get('data')
  async getFullData() {
    return this.bigscreenService.getFullData();
  }

  @Get('stats')
  async getStats() {
    return this.bigscreenService.getStats();
  }

  @Get('devices/realtime')
  async getDevicesRealtime() {
    return this.bigscreenService.getDevicesRealtime();
  }

  @Get('risks/latest')
  async getLatestRisks(@Query('limit') limit: string) {
    return this.bigscreenService.getLatestRisks(parseInt(limit) || 10);
  }

  @Get('alerts/latest')
  async getLatestAlerts(@Query('limit') limit: string) {
    return this.bigscreenService.getLatestAlerts(parseInt(limit) || 10);
  }

  @Get('risk-distribution')
  async getRiskDistribution() {
    return this.bigscreenService.getRiskDistribution();
  }

  @Get('trend')
  async getTrendData() {
    return this.bigscreenService.getTrendData();
  }

  @Get('agents/status')
  async getAgentStatus() {
    return this.bigscreenService.getAgentStatus();
  }
}
