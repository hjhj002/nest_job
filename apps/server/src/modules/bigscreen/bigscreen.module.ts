import { Module } from '@nestjs/common';
import { BigscreenController } from './bigscreen.controller';
import { BigscreenService } from './bigscreen.service';

@Module({
  controllers: [BigscreenController],
  providers: [BigscreenService],
})
export class BigscreenModule {}
