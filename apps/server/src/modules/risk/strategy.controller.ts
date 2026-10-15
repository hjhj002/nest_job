import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query,
} from '@nestjs/common';
import {
  StrategyService,
  CreateStrategyDto,
  UpdateStrategyDto,
  QueryStrategyDto,
} from './strategy.service';

@Controller('risk/strategies')
export class StrategyController {
  constructor(private strategyService: StrategyService) {}

  @Post()
  create(@Body() dto: CreateStrategyDto) {
    return this.strategyService.create(dto);
  }

  @Get()
  query(@Query() dto: QueryStrategyDto) {
    return this.strategyService.query(dto);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.strategyService.getById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStrategyDto) {
    return this.strategyService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.strategyService.delete(id);
  }

  @Post(':id/execute')
  execute(@Param('id') id: string, @Body() context: Record<string, any>) {
    return this.strategyService.execute(id, context);
  }
}
