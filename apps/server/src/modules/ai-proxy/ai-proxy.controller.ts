import { Controller, Post, Get, Body } from '@nestjs/common';
import { AiProxyService } from './ai-proxy.service';

@Controller('ai')
export class AiProxyController {
  constructor(private aiProxy: AiProxyService) {}

  @Post('chat')
  async chat(@Body() body: { message: string; deviceData?: Record<string, any> }) {
    return this.aiProxy.sendChat(body.message, body.deviceData);
  }

  @Get('agents/status')
  async getAgentStatus() {
    return this.aiProxy.getAgentStatus();
  }
}
