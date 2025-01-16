import { getNetwork } from 'utils/tests';
import service from './notImplementedService';

describe('NotImplementedService', () => {
  const node = getNetwork().nodes.bitcoin[0];
  node.implementation = 'btcd';
  const msg = (name: string) => `${name} is not implemented for btcd nodes`;

  it('should throw for all methods', () => {
    expect(() => service.waitUntilOnline(node)).toThrow(msg('waitUntilOnline'));
    expect(() => service.createDefaultWallet(node)).toThrow(msg('createDefaultWallet'));
    expect(() => service.getBlockchainInfo(node)).toThrow(msg('getBlockchainInfo'));
    expect(() => service.getWalletInfo(node)).toThrow(msg('getWalletInfo'));
    expect(() => service.getNewAddress(node)).toThrow(msg('getNewAddress'));
    expect(() => service.connectPeers(node)).toThrow(msg('connectPeers'));
    expect(() => service.mine(1, node)).toThrow(msg('mine'));
    expect(() => service.sendFunds(node, '', 0)).toThrow(msg('sendFunds'));
  });
});
