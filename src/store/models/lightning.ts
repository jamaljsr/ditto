import { Action, action, Thunk, thunk, ThunkOn, thunkOn } from 'easy-peasy';
import { throttle } from 'lodash';
import { LightningNode, Status } from 'shared/types';
import * as PLN from 'lib/lightning/types';
import { ChannelInfo, Network, PreInvoice, StoreInjections } from 'types';
import { delay } from 'utils/async';
import { BLOCKS_TIL_CONFIRMED } from 'utils/constants';
import { getInvoicePayload } from 'utils/network';
import { fromSatsNumeric } from 'utils/units';
import { RootModel } from './';
import { LightningNodeChannel } from 'lib/lightning/types';

export interface LightningNodeMapping {
  [key: string]: LightningNodeModel;
}

export interface LightningNodeModel {
  info?: PLN.LightningNodeInfo;
  walletBalance?: PLN.LightningNodeBalances;
  channels?: PLN.LightningNodeChannel[];
}

export interface DepositFundsPayload {
  node: LightningNode;
  sats: string;
}

export interface OpenChannelPayload {
  from: LightningNode;
  to: LightningNode;
  sats: string;
  autoFund: boolean;
  isPrivate: boolean;
}

export interface CreateInvoicePayload {
  node: LightningNode;
  amount: number;
  memo?: string;
}

export interface PayInvoicePayload {
  node: LightningNode;
  invoice: string;
  amount?: number;
}

export interface LightningModel {
  nodes: LightningNodeMapping;
  channelsInfo: ChannelInfo[];
  removeNode: Action<LightningModel, string>;
  clearNodes: Action<LightningModel, void>;
  setInfo: Action<LightningModel, { node: LightningNode; info: PLN.LightningNodeInfo }>;
  getInfo: Thunk<LightningModel, LightningNode, StoreInjections, RootModel>;
  setWalletBalance: Action<
    LightningModel,
    { node: LightningNode; balance: PLN.LightningNodeBalances }
  >;
  getWalletBalance: Thunk<LightningModel, LightningNode, StoreInjections, RootModel>;
  setChannels: Action<
    LightningModel,
    { node: LightningNode; channels: LightningNodeModel['channels'] }
  >;
  getChannels: Thunk<LightningModel, LightningNode, StoreInjections, RootModel>;
  getAllInfo: Thunk<LightningModel, LightningNode, StoreInjections, RootModel>;
  connectAllPeers: Thunk<LightningModel, Network, StoreInjections, RootModel>;
  depositFunds: Thunk<LightningModel, DepositFundsPayload, StoreInjections, RootModel>;
  openChannel: Thunk<LightningModel, OpenChannelPayload, StoreInjections, RootModel>;
  closeChannel: Thunk<
    LightningModel,
    { node: LightningNode; channelPoint: string },
    StoreInjections,
    RootModel
  >;
  createInvoice: Thunk<
    LightningModel,
    CreateInvoicePayload,
    StoreInjections,
    RootModel,
    Promise<string>
  >;
  payInvoice: Thunk<
    LightningModel,
    PayInvoicePayload,
    StoreInjections,
    RootModel,
    Promise<PLN.LightningNodePayReceipt>
  >;
  waitForNodes: Thunk<LightningModel, LightningNode[], StoreInjections, RootModel>;
  mineListener: ThunkOn<LightningModel, StoreInjections, RootModel>;
  addListeners: Thunk<LightningModel, Network, StoreInjections, RootModel>;
  removeListeners: Thunk<LightningModel, Network, StoreInjections, RootModel>;
  addChannelListeners: Thunk<LightningModel, Network, StoreInjections, RootModel>;
  setChannelsInfo: Action<LightningModel, ChannelInfo[]>;
  resetChannelsInfo: Thunk<LightningModel, Network, StoreInjections, RootModel>;
  manualBalanceChannelsInfo: Action<LightningModel, { value: number; index: number }>;
  autoBalanceChannelsInfo: Action<LightningModel>;
  updateBalanceOfChannels: Thunk<LightningModel, Network, StoreInjections, RootModel>;
  balanceChannels: Thunk<
    LightningModel,
    { id: number; toPay: PreInvoice[] },
    StoreInjections,
    RootModel
  >;
}

