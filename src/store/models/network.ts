import { ipcRenderer, remote, SaveDialogOptions } from 'electron';
import { info } from 'electron-log';
import { join } from 'path';
import { push } from 'connected-react-router';
import { Action, action, Computed, computed, Thunk, thunk } from 'easy-peasy';
import {
  AnyNode,
  BitcoinNode,
  CommonNode,
  LightningNode,
  LitdNode,
  NodeImplementation,
  Status,
  TapdNode,
  TapNode,
} from 'shared/types';
import { AutoMineMode, CustomImage, Network, StoreInjections } from 'types';
import { delay } from 'utils/async';
import { initChartFromNetwork } from 'utils/chart';
import { APP_VERSION, DOCKER_REPO } from 'utils/constants';
import { rm } from 'utils/files';
import {
  createBitcoindNetworkNode,
  createCLightningNetworkNode,
  createEclairNetworkNode,
  createLitdNetworkNode,
  createLndNetworkNode,
  createNetwork,
  createTapdNetworkNode,
  filterCompatibleBackends,
  getMissingImages,
  getOpenPorts,
  importNetworkFromZip,
  OpenPorts,
  renameNode,
  zipNetwork,
} from 'utils/network';
import { prefixTranslation } from 'utils/translate';
import { NETWORK_VIEW } from 'components/routing';
import { RootModel } from './';

const { l } = prefixTranslation('store.models.network');

interface AddNetworkArgs {
  name: string;
  description: string;
  lndNodes: number;
  clightningNodes: number;
  eclairNodes: number;
  bitcoindNodes: number;
  tapdNodes: number;
  litdNodes: number;
  customNodes: Record<string, number>;
}

export interface AutoMinerModel {
  startTime: number;
  timer?: NodeJS.Timer;
  mining: boolean;
}

export interface NetworkModel {
  networks: Network[];
  networkById: Computed<NetworkModel, (id?: string | number) => Network>;
  setNetworks: Action<NetworkModel, Network[]>;
  updateNodePorts: Action<NetworkModel, { id: number; ports: OpenPorts }>;
  updateNodeCommand: Action<NetworkModel, { id: number; name: string; command: string }>;
  load: Thunk<NetworkModel, void, StoreInjections, RootModel, Promise<void>>;
  save: Thunk<NetworkModel, void, StoreInjections, RootModel, Promise<void>>;
  add: Action<NetworkModel, Network>;
  addNetwork: Thunk<
    NetworkModel,
    AddNetworkArgs,
    StoreInjections,
    RootModel,
    Promise<void>
  >;
  addNode: Thunk<
    NetworkModel,
    {
      id: number;
      type: string;
      version: string;
      customId?: string;
    },
    StoreInjections,
    RootModel,
    Promise<AnyNode>
  >;
  updateAdvancedOptions: Thunk<
    NetworkModel,
    { node: CommonNode; command: string },
    StoreInjections,
    RootModel,
    Promise<void>
  >;
  getBackendNode: Thunk<
    NetworkModel,
    LightningNode,
    StoreInjections,
    RootModel,
    BitcoinNode | undefined
  >;
  removeLightningNode: Thunk<
    NetworkModel,
    { node: LightningNode },
    StoreInjections,
    RootModel
  >;
  removeTapNode: Thunk<NetworkModel, { node: TapNode }, StoreInjections, RootModel>;
  removeBitcoinNode: Thunk<
    NetworkModel,
    { node: BitcoinNode },
    StoreInjections,
    RootModel
  >;
  updateBackendNode: Thunk<
    NetworkModel,
    { id: number; lnName: string; backendName: string },
    StoreInjections,
    RootModel
  >;
  updateTapBackendNode: Thunk<
    NetworkModel,
    { id: number; tapName: string; lndName: string },
    StoreInjections,
    RootModel
  >;
  setStatus: Action<
    NetworkModel,
    { id: number; status: Status; only?: string; all?: boolean; error?: Error }
  >;
  start: Thunk<NetworkModel, number, StoreInjections, RootModel, Promise<void>>;
  stop: Thunk<NetworkModel, number, StoreInjections, RootModel, Promise<void>>;
  stopAll: Thunk<NetworkModel, void, StoreInjections, RootModel, Promise<void>>;
  toggle: Thunk<NetworkModel, number, StoreInjections, RootModel, Promise<void>>;
  toggleNode: Thunk<NetworkModel, CommonNode, StoreInjections, RootModel, Promise<void>>;
  monitorStartup: Thunk<
    NetworkModel,
    CommonNode[],
    StoreInjections,
    RootModel,
    Promise<void>
  >;
  rename: Thunk<
    NetworkModel,
    { id: number; name: string; description: string },
    StoreInjections,
    RootModel,
    Promise<void>
  >;
  remove: Thunk<NetworkModel, number, StoreInjections, RootModel, Promise<void>>;
  renameNode: Thunk<
    NetworkModel,
    { node: AnyNode; newName: string },
    StoreInjections,
    RootModel,
    Promise<void>
  >;

