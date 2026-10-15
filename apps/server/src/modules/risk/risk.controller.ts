import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Request,
} from '@nestjs/common';
import { Permissions } from '../auth/decorators/permissions.decorator';
import {
  RiskService,
  CreateRiskEventDto,
  QueryRiskEventDto,
  HandleRiskEventDto,
} from './risk.service';

@Controller('risk/events')
export class RiskController {
  constructor(private riskService: RiskService) {}

  @Post()
  @Permissions('risk:read')
  create(@Body() dto: CreateRiskEventDto) {
    return this.riskService.createRiskEvent(dto);
  }

  @Get()
  @Permissions('risk:read')
  query(@Query() dto: QueryRiskEventDto) {
    return this.riskService.queryRiskEvents(dto);
  }

  @Get('statistics')
  @Permissions('risk:read')
  statistics(
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    return this.riskService.getStatistics(
      startTime ? new Date(startTime) : undefined,
      endTime ? new Date(endTime) : undefined,
    );
  }

  @Get('realtime')
  @Permissions('risk:read')
  realtime() {
    return this.riskService.getRealtimeData();
  }

  @Get(':id')
  @Permissions('risk:read')
  getById(@Param('id') id: string) {
    return this.riskService.getRiskEventById(id);
  }

  @Put(':id/handle')
  @Permissions('risk:handle')
  handle(
    @Param('id') id: string,
    @Body() dto: HandleRiskEventDto,
    @Request() req: any,
  ) {
    return this.riskService.handleRiskEvent(id, dto, req.user?.id);
  }

  @Delete(':id')
  @Permissions('risk:handle')
  delete(@Param('id') id: string) {
    return this.riskService.deleteRiskEvent(id);
  }
}
