import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
} from '@nestjs/common';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { DeviceService } from './device.service';

@Controller('device')
export class DeviceController {
  constructor(private deviceService: DeviceService) {}

  @Get('list')
  @Permissions('device:read')
  list(@Query() query: any) {
    return this.deviceService.list(query);
  }

  @Post('sync')
  @Permissions('device:update')
  syncFromMock() {
    return this.deviceService.syncFromMock();
  }

  @Get('all')
  @Permissions('device:read')
  getAll() {
    return this.deviceService.getAll();
  }

  @Get(':id')
  @Permissions('device:read')
  getById(@Param('id') id: string) {
    return this.deviceService.getById(id);
  }

  @Get(':id/history')
  @Permissions('device:read')
  getHistory(
    @Param('id') id: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    return this.deviceService.getHistory(id, startTime, endTime);
  }

  @Post('data')
  @Permissions('device:create')
  saveData(@Body() dto: any) {
    return this.deviceService.saveData(dto);
  }

  @Put(':id')
  @Permissions('device:update')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.deviceService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('device:delete')
  remove(@Param('id') id: string) {
    return this.deviceService.remove(id);
  }
}
