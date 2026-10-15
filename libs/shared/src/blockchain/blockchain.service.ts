import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EvidenceStorageABI } from './evidence-storage.abi';
import { ethers } from 'ethers';
import { createHash } from 'crypto';

export interface StoreEvidenceParams {
  riskEventNo: string;
  data: Record<string, any>;
  dataType?: string;
  operator?: string;
}

export interface EvidenceResult {
  evidenceId: string;
  riskEventNo: string;
  dataHash: string;
  dataType: string;
  timestamp: number;
  operator: string;
}

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private rpcUrl: string;
  private contractAddress: string;
  private wallet: ethers.Wallet;
  private iface: ethers.Interface;
  private chainId: number;
  private enabled = false;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const host = this.config.get('FISCO_BCOS_NODE_IP');
    const port = this.config.get('FISCO_BCOS_NODE_RPC_PORT') || 8545;
    this.contractAddress = this.config.get('RISK_EVIDENCE_CONTRACT_ADDRESS');
    const privateKey = this.config.get('FISCO_BCOS_PRIVATE_KEY');

    if (!host) {
      this.logger.warn('FISCO_BCOS_NODE_IP not set, blockchain disabled');
      return;
    }
    if (!this.contractAddress) {
      this.logger.warn('RISK_EVIDENCE_CONTRACT_ADDRESS not set, blockchain disabled');
      return;
    }
    if (!privateKey) {
      this.logger.warn('FISCO_BCOS_PRIVATE_KEY not set, blockchain disabled');
      return;
    }

    this.rpcUrl = `http://${host}:${port}`;
    this.iface = new ethers.Interface(EvidenceStorageABI);

    try {
      this.chainId = parseInt(await this.rpcCall('eth_chainId', []), 16);
      this.wallet = new ethers.Wallet(privateKey);
      this.enabled = true;
      this.logger.log(
        `FISCO BCOS connected, chainId=${this.chainId}, contract=${this.contractAddress}, account=${this.wallet.address}`,
      );
    } catch (err: any) {
      this.logger.error(`FISCO BCOS init failed: ${err.message}`);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ── RPC layer ──

  private async rpcCall(method: string, params: any[]): Promise<any> {
    const body = JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 });
    const resp = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Connection: 'close' },
      body,
    });
    const json = await resp.json();
    if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
    return json.result;
  }

  // ── Helpers ──

  private sha256(data: string): string {
    return '0x' + createHash('sha256').update(data).digest('hex');
  }

  private async getNonce(): Promise<number> {
    const count = await this.rpcCall('eth_getTransactionCount', [
      this.wallet.address,
      'latest',
    ]);
    return parseInt(count, 16);
  }

  // ── Contract calls ──

  /**
   * 区块链存证
   */
  async storeEvidence(params: StoreEvidenceParams): Promise<{
    txHash: string;
    blockNumber: bigint;
    evidenceId: string;
    dataHash: string;
  }> {
    if (!this.enabled) throw new Error('Blockchain not available');

    const evidenceId = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const dataJson = JSON.stringify(params.data);
    const dataHash = this.sha256(dataJson);

    const callData = this.iface.encodeFunctionData('storeEvidence', [
      evidenceId,
      params.riskEventNo,
      dataHash,
      params.dataType || 'risk_event',
      params.operator || 'system',
    ]);

    const nonce = await this.getNonce();
    const tx = ethers.Transaction.from({
      to: this.contractAddress,
      data: callData,
      gasLimit: 3000000,
      chainId: this.chainId,
      nonce,
    });

    const signedTx = await this.wallet.signTransaction(tx);
    const txHash = await this.rpcCall('eth_sendRawTransaction', [signedTx]);

    // Wait for receipt
    let blockNumber = 0n;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const receipt = await this.rpcCall('eth_getTransactionReceipt', [txHash]);
      if (receipt) {
        blockNumber = BigInt(parseInt(receipt.blockNumber || '0x0', 16));
        break;
      }
    }

    this.logger.log(`Evidence stored: ${evidenceId} -> tx ${txHash}`);
    return { txHash, blockNumber, evidenceId, dataHash };
  }

  /**
   * 存证并记录到数据库
   */
  async storeWithLog(
    params: StoreEvidenceParams,
    riskEventId: string,
  ): Promise<{ txHash: string; blockNumber: bigint; evidenceId: string; dataHash: string }> {
    let txHash = '';
    let blockNumber = 0n;
    let evidenceId = '';
    let dataHash = '';
    let status: number = 1;
    let errorMsg: string | undefined;

    try {
      const result = await this.storeEvidence(params);
      txHash = result.txHash;
      blockNumber = result.blockNumber;
      evidenceId = result.evidenceId;
      dataHash = result.dataHash;
      status = 1;
    } catch (e: any) {
      status = 2;
      dataHash = this.sha256(JSON.stringify(params.data));
      errorMsg = e?.message || String(e);
    }

    await this.prisma.blockchainLog.create({
      data: {
        riskEventId,
        txHash: txHash || `failed-${Date.now()}`,
        blockNumber: Number(blockNumber),
        dataHash,
        status,
        errorMsg,
      },
    });

    if (status === 2) throw new Error(`Blockchain store failed: ${errorMsg}`);
    return { txHash, blockNumber, evidenceId, dataHash };
  }

  /**
   * 查询存证
   */
  async getEvidence(evidenceId: string): Promise<EvidenceResult | null> {
    if (!this.enabled) return null;
    try {
      const callData = this.iface.encodeFunctionData('getEvidence', [evidenceId]);
      const raw = await this.rpcCall('eth_call', [
        { to: this.contractAddress, data: callData },
        'latest',
      ]);
      const decoded = this.iface.decodeFunctionResult('getEvidence', raw);
      return {
        evidenceId: decoded[0],
        riskEventNo: decoded[1],
        dataHash: decoded[2],
        dataType: decoded[3],
        timestamp: Number(decoded[4]),
        operator: decoded[5],
      };
    } catch {
      return null;
    }
  }

  /**
   * 验证数据哈希
   */
  async verifyByHash(dataHash: string): Promise<{ exists: boolean; evidenceId: string; timestamp: number }> {
    if (!this.enabled) return { exists: false, evidenceId: '', timestamp: 0 };
    const callData = this.iface.encodeFunctionData('verifyByHash', [dataHash]);
    const raw = await this.rpcCall('eth_call', [
      { to: this.contractAddress, data: callData },
      'latest',
    ]);
    const decoded = this.iface.decodeFunctionResult('verifyByHash', raw);
    return { exists: decoded[0], evidenceId: decoded[1], timestamp: Number(decoded[2]) };
  }

  /**
   * 获取链上存证总数
   */
  async getEvidenceCount(): Promise<number> {
    if (!this.enabled) return 0;
    const callData = this.iface.encodeFunctionData('evidenceCount', []);
    const raw = await this.rpcCall('eth_call', [
      { to: this.contractAddress, data: callData },
      'latest',
    ]);
    const decoded = this.iface.decodeFunctionResult('evidenceCount', raw);
    return Number(decoded[0]);
  }
}
