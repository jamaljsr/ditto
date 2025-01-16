import * as electron from 'electron';
import * as log from 'electron-log';
import { waitFor } from '@testing-library/react';
import detectPort from 'detect-port';
import { createStore } from 'easy-peasy';
import { NodeImplementation, Status, TapdNode } from 'shared/types';
import { AutoMineMode, CustomImage, Network } from 'types';
import * as asyncUtil from 'utils/async';
import { initChartFromNetwork } from 'utils/chart';
import { defaultRepoState } from 'utils/constants';
import * as files from 'utils/files';
import {
  bitcoinServiceMock,
  getNetwork,
  injections,
  lightningServiceMock,
  litdServiceMock,
  tapServiceMock,
  testCustomImages,
  testRepoState,
} from 'utils/tests';
import appModel from './app';
import bitcoinModel from './bitcoin';
import designerModel from './designer';
import lightningModel from './lightning';
import litModel from './lit';
import networkModel from './network';
import tapModel from './tap';

jest.mock('utils/files', () => ({
  waitForFile: jest.fn(),
  rm: jest.fn(),
}));
jest.mock('utils/async');

const asyncUtilMock = asyncUtil as jest.Mocked<typeof asyncUtil>;
const filesMock = files as jest.Mocked<typeof files>;
const logMock = log as jest.Mocked<typeof log>;
const detectPortMock = detectPort as jest.Mock;
const electronMock = electron as jest.Mocked<typeof electron>;

