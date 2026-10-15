import { Module } from '@nestjs/common';
import { BlockchainController } from './blockchain.controller';
import { BcService } from './blockchain.service';

@Module({
  controllers: [BlockchainController],
  providers: [BcService],
})
export class BlockchainModule {}
