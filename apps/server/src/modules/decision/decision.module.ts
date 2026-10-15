import { Module } from '@nestjs/common';
import { DecisionController } from './decision.controller';
import { DecisionService } from './decision.service';

@Module({
  controllers: [DecisionController],
  providers: [DecisionService],
})
export class DecisionModule {}
