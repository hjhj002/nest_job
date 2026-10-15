import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query,
} from '@nestjs/common';
import {
  RuleService,
  CreateRuleDto,
  UpdateRuleDto,
  QueryRuleDto,
} from './rule.service';

@Controller('risk/rules')
export class RuleController {
  constructor(private ruleService: RuleService) {}

  @Post()
  create(@Body() dto: CreateRuleDto) {
    return this.ruleService.create(dto);
  }

  @Get()
  query(@Query() dto: QueryRuleDto) {
    return this.ruleService.query(dto);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.ruleService.getById(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRuleDto) {
    return this.ruleService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.ruleService.delete(id);
  }

  @Post('evaluate')
  evaluate(@Body() data: Record<string, any>) {
    return this.ruleService.evaluate(data);
  }
}
