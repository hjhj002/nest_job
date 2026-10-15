import {
  Controller, Get, Post, Param, Query, Body,
} from '@nestjs/common';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { BcService } from './blockchain.service';

@Controller('blockchain')
export class BlockchainController {
  constructor(private bcService: BcService) {}

  @Get('list')
  @Permissions('blockchain:read')
  list(@Query() query: any) {
    return this.bcService.list(query);
  }

  @Get('stats')
  @Permissions('blockchain:read')
  getStats() {
    return this.bcService.getStats();
  }

  @Post('certify')
  @Permissions('blockchain:verify')
  certify(@Body() body: { data: Record<string, any>; dataType?: string; operator?: string }) {
    return this.bcService.certify(body.data, body.dataType, body.operator);
  }

  @Get(':id')
  @Permissions('blockchain:read')
  getDetail(@Param('id') id: string) {
    return this.bcService.getDetail(id);
  }

  @Post(':id/verify')
  @Permissions('blockchain:verify')
  verify(@Param('id') id: string) {
    return this.bcService.verify(id);
  }
}
