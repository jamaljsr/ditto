import { createStore } from 'easy-peasy';
import { LitdNode } from 'shared/types';
import { LightningNodeChannelAsset } from 'lib/lightning/types';
import { Session } from 'lib/litd/types';
import { initChartFromNetwork } from 'utils/chart';
import { defaultRepoState } from 'utils/constants';
import { createNetwork, mapToTapd } from 'utils/network';
import {
  defaultLitSession,
  defaultStateChannel,
  defaultStateInfo,
  injections,
  lightningServiceMock,
  litdServiceMock,
  tapServiceMock,
  testManagedImages,
} from 'utils/tests';
import appModel from './app';
import bitcoinModel from './bitcoin';
import designerModel from './designer';
import lightningModel from './lightning';
import litModel from './lit';
import networkModel from './network';

describe('LIT Model', () => {
  const rootModel = {
    app: appModel,
    network: networkModel,
    lightning: lightningModel,
    bitcoin: bitcoinModel,
    designer: designerModel,
    lit: litModel,
  };
  const network = createNetwork({
    id: 1,
    name: 'my network',
    description: 'network description',
    lndNodes: 0,
    clightningNodes: 0,
    eclairNodes: 0,
    bitcoindNodes: 1,
    tapdNodes: 0,
    litdNodes: 3,
    repoState: defaultRepoState,
    managedImages: testManagedImages,
    customImages: [],
  });
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
  const node = initialState.network.networks[0].nodes.lightning[0] as LitdNode;

  beforeEach(() => {
    // reset the store before each test run
    store = createStore(rootModel, { injections, initialState });
  });

  it('should have a valid initial state', () => {
    expect(store.getState().lit.nodes).toEqual({});
  });

  it('should remove node state', async () => {
    await store.getActions().lit.getSessions(node);
    expect(store.getState().lit.nodes[node.name]).toBeDefined();
    store.getActions().lit.removeNode(node.name);
    expect(store.getState().lit.nodes[node.name]).toBeUndefined();
  });

  describe('sessions', () => {
    beforeEach(() => {
      litdServiceMock.listSessions.mockResolvedValue([
        defaultLitSession({
          label: 'test',
        }),
      ]);
      litdServiceMock.addSession.mockResolvedValue(
        defaultLitSession({
          label: 'add test',
        }),
      );
    });

    it('should update state with getSessions response', async () => {
      await store.getActions().lit.getSessions(node);
      const nodeState = store.getState().lit.nodes[node.name];
      expect(nodeState.sessions).toBeDefined();
      const sessions = nodeState.sessions as Session[];
      expect(sessions[0].label).toEqual('test');
    });

    it('should add a session', async () => {
      await store.getActions().lit.addSession({
        node,
        label: 'add test',
        type: 'Admin',
        expiresAt: 123456,
        mailboxServerAddr: 'test.mailbox.com',
      });
      const nodeState = store.getState().lit.nodes[node.name];
      expect(nodeState.sessions).toBeDefined();
      const sessions = nodeState.sessions as Session[];
      expect(sessions[0].label).toEqual('test');
    });

    it('should revoke a session', async () => {
      await expect(
        store.getActions().lit.revokeSession({
          node,
          localPublicKey: 'abcdef',
        }),
      ).resolves.not.toThrow();
      expect(litdServiceMock.revokeSession).toHaveBeenCalledWith(node, 'abcdef');
    });
  });

  describe('asset payments', () => {
    beforeEach(() => {
      const asset: LightningNodeChannelAsset = {
        id: 'test-id',
        name: 'test asset',
        capacity: '1000',
        localBalance: '600',
        remoteBalance: '400',
      };
      lightningServiceMock.getChannels.mockResolvedValue([
        defaultStateChannel({ assets: [asset] }),
      ]);
      lightningServiceMock.decodeInvoice.mockResolvedValue({
        paymentHash: 'pmt-hash',
        amountMsat: '100000',
        expiry: '123456',
      });
      tapServiceMock.addInvoice.mockResolvedValue('lnbc1invoice');
      tapServiceMock.sendPayment.mockResolvedValue({
        preimage: 'preimage',
        destination: 'asdf',
        amount: 1000,
      });
    });

    it('should create an asset invoice', async () => {
      await store.getActions().lightning.getChannels(node);
      const res = await store.getActions().lit.createAssetInvoice({
        node,
        assetId: 'test-id',
        amount: 200,
      });
      expect(res).toEqual({ invoice: 'lnbc1invoice', sats: 100 });
    });

    it('should throw an error when creating an asset invoice with a high balance', async () => {
      await expect(
        store.getActions().lit.createAssetInvoice({
          node,
          assetId: 'test-id',
          amount: 700,
        }),
      ).rejects.toThrow('Not enough assets in a channel to create the invoice');
    });

    it('should pay an asset invoice', async () => {
      await store.getActions().lightning.getChannels(node);
      const receipt = await store.getActions().lit.payAssetInvoice({
        node,
        assetId: 'test-id',
        invoice: 'lnbc1invoice',
      });
      expect(receipt).toEqual({
        preimage: 'preimage',
        destination: 'asdf',
        amount: 1000,
      });
    });

    it('should pay an asset invoice with a percentage fee limit', async () => {
      await store.getActions().lightning.getChannels(node);
      lightningServiceMock.decodeInvoice.mockResolvedValue({
        paymentHash: 'pmt-hash',
        amountMsat: '10000000',
        expiry: '123456',
      });
      const receipt = await store.getActions().lit.payAssetInvoice({
        node,
        assetId: 'test-id',
        invoice: 'lnbc1invoice',
      });
      expect(tapServiceMock.sendPayment).toHaveBeenCalledWith(
        mapToTapd(node),
        'test-id',
        'lnbc1invoice',
        500000,
        '',
      );
      expect(receipt).toEqual({
        preimage: 'preimage',
        destination: 'asdf',
        amount: 1000,
      });
    });

    it('should throw an error when paying an asset invoice with a low balance', async () => {
      await expect(
        store.getActions().lit.payAssetInvoice({
          node,
          assetId: 'test-id',
          invoice: 'lnbc1invoice',
        }),
      ).rejects.toThrow('Not enough assets in a channel to pay the invoice');
    });
  });

  describe('getAssetsInChannels', () => {
    const asset: LightningNodeChannelAsset = {
      id: 'test-id',
      name: 'test asset',
      capacity: '1000',
      localBalance: '600',
      remoteBalance: '400',
    };
    const node2 = initialState.network.networks[0].nodes.lightning[1] as LitdNode;
    const node3 = initialState.network.networks[0].nodes.lightning[2] as LitdNode;

    beforeEach(() => {});

    it('should use the higher balance with multiple asset channels', async () => {
      const asset1 = { ...asset, localBalance: '400' };
      const asset2 = { ...asset, localBalance: '700' };
      const asset3 = { ...asset, localBalance: '500' };
      const channels = [
        defaultStateChannel({ uniqueId: 'chan1', assets: [asset1] }),
        defaultStateChannel({ uniqueId: 'chan2', assets: [asset2] }),
        defaultStateChannel({ uniqueId: 'chan3', assets: [asset3] }),
      ];
      store.getActions().lightning.setChannels({ node, channels });
      const assets = store.getActions().lit.getAssetsInChannels({ nodeName: node.name });
      expect(assets).toHaveLength(1);
      expect(assets[0].asset.localBalance).toEqual('700');
    });

    it('should discover assets in the channels of other nodes', async () => {
      const aliceInfo = defaultStateInfo({ pubkey: 'alicePubkey' });
      store.getActions().lightning.setInfo({ node, info: aliceInfo });

      const bobInfo = defaultStateInfo({ pubkey: 'bobPubkey' });
      store.getActions().lightning.setInfo({ node: node2, info: bobInfo });
      const bobChannels = [
        defaultStateChannel({ pubkey: 'alicePubkey', assets: [asset] }),
      ];
      store.getActions().lightning.setChannels({ node: node2, channels: bobChannels });

      // store.getActions().lightning.setInfo({ node: node3, info: {} as any });
      const carolChannels = [
        defaultStateChannel({ pubkey: 'alicePubkey', assets: [asset] }),
      ];
      store.getActions().lightning.setChannels({ node: node3, channels: carolChannels });
      // console.log(store.getState().lightning.nodes);

      const assets = store.getActions().lit.getAssetsInChannels({ nodeName: node.name });
      expect(assets).toHaveLength(1);
      expect(assets[0].peerPubkey).toEqual('bobPubkey');
      expect(assets[0].asset.localBalance).toEqual('400');
      expect(assets[0].asset.remoteBalance).toEqual('600');
    });
  });
});
