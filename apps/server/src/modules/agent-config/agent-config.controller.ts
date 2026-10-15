import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
} from '@nestjs/common';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AgentConfigService } from './agent-config.service';

@Controller('agent-configs')
export class AgentConfigController {
  constructor(private agentConfigService: AgentConfigService) {}

  @Get()
  @Permissions('agent:read')
  list(@Query('keyword') keyword?: string) {
    return this.agentConfigService.list(keyword);
  }

  @Get(':id')
  @Permissions('agent:read')
  getById(@Param('id') id: string) {
    return this.agentConfigService.getById(id);
  }

  @Post()
  @Permissions('agent:create')
  create(@Body() dto: any) {
    return this.agentConfigService.create(dto);
  }

  @Put(':id')
  @Permissions('agent:update')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.agentConfigService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('agent:delete')
  remove(@Param('id') id: string) {
    return this.agentConfigService.remove(id);
  }
}