  /**
   * If user didn't cancel the process, returns the destination of the generated Zip
   */
  exportNetwork: Thunk<
    NetworkModel,
    { id: number },
    StoreInjections,
    RootModel,
    Promise<string | undefined>
  >;
  /**
   * Given a file path to a zip archive, unpack and import the contained network
   */
  importNetwork: Thunk<
    NetworkModel,
    string,
    StoreInjections,
    RootModel,
    Promise<Network>
  >;

  /**
   * Auto Mining state and store actions
   */
  autoMiners: { [id: number]: AutoMinerModel };
  autoMine: Thunk<
    NetworkModel,
    { id: number; mode: AutoMineMode; networkLoading?: boolean },
    StoreInjections,
    RootModel
  >;
  setAutoMineMode: Action<NetworkModel, { id: number; mode: AutoMineMode }>;
  setMiningState: Action<NetworkModel, { id: number; mining: boolean }>;
  mineBlock: Thunk<NetworkModel, { id: number }, StoreInjections, RootModel>;
}

const networkModel: NetworkModel = {
  // state properties
  networks: [],
  autoMiners: {},
  // computed properties/functions
  networkById: computed(state => (id?: string | number) => {
    const networkId = typeof id === 'number' ? id : parseInt(id || '');
    const network = state.networks.find(n => n.id === networkId);
    if (!network) {
      throw new Error(l('networkByIdErr', { networkId }));
    }
    return network;
  }),
  // reducer actions (mutations allowed thx to immer)
  setNetworks: action((state, networks) => {
    state.networks = networks;
  }),
  updateNodeCommand: action((state, { id, name, command }) => {
    const network = state.networks.find(n => n.id === id) as Network;
    const { lightning, bitcoin, tap } = network.nodes;
    const nodes: CommonNode[] = [...lightning, ...bitcoin, ...tap];
    nodes.filter(n => n.name === name).forEach(n => (n.docker.command = command));
  }),
  updateNodePorts: action((state, { id, ports }) => {
    const network = state.networks.find(n => n.id === id) as Network;
    network.nodes.bitcoin
      .filter(n => !!ports[n.name])
      .forEach(n => (n.ports = { ...n.ports, ...ports[n.name] }));
    network.nodes.lightning
      .filter(n => !!ports[n.name])
      .forEach(n => (n.ports = { ...n.ports, ...ports[n.name] }));
    network.nodes.tap
      .filter(n => !!ports[n.name])
      .forEach(n => (n.ports = { ...n.ports, ...ports[n.name] }));
  }),
  load: thunk(async (actions, payload, { injections, getStoreActions }) => {
    const { networks, charts } = await injections.dockerService.loadNetworks();
    if (networks && networks.length) {
      actions.setNetworks(networks);
    }
    getStoreActions().designer.setAllCharts(charts);
    networks.forEach(network => {
      actions.autoMine({
        id: network.id,
        mode: network.autoMineMode || AutoMineMode.AutoOff,
        networkLoading: true,
      });
    });
  }),
  save: thunk(async (actions, payload, { getState, injections, getStoreState }) => {
    const data = {
      version: APP_VERSION,
      networks: getState().networks,
      charts: getStoreState().designer.allCharts,
    };
    await injections.dockerService.saveNetworks(data);
  }),
  add: action((state, network) => {
    state.networks.push(network);
    info(`Added new network '${network.name}' to redux state`);
  }),
  addNetwork: thunk(
    async (
      actions,
      payload,
      { dispatch, getState, injections, getStoreState, getStoreActions },
    ) => {
      const { dockerRepoState, computedManagedImages, settings } = getStoreState().app;
      // convert the customNodes object into an array of custom images with counts
      const customImages: { image: CustomImage; count: number }[] = [];
      Object.entries(payload.customNodes)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .filter(([_, count]) => count > 0)
        .forEach(([id, count]) => {
          const image = settings.nodeImages.custom.find(i => i.id === id);
          if (image) customImages.push({ image, count });
        });
      const nextId = Math.max(0, ...getState().networks.map(n => n.id)) + 1;
      const network = createNetwork({
        id: nextId,
        name: payload.name,
        description: payload.description,
        lndNodes: payload.lndNodes,
        clightningNodes: payload.clightningNodes,
        eclairNodes: payload.eclairNodes,
        bitcoindNodes: payload.bitcoindNodes,
        tapdNodes: payload.tapdNodes,
        litdNodes: payload.litdNodes,
        repoState: dockerRepoState,
        managedImages: computedManagedImages,
        customImages,
        basePorts: settings.basePorts,
      });
      actions.add(network);
      const { networks } = getState();
      const newNetwork = networks[networks.length - 1];
      await injections.dockerService.saveComposeFile(newNetwork);
      const chart = initChartFromNetwork(newNetwork);
      getStoreActions().designer.setChart({ id: newNetwork.id, chart });
      getStoreActions().designer.setActiveId(newNetwork.id);
      await actions.save();

      await getStoreActions().app.updateSettings({
        newNodeCounts: {
          LND: payload.lndNodes,
          'c-lightning': payload.clightningNodes,
          eclair: payload.eclairNodes,
          bitcoind: payload.bitcoindNodes,
          tapd: payload.tapdNodes,
          litd: payload.litdNodes,
          btcd: 0,
        },
      });

      dispatch(push(NETWORK_VIEW(newNetwork.id)));
    },
  ),
  addNode: thunk(
    async (
      actions,
      { id, type, version, customId },
      { getState, getStoreState, injections },
    ) => {
      const { dockerRepoState, settings } = getStoreState().app;
      const networks = getState().networks;
      const network = networks.find(n => n.id === id);
      if (!network) throw new Error(l('networkByIdErr', { networkId: id }));
      let node: AnyNode;
      // lookup custom image and startup command
      const docker = { image: '', command: '' };
      if (customId) {
        const customNode = settings.nodeImages.custom.find(n => n.id === customId);
        if (customNode) {
          docker.image = customNode.dockerImage;
          docker.command = customNode.command;
        }
      } else {
        const nodeImage = settings.nodeImages.managed.find(
          i => i.implementation === (type as NodeImplementation) && i.version === version,
        );
        docker.command = nodeImage ? nodeImage.command : '';
      }
      switch (type) {
        case 'LND':
          node = createLndNetworkNode(
            network,
            version,
            dockerRepoState.images.LND.compatibility,
            docker,
            undefined,
            settings.basePorts.LND,
          );
          network.nodes.lightning.push(node);
          break;
        case 'c-lightning':
          node = createCLightningNetworkNode(
            network,
            version,
            dockerRepoState.images['c-lightning'].compatibility,
            docker,
            undefined,
            settings.basePorts['c-lightning'],
          );
          network.nodes.lightning.push(node);
          break;
        case 'eclair':
          node = createEclairNetworkNode(
            network,
            version,
            dockerRepoState.images.eclair.compatibility,
            docker,
            undefined,
            settings.basePorts.eclair,
          );
          network.nodes.lightning.push(node);
          break;
        case 'litd':
          node = createLitdNetworkNode(
            network,
            version,
            dockerRepoState.images.litd.compatibility,
            docker,
          );
          network.nodes.lightning.push(node);
          break;
        case 'bitcoind':
          node = createBitcoindNetworkNode(
            network,
            version,
            docker,
            undefined,
            settings.basePorts.bitcoind,
          );
          network.nodes.bitcoin.push(node);
          break;
        case 'tapd':
          node = createTapdNetworkNode(
            network,
            version,
            dockerRepoState.images.tapd.compatibility,
            docker,
            undefined,
            settings.basePorts.tapd,
          );
          network.nodes.tap.push(node);
          break;
        default:
          throw new Error(`Cannot add unknown node type '${type}' to the network`);
      }
      actions.setNetworks([...networks]);
      await actions.save();
      await injections.dockerService.saveComposeFile(network);
      return node;
    },
  ),
  updateAdvancedOptions: thunk(
    async (actions, { node, command }, { getState, injections }) => {
      const networks = getState().networks;
      let network = networks.find(n => n.id === node.networkId);
      if (!network) throw new Error(l('networkByIdErr', { networkId: node.networkId }));
      actions.updateNodeCommand({ id: node.networkId, name: node.name, command });
      await actions.save();
      network = getState().networks.find(n => n.id === node.networkId) as Network;
      await injections.dockerService.saveComposeFile(network);
    },
  ),
  getBackendNode: thunk((actions, lnNode, { getState }) => {
    const networks = getState().networks;
    const network = networks.find(n => n.id === lnNode.networkId);
    if (!network) throw new Error(l('networkByIdErr', { networkId: lnNode.networkId }));
    return network.nodes.bitcoin.find(n => n.name === lnNode.backendName);
  }),
  removeLightningNode: thunk(
    async (actions, { node }, { getState, injections, getStoreActions }) => {
      const networks = getState().networks;
      const network = networks.find(n => n.id === node.networkId);
      if (!network) throw new Error(l('networkByIdErr', { networkId: node.networkId }));
      // don't allow removing an LND node if it has a tapd node connected to it
      if (node.implementation === 'LND') {
        const tapdNodes = network.nodes.tap.filter(
          n => n.implementation === 'tapd' && (n as TapdNode).lndName === node.name,
        );
        if (tapdNodes.length) {
          throw new Error(l('removeTapdErr', { lnName: node.name }));
        }
      }
      // remove the node from the network
      network.nodes.lightning = network.nodes.lightning.filter(n => n !== node);
      // remove the node's data from the lightning redux state
      getStoreActions().lightning.removeNode(node.name);
      // remove the node rom the running docker network
      if (network.status === Status.Started) {
        await injections.dockerService.removeNode(network, node);
      }
      await injections.dockerService.saveComposeFile(network);
      // clear cached RPC data
      if (node.implementation === 'LND') getStoreActions().app.clearAppCache();
      // remove the node from the chart's redux state
      getStoreActions().designer.removeNode(node.name);
      if (node.implementation === 'litd') {
        // remove the litd node from the litd redux state
        getStoreActions().lit.removeNode(node.name);
      }
      // update the network in the redux state and save to disk
      actions.setNetworks([...networks]);
      await actions.save();
      // delete the docker volume data from disk
      const volumeDir = node.implementation.toLocaleLowerCase().replace('-', '');
      rm(join(network.path, 'volumes', volumeDir, node.name));
      // sync the chart
      await getStoreActions().designer.syncChart(network);
    },
  ),
  removeTapNode: thunk(
    async (actions, { node }, { getState, injections, getStoreActions }) => {
      const networks = getState().networks;
      const network = networks.find(n => n.id === node.networkId);
      if (!network) throw new Error(l('networkByIdErr', { networkId: node.networkId }));
      // remove the node from the network
      network.nodes.tap = network.nodes.tap.filter(n => n !== node);
      // remove the node's data from the lightning redux state
      getStoreActions().tap.removeNode(node.name);
      // remove the node rom the running docker network
      if (network.status === Status.Started) {
        await injections.dockerService.removeNode(network, node);
      }
      await injections.dockerService.saveComposeFile(network);
      // clear cached RPC data
      getStoreActions().app.clearAppCache();
      // remove the node from the chart's redux state
      getStoreActions().designer.removeNode(node.name);
      // update the network in the redux state and save to disk
      actions.setNetworks([...networks]);
      await actions.save();
      // delete the docker volume data from disk
      const volumeDir = node.implementation.toLocaleLowerCase().replace('-', '');
      rm(join(network.path, 'volumes', volumeDir, node.name));
      // sync the chart
      await getStoreActions().designer.syncChart(network);
    },
  ),
  removeBitcoinNode: thunk(
    async (
      actions,
      { node },
      { getState, injections, getStoreState, getStoreActions },
    ) => {
      const networks = getState().networks;
      const network = networks.find(n => n.id === node.networkId);
      if (!network) throw new Error(l('networkByIdErr', { networkId: node.networkId }));
      const { dockerRepoState } = getStoreState().app;
      const { dockerService, lightningFactory } = injections;
      const { bitcoin: bitcoinActions, designer } = getStoreActions();
      const { bitcoin, lightning } = network.nodes;

      if (bitcoin.length === 1) throw new Error(l('removeLastErr'));
      const index = bitcoin.indexOf(node);
      const remaining = bitcoin.filter(n => n !== node);
      // update LN nodes to use a different backend. Use the first bitcoin node unless
      // it is the one being removed
      lightning
        .filter(n => n.backendName === node.name)
        .forEach(n => {
          try {
            const backends = filterCompatibleBackends(
              n.implementation,
              n.version,
              dockerRepoState.images[n.implementation].compatibility,
              remaining,
            );
            n.backendName = backends[0].name;
          } catch (error: any) {
            throw new Error(l('removeCompatErr', { lnName: n.name }));
          }
        });

      // bitcoin nodes are peered with the nodes immediately before and after. if the
      // node being removed is in between two nodes, then connect those two nodes
      // together. Otherwise, the network will be operating on two different chains
      if (index > 0 && index < bitcoin.length - 1) {
        // make prev & next nodes peers
        const [prev, curr, next] = bitcoin.slice(index - 1, index + 2);
        // remove curr and add next to prev peers
        prev.peers = [...prev.peers.filter(p => p !== curr.name), next.name];
        // remove curr and add prev to next peers
        next.peers = [prev.name, ...next.peers.filter(p => p !== curr.name)];
      }
      // remove the node from the network
      network.nodes.bitcoin = bitcoin.filter(n => n !== node);
      // remove the node's data from the bitcoind redux state
      bitcoinActions.removeNode(node);
      if (network.status === Status.Started) {
        // restart the whole network if it is running
        await actions.stop(network.id);
        await dockerService.saveComposeFile(network);
        await actions.start(network.id);
      } else {
        // save compose file if the network is not running
        await dockerService.saveComposeFile(network);
      }
      // update the network in the redux state and save to disk
      actions.setNetworks([...networks]);
      await actions.save();
      // delete the docker volume data from disk
      const volumeDir = node.implementation.toLocaleLowerCase().replace('-', '');
      rm(join(network.path, 'volumes', volumeDir, node.name));
      if (network.status === Status.Started) {
        // wait for the LN nodes to come back online then update the chart
        await Promise.all(
          lightning.map(n => lightningFactory.getService(n).waitUntilOnline(n)),
        );
      }
      // remove the node from the chart's redux state
      designer.removeNode(node.name);
      await designer.syncChart(network);
    },
  ),
  updateBackendNode: thunk(
    async (
      actions,
      { id, lnName, backendName },
      { injections, getState, getStoreActions },
    ) => {
      const networks = getState().networks;
      const network = networks.find(n => n.id === id);
      if (!network) throw new Error(l('networkByIdErr', { networkId: id }));
      const lnNode = network.nodes.lightning.find(n => n.name === lnName);
      if (!lnNode) throw new Error(l('nodeByNameErr', { name: lnName }));
      const btcNode = network.nodes.bitcoin.find(n => n.name === backendName);
      if (!btcNode) throw new Error(l('nodeByNameErr', { name: backendName }));
      if (lnNode.backendName === backendName)
        throw new Error(l('connectedErr', { lnName, backendName }));

      if (network.status === Status.Started) {
        // stop the LN node container
        actions.setStatus({ id: network.id, status: Status.Stopping, only: lnName });
        await injections.dockerService.stopNode(network, lnNode);
        actions.setStatus({ id: network.id, status: Status.Stopped, only: lnName });
      }

      // update the backend
      lnNode.backendName = btcNode.name;
      // update the network in the redux state and save to disk
      actions.setNetworks([...networks]);
      await actions.save();
      // save the updated compose file
      await injections.dockerService.saveComposeFile(network);

      if (network.status === Status.Started) {
        // start the LN node container
        actions.setStatus({ id: network.id, status: Status.Starting, only: lnName });
        await injections.dockerService.startNode(network, lnNode);
        await actions.monitorStartup([
          ...network.nodes.lightning,
          ...network.nodes.bitcoin,
        ]);
      }

      // update the link in the chart
      getStoreActions().designer.updateBackendLink({ lnName, backendName });
    },
  ),
  updateTapBackendNode: thunk(
    async (
      actions,
      { id, tapName, lndName },
      { injections, getState, getStoreActions },
    ) => {
      const networks = getState().networks;
      const network = networks.find(n => n.id === id);
      if (!network) throw new Error(l('networkByIdErr', { networkId: id }));
      const lndNode = network.nodes.lightning.find(n => n.name === lndName);
      if (!lndNode) throw new Error(l('nodeByNameErr', { name: lndName }));
      const tapNode = network.nodes.tap.find(n => n.name === tapName) as TapdNode;
      if (!tapNode) throw new Error(l('nodeByNameErr', { name: tapName }));
      if (tapNode.lndName === lndName)
        throw new Error(l('connectedErr', { lnName: tapName, backendName: lndName }));

      tapNode.lndName = lndNode.name;
      // update the network in the redux state and save to disk
      actions.setNetworks([...networks]);
      await actions.save();
      // save the updated compose file
      await injections.dockerService.saveComposeFile(network);

      getStoreActions().designer.updateTapBackendLink({ tapName, lndName: lndName });
    },
  ),
  setStatus: action((state, { id, status, only, all = true, error }) => {
    const network = state.networks.find(n => n.id === id);
    if (!network) throw new Error(l('networkByIdErr', { networkId: id }));
    const setNodeStatus = (n: CommonNode) => {
      n.status = status;
      n.errorMsg = error && error.message;
    };
    if (only) {
      // only update a specific node's status
      network.nodes.lightning.filter(n => n.name === only).forEach(setNodeStatus);
      network.nodes.bitcoin.filter(n => n.name === only).forEach(setNodeStatus);
      network.nodes.tap.filter(n => n.name === only).forEach(setNodeStatus);
    } else if (all) {
      // update all node statuses
      network.status = status;
      network.nodes.bitcoin.forEach(setNodeStatus);
      network.nodes.lightning.forEach(setNodeStatus);
      network.nodes.tap.forEach(setNodeStatus);
    } else {
      // if no specific node name provided, just update the network status
      network.status = status;
    }
  }),
  start: thunk(
    async (
      actions,
      networkId,
      { getState, injections, getStoreState, getStoreActions },
    ) => {
      let network = getState().networks.find(n => n.id === networkId);
      if (!network) throw new Error(l('networkByIdErr', { networkId }));
      const { dockerImages } = getStoreState().app;
      // make sure all non-Polar images are available
      const missingImages = getMissingImages(network, dockerImages).filter(
        i => !i.startsWith(DOCKER_REPO),
      );
      if (missingImages.length) {
        throw new Error(`${l('missingImages')}: ${missingImages.join(', ')}`);
      }
      const { id } = network;
      actions.setStatus({ id: id, status: Status.Starting });
      try {
        // make sure the node ports are available
        const ports = await getOpenPorts(network);
        if (ports) {
          // at least one port was updated. save the network & composeFile
          actions.updateNodePorts({ id, ports });
          // re-fetch the network with the updated ports
          network = getState().networks.find(n => n.id === networkId) as Network;
          await actions.save();
          await injections.dockerService.saveComposeFile(network);
        }
        // start the docker containers
        await injections.dockerService.start(network);
        // update the list of docker images pulled since new images may be pulled
        await getStoreActions().app.getDockerImages();
        // set the status of only the network to Started
        actions.setStatus({ id, status: Status.Started, all: false });
        // wait for nodes to startup before updating their status
        await actions.monitorStartup([
          ...network.nodes.lightning,
          ...network.nodes.bitcoin,
          ...network.nodes.tap,
        ]);
      } catch (e: any) {
        actions.setStatus({ id, status: Status.Error });
        info(`unable to start network '${network.name}'`, e.message);
        throw e;
      }
    },
  ),
  stop: thunk(async (actions, networkId, { getState, injections, getStoreActions }) => {
    const network = getState().networks.find(n => n.id === networkId);
    if (!network) throw new Error(l('networkByIdErr', { networkId }));
    actions.autoMine({ id: network.id, mode: AutoMineMode.AutoOff });
    actions.setStatus({ id: network.id, status: Status.Stopping });
    try {
      await injections.dockerService.stop(network);
      actions.setStatus({ id: network.id, status: Status.Stopped });
      // Remove listeners from lightning nodes
      await getStoreActions().lightning.removeListeners(network);
      // clear cached RPC data
      getStoreActions().app.clearAppCache();
    } catch (e: any) {
      actions.setStatus({ id: network.id, status: Status.Error });
      info(`unable to stop network '${network.name}'`, e.message);
      throw e;
    }
  }),
  stopAll: thunk(async (actions, _, { getState }) => {
    let networks = getState().networks.filter(
      n => n.status === Status.Started || n.status === Status.Stopping,
    );
    if (networks.length === 0) {
      ipcRenderer.send('docker-shut-down');
    }
    networks.forEach(async network => {
      await actions.stop(network.id);
    });
    setInterval(async () => {
      networks = getState().networks.filter(
        n => n.status === Status.Started || n.status === Status.Stopping,
      );
      if (networks.length === 0) {
        await actions.save();
        ipcRenderer.send('docker-shut-down');
      }
    }, 2000);
  }),
  toggle: thunk(async (actions, networkId, { getState }) => {
    const network = getState().networks.find(n => n.id === networkId);
    if (!network) throw new Error(l('networkByIdErr', { networkId }));
    if (network.status === Status.Stopped || network.status === Status.Error) {
      await actions.start(network.id);
    } else if (network.status === Status.Started) {
      await actions.stop(network.id);
    }
    await actions.save();
  }),
  toggleNode: thunk(async (actions, node, { getState, injections, getStoreActions }) => {
    const { networkId } = node;
    let network = getState().networks.find(n => n.id === networkId);
    if (!network) throw new Error(l('networkByIdErr', { networkId }));
    const only = node.name;
    if (node.status === Status.Stopped || node.status === Status.Error) {
      // start the node container
      actions.setStatus({ id: network.id, status: Status.Starting, only });
      // make sure the node ports are available
      const ports = await getOpenPorts(network);
      if (ports) {
        // at least one port was updated. save the network & composeFile
        actions.updateNodePorts({ id: node.networkId, ports });
        // re-fetch the network with the updated ports
        network = getState().networks.find(n => n.id === networkId) as Network;
        await actions.save();
        await injections.dockerService.saveComposeFile(network);
      }
      await injections.dockerService.startNode(network, node);
      actions.monitorStartup([node]);
    } else if (node.status === Status.Started) {
      // stop the node container
      actions.setStatus({ id: network.id, status: Status.Stopping, only });
      await injections.dockerService.stopNode(network, node);
      actions.setStatus({ id: network.id, status: Status.Stopped, only });
      // clear cached RPC data
      getStoreActions().app.clearAppCache();
    }
    await actions.save();
  }),
  monitorStartup: thunk(
    async (actions, nodes, { injections, getStoreState, getStoreActions }) => {
      if (!nodes.length) return;
      const id = nodes[0].networkId;
      const network = getStoreState().network.networks.find(n => n.id === id);
      if (!network) throw new Error(l('networkByIdErr', { networkId: id }));

      const lnNodesOnline: Promise<void>[] = [];
      const btcNodesOnline: Promise<void>[] = [];
      for (const node of nodes) {
        // wait for lnd nodes to come online before updating their status
        if (node.type === 'lightning') {
          const ln = node as LightningNode;
          let promise: Promise<void>;
          if (ln.implementation !== 'litd') {
            // use .then() to continue execution while the promises are waiting to complete
            promise = injections.lightningFactory
              .getService(ln)
              .waitUntilOnline(ln)
              .then(async () => {
                actions.setStatus({ id, status: Status.Started, only: ln.name });
              })
              .catch(error =>
                actions.setStatus({ id, status: Status.Error, only: ln.name, error }),
              );
          } else {
            const litd = ln as LitdNode;
            promise = injections.litdService
              .waitUntilOnline(litd)
              .then(async () => {
                actions.setStatus({ id, status: Status.Started, only: ln.name });
              })
              .catch(error =>
                actions.setStatus({ id, status: Status.Error, only: ln.name, error }),
              );
          }
          lnNodesOnline.push(promise);
        } else if (node.type === 'bitcoin') {
          const btc = node as BitcoinNode;
          // wait for bitcoind nodes to come online before updating their status
          // use .then() to continue execution while the promises are waiting to complete
          const promise = injections.bitcoinFactory
            .getService(btc)
            .waitUntilOnline(btc)
            .then(async () => {
              actions.setStatus({ id, status: Status.Started, only: btc.name });
              // connect each bitcoin node to it's peers so tx & block propagation is fast
              await injections.bitcoinFactory.getService(btc).connectPeers(btc);
              // create a default wallet since it's not automatic on v0.21.0 and up
              await injections.bitcoinFactory.getService(btc).createDefaultWallet(btc);
              await getStoreActions().bitcoin.getInfo(btc);
            })
            .catch(error =>
              actions.setStatus({ id, status: Status.Error, only: btc.name, error }),
            );
          btcNodesOnline.push(promise);
        } else if (node.type === 'tap') {
          const tap = node as TapNode;
          injections.tapFactory
            .getService(tap)
            .waitUntilOnline(tap)
            .then(async () => {
              actions.setStatus({ id, status: Status.Started, only: tap.name });
            })
            .catch(error =>
              actions.setStatus({ id, status: Status.Error, only: tap.name, error }),
            );
        }
      }
      // after all bitcoin nodes are online, mine one block so that Eclair nodes will start
      if (btcNodesOnline.length) {
        const node = network.nodes.bitcoin[0];
        await Promise.all(btcNodesOnline)
          .then(async () => {
            await delay(2000);
            await getStoreActions().bitcoin.mine({ node, blocks: 1 });
          })
          .catch(e => info('Failed to mine a block after network startup', e));
      }
      // after all LN nodes are online, connect each of them to each other. This helps
      // ensure that each node is aware of the entire graph and can route payments properly
      if (lnNodesOnline.length) {
        await Promise.all(lnNodesOnline)
          .then(async () => {
            await getStoreActions().lightning.connectAllPeers(network);
            // Add listeners to lightning nodes
            await getStoreActions().lightning.addListeners(network);
          })
          .catch(e => info('Failed to connect all LN peers', e));
      }
    },
  ),
  rename: thunk(async (actions, { id, name, description }, { getState }) => {
    if (!name) throw new Error(l('missingNetworkName', { name }));
    const { networks } = getState();
    const network = networks.find(n => n.id === id);
    if (!network) throw new Error(l('networkByIdErr', { networkId: id }));
    network.name = name;
    network.description = description;
    actions.setNetworks(networks);
    await actions.save();
  }),
  remove: thunk(async (actions, networkId, { getState, getStoreActions }) => {
    const { networks } = getState();
    const network = networks.find(n => n.id === networkId);
    if (!network) throw new Error(l('networkByIdErr', { networkId }));
    const statuses = [
      network.status,
      ...network.nodes.lightning.map(n => n.status),
      ...network.nodes.bitcoin.map(n => n.status),
    ];
    if (statuses.find(n => n !== Status.Stopped)) {
      await actions.stop(networkId);
    }
    await rm(network.path);
    const newNetworks = networks.filter(n => n.id !== networkId);
    actions.setNetworks(newNetworks);
    getStoreActions().designer.removeChart(networkId);
    network.nodes.lightning.forEach(n => getStoreActions().lightning.removeNode(n.name));
    network.nodes.lightning
      .filter(n => n.implementation === 'litd')
      .forEach(n => getStoreActions().lit.removeNode(n.name));
    network.nodes.bitcoin.forEach(n => getStoreActions().bitcoin.removeNode(n));
    network.nodes.tap.forEach(n => getStoreActions().tap.removeNode(n.name));
    await actions.save();
    await getStoreActions().app.clearAppCache();
  }),
  exportNetwork: thunk(async (actions, { id }, { getState, getStoreState }) => {
    const { networks } = getState();
    const network = networks.find(n => n.id === id);
    if (!network) throw new Error(l('networkByIdErr', { networkId: id }));
    // only export stopped networks
    if (![Status.Error, Status.Stopped].includes(network.status)) {
      throw new Error(l('exportBadStatus'));
    }
    const defaultName = network.name.replace(/\s/g, '-').replace(/[^0-9a-zA-Z-._]/g, '');
    const options: SaveDialogOptions = {
      title: l('exportTitle', { name: network.name }),
      defaultPath: `${defaultName}.polar.zip`,
      properties: ['promptToCreate', 'createDirectory'],
    } as any; // types are broken, but 'properties' allow us to customize how the dialog performs
    const { filePath } = await remote.dialog.showSaveDialog(options);

    // user aborted dialog
    if (!filePath) {
      info('User aborted network export');
      return;
    }

    info(`exporting network '${network.name}' to '${filePath}'`);
    const { activeChart } = getStoreState().designer;
    await zipNetwork(network, activeChart, filePath);
    info('exported network successfully');
    return filePath;
  }),
  importNetwork: thunk(
    async (actions, path, { getStoreState, getStoreActions, injections }) => {
      const { networks } = getStoreState().network;
      const { add, save } = getStoreActions().network;
      const { setChart } = getStoreActions().designer;

      // determine the next available id to use
      const nextId = Math.max(0, ...networks.map(n => n.id)) + 1;
      const [network, chart] = await importNetworkFromZip(path, nextId);

      add(network);
      setChart({ chart, id: network.id });
      await save();
      await injections.dockerService.saveComposeFile(network);

      info('imported', JSON.stringify({ network, chart }));
      return network;
    },
  ),
  setAutoMineMode: action((state, { id, mode }) => {
    const network = state.networks.find(n => n.id === id);
    if (!network) throw new Error(l('networkByIdErr', { id }));

    network.autoMineMode = mode;
  }),
  setMiningState: action((state, { id, mining }) => {
    state.autoMiners[id].mining = mining;
  }),
  mineBlock: thunk(async (actions, { id }, { getStoreState, getStoreActions }) => {
    const { networks } = getStoreState().network;
    const network = networks.find(n => n.id === id);
    if (!network) throw new Error(l('networkByIdErr', { id }));

    const { bitcoin } = getStoreActions();
    const node = network.nodes.bitcoin[0];

    actions.setMiningState({ id, mining: true });

    try {
      await bitcoin.mine({ node, blocks: 1 });
    } catch (e) {
      // No error displayed to the user since this is could be a background running task
    }

    bitcoin.getInfo(node);
    actions.setMiningState({ id, mining: false });
  }),
  autoMine: thunk(async (actions, { id, mode, networkLoading }, { getState }) => {
    const { networks, autoMiners } = getState();
    const network = networks.find(n => n.id === id);
    if (!network) throw new Error(l('networkByIdErr', { id }));

    if (!autoMiners[id]) {
      autoMiners[id] = {
        mining: false,
        startTime: 0,
        timer: undefined,
      };
    }

    if (networkLoading || network.autoMineMode !== mode) {
      await actions.save();

      if (autoMiners[id].timer) {
        clearInterval(autoMiners[id].timer);
      }

      if (mode !== AutoMineMode.AutoOff) {
        autoMiners[id].startTime = Date.now();
        autoMiners[id].timer = setInterval(() => actions.mineBlock({ id }), 1000 * mode);
      } else {
        autoMiners[id].timer = undefined;
        autoMiners[id].startTime = 0;
      }
    }

    actions.setAutoMineMode({ id, mode });
  }),
  renameNode: thunk(
    async (actions, { node, newName }, { getState, injections, getStoreActions }) => {
      const wasStarted = node.status === Status.Started;

      if (wasStarted) {
        await actions.stop(node.networkId);
      }
      const oldNodeName = node.name;

      const networks = getState().networks;
      const network = networks.find(n => n.id === node.networkId);
      if (!network) throw new Error(l('networkByIdErr', { networkId: node.networkId }));

      // rename the node's directory on disk
      await injections.dockerService.renameNodeDir(network, node, newName);

      // update the node's name in the network
      await renameNode(network, node, newName);
      // update the node's name in the chart
      getStoreActions().designer.renameNode({
        nodeId: oldNodeName,
        name: newName,
      });
      // remove the stored node data from the appropriate store
      switch (node.type) {
        case 'lightning':
          getStoreActions().lightning.removeNode(oldNodeName);
          break;
        case 'bitcoin':
          getStoreActions().bitcoin.removeNode(node);
          break;
        case 'tap':
          getStoreActions().tap.removeNode(oldNodeName);
          break;
      }

      // update the network in the store and save the changes to disk
      actions.setNetworks([...networks]);
      await actions.save();
      await injections.dockerService.saveComposeFile(network);

      // clear cached RPC data, specifically LND certs
      getStoreActions().app.clearAppCache();

      if (wasStarted) {
        // do not await this so the modal will close while the network is starting
        actions.start(node.networkId);
      }
    },
  ),
};

export default networkModel;