const lightningModel: LightningModel = {
  // state properties
  nodes: {},
  channelsInfo: [],
  // reducer actions (mutations allowed thx to immer)
  removeNode: action((state, name) => {
    if (state.nodes[name]) {
      delete state.nodes[name];
    }
  }),
  clearNodes: action(state => {
    state.nodes = {};
  }),
  setInfo: action((state, { node, info }) => {
    if (!state.nodes[node.name]) state.nodes[node.name] = {};
    state.nodes[node.name].info = info;
  }),
  getInfo: thunk(async (actions, node, { injections }) => {
    const api = injections.lightningFactory.getService(node);
    const info = await api.getInfo(node);
    actions.setInfo({ node, info });
  }),
  setWalletBalance: action((state, { node, balance }) => {
    if (!state.nodes[node.name]) state.nodes[node.name] = {};
    state.nodes[node.name].walletBalance = balance;
  }),
  getWalletBalance: thunk(async (actions, node, { injections, getStoreActions }) => {
    const api = injections.lightningFactory.getService(node);
    const backend = getStoreActions().network.getBackendNode(node);
    const balance = await api.getBalances(node, backend);
    actions.setWalletBalance({ node, balance });
  }),
  setChannels: action((state, { node, channels }) => {
    if (!state.nodes[node.name]) state.nodes[node.name] = {};
    state.nodes[node.name].channels = channels;
  }),
  getChannels: thunk(async (actions, node, { injections }) => {
    const api = injections.lightningFactory.getService(node);
    const channels = await api.getChannels(node);
    actions.setChannels({ node, channels });
    return channels;
  }),
  getAllInfo: thunk(async (actions, node) => {
    await actions.getInfo(node);
    await actions.getWalletBalance(node);
    await actions.getChannels(node);
  }),
  connectAllPeers: thunk(async (actions, network, { injections, getState }) => {
    // fetch info for each ln node
    for (const node of network.nodes.lightning) {
      // swallow any error when connecting peers in case a single node fails to start
      try {
        await actions.getInfo(node);
      } catch {}
    }
    const { nodes } = getState();
    // make a list of rpcUrls and a map of name -> pubkey
    const rpcUrls: string[] = [];
    const pubKeys: Record<string, string> = {};
    Object.values(nodes).forEach(n => {
      if (n.info) {
        pubKeys[n.info.alias] = n.info.pubkey;
        rpcUrls.push(n.info.rpcUrl);
      }
    });

    for (const node of network.nodes.lightning) {
      const pubkey = pubKeys[node.name];
      // filter out the node's own rpcUrl
      const urls = pubkey ? rpcUrls.filter(u => !u.startsWith(pubkey)) : rpcUrls;
      await injections.lightningFactory.getService(node).connectPeers(node, urls);
    }
  }),
  depositFunds: thunk(
    async (actions, { node, sats }, { injections, getStoreState, getStoreActions }) => {
      const { nodes } = getStoreState().network.networkById(node.networkId);
      const btcNode = nodes.bitcoin[0];
      const api = injections.lightningFactory.getService(node);
      const { address } = await api.getNewAddress(node);
      const coins = fromSatsNumeric(sats);
      await injections.bitcoindService.sendFunds(btcNode, address, coins);
      await getStoreActions().bitcoind.mine({
        blocks: BLOCKS_TIL_CONFIRMED,
        node: btcNode,
      });
      // add a small delay to allow nodes to process the mined blocks
      await actions.waitForNodes([node]);
      await actions.getWalletBalance(node);
    },
  ),
  openChannel: thunk(
    async (
      actions,
      { from, to, sats, autoFund, isPrivate },
      { injections, getStoreState, getStoreActions },
    ) => {
      // automatically deposit funds when the node doesn't have enough to open the channel
      if (autoFund) {
        const fund = (parseInt(sats) * 2).toString();
        await actions.depositFunds({ node: from, sats: fund });
      }
      // get the rpcUrl of the destination node
      const toNode = getStoreState().lightning.nodes[to.name];
      if (!toNode || !toNode.info) await actions.getInfo(to);
      // cast because it should never be undefined after calling getInfo above
      const { rpcUrl } = getStoreState().lightning.nodes[to.name]
        .info as PLN.LightningNodeInfo;
      // open the channel via lightning node
      const api = injections.lightningFactory.getService(from);
      await api.openChannel({ from, toRpcUrl: rpcUrl, amount: sats, isPrivate });
      // wait for the unconfirmed tx to be processed by the bitcoin node
      await delay(500);
      // mine some blocks to confirm the txn
      const network = getStoreState().network.networkById(from.networkId);
      const btcNode =
        network.nodes.bitcoin.find(n => n.name === from.backendName) ||
        network.nodes.bitcoin[0];
      await getStoreActions().bitcoind.mine({
        blocks: BLOCKS_TIL_CONFIRMED,
        node: btcNode,
      });
      // add a small delay to allow nodes to process the mined blocks
      await actions.waitForNodes([from, to]);
      // synchronize the chart with the new channel
      await getStoreActions().designer.syncChart(network);
      // synchronize channels info
      await actions.resetChannelsInfo(network);
    },
  ),
  closeChannel: thunk(
    async (
      actions,
      { node, channelPoint },
      { injections, getStoreState, getStoreActions },
    ) => {
      const api = injections.lightningFactory.getService(node);
      await api.closeChannel(node, channelPoint);
      // add a small delay to allow nodes to create the closing txn and broadcast it
      await actions.waitForNodes([node]);
      // mine some blocks to confirm the txn
      const network = getStoreState().network.networkById(node.networkId);
      const btcNode = network.nodes.bitcoin[0];
      await getStoreActions().bitcoind.mine({
        blocks: BLOCKS_TIL_CONFIRMED,
        node: btcNode,
      });
      // add a small delay to allow nodes to process the mined blocks
      await actions.waitForNodes([node]);
      // synchronize the chart with the new channel
      await getStoreActions().designer.syncChart(network);
      // synchronize channels info
      await actions.resetChannelsInfo(network);
    },
  ),
  createInvoice: thunk(async (actions, { node, amount, memo }, { injections }) => {
    const api = injections.lightningFactory.getService(node);
    return await api.createInvoice(node, amount, memo);
  }),
  payInvoice: thunk(
    async (
      actions,
      { node, invoice, amount },
      { injections, getStoreState, getStoreActions },
    ) => {
      const api = injections.lightningFactory.getService(node);
      const receipt = await api.payInvoice(node, invoice, amount);

      const network = getStoreState().network.networkById(node.networkId);
      // synchronize the chart with the new channel
      await getStoreActions().lightning.waitForNodes(network.nodes.lightning);
      await getStoreActions().designer.syncChart(network);

      return receipt;
    },
  ),
  waitForNodes: thunk(async (actions, nodes) => {
    // TODO: move this check into the delay() func
    if (process.env.NODE_ENV === 'test') return;
    // mapping of the number of seconds to wait for each implementation
    const nodeDelays: Record<LightningNode['implementation'], number> = {
      LND: 1,
      'c-lightning': 2,
      eclair: 2,
      litd: 1,
    };
    // determine the highest delay of all implementations
    const longestDelay = nodes.reduce(
      (d, node) => Math.max(d, nodeDelays[node.implementation]),
      0,
    );
    await delay(longestDelay * 1000);
  }),
  mineListener: thunkOn(
    (actions, storeActions) => storeActions.bitcoind.mine,
    async (actions, { payload }, { getStoreState, getStoreActions }) => {
      const { notify } = getStoreActions().app;
      // update all lightning nodes info when a block in mined
      const network = getStoreState().network.networkById(payload.node.networkId);
      await actions.waitForNodes(network.nodes.lightning);
      await Promise.all(
        network.nodes.lightning
          .filter(n => n.status === Status.Started)
          .map(async n => {
            try {
              await actions.getAllInfo(n);
            } catch (error: any) {
              notify({ message: `Unable to retrieve node info from ${n.name}`, error });
            }
          }),
      );
    },
  ),
  addListeners: thunk(async (actions, network, { injections, getStoreState }) => {
    const { nodes } = getStoreState().network.networkById(network.id);
    for (const node of nodes.lightning) {
      await injections.lightningFactory.getService(node).addListenerToNode(node);
    }
    // subscribe to channel events
    actions.addChannelListeners(network);
    // TODO: subscribe to channel payment/balances
  }),
  removeListeners: thunk(async (actions, network, { injections, getStoreState }) => {
    const { nodes } = getStoreState().network.networkById(network.id);
    nodes.lightning.forEach(
      async node =>
        await injections.lightningFactory.getService(node).removeListener(node),
    );
  }),
  addChannelListeners: thunk(
    async (actions, network, { injections, getStoreState, getStoreActions }) => {
      const { nodes } = getStoreState().network.networkById(network.id);

      // throttle the sync to avoid too many back to back requests
      const syncThrottled = throttle(
        () => {
          const net = getStoreState().network.networks.find(n => n.id === network.id);
          if (net?.status !== Status.Started) return;
          getStoreActions().designer.syncChart(net);
        },
        5 * 1000,
        { leading: true, trailing: false },
      );

      for (const node of nodes.lightning) {
        await injections.lightningFactory
          .getService(node)
          .subscribeChannelEvents(node, async (event: PLN.LightningNodeChannelEvent) => {
            if (event.type !== 'Unknown') {
              await actions.waitForNodes([node]);
              syncThrottled();
            }
          });
      }
    },
  ),
  setChannelsInfo: action((state, payload) => {
    state.channelsInfo = payload;
  }),
  resetChannelsInfo: thunk(async (actions, network, { getStoreState }) => {
    const channels = [] as LightningNodeChannel[];
    const { getChannels } = actions;
    const { links } = getStoreState().designer.activeChart;

    const id2Node = {} as Record<string, LightningNode>;
    const channelsInfo = [] as ChannelInfo[];

    await Promise.all(
      network.nodes.lightning.map(async node => {
        const nodeChannels = await getChannels(node);
        channels.push(...nodeChannels);
        id2Node[node.name] = node;
      }),
    );

    for (const channel of channels) {
      const { uniqueId: id, localBalance, remoteBalance } = channel;
      if (!links[id]) continue;
      const from = links[id].from.nodeId;
      const to = links[id].to.nodeId;
      if (!to) continue;
      const nextLocalBalance = Number(localBalance);
      channelsInfo.push({
        id,
        to,
        from,
        localBalance,
        remoteBalance,
        nextLocalBalance,
      });
    }

    actions.setChannelsInfo(channelsInfo);
  }),
  manualBalanceChannelsInfo: action((state, { value, index }) => {
    const { channelsInfo: info } = state;
    if (info && info[index]) {
      info[index].nextLocalBalance = value;
      state.channelsInfo = info;
    }
  }),
  autoBalanceChannelsInfo: action(state => {
    const { channelsInfo } = state;
    if (!channelsInfo) {
      return;
    }
    for (let index = 0; index < channelsInfo.length; index += 1) {
      const { localBalance, remoteBalance } = channelsInfo[index];
      const halfAmount = Math.floor((Number(localBalance) + Number(remoteBalance)) / 2);
      channelsInfo[index].nextLocalBalance = halfAmount;
    }
    state.channelsInfo = channelsInfo;
  }),
  updateBalanceOfChannels: thunk(
    async (actions, network, { getStoreActions, getState }) => {
      const { notify } = getStoreActions().app;
      const { hideBalanceChannels } = getStoreActions().modals;
      const { channelsInfo } = getState();

      if (!channelsInfo) return;

      const toPay: PreInvoice[] = channelsInfo
        .filter(c => Number(c.localBalance) !== c.nextLocalBalance)
        .map(c => ({ channelId: c.id, nextLocalBalance: c.nextLocalBalance }));

      await actions.balanceChannels({ id: network.id, toPay });
      await hideBalanceChannels();
      notify({ message: 'Channels balanced!' });
    },
  ),
  balanceChannels: thunk(async (actions, { id, toPay }, { getStoreState }) => {
    const { networks } = getStoreState().network;
    const network = networks.find(n => n.id === id);
    if (!network) throw new Error('networkByIdErr');
    const { createInvoice, payInvoice, getChannels } = actions;
    const lnNodes = network.nodes.lightning;
    const channels = [] as LightningNodeChannel[];
    const id2Node = {} as Record<string, LightningNode>;
    const id2channel = {} as Record<string, LightningNodeChannel>;

    await Promise.all(
      lnNodes.map(async node => {
        id2Node[node.name] = node;
        const nodeChannels = await getChannels(node);
        channels.push(...nodeChannels);
      }),
    );

    channels.forEach(channel => (id2channel[channel.uniqueId] = channel));
    const minimumSatsDifference = 50;
    const links = getStoreState().designer.activeChart.links;

    await Promise.all(
      toPay.map(async ({ channelId, nextLocalBalance }) => {
        const channel = id2channel[channelId];
        const { to, from } = links[channelId];
        if (!to.nodeId) return;
        const fromNode = id2Node[from.nodeId];
        const toNode = id2Node[to.nodeId];
        const payload = getInvoicePayload(channel, fromNode, toNode, nextLocalBalance);

        if (payload.amount < minimumSatsDifference) return;

        const invoice = await createInvoice({
          node: payload.target,
          amount: payload.amount,
        });

        await payInvoice({
          invoice,
          node: payload.source,
        });
      }),
    );
  }),
};

export default lightningModel;
