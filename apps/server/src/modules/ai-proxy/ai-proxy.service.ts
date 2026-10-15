import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AiProxyService {
  private readonly logger = new Logger(AiProxyService.name);
  private readonly aiBaseUrl = 'http://localhost:3001';

  async sendChat(message: string, deviceData?: Record<string, any>) {
    try {
      const resp = await fetch(`${this.aiBaseUrl}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, deviceData }),
      });
      const json = await resp.json();
      return json.data || json;
    } catch (e: any) {
      this.logger.error(`AI chat failed: ${e.message}`);
      throw e;
    }
  }

  async getAgentStatus() {
    try {
      const resp = await fetch(`${this.aiBaseUrl}/ai/agents/status`);
      const json = await resp.json();
      return json;
    } catch (e: any) {
      this.logger.error(`Agent status failed: ${e.message}`);
      return { agents: [] };
    }
  }
}
