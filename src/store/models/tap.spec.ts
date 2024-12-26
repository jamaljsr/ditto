import { createStore } from 'easy-peasy';
import { defaultTapdMintAsset } from 'shared';
import { Status, TapdNode } from 'shared/types';
import * as PTAP from 'lib/tap/types';
import { initChartFromNetwork } from 'utils/chart';
import {
  defaultTapAsset,
  defaultTapBalance,
  getNetwork,
  injections,
  tapServiceMock,
  bitcoinServiceMock,
} from 'utils/tests';
import appModel from './app';
import bitcoinModel from './bitcoin';
import designerModel from './designer';
import lightningModel from './lightning';
import networkModel from './network';
import tapModel, { MintAssetPayload } from './tap';

describe('TAP Model', () => {
  const rootModel = {
    app: appModel,
    network: networkModel,
    lightning: lightningModel,
    bitcoin: bitcoinModel,
    designer: designerModel,
    tap: tapModel,
  };
  const network = getNetwork(1, 'tap network', Status.Stopped, 2);
  const initialState = {
    network: {
      networks: [network],
    },
    designer: {
      activeId: 1,
      allCharts: {
        1: initChartFromNetwork(network),
      },
    },
  };
  // initialize store for type inference
  let store = createStore(rootModel, { injections, initialState });
  const node = initialState.network.networks[0].nodes.tap[0] as TapdNode;

  beforeEach(() => {
    // reset the store before each test run
    store = createStore(rootModel, { injections, initialState });

    tapServiceMock.listAssets.mockResolvedValue([
      defaultTapAsset({ id: 'abcd', name: 'my-asset', amount: '100' }),
    ]);
    tapServiceMock.listBalances.mockResolvedValue([
      defaultTapBalance({ id: 'abcd', name: 'my-asset', balance: '100' }),
    ]);
  });

  it('should have a valid initial state', () => {
    expect(store.getState().tap.nodes).toEqual({});
  });

  it('should update state with getAssets response', async () => {
    await store.getActions().tap.getAssets(node);
    const nodeState = store.getState().tap.nodes[node.name];
    expect(nodeState.assets).toBeDefined();
    const assets = nodeState.assets as PTAP.TapAsset[];
    expect(assets[0].name).toEqual('my-asset');
    expect(assets[0].amount).toEqual('100');
  });

  it('should update state with getBalances response', async () => {
    await store.getActions().tap.getBalances(node);
    const nodeState = store.getState().tap.nodes[node.name];
    expect(nodeState.balances).toBeDefined();
    const balances = nodeState.balances as PTAP.TapBalance[];
    expect(balances[0].name).toEqual('my-asset');
    expect(balances[0].balance).toEqual('100');
  });

  it('should update state with getAllInfo response', async () => {
    await store.getActions().tap.getAllInfo(node);
    const nodeState = store.getState().tap.nodes[node.name];
    expect(nodeState.balances).toBeDefined();
    const assets = nodeState.assets as PTAP.TapAsset[];
    expect(assets[0].name).toEqual('my-asset');
    expect(assets[0].amount).toEqual('100');
    const balances = nodeState.balances as PTAP.TapBalance[];
    expect(balances[0].name).toEqual('my-asset');
    expect(balances[0].balance).toEqual('100');
  });

  it('should mint an asset and mine on the first bitcoin node', async () => {
    tapServiceMock.mintAsset.mockResolvedValue(defaultTapdMintAsset());
    const { lightning, tap } = store.getState().network.networks[0].nodes;
    lightning[1].backendName = 'invalid';
    const payload: MintAssetPayload = {
      node: tap[1] as TapdNode,
      assetType: PTAP.TAP_ASSET_TYPE.NORMAL,
      name: 'my-asset',
      amount: 100,
      enableEmission: false,
      finalize: true,
      autoFund: false,
      decimals: 0,
    };
    await store.getActions().tap.mintAsset(payload);
    expect(tapServiceMock.mintAsset).toHaveBeenCalledWith(
      tap[1],
      expect.objectContaining({ asset: expect.objectContaining({ name: 'my-asset' }) }),
    );
    expect(bitcoinServiceMock.mine).toHaveBeenCalledWith(
      6,
      expect.objectContaining({ name: 'backend1' }),
    );
  });

  it('should mint an asset without finalizing', async () => {
    tapServiceMock.mintAsset.mockResolvedValue(defaultTapdMintAsset());
    const { lightning, tap } = store.getState().network.networks[0].nodes;
    lightning[1].backendName = 'invalid';
    const payload: MintAssetPayload = {
      node: tap[1] as TapdNode,
      assetType: PTAP.TAP_ASSET_TYPE.NORMAL,
      name: 'my-asset',
      amount: 100,
      enableEmission: false,
      finalize: false,
      autoFund: false,
      decimals: 0,
    };
    await store.getActions().tap.mintAsset(payload);
    expect(tapServiceMock.mintAsset).toHaveBeenCalledWith(
      tap[1],
      expect.objectContaining({ asset: expect.objectContaining({ name: 'my-asset' }) }),
    );
    expect(tapServiceMock.finalizeBatch).not.toHaveBeenCalled();
    expect(bitcoinServiceMock.mine).not.toHaveBeenCalled();
  });

  it('should format the asset amount', async () => {
    const { formatAssetAmount } = store.getActions().tap;
    const payload = {
      assetId: 'abcd',
      amount: '10000',
      includeName: true,
    };

    tapServiceMock.listAssets.mockResolvedValue([
      defaultTapAsset({ id: 'abcd', name: 'my-asset', amount: '100', decimals: 2 }),
    ]);
    await store.getActions().tap.getAssets(node);
    expect(store.getState().tap.nodes[node.name].assets).toBeDefined();

    let result = formatAssetAmount(payload);
    expect(result).toEqual(`100.00 my-asset`);

    result = formatAssetAmount({ ...payload, includeName: false });
    expect(result).toEqual('100.00');

    // induce a missing asset situation
    tapServiceMock.listAssets.mockResolvedValue(undefined as any);
    await store.getActions().tap.getAssets(node);
    result = formatAssetAmount({ ...payload, assetId: 'efgh' });
    expect(result).toEqual('10000');
  });

  it('should convert an amount to asset units', async () => {
    const { toAssetUnits } = store.getActions().tap;
    const payload = {
      assetId: 'abcd',
      amount: 100,
    };

    tapServiceMock.listAssets.mockResolvedValue([
      defaultTapAsset({ id: 'abcd', name: 'my-asset', amount: '100', decimals: 2 }),
    ]);
    await store.getActions().tap.getAssets(node);

    let result = toAssetUnits(payload);
    expect(result).toEqual(10000);

    result = toAssetUnits({ ...payload, assetId: 'efgh' });
    expect(result).toEqual(100);

    // induce a missing asset situation
    tapServiceMock.listAssets.mockResolvedValue(undefined as any);
    await store.getActions().tap.getAssets(node);
    result = toAssetUnits(payload);
    expect(result).toEqual(100);
  });
});
