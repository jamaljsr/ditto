import * as TAP from '@lightningpolar/tapd-api';
import {
  action,
  Action,
  computed,
  Computed,
  thunk,
  Thunk,
  thunkOn,
  ThunkOn,
} from 'easy-peasy';
import { BitcoinNode, LightningNode, Status, TapdNode, TapNode } from 'shared/types';
import * as PLN from 'lib/lightning/types';
import * as PTAP from 'lib/tap/types';
import { StoreInjections } from 'types';
import { delay } from 'utils/async';
import { BLOCKS_TIL_CONFIRMED } from 'utils/constants';
import { mapToTapd } from 'utils/network';
import { formatDecimals } from 'utils/numbers';
import { RootModel } from './';

//This is the minimum balance that a tap node must have access to in order to mint assets
export const TAP_MIN_LND_BALANCE = 10000;

export interface TapNodeMapping {
  [key: string]: TapNodeModel;
}

export interface TapNodeModel {
  assets?: PTAP.TapAsset[];
  balances?: PTAP.TapBalance[];
  assetRoots?: PTAP.TapAssetRoot[];
}

export interface MintAssetPayload {
  node: TapNode;
  assetType: PTAP.TAP_ASSET_TYPE.NORMAL | PTAP.TAP_ASSET_TYPE.COLLECTIBLE;
  name: string;
  amount: number;
  enableEmission: boolean;
  finalize: boolean;
  autoFund: boolean;
  decimals: number;
}

export interface SyncUniversePayload {
  node: TapNode;
  hostname: string;
}

export interface NewAddressPayload {
  node: TapNode;
  assetId: string;
  amount: string;
}

export interface SendAssetPayload {
  node: TapNode;
  address: string;
  autoFund: boolean;
}

export interface DecodeAddressPayload {
  node: TapNode;
  address: string;
}

export interface FundChannelPayload {
  from: TapNode;
  to: LightningNode;
  assetId: string;
  amount: number;
}

export interface TapModel {
  nodes: TapNodeMapping;
  allAssetRoots: Computed<TapModel, PTAP.TapAssetRoot[], RootModel>;
  removeNode: Action<TapModel, string>;
  clearNodes: Action<TapModel, void>;
  setAssets: Action<TapModel, { node: TapNode; assets: PTAP.TapAsset[] }>;
  getAssets: Thunk<TapModel, TapNode, StoreInjections, RootModel>;
  setBalances: Action<TapModel, { node: TapNode; balances: PTAP.TapBalance[] }>;
  getBalances: Thunk<TapModel, TapNode, StoreInjections, RootModel>;
  setAssetRoots: Action<TapModel, { node: TapNode; roots: PTAP.TapAssetRoot[] }>;
  getAssetRoots: Thunk<TapModel, TapNode, StoreInjections, RootModel>;
  getAllInfo: Thunk<TapModel, TapNode, RootModel>;
  formatAssetAmount: Thunk<
    TapModel,
    { assetId: string; amount: string | number; includeName?: boolean },
    StoreInjections,
    RootModel,
    string
  >;
  toAssetUnits: Thunk<
    TapModel,
    { assetId: string; amount: number },
    StoreInjections,
    RootModel,
    number
  >;
  mintAsset: Thunk<TapModel, MintAssetPayload, StoreInjections, RootModel>;
  syncUniverse: Thunk<
    TapModel,
    SyncUniversePayload,
    StoreInjections,
    RootModel,
    Promise<number>
  >;
  getNewAddress: Thunk<
    TapModel,
    NewAddressPayload,
    StoreInjections,
    RootModel,
    Promise<PTAP.TapAddress>
  >;
  sendAsset: Thunk<TapModel, SendAssetPayload, StoreInjections, RootModel>;
  decodeAddress: Thunk<
    TapModel,
    DecodeAddressPayload,
    StoreInjections,
    RootModel,
    Promise<PTAP.TapAddress & { name?: string }>
  >;
  fundChannel: Thunk<TapModel, FundChannelPayload, StoreInjections, RootModel>;
  mineListener: ThunkOn<TapModel, StoreInjections, RootModel>;
}