describe('Network model', () => {
  const rootModel = {
    app: appModel,
    network: networkModel,
    lightning: lightningModel,
    bitcoin: bitcoinModel,
    designer: designerModel,
    tap: tapModel,
    lit: litModel,
  };
  // initialize store for type inference
  let store = createStore(rootModel, { injections });
  // helper to get the first network in the store
  const firstNetwork = () => store.getState().network.networks[0];

  // reusable args for adding a new network
  const addNetworkArgs = {
    name: 'test',
    description: 'test description',
    lndNodes: 2,
    clightningNodes: 1,
    eclairNodes: 1,
    bitcoindNodes: 1,
    tapdNodes: 0,
    litdNodes: 1,
    customNodes: {},
  };

  beforeEach(() => {
    // reset the store before each test run
    store = createStore(rootModel, { injections });
    // always return true immediately
    filesMock.waitForFile.mockResolvedValue();
    lightningServiceMock.waitUntilOnline.mockResolvedValue();
    bitcoinServiceMock.waitUntilOnline.mockResolvedValue();
    litdServiceMock.waitUntilOnline.mockResolvedValue();
  });

  it('should have a valid initial state', () => {
    expect(store.getState().network.networks).toEqual([]);
  });

  it('should load a list of networks', async () => {
    const mockNetworks = [getNetwork(1, 'test 1'), getNetwork(2, 'test 2')];
    const mockCharts = mockNetworks.map(initChartFromNetwork);
    const mockedLoad = injections.dockerService.loadNetworks as jest.Mock;
    mockedLoad.mockResolvedValue({ networks: mockNetworks, charts: mockCharts });
    await store.getActions().network.load();
    const [net1, net2] = store.getState().network.networks;
    expect(net1.name).toBe('test 1');
    expect(net2.name).toBe('test 2');
  });

  describe('Fetching', () => {
    it('should be able to fetch a node by id', () => {
      store.getActions().network.addNetwork(addNetworkArgs);
      const network = store.getState().network.networkById('1') as Network;
      expect(network).not.toBeNull();
      expect(network.id).toBe(1);
      expect(network.name).toBe('test');
      expect(network.description).toBe('test description');
    });

    it('should fail to fetch a node with invalid id', () => {
      store.getActions().network.addNetwork(addNetworkArgs);
      [99, '99', 'asdf', undefined, null as unknown as string].forEach(v => {
        expect(() => store.getState().network.networkById(v)).toThrow();
      });
    });
  });

  describe('Adding', () => {
    it('should add a new network', async () => {
      await store.getActions().network.addNetwork(addNetworkArgs);
      const { networks } = store.getState().network;
      expect(networks.length).toBe(1);
      expect(networks[0].name).toBe('test');
      expect(networks[0].description).toBe('test description');
    });

    it('should call the docker service when adding a new network', async () => {
      await store.getActions().network.addNetwork(addNetworkArgs);
      expect(store.getState().network.networks.length).toBe(1);
      expect(injections.dockerService.saveComposeFile).toHaveBeenCalledTimes(1);
    });

    it('should add a network with the correct lightning nodes', async () => {
      await store.getActions().network.addNetwork(addNetworkArgs);
      const { lightning } = firstNetwork().nodes;
      expect(lightning.length).toBe(5);
      lightning.forEach(node => {
        expect(node.type).toBe('lightning');
      });
    });

    it('should add a network with the correct bitcoind nodes', async () => {
      await store
        .getActions()
        .network.addNetwork({ ...addNetworkArgs, bitcoindNodes: 2 });
      const { networks } = store.getState().network;
      const { bitcoin } = networks[0].nodes;
      expect(bitcoin.length).toBe(2);
      bitcoin.forEach(node => {
        expect(node.type).toBe('bitcoin');
      });
    });

    it('should set all nodes to Stopped by default', async () => {
      await store.getActions().network.addNetwork(addNetworkArgs);
      const network = firstNetwork();
      const { bitcoin, lightning } = network.nodes;
      expect(network.status).toBe(Status.Stopped);
      bitcoin.forEach(node => expect(node.status).toBe(Status.Stopped));
      lightning.forEach(node => expect(node.status).toBe(Status.Stopped));
    });

    it('should be able to add multiple networks', async () => {
      await store.getActions().network.addNetwork(addNetworkArgs);
      await store.getActions().network.addNetwork({
        ...addNetworkArgs,
        name: 'test2',
        description: 'test2 description',
      });
      const { networks } = store.getState().network;
      expect(networks.length).toBe(2);
      expect(networks[0].name).toBe('test');
      expect(networks[0].description).toBe('test description');
      expect(networks[1].name).toBe('test2');
      expect(networks[1].description).toBe('test2 description');
    });

    it('should save the networks to disk', async () => {
      await store.getActions().network.addNetwork(addNetworkArgs);
      expect(injections.dockerService.saveComposeFile).toHaveBeenCalledTimes(1);
      expect(injections.dockerService.saveNetworks).toHaveBeenCalledTimes(1);
    });

    it('should add a network with custom nodes', async () => {
      const custom: CustomImage[] = [
        ...testCustomImages,
        {
          id: '012',
          name: 'Another Custom Image',
          implementation: 'bitcoind',
          dockerImage: 'my-bitcoind:latest',
          command: 'another-command',
        },
      ];
      const settings = {
        nodeImages: {
          managed: [],
          custom,
        },
      };
      store.getActions().app.setSettings(settings);
      const args = {
        ...addNetworkArgs,
        customNodes: {
          '123': 1, // LND
          '456': 1, // c-lightning
          '789': 1, // Eclair
          '012': 1, // bitcoind
          '999': 1, // invalid
        },
      };
      await store.getActions().network.addNetwork(args);
      const node = firstNetwork().nodes.lightning[0];
      expect(node.docker.image).toBe(custom[0].dockerImage);
      expect(node.docker.command).toBe(custom[0].command);
    });
  });

  describe('Adding a Node', () => {
    const lndLatest = defaultRepoState.images.LND.latest;
    const clnLatest = defaultRepoState.images['c-lightning'].latest;
    const eclairLatest = defaultRepoState.images.eclair.latest;

    beforeEach(async () => {
      await store.getActions().network.addNetwork(addNetworkArgs);
    });

    it('should add an LND node to an existing network', async () => {
      const payload = { id: firstNetwork().id, type: 'LND', version: lndLatest };
      store.getActions().network.addNode(payload);
      const { lightning } = firstNetwork().nodes;
      expect(lightning).toHaveLength(6);
      expect(lightning[0].name).toBe('alice');
      expect(lightning[0].implementation).toBe('LND');
    });

    it('should add a c-lightning node to an existing network', async () => {
      const payload = {
        id: firstNetwork().id,
        type: 'c-lightning',
        version: clnLatest,
      };
      store.getActions().network.addNode(payload);
      const { lightning } = firstNetwork().nodes;
      expect(lightning).toHaveLength(6);
      expect(lightning[1].name).toBe('bob');
      expect(lightning[1].implementation).toBe('c-lightning');
    });

    it('should add an Eclair node to an existing network', async () => {
      const payload = { id: firstNetwork().id, type: 'eclair', version: eclairLatest };
      store.getActions().network.addNode(payload);
      const { lightning } = firstNetwork().nodes;
      expect(lightning).toHaveLength(6);
      expect(lightning[2].name).toBe('carol');
      expect(lightning[2].implementation).toBe('eclair');
    });

    it('should throw an error if the network id is invalid', async () => {
      const payload = { id: 999, type: 'LND', version: lndLatest };
      const { addNode } = store.getActions().network;
      await expect(addNode(payload)).rejects.toThrow(
        "Network with the id '999' was not found.",
      );
    });

    it('should throw an error if the node type is invalid', async () => {
      const payload = { id: firstNetwork().id, type: 'abcd', version: lndLatest };
      const { addNode } = store.getActions().network;
      await expect(addNode(payload)).rejects.toThrow(
        "Cannot add unknown node type 'abcd' to the network",
      );
    });

    it('should add a LND custom node', async () => {
      const settings = {
        nodeImages: {
          managed: [],
          custom: testCustomImages,
        },
      };
      store.getActions().app.setSettings(settings);
      const payload = {
        id: firstNetwork().id,
        type: 'LND',
        version: lndLatest,
        customId: '123',
      };
      store.getActions().network.addNode(payload);
      const { lightning } = firstNetwork().nodes;
      expect(lightning[5].docker.image).toBe(testCustomImages[0].dockerImage);
      expect(lightning[5].docker.command).toBe(testCustomImages[0].command);
    });

    it('should add a c-lightning custom node', async () => {
      const settings = {
        nodeImages: {
          managed: [],
          custom: testCustomImages,
        },
      };
      store.getActions().app.setSettings(settings);
      const payload = {
        id: firstNetwork().id,
        type: 'c-lightning',
        version: clnLatest,
        customId: '456',
      };
      store.getActions().network.addNode(payload);
      const { lightning } = firstNetwork().nodes;
      expect(lightning[5].docker.image).toBe(testCustomImages[1].dockerImage);
      expect(lightning[5].docker.command).toBe(testCustomImages[1].command);
    });

    it('should add a bitcoind custom node', async () => {
      const customBitcoind = {
        id: '789',
        name: 'Another Custom Image',
        implementation: 'bitcoind',
        dockerImage: 'my-bitcoind:latest',
        command: 'another-command',
      };
      const settings = {
        nodeImages: {
          managed: [],
          custom: [customBitcoind] as CustomImage[],
        },
      };
      store.getActions().app.setSettings(settings);
      const payload = {
        id: firstNetwork().id,
        type: 'bitcoind',
        version: defaultRepoState.images.bitcoind.latest,
        customId: '789',
      };
      store.getActions().network.addNode(payload);
      const { bitcoin } = firstNetwork().nodes;
      expect(bitcoin[1].docker.image).toBe(customBitcoind.dockerImage);
      expect(bitcoin[1].docker.command).toBe(customBitcoind.command);
    });

    it('should ignore an invalid custom node', async () => {
      const invalidId = '999';
      const settings = {
        nodeImages: {
          managed: [],
          custom: testCustomImages,
        },
      };
      store.getActions().app.setSettings(settings);
      const payload = {
        id: firstNetwork().id,
        type: 'LND',
        version: lndLatest,
        customId: invalidId,
      };
      store.getActions().network.addNode(payload);
      const { lightning } = firstNetwork().nodes;
      expect(lightning[3].docker.image).toBe('');
      expect(lightning[3].docker.command).toBe('');
    });

    it('should add a managed node', async () => {
      const settings = {
        nodeImages: {
          managed: [
            {
              implementation: 'LND' as NodeImplementation,
              version: defaultRepoState.images.LND.latest,
              command: 'test-command',
            },
          ],
          custom: [],
        },
      };
      store.getActions().app.setSettings(settings);
      const payload = { id: firstNetwork().id, type: 'LND', version: lndLatest };
      store.getActions().network.addNode(payload);
      const { lightning } = firstNetwork().nodes;
      expect(lightning[5].docker.command).toBe('test-command');
    });
  });

  describe('Removing a Node', () => {
    beforeEach(async () => {
      await store.getActions().network.addNetwork({
        ...addNetworkArgs,
        bitcoindNodes: 2,
      });
      store.getActions().designer.setActiveId(1);
    });

    it('should remove a node from an existing network', async () => {
      const node = firstNetwork().nodes.lightning[0];
      await store.getActions().network.removeLightningNode({ node });
      const { lightning } = firstNetwork().nodes;
      expect(lightning).toHaveLength(4);
      expect(lightning[0].name).toBe('bob');
    });

    it('should remove a c-lightning node from an existing network', async () => {
      const node = firstNetwork().nodes.lightning[1];
      await store.getActions().network.removeLightningNode({ node });
      expect(firstNetwork().nodes.lightning).toHaveLength(4);
    });

    it('should remove a litd node from an existing network', async () => {
      const node = firstNetwork().nodes.lightning[3];
      await store.getActions().network.removeLightningNode({ node });
      expect(firstNetwork().nodes.lightning).toHaveLength(4);
    });

    it('should throw an error if the lightning node network id is invalid', async () => {
      const node = firstNetwork().nodes.lightning[0];
      node.networkId = 999;
      const { removeLightningNode } = store.getActions().network;
      await expect(removeLightningNode({ node })).rejects.toThrow(
        "Network with the id '999' was not found.",
      );
    });

    it('should remove a bitcoin node from an existing network', async () => {
      const node = firstNetwork().nodes.bitcoin[0];
      await store.getActions().network.removeBitcoinNode({ node });
      expect(firstNetwork().nodes.bitcoin).toHaveLength(1);
    });

    it('should throw an error if the bitcoin node network id is invalid', async () => {
      const node = firstNetwork().nodes.bitcoin[0];
      node.networkId = 999;
      const { removeBitcoinNode } = store.getActions().network;
      await expect(removeBitcoinNode({ node })).rejects.toThrow(
        "Network with the id '999' was not found.",
      );
    });

    it('should throw an error if only one bitcoin node is in the network', async () => {
      const { removeBitcoinNode } = store.getActions().network;
      await removeBitcoinNode({ node: firstNetwork().nodes.bitcoin[0] });
      const node = firstNetwork().nodes.bitcoin[0];
      await expect(removeBitcoinNode({ node })).rejects.toThrow(
        'Cannot remove the only bitcoin node',
      );
    });

    it('should throw an error if a LN node depends on the bitcoin node being removed', async () => {
      store.getActions().app.setRepoState(testRepoState);
      const { removeBitcoinNode, addNode } = store.getActions().network;
      const { id } = firstNetwork();
      // add old bitcoin and LN nodes
      await addNode({ id, type: 'bitcoind', version: '0.18.1' });
      await addNode({ id, type: 'LND', version: '0.7.1-beta' });
      // try to remove the old bitcoind version
      const node = firstNetwork().nodes.bitcoin[2];
      await expect(removeBitcoinNode({ node })).rejects.toThrow(
        'There are no other compatible backends for frank to connect to. You must remove the frank node first',
      );
    });

    it('should update peers of surrounding bitcoin nodes', async () => {
      const { removeBitcoinNode, addNode } = store.getActions().network;
      const { id } = firstNetwork();
      const { latest } = defaultRepoState.images.bitcoind;
      await addNode({ id, type: 'bitcoind', version: latest });
      const node = firstNetwork().nodes.bitcoin[1];
      await removeBitcoinNode({ node });
      const { bitcoin } = firstNetwork().nodes;
      expect(bitcoin).toHaveLength(2);
      expect(bitcoin[0].peers).toEqual(['backend3']);
      expect(bitcoin[1].peers).toEqual(['backend1']);
    });
  });

  describe('Updating Backend', () => {
    beforeEach(async () => {
      await store.getActions().network.addNetwork({
        ...addNetworkArgs,
        bitcoindNodes: 2,
      });
      store.getActions().designer.setActiveId(1);
    });

    it('should update the backend node', async () => {
      const { updateBackendNode } = store.getActions().network;
      expect(firstNetwork().nodes.lightning[0].backendName).toBe('backend1');
      const { id } = firstNetwork();
      await updateBackendNode({ id, lnName: 'alice', backendName: 'backend2' });
      expect(firstNetwork().nodes.lightning[0].backendName).toBe('backend2');
    });

    it('should throw an error if the network id is not valid', async () => {
      const { updateBackendNode } = store.getActions().network;
      const args = { id: 999, lnName: 'alice', backendName: 'backend2' };
      await expect(updateBackendNode(args)).rejects.toThrow(
        "Network with the id '999' was not found.",
      );
    });

    it('should throw an error if the LN node name is not valid', async () => {
      const { updateBackendNode } = store.getActions().network;
      const args = { id: firstNetwork().id, lnName: 'xxx', backendName: 'backend2' };
      await expect(updateBackendNode(args)).rejects.toThrow(
        "The node 'xxx' was not found.",
      );
    });

    it('should throw an error if the bitcoin node name is not valid', async () => {
      const { updateBackendNode } = store.getActions().network;
      const args = { id: firstNetwork().id, lnName: 'alice', backendName: 'xxx' };
      await expect(updateBackendNode(args)).rejects.toThrow(
        "The node 'xxx' was not found.",
      );
    });

    it('should throw an error if the backend node name is already set on the LN node', async () => {
      const { updateBackendNode } = store.getActions().network;
      const args = { id: firstNetwork().id, lnName: 'alice', backendName: 'backend1' };
      await expect(updateBackendNode(args)).rejects.toThrow(
        "The node 'alice' is already connected to 'backend1'",
      );
    });
  });

  describe('Starting', () => {
    beforeEach(async () => {
      await store.getActions().network.addNetwork(addNetworkArgs);
    });

    it('should start a network by id', async () => {
      const { start } = store.getActions().network;
      await start(firstNetwork().id);
      expect(firstNetwork().status).toBe(Status.Started);
    });

    it('should update all node statuses when a network is started', async () => {
      const { start } = store.getActions().network;
      await start(firstNetwork().id);
      const { bitcoin, lightning } = firstNetwork().nodes;
      bitcoin.forEach(node => expect(node.status).toBe(Status.Started));
      lightning.forEach(node => expect(node.status).toBe(Status.Started));
    });

    it('should fail to start a network with an invalid id', async () => {
      const { start } = store.getActions().network;
      await expect(start(10)).rejects.toThrow();
    });

    it('should update all node statuses when a network fails to start', async () => {
      const { start } = store.getActions().network;
      // mock dockerService.start to throw an error
      const mockDockerStart = injections.dockerService.start as jest.Mock;
      mockDockerStart.mockRejectedValueOnce(new Error('start failed'));
      // call start
      await expect(start(firstNetwork().id)).rejects.toThrow('start failed');
      // verify error statuses
      const network = firstNetwork();
      const { bitcoin, lightning } = network.nodes;
      expect(network.status).toBe(Status.Error);
      bitcoin.forEach(node => expect(node.status).toBe(Status.Error));
      lightning.forEach(node => expect(node.status).toBe(Status.Error));
    });

    it('should call the dockerService when starting a network', async () => {
      const { start } = store.getActions().network;
      const network = firstNetwork();
      await start(network.id);
      expect(injections.dockerService.start).toHaveBeenCalledWith(
        expect.objectContaining({ id: network.id }),
      );
    });

    it('should set lightning node status to error if the node startup fails', async () => {
      lightningServiceMock.waitUntilOnline.mockRejectedValue(new Error('test-error'));
      litdServiceMock.waitUntilOnline.mockRejectedValue(new Error('test-error'));
      const { start } = store.getActions().network;
      await start(firstNetwork().id);
      const { lightning } = firstNetwork().nodes;
      lightning.forEach(node => expect(node.status).toBe(Status.Error));
      lightning.forEach(node => expect(node.errorMsg).toBe('test-error'));
    });

    it('should set bitcoind node status to error if the node startup fails', async () => {
      bitcoinServiceMock.waitUntilOnline.mockRejectedValue(new Error('test-error'));
      const { start } = store.getActions().network;
      await start(firstNetwork().id);
      const { bitcoin } = firstNetwork().nodes;
      bitcoin.forEach(node => expect(node.status).toBe(Status.Error));
      bitcoin.forEach(node => expect(node.errorMsg).toBe('test-error'));
    });

    it('should mine a block on startup', async () => {
      bitcoinServiceMock.getBlockchainInfo.mockResolvedValue({ blocks: 0 } as any);
      const { start } = store.getActions().network;
      const network = firstNetwork();
      await start(network.id);
      const btcNode = {
        ...firstNetwork().nodes.bitcoin[0],
        status: Status.Starting,
      };
      expect(bitcoinServiceMock.mine).toHaveBeenCalledWith(1, btcNode);
    });

    it('should not throw when mining a block on startup fails', async () => {
      bitcoinServiceMock.mine.mockRejectedValue(new Error('test-error'));
      const { start } = store.getActions().network;
      const network = firstNetwork();
      await expect(start(network.id)).resolves.not.toThrow();
      const btcNode = {
        ...firstNetwork().nodes.bitcoin[0],
        status: Status.Starting,
      };
      expect(bitcoinServiceMock.mine).toHaveBeenCalledWith(1, btcNode);
    });

    it('should not save compose file and networks if all ports are available', async () => {
      detectPortMock.mockImplementation(port => Promise.resolve(port));
      (injections.dockerService.saveComposeFile as jest.Mock).mockReset();
      (injections.dockerService.saveNetworks as jest.Mock).mockReset();
      const { start } = store.getActions().network;
      const network = firstNetwork();
      await start(network.id);
      const { lightning } = firstNetwork().nodes;
      expect(lightning[0].ports.grpc).toBe(10001);
      expect(lightning[4].ports.grpc).toBe(10005);
      expect(injections.dockerService.saveComposeFile).toHaveBeenCalledTimes(0);
      expect(injections.dockerService.saveNetworks).toHaveBeenCalledTimes(0);
    });

    it('should save compose file and networks when a port is in use', async () => {
      const portsInUse = [10001];
      detectPortMock.mockImplementation(port =>
        Promise.resolve(portsInUse.includes(port) ? port + 1 : port),
      );

      // add a second network to be sure updating works
      await store.getActions().network.addNetwork({
        ...addNetworkArgs,
        name: 'test2',
        description: 'test2 description',
      });
      (injections.dockerService.saveComposeFile as jest.Mock).mockReset();
      (injections.dockerService.saveNetworks as jest.Mock).mockReset();
      const { start } = store.getActions().network;
      const network = firstNetwork();
      await start(network.id);
      const { lightning } = firstNetwork().nodes;
      expect(lightning[0].ports.grpc).toBe(10002);
      expect(lightning[4].ports.grpc).toBe(10005);
      expect(injections.dockerService.saveComposeFile).toHaveBeenCalledTimes(1);
      expect(injections.dockerService.saveNetworks).toHaveBeenCalledTimes(1);
    });

    it('should catch exception if it cannot connect all peers', async () => {
      const err = new Error('test-error');
      // raise an error for the 3rd call to connect peers
      lightningServiceMock.connectPeers.mockResolvedValueOnce();
      lightningServiceMock.connectPeers.mockResolvedValueOnce();
      lightningServiceMock.connectPeers.mockRejectedValueOnce(err);
      const { start } = store.getActions().network;
      const network = firstNetwork();
      await start(network.id);
      await waitFor(() => {
        expect(lightningServiceMock.connectPeers).toHaveBeenCalledTimes(3);
      });
      expect(logMock.info).toHaveBeenCalledWith('Failed to connect all LN peers', err);
    });

    it('should throw an error if a custom node image is missing', async () => {
      const { networks } = store.getState().network;
      networks[0].nodes.lightning[0].docker.image = 'custom-image:latest';
      store.getActions().network.setNetworks(networks);
      const { start } = store.getActions().network;
      const errMsg =
        'Cannot start the network because it contains custom node images that are not available on this machine: custom-image:latest';
      await expect(start(firstNetwork().id)).rejects.toThrow(errMsg);
    });

    it('should wait for lightning nodes to be online then add listeners', async () => {
      const { monitorStartup } = store.getActions().network;
      await monitorStartup(firstNetwork().nodes.lightning);
      await waitFor(() => {
        expect(lightningServiceMock.waitUntilOnline).toHaveBeenCalled();
        expect(lightningServiceMock.addListenerToNode).toHaveBeenCalled();
      });
    });
  });

  describe('Stopping', () => {
    beforeEach(() => {
      const { addNetwork } = store.getActions().network;
      addNetwork(addNetworkArgs);
    });

    it('should stop a network by id', async () => {
      const { stop } = store.getActions().network;
      await stop(firstNetwork().id);
      expect(firstNetwork().status).toBe(Status.Stopped);
    });

    it('should update all node statuses when a network is stopped', async () => {
      const { stop } = store.getActions().network;
      await stop(firstNetwork().id);
      const { bitcoin, lightning } = firstNetwork().nodes;
      bitcoin.forEach(node => expect(node.status).toBe(Status.Stopped));
      lightning.forEach(node => expect(node.status).toBe(Status.Stopped));
    });

    it('should fail to stop a network with an invalid id', async () => {
      const { stop } = store.getActions().network;
      await expect(stop(10)).rejects.toThrow();
    });

    it('should update all node statuses when a network fails to stop', async () => {
      const { stop } = store.getActions().network;
      // mock dockerService.stop to throw an error
      const mockDockerStart = injections.dockerService.stop as jest.Mock;
      mockDockerStart.mockRejectedValueOnce(new Error('stop failed'));
      // call stop
      await expect(stop(firstNetwork().id)).rejects.toThrow('stop failed');
      // verify error statuses
      const network = firstNetwork();
      const { bitcoin, lightning } = network.nodes;
      expect(network.status).toBe(Status.Error);
      bitcoin.forEach(node => expect(node.status).toBe(Status.Error));
      lightning.forEach(node => expect(node.status).toBe(Status.Error));
    });

    it('should call the dockerService when stopping a network', async () => {
      const { stop } = store.getActions().network;
      await stop(firstNetwork().id);
      expect(injections.dockerService.stop).toHaveBeenCalledWith(firstNetwork());
    });

    it('should call removeListener for lightning nodes when stopping a network', async () => {
      const { stop } = store.getActions().network;
      await stop(firstNetwork().id);
      expect(lightningServiceMock.removeListener).toHaveBeenCalled();
    });
  });

  describe('Stop all', () => {
    beforeEach(() => {
      const { addNetwork } = store.getActions().network;
      addNetwork(addNetworkArgs);
    });

    it('should shutdown immediately for stopped networks', async () => {
      const { stopAll } = store.getActions().network;
      await stopAll();
      expect(electronMock.ipcRenderer.send).toHaveBeenCalledWith('docker-shut-down');
    });

    it('should stop the started networks', async () => {
      const { stopAll, setStatus } = store.getActions().network;
      setStatus({ id: firstNetwork().id, status: Status.Started });
      await stopAll();
      const { networks } = store.getState().network;
      expect(networks.filter(n => n.status !== Status.Stopped)).toHaveLength(0);
      expect(firstNetwork().status).toBe(Status.Stopped);
    });

    it('should handle a delay when stopping the networks', async () => {
      jest.useFakeTimers();
      asyncUtilMock.delay.mockResolvedValue(0);
      const { stopAll, setStatus } = store.getActions().network;

      setStatus({ id: firstNetwork().id, status: Status.Started });
      await stopAll();
      expect(setInterval).toHaveBeenCalledTimes(1);

      // simulate the interval being called with Stopping nodes
      setStatus({ id: firstNetwork().id, status: Status.Stopping });
      jest.advanceTimersByTime(2000);
      expect(electronMock.ipcRenderer.send).not.toHaveBeenCalled();

      // simulate the interval being called with Stopped nodes
      setStatus({ id: firstNetwork().id, status: Status.Stopped });
      jest.advanceTimersByTime(2000);

      // confirm the IPC message is sent
      await waitFor(() => {
        expect(electronMock.ipcRenderer.send).toHaveBeenCalledWith('docker-shut-down');
      });
      jest.useRealTimers();
    });
  });

  describe('Toggle', () => {
    beforeEach(() => {
      const { addNetwork } = store.getActions().network;
      addNetwork(addNetworkArgs);
    });

    it('should start if its currently stopped', async () => {
      const { toggle } = store.getActions().network;
      await toggle(firstNetwork().id);
      expect(firstNetwork().status).toBe(Status.Started);
    });

    it('should restart if its currently error', async () => {
      const { setStatus, toggle } = store.getActions().network;
      const id = firstNetwork().id;
      setStatus({ id, status: Status.Error });
      await toggle(id);
      expect(firstNetwork().status).toBe(Status.Started);
    });

    it('should stop if its currently started', async () => {
      const { setStatus, toggle } = store.getActions().network;
      const id = firstNetwork().id;
      setStatus({ id, status: Status.Started });
      await toggle(id);
      expect(firstNetwork().status).toBe(Status.Stopped);
    });

    it('should do nothing if its currently starting', async () => {
      const { setStatus, toggle } = store.getActions().network;
      const id = firstNetwork().id;
      setStatus({ id, status: Status.Starting });
      await toggle(id);
      expect(firstNetwork().status).toBe(Status.Starting);
    });

    it('should do nothing if its currently stopping', async () => {
      const { setStatus, toggle } = store.getActions().network;
      const id = firstNetwork().id;
      setStatus({ id, status: Status.Stopping });
      await toggle(id);
      expect(firstNetwork().status).toBe(Status.Stopping);
    });

    it('should fail to toggle a network with an invalid id', async () => {
      const { toggle } = store.getActions().network;
      await expect(toggle(10)).rejects.toThrow();
    });
  });

  describe('Toggle Node', () => {
    const firstNode = () => firstNetwork().nodes.lightning[0];

    beforeEach(() => {
      detectPortMock.mockImplementation(port => Promise.resolve(port));
      const { addNetwork } = store.getActions().network;
      addNetwork(addNetworkArgs);
    });

    it('should start node if its currently stopped', async () => {
      const { toggleNode } = store.getActions().network;
      await toggleNode(firstNode());
      expect(firstNode().status).toBe(Status.Started);
    });

    it('should restart node if its currently error', async () => {
      const { setStatus, toggleNode } = store.getActions().network;
      setStatus({ id: firstNetwork().id, status: Status.Error });
      await toggleNode(firstNode());
      expect(firstNode().status).toBe(Status.Started);
    });

    it('should stop node if its currently started', async () => {
      const { setStatus, toggleNode } = store.getActions().network;
      setStatus({ id: firstNetwork().id, status: Status.Started });
      await toggleNode(firstNode());
      expect(firstNode().status).toBe(Status.Stopped);
    });

    it('should do nothing node if its currently starting', async () => {
      const { setStatus, toggleNode } = store.getActions().network;
      setStatus({ id: firstNetwork().id, status: Status.Starting });
      await toggleNode(firstNode());
      expect(firstNode().status).toBe(Status.Starting);
    });

    it('should do nothing node if its currently stopping', async () => {
      const { setStatus, toggleNode } = store.getActions().network;
      setStatus({ id: firstNetwork().id, status: Status.Stopping });
      await toggleNode(firstNode());
      expect(firstNode().status).toBe(Status.Stopping);
    });

    it('should fail to toggle a node with an invalid id', async () => {
      const { toggleNode } = store.getActions().network;
      const node = firstNode();
      node.networkId = 10;
      await expect(toggleNode(node)).rejects.toThrow();
    });

    it('should update node ports when starting', async () => {
      const portsInUse = [8084];
      detectPortMock.mockImplementation(port =>
        Promise.resolve(portsInUse.includes(port) ? port + 1 : port),
      );
      const { toggleNode } = store.getActions().network;
      let node = firstNetwork().nodes.lightning[4];
      await toggleNode(node);
      // get a reference to the updated nodes
      node = firstNetwork().nodes.lightning[4];
      expect(node.ports.rest).toBe(8085);
    });
  });

  describe('TAP network', () => {
    beforeEach(() => {
      (() => {
        const network = getNetwork(1, 'test network', Status.Stopped, 2);
        store.getActions().network.setNetworks([network]);
        const chart = initChartFromNetwork(network);
        store.getActions().designer.setChart({ id: network.id, chart });
        store.getActions().designer.setActiveId(network.id);
        return network;
      })();
    });

    it('should remove a tap network', async () => {
      await store.getActions().network.remove(firstNetwork().id);
      expect(firstNetwork()).toBeUndefined();
    });

    it('should throw when removing a node with an invalid network id', async () => {
      const node = {
        ...firstNetwork().nodes.tap[0],
        networkId: 999,
      };
      const { removeTapNode } = store.getActions().network;
      await expect(removeTapNode({ node })).rejects.toThrow(
        "Network with the id '999' was not found.",
      );
    });

    it('should set tap node status to error if the node startup fails', async () => {
      tapServiceMock.waitUntilOnline.mockRejectedValue(new Error('test-error'));
      const { start } = store.getActions().network;
      await start(firstNetwork().id);
      const { tap } = firstNetwork().nodes;
      tap.forEach(node => expect(node.status).toBe(Status.Error));
      tap.forEach(node => expect(node.errorMsg).toBe('test-error'));
    });
    it('should update the backend LND node', async () => {
      const { updateTapBackendNode } = store.getActions().network;
      const { id, nodes } = firstNetwork();
      const tapdNode = nodes.tap[0] as TapdNode;
      expect(tapdNode.lndName).toBe('alice');
      await updateTapBackendNode({ id, lndName: 'bob', tapName: 'alice-tap' });
      expect(tapdNode.lndName).toBe('bob');
    });

    it('should throw an error if the network id is not valid', async () => {
      const { updateTapBackendNode } = store.getActions().network;
      const args = { id: 999, tapName: 'alice-tap', lndName: 'alice' };
      await expect(updateTapBackendNode(args)).rejects.toThrow(
        "Network with the id '999' was not found.",
      );
    });

    it('should throw an error if the tap node name is not valid', async () => {
      const { updateTapBackendNode } = store.getActions().network;
      const args = { id: firstNetwork().id, tapName: 'xxx', lndName: 'alice' };
      await expect(updateTapBackendNode(args)).rejects.toThrow(
        "The node 'xxx' was not found.",
      );
    });

    it('should throw an error if the LND node name is not valid', async () => {
      const { updateTapBackendNode } = store.getActions().network;
      const args = { id: firstNetwork().id, tapName: 'alice', lndName: 'xxx' };
      await expect(updateTapBackendNode(args)).rejects.toThrow(
        "The node 'xxx' was not found.",
      );
    });

    it('should throw an error if the LND node name is already set on the tap node', async () => {
      const { updateTapBackendNode } = store.getActions().network;
      const args = {
        id: firstNetwork().id,
        tapName: 'alice-tap',
        lndName: 'alice',
      };
      await expect(updateTapBackendNode(args)).rejects.toThrow(
        "The node 'alice-tap' is already connected to 'alice'",
      );
    });
  });

  describe('Monitor Status', () => {
    beforeEach(() => {
      const { addNetwork } = store.getActions().network;
      addNetwork(addNetworkArgs);
    });

    it('should do nothing if no nodes are provided', async () => {
      const { monitorStartup } = store.getActions().network;
      await monitorStartup([]);
      expect(lightningServiceMock.waitUntilOnline).not.toHaveBeenCalled();
      expect(bitcoinServiceMock.waitUntilOnline).not.toHaveBeenCalled();
    });

    it('should fail with an invalid network id', async () => {
      const { monitorStartup } = store.getActions().network;
      const node = firstNetwork().nodes.lightning[0];
      node.networkId = 10;
      await expect(monitorStartup([node])).rejects.toThrow();
    });

    it('should wait for lightning nodes then connect peers', async () => {
      const { monitorStartup } = store.getActions().network;
      await monitorStartup(firstNetwork().nodes.lightning);
      await waitFor(() => {
        expect(lightningServiceMock.waitUntilOnline).toHaveBeenCalled();
        expect(lightningServiceMock.connectPeers).toHaveBeenCalled();
      });
    });

    it('should wait for bitcoin nodes then connect peers', async () => {
      const { monitorStartup } = store.getActions().network;
      await monitorStartup(firstNetwork().nodes.bitcoin);
      await waitFor(() => {
        expect(bitcoinServiceMock.waitUntilOnline).toHaveBeenCalled();
        expect(bitcoinServiceMock.connectPeers).toHaveBeenCalled();
      });
    });

    it('should do nothing for unknown node type', async () => {
      const { monitorStartup } = store.getActions().network;
      const { bitcoin } = firstNetwork().nodes;
      bitcoin[0].type = 'asdf' as any;
      await monitorStartup(bitcoin);
      expect(bitcoinServiceMock.waitUntilOnline).not.toHaveBeenCalled();
    });
  });

  describe('Other actions', () => {
    it('should remove a network', async () => {
      expect(store.getState().network.networks).toHaveLength(0);
      await store.getActions().network.addNetwork(addNetworkArgs);
      expect(store.getState().network.networks).toHaveLength(1);
      const networkId = firstNetwork().id;
      await store.getActions().network.remove(networkId);
      expect(store.getState().network.networks).toHaveLength(0);
    });

    it('should fail to set the status with an invalid id', () => {
      const { setStatus: setNetworkStatus } = store.getActions().network;
      expect(() => setNetworkStatus({ id: 10, status: Status.Starting })).toThrow();
    });

    it('should fail to rename with an invalid id', async () => {
      const { rename } = store.getActions().network;
      await expect(
        rename({ id: 10, name: 'asdf', description: 'qwerty' }),
      ).rejects.toThrow();
    });

    it('should fail to remove with an invalid id', async () => {
      const { remove } = store.getActions().network;
      await expect(remove(10)).rejects.toThrow();
    });

    it('should fail to update advanced options with an invalid id', async () => {
      const { addNetwork, updateAdvancedOptions } = store.getActions().network;
      addNetwork(addNetworkArgs);
      const node = {
        ...firstNetwork().nodes.lightning[0],
        networkId: 999,
      };
      await expect(updateAdvancedOptions({ node, command: '' })).rejects.toThrow();
    });

    it('should fail to get backend node with an invalid id', () => {
      const { addNetwork, getBackendNode } = store.getActions().network;
      addNetwork(addNetworkArgs);
      const lnNode = {
        ...firstNetwork().nodes.lightning[0],
        networkId: 10,
      };
      expect(() => getBackendNode(lnNode)).toThrow();
    });

    it('should fail to export with an invalid id', async () => {
      const { exportNetwork } = store.getActions().network;
      await expect(exportNetwork({ id: 10 })).rejects.toThrow();
    });

    it('should autoMine blocks when autoMine enabled', async () => {
      jest.useFakeTimers();

      const { addNetwork } = store.getActions().network;
      await addNetwork(addNetworkArgs);
      const { networks } = store.getState().network;

      await store
        .getActions()
        .network.autoMine({ id: networks[0].id, mode: AutoMineMode.Auto30s });

      jest.advanceTimersByTime(65000);
      expect(bitcoinServiceMock.mine).toHaveBeenCalledTimes(2);

      await store
        .getActions()
        .network.autoMine({ id: networks[0].id, mode: AutoMineMode.AutoOff });

      jest.advanceTimersByTime(65000);
      // the call count is not incremented
      expect(bitcoinServiceMock.mine).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should fail to setAutoMineMode with an invalid id', async () => {
      const { setAutoMineMode } = store.getActions().network;
      expect(() => setAutoMineMode({ id: 10, mode: AutoMineMode.Auto30s })).toThrow();
    });

    it('should fail to autoMine blocks with an invalid id', async () => {
      const { autoMine } = store.getActions().network;
      await expect(autoMine({ id: 10, mode: AutoMineMode.Auto30s })).rejects.toThrow();
    });

    it('should fail to mineBlock blocks with an invalid id', async () => {
      const { mineBlock } = store.getActions().network;
      await expect(mineBlock({ id: 10 })).rejects.toThrow();
    });

    it('should fail to rename node with an invalid id', async () => {
      const { addNetwork, renameNode } = store.getActions().network;
      addNetwork(addNetworkArgs);
      const node = {
        ...firstNetwork().nodes.lightning[0],
        networkId: 999,
      };
      await expect(renameNode({ node, newName: 'asdf' })).rejects.toThrow(
        "Network with the id '999' was not found.",
      );
    });
  });
});
