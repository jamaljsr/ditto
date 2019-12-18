import { createStore } from 'easy-peasy';
import { LndNode } from 'shared/types';
import {
  LightningNodeBalances,
  LightningNodeChannel,
  LightningNodeInfo,
} from 'lib/lightning/types';
import { BitcoindLibrary } from 'types';
import * as asyncUtil from 'utils/async';
import { initChartFromNetwork } from 'utils/chart';
import {
  defaultStateInfo,
  getNetwork,
  injections,
  lightningServiceMock,
  mockProperty,
} from 'utils/tests';
import bitcoindModel from './bitcoind';
import designerModel from './designer';
import lightningModel from './lightning';
import networkModel from './network';

jest.mock('utils/async');
const asyncUtilMock = asyncUtil as jest.Mocked<typeof asyncUtil>;
const bitcoindServiceMock = injections.bitcoindService as jest.Mocked<BitcoindLibrary>;

describe('Lightning Model', () => {
  const rootModel = {
    network: networkModel,
    lightning: lightningModel,
    bitcoind: bitcoindModel,
    designer: designerModel,
  };
  const network = getNetwork();
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
  const node = initialState.network.networks[0].nodes.lightning[0] as LndNode;

  beforeEach(() => {
    // reset the store before each test run
    store = createStore(rootModel, { injections, initialState });

    asyncUtilMock.delay.mockResolvedValue(Promise.resolve());
    bitcoindServiceMock.sendFunds.mockResolvedValue('txid');
    lightningServiceMock.getNewAddress.mockResolvedValue({ address: 'bc1aaaa' });
    lightningServiceMock.getInfo.mockResolvedValue(
      defaultStateInfo({
        alias: 'my-node',
        pubkey: 'abcdef',
        syncedToChain: true,
      }),
    );
    lightningServiceMock.getBalances.mockResolvedValue({
      confirmed: '100',
      unconfirmed: '200',
      total: '300',
    });
    lightningServiceMock.getChannels.mockResolvedValueOnce([]);
  });

  it('should have a valid initial state', () => {
    expect(store.getState().lightning.nodes).toEqual({});
  });

  it('should update state with getInfo response', async () => {
    const { getInfo } = store.getActions().lightning;
    await getInfo(node);
    const nodeState = store.getState().lightning.nodes[node.name];
    expect(nodeState.info).toBeDefined();
    const info = nodeState.info as LightningNodeInfo;
    expect(info.alias).toEqual('my-node');
    expect(info.pubkey).toEqual('abcdef');
    expect(info.syncedToChain).toEqual(true);
  });

  it('should update state with getBalance response', async () => {
    const { getWalletBalance } = store.getActions().lightning;
    await getWalletBalance(node);
    const nodeState = store.getState().lightning.nodes[node.name];
    expect(nodeState.walletBalance).toBeDefined();
    const balances = nodeState.walletBalance as LightningNodeBalances;
    expect(balances.confirmed).toEqual('100');
    expect(balances.unconfirmed).toEqual('200');
    expect(balances.total).toEqual('300');
  });

  it('should update state with getChannels response', async () => {
    const { getChannels } = store.getActions().lightning;
    await getChannels(node);
    const nodeState = store.getState().lightning.nodes[node.name];
    expect(nodeState.channels).toBeDefined();
    const channels = nodeState.channels as LightningNodeChannel[];
    expect(channels).toEqual([]);
  });

  it('should be able to deposit funds using the backend bitcoin node', async () => {
    const { depositFunds } = store.getActions().lightning;
    await depositFunds({ node, sats: '50000' });
    const nodeState = store.getState().lightning.nodes[node.name];
    expect(nodeState.walletBalance).toBeDefined();
    const balances = nodeState.walletBalance as LightningNodeBalances;
    expect(balances.confirmed).toEqual('100');
    expect(balances.unconfirmed).toEqual('200');
    expect(balances.total).toEqual('300');
  });

  it('should be able to deposit funds using the first bitcoin node', async () => {
    const { depositFunds } = store.getActions().lightning;
    const modifiednode = { ...node, backendName: 'not-valid' };
    await depositFunds({ node: modifiednode, sats: '50000' });
    const nodeState = store.getState().lightning.nodes[node.name];
    expect(nodeState.walletBalance).toBeDefined();
    const balances = nodeState.walletBalance as LightningNodeBalances;
    expect(balances.confirmed).toEqual('100');
    expect(balances.unconfirmed).toEqual('200');
    expect(balances.total).toEqual('300');
  });

  it('should not throw an error when connecting peers', async () => {
    const { connectAllPeers } = store.getActions().lightning;
    lightningServiceMock.getInfo.mockResolvedValue(defaultStateInfo({ rpcUrl: 'asdf' }));
    lightningServiceMock.getInfo.mockRejectedValueOnce(new Error('getInfo-error'));
    await expect(connectAllPeers(network)).resolves.not.toThrow();
  });

  it('should open a channel successfully', async () => {
    lightningServiceMock.getInfo.mockResolvedValueOnce(
      defaultStateInfo({
        pubkey: 'abcdef',
        syncedToChain: true,
        rpcUrl: 'abcdef@1.1.1.1:9735',
      }),
    );

    const [from, to] = store.getState().network.networks[0].nodes.lightning;
    const sats = '1000';
    const { openChannel, getInfo } = store.getActions().lightning;
    await getInfo(to);
    await openChannel({ from, to, sats, autoFund: false });
    expect(lightningServiceMock.getInfo).toBeCalledTimes(1);
    expect(lightningServiceMock.openChannel).toBeCalledTimes(1);
    expect(bitcoindServiceMock.mine).toBeCalledTimes(1);
  });

  it('should open a channel and mine on the first bitcoin node', async () => {
    lightningServiceMock.getInfo.mockResolvedValueOnce(
      defaultStateInfo({
        pubkey: 'abcdef',
        syncedToChain: true,
        rpcUrl: 'abcdef@1.1.1.1:9735',
      }),
    );

    const [from, to] = store.getState().network.networks[0].nodes.lightning;
    from.backendName = 'invalid';
    const sats = '1000';
    const { openChannel, getInfo } = store.getActions().lightning;
    await getInfo(to);
    await openChannel({ from, to, sats, autoFund: false });
    const btcNode = store.getState().network.networks[0].nodes.bitcoin[0];
    expect(bitcoindServiceMock.mine).toBeCalledWith(6, btcNode);
  });

  it('should cause some delay waiting for nodes', async () => {
    mockProperty(process.env, 'NODE_ENV', 'production');

    const { waitForNodes } = store.getActions().lightning;
    await waitForNodes(network.nodes.lightning);
    expect(asyncUtilMock.delay).toBeCalledWith(2000);

    mockProperty(process.env, 'NODE_ENV', 'test');
  });
});
