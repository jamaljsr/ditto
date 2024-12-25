import { debug } from 'electron-log';
import { BitcoinNode, EclairNode, LightningNode, OpenChannelOptions } from 'shared/types';
import { BitcoinFactory } from 'lib/bitcoin';
import { LightningService } from 'types';
import { waitFor } from 'utils/async';
import { toSats } from 'utils/units';
import * as PLN from '../types';
import { getListener, httpPost, removeListener, setupListener } from './eclairApi';
import * as ELN from './types';

const ChannelStateToStatus: Record<ELN.ChannelState, PLN.LightningNodeChannel['status']> =
  {
    WAIT_FOR_INIT_INTERNAL: 'Opening',
    WAIT_FOR_OPEN_CHANNEL: 'Opening',
    WAIT_FOR_ACCEPT_CHANNEL: 'Opening',
    WAIT_FOR_FUNDING_INTERNAL: 'Opening',
    WAIT_FOR_FUNDING_CREATED: 'Opening',
    WAIT_FOR_FUNDING_SIGNED: 'Opening',
    WAIT_FOR_FUNDING_CONFIRMED: 'Opening',
    WAIT_FOR_FUNDING_LOCKED: 'Opening',
    NORMAL: 'Open',
    SHUTDOWN: 'Closed',
    NEGOTIATING: 'Opening',
    CLOSING: 'Closing',
    CLOSED: 'Closed',
    OFFLINE: 'Open',
    SYNCING: 'Open',
    WAIT_FOR_REMOTE_PUBLISH_FUTURE_COMMITMENT: 'Opening',
    ERR_FUNDING_LOST: 'Error',
    ERR_INFORMATION_LEAK: 'Error',
  };

class EclairService implements LightningService {
  async getInfo(node: LightningNode): Promise<PLN.LightningNodeInfo> {
    const info = await httpPost<ELN.GetInfoResponse>(node, 'getinfo');
    return {
      pubkey: info.nodeId,
      alias: info.alias,
      rpcUrl:
        info.publicAddresses && info.publicAddresses[0]
          ? `${info.nodeId}@${info.publicAddresses[0]}`
          : '',
      syncedToChain: true,
      blockHeight: info.blockHeight,
      numActiveChannels: 0,
      numPendingChannels: 0,
      numInactiveChannels: 0,
    };
  }

  async getBalances(
    node: LightningNode,
    backend?: BitcoinNode,
  ): Promise<PLN.LightningNodeBalances> {
    const btcNode = this.validateBackend('getBalances', backend);
    const bitcoinFactory = new BitcoinFactory();
    const balances = await bitcoinFactory.getService(btcNode).getWalletInfo(btcNode);
    const unconfirmed = balances.unconfirmed_balance + balances.immature_balance;
    return {
      total: toSats(balances.balance + unconfirmed),
      confirmed: toSats(balances.balance),
      unconfirmed: toSats(unconfirmed),
    };
  }
  async getNewAddress(node: LightningNode): Promise<PLN.LightningNodeAddress> {
    const address = await httpPost<string>(node, 'getnewaddress');
    return { address };
  }

  async getChannels(node: LightningNode): Promise<PLN.LightningNodeChannel[]> {
    const channels = await httpPost<ELN.ChannelResponse[]>(node, 'channels');
    return channels
      .filter(
        c =>
          c.data.commitments?.localParams?.isFunder ||
          c.data.commitments?.localParams?.isInitiator ||
          c.data.commitments?.params?.localParams?.isInitiator ||
          c.data.commitments?.params?.localParams?.isChannelOpener,
      )
      .filter(c => ChannelStateToStatus[c.state] !== 'Closed')
      .map(c => {
        let capacity: string;
        let localBalance: number;
        let remoteBalance: number;
        let isPrivate: boolean;

        if ('0.8.0' === node.version || '0.7.0' === node.version) {
          const { localCommit, commitInput } = c.data.commitments;
          capacity = commitInput.amountSatoshis.toString(10);
          localBalance = localCommit.spec.toLocal;
          remoteBalance = localCommit.spec.toRemote;
          isPrivate = c.data.commitments.channelFlags.announceChannel === false;
        } else {
          // v0.9.0+
          const { fundingTx, localCommit } = c.data.commitments.active[0];
          capacity = fundingTx.amountSatoshis.toString(10);
          localBalance = localCommit.spec.toLocal;
          remoteBalance = localCommit.spec.toRemote;
          isPrivate = c.data.commitments.params.channelFlags.announceChannel === false;
        }
        const status = ChannelStateToStatus[c.state];
        return {
          pending: status !== 'Open',
          uniqueId: c.channelId.slice(-12),
          channelPoint: c.channelId,
          pubkey: c.nodeId,
          capacity,
          localBalance: this.toSats(localBalance),
          remoteBalance: this.toSats(remoteBalance),
          status,
          isPrivate,
        };
      });
  }

  async getPeers(node: LightningNode): Promise<PLN.LightningNodePeer[]> {
    const peers = await httpPost<ELN.PeerResponse[]>(node, 'peers');
    return peers.map(p => ({
      pubkey: p.nodeId,
      address: p.address || '',
    }));
  }

  async connectPeers(node: LightningNode, rpcUrls: string[]): Promise<void> {
    const peers = await this.getPeers(node);
    const keys = peers.map(p => p.pubkey);
    const newUrls = rpcUrls.filter(u => !keys.includes(u.split('@')[0]));
    for (const toRpcUrl of newUrls) {
      try {
        const body = { uri: toRpcUrl };
        await httpPost<{ uri: string }>(node, 'connect', body);
      } catch (error: any) {
        debug(
          `Failed to connect peer '${toRpcUrl}' to Eclair node ${node.name}:`,
          error.message,
        );
      }
    }
  }

