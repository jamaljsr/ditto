/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChainInfo, WalletInfo } from 'bitcoin-core';
import { BitcoinNode } from 'shared/types';
import { BitcoinService } from 'types';

/**
 * A Bitcoin Service class whose functions are not yet implemented
 */
class NotImplementedService implements BitcoinService {
  waitUntilOnline(node: BitcoinNode): Promise<void> {
    throw new Error(
      `waitUntilOnline is not implemented for ${node.implementation} nodes`,
    );
  }
  createDefaultWallet(node: BitcoinNode): Promise<void> {
    throw new Error(
      `createDefaultWallet is not implemented for ${node.implementation} nodes`,
    );
  }
  getBlockchainInfo(node: BitcoinNode): Promise<ChainInfo> {
    throw new Error(
      `getBlockchainInfo is not implemented for ${node.implementation} nodes`,
    );
  }
  getWalletInfo(node: BitcoinNode): Promise<WalletInfo> {
    throw new Error(`getWalletInfo is not implemented for ${node.implementation} nodes`);
  }
  getNewAddress(node: BitcoinNode): Promise<string> {
    throw new Error(`getNewAddress is not implemented for ${node.implementation} nodes`);
  }
  connectPeers(node: BitcoinNode): Promise<void> {
    throw new Error(`connectPeers is not implemented for ${node.implementation} nodes`);
  }
  mine(numBlocks: number, node: BitcoinNode): Promise<string[]> {
    throw new Error(`mine is not implemented for ${node.implementation} nodes`);
  }
  sendFunds(node: BitcoinNode, addr: string, amount: number): Promise<string> {
    throw new Error(`sendFunds is not implemented for ${node.implementation} nodes`);
  }
}

export default new NotImplementedService();