const tapModel: TapModel = {
  // state properties
  nodes: {},
  // computed properties
  allAssetRoots: computed(state => {
    // map by asset id to dedupe
    const assets: Record<string, PTAP.TapAssetRoot> = {};
    // collect assets from all tap nodes in the network
    Object.values(state.nodes).forEach(node => {
      node.assetRoots?.forEach(r => {
        assets[r.id] = r;
      });
    });
    return Object.values(assets);
  }),
  // reducer actions (mutations allowed thx to immer)
  removeNode: action((state, name) => {
    if (state.nodes[name]) {
      delete state.nodes[name];
    }
  }),
  clearNodes: action(state => {
    state.nodes = {};
  }),
  setAssets: action((state, { node, assets }) => {
    if (!state.nodes[node.name]) state.nodes[node.name] = {};
    state.nodes[node.name].assets = assets;
  }),
  getAssets: thunk(async (actions, node, { injections }) => {
    const api = injections.tapFactory.getService(node);
    const assets = await api.listAssets(node);
    actions.setAssets({ node, assets });
  }),
  setBalances: action((state, { node, balances }) => {
    if (!state.nodes[node.name]) state.nodes[node.name] = {};
    state.nodes[node.name].balances = balances;
  }),
  getBalances: thunk(async (actions, node, { injections }) => {
    const api = injections.tapFactory.getService(node);
    const balances = await api.listBalances(node);
    actions.setBalances({ node, balances });
  }),
  setAssetRoots: action((state, { node, roots }) => {
    if (!state.nodes[node.name]) state.nodes[node.name] = {};
    state.nodes[node.name].assetRoots = roots;
  }),
  getAssetRoots: thunk(async (actions, node, { injections }) => {
    const api = injections.tapFactory.getService(node);
    const roots = await api.assetRoots(node);
    actions.setAssetRoots({ node, roots });
  }),
  getAllInfo: thunk(async (actions, node) => {
    await actions.getAssets(node);
    await actions.getBalances(node);
    await actions.getAssetRoots(node);
  }),
  formatAssetAmount: thunk(
    (actions, { assetId, amount, includeName }, { getStoreState }) => {
      // convert asset units to the amount with decimals
      for (const node of Object.values(getStoreState().tap.nodes)) {
        const asset = node.assets?.find(a => a.id === assetId);
        if (asset) {
          const amt = formatDecimals(Number(amount), asset.decimals);
          if (includeName) {
            return `${amt} ${asset.name}`;
          }
          return amt;
        }
      }
      return amount.toString();
    },
  ),
  toAssetUnits: thunk((actions, { assetId, amount }, { getStoreState }) => {
    // convert amount which may include decimals to integer asset units
    for (const node of Object.values(getStoreState().tap.nodes)) {
      const asset = node.assets?.find(a => a.id === assetId);
      if (asset) {
        return amount * 10 ** asset.decimals;
      }
    }
    return amount;
  }),
  mintAsset: thunk(
    async (actions, payload, { injections, getStoreState, getStoreActions }) => {
      const {
        node,
        assetType,
        name,
        amount,
        enableEmission,
        finalize,
        autoFund,
        decimals,
      } = payload;

      const network = getStoreState().network.networkById(node.networkId);
      if (
        autoFund &&
        (node.implementation === 'tapd' || node.implementation === 'litd')
      ) {
        // fund lnd node with 1M sats
        const lndNode = network.nodes.lightning.find(
          n => n.name === (node as TapdNode).lndName,
        ) as LightningNode;

        await getStoreActions().lightning.depositFunds({
          node: lndNode,
          sats: '1000000',
        });
      }

      // mint tap asset
      const api = injections.tapFactory.getService(node);

      const req: TAP.MintAssetRequestPartial = {
        asset: {
          assetType,
          name,
          amount: assetType === PTAP.TAP_ASSET_TYPE.COLLECTIBLE ? '1' : amount.toString(),
          newGroupedAsset: enableEmission,
          decimalDisplay: decimals,
          assetMeta:
            assetType === PTAP.TAP_ASSET_TYPE.COLLECTIBLE || decimals === 0
              ? undefined
              : { type: TAP.AssetMetaType.META_TYPE_JSON },
        },
      };
      const res = await api.mintAsset(node, req);

      // finalize asset
      if (finalize) {
        await api.finalizeBatch(node);

        // update network
        const btcNode = network.nodes.bitcoin[0];
        // missing await is intentional, we don't have to wait for bitcoin to mine
        getStoreActions().bitcoin.mine({
          blocks: BLOCKS_TIL_CONFIRMED,
          node: btcNode,
        });
      }

      return res;
    },
  ),
  syncUniverse: thunk(async (actions, payload, { injections }) => {
    const { node, hostname } = payload;
    const api = injections.tapFactory.getService(node);
    const res = await api.syncUniverse(node, hostname);
    await actions.getAllInfo(node);
    return res.syncedUniverses.length;
  }),
  getNewAddress: thunk(async (actions, payload, { injections }) => {
    const { node, assetId, amount } = payload;
    const api = injections.tapFactory.getService(node);
    return await api.newAddress(node, assetId, amount);
  }),
  sendAsset: thunk(
    async (
      actions,
      { node, address, autoFund },
      { injections, getState, getStoreState, getStoreActions },
    ) => {
      const network = getStoreState().network.networkById(node.networkId);
      if (
        autoFund &&
        (node.implementation === 'tapd' || node.implementation === 'litd')
      ) {
        // fund lnd node with 1M sats
        const lndNode = network.nodes.lightning.find(
          n => n.name === (node as TapdNode).lndName,
        ) as LightningNode;

        await getStoreActions().lightning.depositFunds({
          node: lndNode,
          sats: '1000000',
        });
      }
      const api = injections.tapFactory.getService(node);
      const sendReq: TAP.SendAssetRequestPartial = {
        tapAddrs: [address],
      };
      const res = await api.sendAsset(node, sendReq);
      // update network
      const btcNode: BitcoinNode = network.nodes.bitcoin[0];
      await getStoreActions().bitcoin.mine({
        blocks: BLOCKS_TIL_CONFIRMED,
        node: btcNode,
      });

      // sending assets takes a few seconds before it's reflected in the
      // balance, so fetch balances until the balance changes for up to
      // 10 seconds
      const { id } = await actions.decodeAddress({ node, address });
      const currentBalance = getState().nodes[node.name]?.balances?.find(
        b => b.id === id,
      )?.balance;
      for (let i = 0; i < 10; i++) {
        await actions.getAllInfo(node);
        const newBalance = getState().nodes[node.name]?.balances?.find(
          b => b.id === id,
        )?.balance;
        if (newBalance !== currentBalance) break;
        await delay(1000);
      }
      return res;
    },
  ),
  decodeAddress: thunk(
    async (actions, { node, address }, { injections, getStoreState }) => {
      const api = injections.tapFactory.getService(node);
      const sendReq: TAP.DecodeAddrRequestPartial = {
        addr: address,
      };
      const res = await api.decodeAddress(node, sendReq);
      const name = getStoreState().tap.nodes[node.name]?.assets?.find(
        a => a.id === res.id,
      )?.name;
      const decimals =
        getStoreState().tap.nodes[node.name]?.assets?.find(a => a.id === res.id)
          ?.decimals || 0;
      res.amount = formatDecimals(parseInt(res.amount), decimals);
      return { ...res, name };
    },
  ),
  fundChannel: thunk(
    async (
      actions,
      { from, to, assetId, amount },
      { injections, getStoreState, getStoreActions },
    ) => {
      const fromNode = getStoreState().tap.nodes[from.name];
      const assetBalance = fromNode?.balances?.find(b => b.id === assetId)?.balance;
      if (assetBalance && parseInt(assetBalance) < amount) {
        const decimals = fromNode?.assets?.find(a => a.id === assetId)?.decimals || 0;
        const amtLabel = formatDecimals(parseInt(assetBalance), decimals);
        throw new Error(`Capacity cannot exceed the asset balance of ${amtLabel}`);
      }
      // get the pubkey of the destination node
      const toNode = getStoreState().lightning.nodes[to.name];
      if (!toNode || !toNode.info) await getStoreActions().lightning.getInfo(to);
      // cast because it should never be undefined after calling getInfo above
      const { pubkey } = getStoreState().lightning.nodes[to.name]
        .info as PLN.LightningNodeInfo;

      const api = injections.tapFactory.getService(from);
      // ensure the recipient node's assets are in sync with the initiator node
      const hostname = `${from.name}:8443`;
      await actions.syncUniverse({ node: mapToTapd(to), hostname });
      // open the channel via the tap node
      await api.fundChannel(from, pubkey, assetId, amount);
      // wait for the unconfirmed tx to be processed by the bitcoin node
      await delay(500);
      // mine some blocks to confirm the txn
      const network = getStoreState().network.networkById(from.networkId);
      const btcNode = network.nodes.bitcoin[0];
      await getStoreActions().bitcoin.mine({
        blocks: BLOCKS_TIL_CONFIRMED,
        node: btcNode,
      });
      // add a small delay to allow nodes to process the mined blocks
      await delay(2000);
      // synchronize the chart with the new channel
      await getStoreActions().designer.syncChart(network);
    },
  ),
  mineListener: thunkOn(
    (actions, storeActions) => storeActions.bitcoin.mine,
    async (actions, { payload }, { getStoreState, getStoreActions }) => {
      const { notify } = getStoreActions().app;
      // update all tap nodes info when a block in mined
      const network = getStoreState().network.networkById(payload.node.networkId);
      await getStoreActions().lightning.waitForNodes(network.nodes.lightning);
      const nodes = [
        ...network.nodes.tap,
        ...network.nodes.lightning
          .filter(n => n.implementation === 'litd')
          .map(mapToTapd),
      ];
      await Promise.all(
        nodes
          .filter(n => n.status === Status.Started)
          .map(async n => {
            try {
              await actions.getAllInfo(n);
            } catch (error: any) {
              notify({ message: `Unable to retrieve assets for ${n.name}`, error });
            }
          }),
      );
    },
  ),
};

export default tapModel;
