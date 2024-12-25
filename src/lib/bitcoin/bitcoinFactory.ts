import { BitcoinNode } from 'shared/types';
import { bitcoindService } from 'lib/bitcoin/bitcoind';
import { BitcoinService } from 'types';
import notImplementedService from './notImplementedService';

/**
 * A factory class used to obtain a Bitcoin service based on
 * the node's implementation
 */
class BitcoinFactory {
  /**
   * The mapping of implementation types to services
   */
  private _services: Record<BitcoinNode['implementation'], BitcoinService>;

  constructor() {
    this._services = {
      bitcoind: bitcoindService,
      btcd: notImplementedService, // TODO: To be replaced with btcd service
    };
  }

  /**
   * Returns a Bitcoin service for the given node
   * @param node the Bitcoin node object
   */
  getService(node: BitcoinNode): BitcoinService {
    return this._services[node.implementation];
  }
}

export default BitcoinFactory;
