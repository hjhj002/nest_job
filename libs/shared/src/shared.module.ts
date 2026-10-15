import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [PrismaModule, BlockchainModule, LoggerModule],
  exports: [PrismaModule, BlockchainModule, LoggerModule],
})
export class SharedModule {}
