import { Controller, Post, Get, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import { Public } from './decorators/public.decorator';

@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Public()
  @Get('agents/status')
  getAgentStatus() {
    return this.aiService.getAgentStatus();
  }

  @Public()
  @Post('workflow/risk')
  runRiskWorkflow(@Body() body: { deviceData?: Record<string, any> } & Record<string, any>) {
    const deviceData = body.deviceData ?? body;
    return this.aiService.runRiskWorkflow(deviceData);
  }

  @Public()
  @Post('chat')
  async chat(@Body() body: { message: string; deviceData?: Record<string, any>; agent?: string }) {
    return this.aiService.handleChat(body.message, body.deviceData, body.agent);
  }
}
