import {
  Controller, Get, Put, Param, Query, Body, Request,
} from '@nestjs/common';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { DecisionService } from './decision.service';

@Controller('decision')
export class DecisionController {
  constructor(private decisionService: DecisionService) {}

  @Get('list')
  @Permissions('decision:read')
  list(@Query() query: any) {
    return this.decisionService.list(query);
  }

  @Get('reviews')
  @Permissions('risk:handle')
  getReviews(@Query() query: any) {
    return this.decisionService.getReviews(query);
  }

  @Put('reviews/:riskId/approve')
  @Permissions('risk:handle')
  approveReview(@Param('riskId') riskId: string, @Request() req: any) {
    return this.decisionService.approveReview(riskId, req.user?.id);
  }

  @Put('reviews/:riskId/reject')
  @Permissions('risk:handle')
  rejectReview(@Param('riskId') riskId: string, @Body() body: { comment: string }, @Request() req: any) {
    return this.decisionService.rejectReview(riskId, body.comment, req.user?.id);
  }

  @Get('agents/status')
  @Permissions('decision:read')
  getAgentStatus() {
    return this.decisionService.getAgentStatus();
  }

  @Get('risk/:riskId')
  @Permissions('decision:read')
  getByRiskId(@Param('riskId') riskId: string) {
    return this.decisionService.getByRiskId(riskId);
  }

  @Get(':id')
  @Permissions('decision:read')
  getDetail(@Param('id') id: string) {
    return this.decisionService.getByTraceId(id);
  }
}
