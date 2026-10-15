import {
  Controller, Get, Post, Body, Param, Query,
} from '@nestjs/common';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AlertService } from './alert.service';

@Controller('alert')
export class AlertController {
  constructor(private alertService: AlertService) {}

  @Get('list')
  @Permissions('alarm:read')
  list(@Query() query: any) {
    return this.alertService.list(query);
  }

  @Get('latest')
  @Permissions('alarm:read')
  getLatest(@Query('limit') limit?: string) {
    return this.alertService.getLatest(Number(limit) || 10);
  }

  @Get('unread/count')
  @Permissions('alarm:read')
  getUnreadCount() {
    return this.alertService.getUnreadCount();
  }

  @Post(':id/read')
  @Permissions('alarm:confirm')
  markAsRead(@Param('id') id: string) {
    return this.alertService.markAsRead(id);
  }

  @Post(':id/handle')
  @Permissions('alarm:confirm')
  handle(@Param('id') id: string, @Body() dto: any) {
    return this.alertService.handle(id, dto);
  }
}
