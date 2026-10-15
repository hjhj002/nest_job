import { Module } from '@nestjs/common';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';
import { RuleController } from './rule.controller';
import { RuleService } from './rule.service';
import { StrategyController } from './strategy.controller';
import { StrategyService } from './strategy.service';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';

@Module({
  controllers: [RiskController, RuleController, StrategyController, DeviceController],
  providers: [RiskService, RuleService, StrategyService, DeviceService],
  exports: [RiskService, RuleService, StrategyService, DeviceService],
})
export class RiskModule {}