  async openChannel({
    from,
    toRpcUrl,
    amount,
    isPrivate,
  }: OpenChannelOptions): Promise<PLN.LightningNodeChannelPoint> {
    // add peer if not connected already
    await this.connectPeers(from, [toRpcUrl]);
    // get pubkey of dest node
    const [toPubKey] = toRpcUrl.split('@');

    // open the channel
    const capacity = parseInt(amount);
    const body: ELN.OpenChannelRequest = {
      nodeId: toPubKey,
      fundingSatoshis: capacity,
      // regtest fee estimation is unusually high so increase the budget to 50% of capacity
      fundingFeeBudgetSatoshis: Math.round(capacity * 0.5),
      channelFlags: isPrivate ? 0 : 1, // 0 is private, 1 is public: https://acinq.github.io/eclair/#open-2
    };
    const res = await httpPost<string>(from, 'open', body);

    return {
      txid: res,
      // Eclair doesn't return the output index. hard-code to 0
      index: 0,
    };
  }

  async closeChannel(node: LightningNode, channelPoint: string): Promise<any> {
    const body: ELN.CloseChannelRequest = {
      channelId: channelPoint,
    };
    return await httpPost<string>(node, 'close', body);
  }

  async createInvoice(
    node: LightningNode,
    amount: number,
    memo?: string,
  ): Promise<string> {
    const body: ELN.CreateInvoiceRequest = {
      description: memo || `Payment to ${node.name}`,
      amountMsat: amount * 1000,
    };
    const inv = await httpPost<ELN.CreateInvoiceResponse>(node, 'createinvoice', body);

    return inv.serialized;
  }

  async payInvoice(
    node: LightningNode,
    invoice: string,
    amount?: number,
  ): Promise<PLN.LightningNodePayReceipt> {
    const amountMsat = amount ? amount * 1000 : undefined;
    const body: ELN.PayInvoiceRequest = { invoice, amountMsat };
    const id = await httpPost<string>(node, 'payinvoice', body);

    // payinvoice is fire-and-forget, so we need to poll to check for status updates.
    // poll for a success every second for up to 5 seconds
    await waitFor(() => this.getPaymentStatus(node, id), 1000, 5 * 1000);

    const res = await this.getPaymentStatus(node, id);
    const { status, paymentRequest, invoice: resInvoice } = res;
    const payReq = paymentRequest || resInvoice;
    return {
      preimage: status.paymentPreimage,
      amount: payReq.amount / 1000,
      destination: payReq.nodeId,
    };
  }

  async getPaymentStatus(
    node: LightningNode,
    id: string,
  ): Promise<ELN.GetSentInfoResponse> {
    const body: ELN.GetSentInfoRequest = { id };
    const attempts = await httpPost<ELN.GetSentInfoResponse[]>(node, 'getsentinfo', body);
    const sent = attempts.find(a => a.status.type === 'sent');
    if (!sent) {
      // throw an error with the failureMessage
      let msg = 'Failed to send payment';
      const failed = attempts.find(a => a.status.type === 'failed');
      if (failed) {
        const { failures } = failed.status;
        if (failures && failures.length) {
          msg = failures[0].failureMessage;
        }
      }
      throw new Error(msg);
    }

    return sent;
  }

  async decodeInvoice(node: LightningNode): Promise<PLN.LightningNodePaymentRequest> {
    throw new Error(`decodeInvoice is not implemented for ${node.implementation} nodes`);
  }

  /**
   * Helper function to continually query the LND node until a successful
   * response is received or it times out
   */
  async waitUntilOnline(
    node: LightningNode,
    interval = 3 * 1000, // check every 3 seconds
    timeout = 120 * 1000, // timeout after 120 seconds
  ): Promise<void> {
    return waitFor(
      async () => {
        await this.getInfo(node);
      },
      interval,
      timeout,
    );
  }

  async addListenerToNode(node: LightningNode): Promise<void> {
    setupListener(this.cast(node));
  }

  async removeListener(node: LightningNode): Promise<void> {
    removeListener(node);
  }

  async subscribeChannelEvents(
    node: LightningNode,
    callback: (event: PLN.LightningNodeChannelEvent) => void,
  ): Promise<void> {
    const listener = getListener(this.cast(node));
    debug(`Eclair API: [stream] ${node.name}: Listening for channel events`);
    // listen for incoming channel messages
    listener?.on('message', async (data: any) => {
      const response = JSON.parse(data.toString());
      debug(`Eclair API: [stream] ${node.name}`, response);
      switch (response.type) {
        case 'channel-created':
          callback({ type: 'Pending' });
          break;
        case 'channel-opened':
          callback({ type: 'Open' });
          break;
        case 'channel-closed':
          callback({ type: 'Closed' });
          break;
        default:
          callback({ type: 'Unknown' });
          break;
      }
    });
  }

  private toSats(msats: number): string {
    return (msats / 1000).toFixed(0).toString();
  }

  private validateBackend(action: string, backend?: BitcoinNode) {
    if (!backend) throw new Error(`EclairService ${action}: backend was not specified`);

    return backend as BitcoinNode;
  }

  private cast(node: LightningNode): EclairNode {
    if (node.implementation !== 'eclair')
      throw new Error(`EclairService cannot be used for '${node.implementation}' nodes`);

    return node as EclairNode;
  }
}

export default new EclairService();
