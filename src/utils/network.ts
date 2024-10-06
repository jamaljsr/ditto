import { debug } from 'electron-log';
import { copy, writeFile } from 'fs-extra';
import { basename, join } from 'path';
import { IChart } from '@mrblenny/react-flow-chart';
import detectPort from 'detect-port';
import { tmpdir } from 'os';
import { ipcChannels } from 'shared';
import {
  AnyNode,
  BitcoinNode,
  CLightningNode,
  CommonNode,
  EclairNode,
  LightningNode,
  LitdNode,
  LndNode,
  NodeImplementation,
  Status,
  TapdNode,
  TapNode,
} from 'shared/types';
import { createIpcSender } from 'lib/ipc/ipcService';
import { LightningNodeChannel } from 'lib/lightning/types';
import {
  AutoMineMode,
  CustomImage,
  DockerRepoImage,
  DockerRepoState,
  ManagedImage,
  Network,
  NetworksFile,
  NodeBasePorts,
} from 'types';
import { dataPath, networksPath, nodePath } from './config';
import { BasePorts, DOCKER_REPO, dockerConfigs } from './constants';
import { read, rm } from './files';
import { migrateNetworksFile } from './migrations';
import { getName } from './names';
import { range } from './numbers';
import { isVersionBelow, isVersionCompatible } from './strings';
import { getPolarPlatform } from './system';
import { prefixTranslation } from './translate';

const { l } = prefixTranslation('utils.network');

export const getContainerName = (node: CommonNode) =>
  `polar-n${node.networkId}-${node.name}`;

export const getNetworkBackendId = (node: BitcoinNode) =>
  `${node.networkId}-${node.name}`;

const groupNodes = (network: Network) => {
  const { bitcoin, lightning, tap } = network.nodes;
  return {
    bitcoind: bitcoin.filter(n => n.implementation === 'bitcoind') as BitcoinNode[],
    lnd: lightning.filter(n => n.implementation === 'LND') as LndNode[],
    clightning: lightning.filter(
      n => n.implementation === 'c-lightning',
    ) as CLightningNode[],
    eclair: lightning.filter(n => n.implementation === 'eclair') as EclairNode[],
    litd: lightning.filter(n => n.implementation === 'litd') as LitdNode[],
    tapd: tap.filter(n => n.implementation === 'tapd') as TapdNode[],
  };
};

export const getInvoicePayload = (
  channel: LightningNodeChannel,
  localNode: LightningNode,
  remoteNode: LightningNode,
  nextLocalBalance: number,
) => {
  const localBalance = Number(channel.localBalance);
  const amount = Math.abs(localBalance - nextLocalBalance);
  const source = localBalance > nextLocalBalance ? localNode : remoteNode;
  const target = localBalance > nextLocalBalance ? remoteNode : localNode;
  return { source, target, amount };
};

export const getImageCommand = (
  images: ManagedImage[],
  implementation: NodeImplementation,
  version: string,
): string => {
  const image = images.find(
    i => i.implementation === implementation && i.version === version,
  );
  if (!image) {
    throw new Error(
      `Unable to set docker image command for ${implementation} v${version}`,
    );
  }
  return image.command;
};

// long path games
export const getLndFilePaths = (name: string, network: Network) => {
  // returns /volumes/lnd/lnd-1
  const lndDataPath = nodePath(network, 'LND', name);
  // returns /volumes/lnd/lnd-1/tls.cert
  const lndCertPath = join(lndDataPath, 'tls.cert');
  // returns /data/chain/bitcoin/regtest
  const macaroonPath = join('data', 'chain', 'bitcoin', 'regtest');
  // returns /volumes/lnd/lnd-1/data/chain/bitcoin/regtest/admin.macaroon
  const lndMacaroonPath = (macaroon: string) =>
    join(lndDataPath, macaroonPath, `${macaroon}.macaroon`);

  return {
    tlsCert: lndCertPath,
    adminMacaroon: lndMacaroonPath('admin'),
    invoiceMacaroon: lndMacaroonPath('invoice'),
    readonlyMacaroon: lndMacaroonPath('readonly'),
  };
};

// long path games
export const getLitdFilePaths = (name: string, network: Network) => {
  // /volumes/litd/<name>
  const basePath = nodePath(network, 'litd', name);
  // /volumes/litd/<name>/lnd/data/chain/bitcoin/regtest
  const macaroonPath = join(basePath, 'lnd', 'data', 'chain', 'bitcoin', 'regtest');

  return {
    // /volumes/litd/<name>/lnd/tls.cert
    tlsCert: join(basePath, 'lnd', 'tls.cert'),
    // /volumes/litd/<name>/lit/tls.cert
    litTlsCert: join(basePath, 'lit', 'tls.cert'),
    // /volumes/litd/<name>/lnd/data/chain/bitcoin/regtest/admin.macaroon
    adminMacaroon: join(macaroonPath, 'admin.macaroon'),
    invoiceMacaroon: join(macaroonPath, 'invoice.macaroon'),
    readonlyMacaroon: join(macaroonPath, 'readonly.macaroon'),
    // /volumes/litd/<name>/lit/regtest/lit.macaroon
    litMacaroon: join(basePath, 'lit', 'regtest', 'lit.macaroon'),
    // /volumes/litd/<name>/tapd/data/regtest/admin.macaroon
    tapMacaroon: join(basePath, 'tapd', 'data', 'regtest', 'admin.macaroon'),
  };
};

export const getCLightningFilePaths = (
  name: string,
  withTls: boolean,
  network: Network,
) => {
  const path = nodePath(network, 'c-lightning', name);
  return {
    macaroon: join(path, 'rest-api', 'access.macaroon'),
    rune: join(path, 'lightningd', 'admin.rune'),
    tlsCert: withTls ? join(path, 'lightningd', 'regtest', 'ca.pem') : undefined,
    tlsClientCert: withTls
      ? join(path, 'lightningd', 'regtest', 'client.pem')
      : undefined,
    tlsClientKey: withTls
      ? join(path, 'lightningd', 'regtest', 'client-key.pem')
      : undefined,
  };
};

export const getTapdFilePaths = (name: string, network: Network) => {
  // returns /volumes/tapd/tapd-1
  const tapdDataPath = nodePath(network, 'tapd', name);

  return {
    // returns /volumes/tapd/tapd-1/tls.cert
    tlsCert: join(tapdDataPath, 'tls.cert'),
    // returns /volumes/tapd/tapd-1/data/regtest/admin.macaroon
    adminMacaroon: join(tapdDataPath, 'data', 'regtest', 'admin.macaroon'),
  };
};

export const filterCompatibleBackends = (
  implementation: LightningNode['implementation'],
  version: string,
  compatibility: DockerRepoImage['compatibility'],
  backends: BitcoinNode[],
): BitcoinNode[] => {
  // if compatibility is not defined, then allow all backend versions
  if (!compatibility || !compatibility[version]) return backends;
  const requiredVersion = compatibility[version];
  const compatibleBackends = backends.filter(n =>
    isVersionCompatible(n.version, requiredVersion),
  );
  if (compatibleBackends.length === 0) {
    throw new Error(
      l('backendCompatError', { requiredVersion, implementation, version }),
    );
  }
  return compatibleBackends;
};

export const createLndNetworkNode = (
  network: Network,
  version: string,
  compatibility: DockerRepoImage['compatibility'],
  docker: CommonNode['docker'],
  status = Status.Stopped,
  basePort = BasePorts.LND,
): LndNode => {
  const { bitcoin, lightning } = network.nodes;
  const implementation: LndNode['implementation'] = 'LND';
  const backends = filterCompatibleBackends(
    implementation,
    version,
    compatibility,
    bitcoin,
  );
  const id = lightning.length ? Math.max(...lightning.map(n => n.id)) + 1 : 0;
  const name = getName(id);
  return {
    id,
    networkId: network.id,
    name: name,
    type: 'lightning',
    implementation,
    version,
    status,
    // alternate between backend nodes
    backendName: backends[id % backends.length].name,
    paths: getLndFilePaths(name, network),
    ports: {
      rest: basePort.rest + id,
      grpc: basePort.grpc + id,
      p2p: BasePorts.LND.p2p + id,
    },
    docker,
  };
};

export const createCLightningNetworkNode = (
  network: Network,
  version: string,
  compatibility: DockerRepoImage['compatibility'],
  docker: CommonNode['docker'],
  status = Status.Stopped,
  basePort = BasePorts['c-lightning'],
): CLightningNode => {
  const { bitcoin, lightning } = network.nodes;
  const implementation: LightningNode['implementation'] = 'c-lightning';
  const backends = filterCompatibleBackends(
    implementation,
    version,
    compatibility,
    bitcoin,
  );
  // determines if GRPC is supported in a version of Core Lightning provided
  const supportsGrpc = !isVersionCompatible(version, '0.10.2');
  const id = lightning.length ? Math.max(...lightning.map(n => n.id)) + 1 : 0;
  const name = getName(id);
  return {
    id,
    networkId: network.id,
    name,
    type: 'lightning',
    implementation: 'c-lightning',
    version,
    status,
    // alternate between backend nodes
    backendName: backends[id % backends.length].name,
    paths: getCLightningFilePaths(name, supportsGrpc, network),
    ports: {
      rest: basePort.rest + id,
      grpc: supportsGrpc ? basePort.grpc + id : 0,
      p2p: BasePorts['c-lightning'].p2p + id,
    },
    docker,
  };
};

export const createEclairNetworkNode = (
  network: Network,
  version: string,
  compatibility: DockerRepoImage['compatibility'],
  docker: CommonNode['docker'],
  status = Status.Stopped,
  basePort = BasePorts.eclair,
): EclairNode => {
  const { bitcoin, lightning } = network.nodes;
  const implementation: EclairNode['implementation'] = 'eclair';
  const backends = filterCompatibleBackends(
    implementation,
    version,
    compatibility,
    bitcoin,
  );
  const id = lightning.length ? Math.max(...lightning.map(n => n.id)) + 1 : 0;
  const name = getName(id);
  return {
    id,
    networkId: network.id,
    name: name,
    type: 'lightning',
    implementation,
    version,
    status,
    // alternate between backend nodes
    backendName: backends[id % backends.length].name,
    ports: {
      rest: basePort.rest + id,
      p2p: BasePorts.eclair.p2p + id,
    },
    docker,
  };
};

export const createLitdNetworkNode = (
  network: Network,
  version: string,
  compatibility: DockerRepoImage['compatibility'],
  docker: CommonNode['docker'],
  status = Status.Stopped,
): LitdNode => {
  const { bitcoin, lightning } = network.nodes;
  const implementation: LitdNode['implementation'] = 'litd';
  const backends = filterCompatibleBackends(
    implementation,
    version,
    compatibility,
    bitcoin,
  );
  const id = lightning.length ? Math.max(...lightning.map(n => n.id)) + 1 : 0;
  const name = getName(id);
  return {
    id,
    networkId: network.id,
    name: name,
    type: 'lightning',
    implementation,
    version,
    status,
    // alternate between backend nodes
    backendName: backends[id % backends.length].name,
    lndName: name,
    paths: getLitdFilePaths(name, network),
    ports: {
      rest: BasePorts.litd.rest + id,
      grpc: BasePorts.litd.grpc + id,
      p2p: BasePorts.litd.p2p + id,
      web: BasePorts.litd.web + id,
    },
    docker,
  };
};

export const createBitcoindNetworkNode = (
  network: Network,
  version: string,
  docker: CommonNode['docker'],
  status = Status.Stopped,
  basePort = BasePorts.bitcoind,
): BitcoinNode => {
  const { bitcoin } = network.nodes;
  const id = bitcoin.length ? Math.max(...bitcoin.map(n => n.id)) + 1 : 0;

  const name = `backend${id + 1}`;
  const node: BitcoinNode = {
    id,
    networkId: network.id,
    name: name,
    type: 'bitcoin',
    implementation: 'bitcoind',
    version,
    peers: [],
    status,
    ports: {
      rpc: basePort.rest + id,
      p2p: BasePorts.bitcoind.p2p + id,
      zmqBlock: BasePorts.bitcoind.zmqBlock + id,
      zmqTx: BasePorts.bitcoind.zmqTx + id,
    },
    docker,
  };

  // peer up with the previous node on both sides
  if (bitcoin.length > 0) {
    const prev = bitcoin[bitcoin.length - 1];
    node.peers.push(prev.name);
    prev.peers.push(node.name);
  }

  return node;
};

const filterLndBackends = (
  implementation: TapNode['implementation'],
  version: string,
  compatibility: DockerRepoImage['compatibility'],
  network: Network,
) => {
  const { tap, lightning } = network.nodes;
  const requiredVersion = (compatibility && compatibility[version]) || '';
  const backendsInUse = tap
    .filter(n => n.implementation === 'tapd')
    .map(n => (n as TapdNode).lndName);
  const lndBackends = lightning.filter(n => {
    if (n.implementation !== 'LND') return false;
    if (backendsInUse.includes(n.name)) return false;
    if (requiredVersion) {
      const isLowerVersion =
        isVersionCompatible(n.version, requiredVersion) && n.version !== requiredVersion;
      if (isLowerVersion) return false;
    }
    return true;
  });
  if (lndBackends.length === 0) {
    throw new Error(
      l('lndBackendCompatError', { requiredVersion, implementation, version }),
    );
  }
  return lndBackends[0];
};

export const createTapdNetworkNode = (
  network: Network,
  version: string,
  compatibility: DockerRepoImage['compatibility'],
  docker: CommonNode['docker'],
  status = Status.Stopped,
  basePort = BasePorts.tapd,
): TapdNode => {
  const { tap } = network.nodes;
  const implementation: TapdNode['implementation'] = 'tapd';
  const lndBackend = filterLndBackends(implementation, version, compatibility, network);

  const id = tap.length ? Math.max(...tap.map(n => n.id)) + 1 : 0;
  const name = `${lndBackend.name}-tap`;
  const node: TapdNode = {
    id,
    networkId: network.id,
    name: name,
    type: 'tap',
    implementation,
    version,
    status,
    lndName: lndBackend.name,
    paths: getTapdFilePaths(name, network),
    ports: {
      rest: basePort.rest + id,
      grpc: basePort.grpc + id,
    },
    docker,
  };

  return node;
};

export const createNetwork = (config: {
  id: number;
  name: string;
  description: string;
  lndNodes: number;
  clightningNodes: number;
  eclairNodes: number;
  bitcoindNodes: number;
  tapdNodes: number;
  litdNodes: number;
  repoState: DockerRepoState;
  managedImages: ManagedImage[];
  customImages: { image: CustomImage; count: number }[];
  status?: Status;
  basePorts?: NodeBasePorts;
}): Network => {
  const {
    id,
    name,
    description,
    lndNodes,
    clightningNodes,
    eclairNodes,
    bitcoindNodes,
    tapdNodes,
    litdNodes,
    repoState,
    managedImages,
    customImages,
    basePorts,
  } = config;
  // need explicit undefined check because Status.Starting is 0
  const status = config.status !== undefined ? config.status : Status.Stopped;

  const network: Network = {
    id: id,
    name,
    description,
    status,
    path: join(networksPath, id.toString()),
    nodes: {
      bitcoin: [],
      lightning: [],
      tap: [],
    },
    autoMineMode: AutoMineMode.AutoOff,
  };

  const { bitcoin, lightning } = network.nodes;
  const dockerWrap = (command: string) => ({ image: '', command });

  // add custom bitcoin nodes
  customImages
    .filter(i => i.image.implementation === 'bitcoind')
    .forEach(i => {
      const version = repoState.images.bitcoind.latest;
      const docker = { image: i.image.dockerImage, command: i.image.command };
      range(i.count).forEach(() => {
        bitcoin.push(
          createBitcoindNetworkNode(
            network,
            version,
            docker,
            status,
            basePorts?.bitcoind,
          ),
        );
      });
    });

  // add managed bitcoin nodes
  range(bitcoindNodes).forEach(() => {
    let version = repoState.images.bitcoind.latest;
    if (lndNodes > 0) {
      const compat = repoState.images.LND.compatibility as Record<string, string>;
      version = compat[repoState.images.LND.latest];
    }
    const cmd = getImageCommand(managedImages, 'bitcoind', version);
    bitcoin.push(
      createBitcoindNetworkNode(
        network,
        version,
        dockerWrap(cmd),
        status,
        basePorts?.bitcoind,
      ),
    );
  });

  // add custom lightning nodes
  customImages
    .filter(i => ['LND', 'c-lightning', 'eclair'].includes(i.image.implementation))
    .forEach(({ image, count }) => {
      const { latest, compatibility } = repoState.images.LND;
      const docker = { image: image.dockerImage, command: image.command };
      const createFunc =
        image.implementation === 'LND'
          ? createLndNetworkNode
          : image.implementation === 'c-lightning'
          ? createCLightningNetworkNode
          : createEclairNetworkNode;
      const basePort =
        image.implementation === 'LND'
          ? basePorts?.LND
          : image.implementation === 'c-lightning'
          ? basePorts?.['c-lightning']
          : basePorts?.eclair;
      range(count).forEach(() => {
        lightning.push(
          createFunc(network, latest, compatibility, docker, status, basePort),
        );
      });
    });

  // add lightning nodes in an alternating pattern
  range(Math.max(lndNodes, clightningNodes, eclairNodes, litdNodes)).forEach(i => {
    if (i < lndNodes) {
      const { latest, compatibility } = repoState.images.LND;
      const cmd = getImageCommand(managedImages, 'LND', latest);
      lightning.push(
        createLndNetworkNode(
          network,
          latest,
          compatibility,
          dockerWrap(cmd),
          status,
          basePorts?.LND,
        ),
      );
    }
    if (i < clightningNodes) {
      const { latest, compatibility } = repoState.images['c-lightning'];
      const cmd = getImageCommand(managedImages, 'c-lightning', latest);
      lightning.push(
        createCLightningNetworkNode(
          network,
          latest,
          compatibility,
          dockerWrap(cmd),
          status,
          basePorts?.['c-lightning'],
        ),
      );
    }
    if (i < eclairNodes) {
      const { latest, compatibility } = repoState.images.eclair;
      const cmd = getImageCommand(managedImages, 'eclair', latest);
      lightning.push(
        createEclairNetworkNode(
          network,
          latest,
          compatibility,
          dockerWrap(cmd),
          status,
          basePorts?.eclair,
        ),
      );
    }
    if (i < litdNodes) {
      const { latest, compatibility } = repoState.images.litd;
      const cmd = getImageCommand(managedImages, 'litd', latest);
      lightning.push(
        createLitdNetworkNode(network, latest, compatibility, dockerWrap(cmd), status),
      );
    }
  });

  range(tapdNodes).forEach(() => {
    const { latest, compatibility } = repoState.images.tapd;
    const cmd = getImageCommand(managedImages, 'tapd', latest);
    network.nodes.tap.push(
      createTapdNetworkNode(network, latest, compatibility, dockerWrap(cmd), status),
    );
  });

  return network;
};

export const renameNode = async (network: Network, node: AnyNode, newName: string) => {
  switch (node.type) {
    case 'lightning':
      switch (node.implementation) {
        case 'LND':
          const lndNode = network.nodes.lightning.find(n => n.id === node.id) as LndNode;
          network.nodes.tap
            .filter(n => n.implementation === 'tapd')
            .map(n => n as TapdNode)
            .filter(n => n.lndName === node.name)
            .forEach(n => {
              n.lndName = newName;
            });
          lndNode.name = newName;
          lndNode.paths = getLndFilePaths(newName, network);
          return lndNode;
        case 'c-lightning':
          const clnNode = network.nodes.lightning.find(
            n => n.id === node.id,
          ) as CLightningNode;
          const supportsGrpc = clnNode.ports.grpc !== 0;
          clnNode.name = newName;
          clnNode.paths = getCLightningFilePaths(newName, supportsGrpc, network);
          return clnNode;
        case 'eclair':
          const eclairNode = network.nodes.lightning.find(
            n => n.id === node.id,
          ) as EclairNode;
          eclairNode.name = newName;
          return eclairNode;
        case 'litd':
          const litdNode = network.nodes.lightning.find(
            n => n.id === node.id,
          ) as LitdNode;
          litdNode.name = newName;
          litdNode.paths = getLitdFilePaths(newName, network);
          return litdNode;
      }
    case 'bitcoin':
      network.nodes.lightning
        .filter(n => n.backendName === node.name)
        .forEach(n => {
          n.backendName = newName;
        });
      network.nodes.bitcoin
        .filter(n => n.peers.includes(node.name))
        .forEach(n => {
          n.peers = n.peers.map(peer => (peer === node.name ? newName : peer));
        });
      const btcNode = network.nodes.bitcoin.find(n => n.id === node.id) as BitcoinNode;
      btcNode.name = newName;
      return btcNode;
    case 'tap':
      const tapdNode = network.nodes.tap.find(n => n.id === node.id) as TapdNode;
      tapdNode.name = newName;
      tapdNode.paths = getTapdFilePaths(newName, network);
      return tapdNode;
    default:
      throw new Error('Invalid node type');
  }
};

/**
 * Returns the images needed to start a network that are not included in the list
 * of images already pulled
 * @param network the network to check
 * @param pulled the list of images already pulled
 */
export const getMissingImages = (network: Network, pulled: string[]): string[] => {
  const { bitcoin, lightning, tap } = network.nodes;
  const neededImages = [...bitcoin, ...lightning, ...tap].map(n => {
    // use the custom image name if specified
    if (n.docker.image) return n.docker.image;
    // convert implementation to image name: LND -> lnd, c-lightning -> clightning
    const impl = n.implementation.toLocaleLowerCase().replace(/-/g, '');
    return `${DOCKER_REPO}/${impl}:${n.version}`;
  });
  // exclude images already pulled
  const missing = neededImages.filter(i => !pulled.includes(i));
  // filter out duplicates
  const unique = missing.filter((image, index) => missing.indexOf(image) === index);
  if (unique.length)
    debug(`The network '${network.name}' is missing docker images`, unique);
  return unique;
};

/**
 * Returns the default docker command for a given implementation and version. This will
 * tweak commands for older node versions that do not support certain flags.
 */
export const getDefaultCommand = (
  implementation: NodeImplementation,
  version: string,
) => {
  let command = dockerConfigs[implementation].command;

  // Remove the flags that are not supported in versions before v0.4.0
  if (implementation === 'tapd' && isVersionBelow(version, '0.4.0-alpha')) {
    command = command
      .replace('--universe.public-access=rw', '--universe.public-access')
      .replace('--universe.sync-all-assets', '');
  }

  return command;
};

/**
 * Checks a range of port numbers to see if they are open on the current operating system.
 * Returns a new array of port numbers that are confirmed available
 * @param requestedPorts the ports to check for availability. ** must be in ascending order
 *
 * @example if port 10002 is in use
 * getOpenPortRange([10001, 10002, 10003]) -> [10001, 10004, 10005]
 */
export const getOpenPortRange = async (requestedPorts: number[]): Promise<number[]> => {
  const openPorts: number[] = [];

  for (let port of requestedPorts) {
    // keep 0 port as this indicates the port isn't supported for the node
    if (port === 0) {
      openPorts.push(0);
      continue;
    }
    if (openPorts.length) {
      // adjust to check after the previous open port if necessary, since the last
      // open port may have increased
      const lastOpenPort = openPorts[openPorts.length - 1];
      if (port <= lastOpenPort) {
        port = lastOpenPort + 1;
      }
    }
    openPorts.push(await detectPort(port));
  }
  return openPorts;
};

export interface OpenPorts {
  [key: string]: {
    rpc?: number;
    grpc?: number;
    rest?: number;
    zmqBlock?: number;
    zmqTx?: number;
    p2p?: number;
    web?: number;
  };
}

/**
 * Checks if the ports specified on the nodes are available on the host OS. If not,
 * return new ports that are confirmed available
 * @param network the network with nodes to verify ports of
 */
export const getOpenPorts = async (network: Network): Promise<OpenPorts | undefined> => {
  const ports: OpenPorts = {};

  // filter out nodes that are already started since their ports are in use by themselves
  const bitcoin = network.nodes.bitcoin.filter(n => n.status !== Status.Started);
  if (bitcoin.length) {
    let existingPorts = bitcoin.map(n => n.ports.rpc);
    let openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[bitcoin[index].name] = { rpc: port };
      });
    }

    existingPorts = bitcoin.map(n => n.ports.p2p);
    openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[bitcoin[index].name] = {
          ...(ports[bitcoin[index].name] || {}),
          p2p: port,
        };
      });
    }

    existingPorts = bitcoin.map(n => n.ports.zmqBlock);
    openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[bitcoin[index].name] = {
          ...(ports[bitcoin[index].name] || {}),
          zmqBlock: port,
        };
      });
    }

    existingPorts = bitcoin.map(n => n.ports.zmqTx);
    openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[bitcoin[index].name] = {
          ...(ports[bitcoin[index].name] || {}),
          zmqTx: port,
        };
      });
    }
  }

  let { lnd, clightning, eclair, litd, tapd } = groupNodes(network);

  // filter out nodes that are already started since their ports are in use by themselves
  lnd = lnd.filter(n => n.status !== Status.Started);
  if (lnd.length) {
    let existingPorts = lnd.map(n => n.ports.grpc);
    let openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[lnd[index].name] = { grpc: port };
      });
    }

    existingPorts = lnd.map(n => n.ports.rest);
    openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[lnd[index].name] = {
          ...(ports[lnd[index].name] || {}),
          rest: port,
        };
      });
    }

    existingPorts = lnd.map(n => n.ports.p2p);
    openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[lnd[index].name] = {
          ...(ports[lnd[index].name] || {}),
          p2p: port,
        };
      });
    }
  }

  clightning = clightning.filter(n => n.status !== Status.Started);
  if (clightning.length) {
    let existingPorts = clightning.map(n => n.ports.rest);
    let openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[clightning[index].name] = { rest: port };
      });
    }

    existingPorts = clightning.map(n => n.ports.grpc);
    openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[clightning[index].name] = { grpc: port };
      });
    }

    existingPorts = clightning.map(n => n.ports.p2p);
    openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[clightning[index].name] = {
          ...(ports[clightning[index].name] || {}),
          p2p: port,
        };
      });
    }
  }

  eclair = eclair.filter(n => n.status !== Status.Started);
  if (eclair.length) {
    let existingPorts = eclair.map(n => n.ports.rest);
    let openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[eclair[index].name] = { rest: port };
      });
    }

    existingPorts = eclair.map(n => n.ports.p2p);
    openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[eclair[index].name] = {
          ...(ports[eclair[index].name] || {}),
          p2p: port,
        };
      });
    }
  }

  litd = litd.filter(n => n.status !== Status.Started);
  if (litd.length) {
    let existingPorts = litd.map(n => n.ports.rest);
    let openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[litd[index].name] = { rest: port };
      });
    }

    existingPorts = litd.map(n => n.ports.grpc);
    openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[litd[index].name] = { grpc: port };
      });
    }

    existingPorts = litd.map(n => n.ports.p2p);
    openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[litd[index].name] = {
          ...(ports[litd[index].name] || {}),
          p2p: port,
        };
      });
    }

    existingPorts = litd.map(n => n.ports.web);
    openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[litd[index].name] = {
          ...(ports[litd[index].name] || {}),
          web: port,
        };
      });
    }
  }

  tapd = tapd.filter(n => n.status !== Status.Started);
  if (tapd.length) {
    let existingPorts = tapd.map(n => n.ports.grpc);
    let openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[tapd[index].name] = { grpc: port };
      });
    }

    existingPorts = tapd.map(n => n.ports.rest);
    openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => {
        ports[tapd[index].name] = {
          ...(ports[tapd[index].name] || {}),
          rest: port,
        };
      });
    }
  }
  // return undefined if no ports where updated
  return Object.keys(ports).length > 0 ? ports : undefined;
};

/**
 * Validates that an object is a valid network
 * @param value the object to validate
 */
const isNetwork = (value: any): value is Network => {
  return (
    typeof value === 'object' &&
    typeof value.id === 'number' &&
    typeof value.name === 'string' &&
    typeof value.status === 'number' &&
    typeof value.path === 'string' &&
    typeof value.nodes === 'object'
  );
};

/**
 * Validates that an object is a valid network chart
 * @param value the object to validate
 */
const isChart = (value: any): value is IChart =>
  typeof value === 'object' &&
  typeof value.offset === 'object' &&
  typeof value.nodes === 'object' &&
  typeof value.links === 'object' &&
  typeof value.selected === 'object' &&
  typeof value.hovered === 'object';

/**
 * Imports a network from a given zip file path
 * @param zipPath the path to the zip file
 * @param id the network id to assign to the parsed network
 */
export const importNetworkFromZip = async (
  zipPath: string,
  id: number,
): Promise<[Network, IChart]> => {
  // extract zip to a temp folder first
  const tmpDir = join(tmpdir(), 'polar', basename(zipPath, '.zip'));
  const ipc = createIpcSender('NetworkUtil', 'app');
  await ipc(ipcChannels.unzip, { filePath: zipPath, destination: tmpDir });
  debug(`Extracted '${zipPath}' to '${tmpDir}'`);

  // read and parse the export.json file
  const exportFilePath = join(tmpDir, 'export.json');
  const parsed = JSON.parse(await read(exportFilePath));
  // validate the network and chart
  if (!(parsed.network && isNetwork(parsed.network))) {
    throw new Error(`${exportFilePath} did not contain a valid network`);
  }
  if (!(parsed.chart && isChart(parsed.chart))) {
    throw new Error(`${exportFilePath} did not contain a valid chart`);
  }

  debug('Migrating the imported network:\n' + JSON.stringify(parsed));
  const networksFile: NetworksFile = {
    // the version is not available in the export.json file and is not needed
    version: '',
    networks: [parsed.network],
    charts: {
      [parsed.network.id]: parsed.chart,
    },
  };
  const { networks, charts } = migrateNetworksFile(networksFile);

  const network = networks[0];
  const chart = charts[network.id];
  const netPath = join(dataPath, 'networks', `${id}`);
  debug(`Updating the network path from '${network.path}' to '${netPath}'`);
  network.path = netPath;
  debug(`Updating network id to '${id}'`);
  network.id = id;
  network.nodes.bitcoin.forEach(bitcoin => {
    bitcoin.networkId = id;
  });
  network.nodes.lightning.forEach(ln => {
    ln.networkId = id;
    if (ln.implementation === 'LND') {
      const lnd = ln as LndNode;
      lnd.paths = getLndFilePaths(lnd.name, network);
    } else if (ln.implementation === 'litd') {
      const litd = ln as LitdNode;
      litd.paths = getLitdFilePaths(litd.name, network);
    } else if (ln.implementation === 'c-lightning') {
      const cln = ln as CLightningNode;
      const supportsGrpc = cln.ports.grpc !== 0;
      cln.paths = getCLightningFilePaths(cln.name, supportsGrpc, network);
    } else if (ln.implementation !== 'eclair') {
      throw new Error(l('unknownImplementation', { implementation: ln.implementation }));
    }
  });
  network.nodes.tap.forEach(tap => {
    tap.networkId = id;
    if (tap.implementation === 'tapd') {
      const tapd = tap as TapdNode;
      tapd.paths = getTapdFilePaths(tapd.name, network);
    } else {
      throw new Error(l('unknownImplementation', { implementation: tap.implementation }));
    }
  });

  // confirms all nodes in the network are supported on the current OS
  const platform = getPolarPlatform();
  for (const { implementation } of network.nodes.lightning) {
    const { platforms } = dockerConfigs[implementation];
    const nodeSupportsPlatform = platforms.includes(platform);
    if (!nodeSupportsPlatform) {
      throw new Error(l('incompatibleImplementation', { implementation, platform }));
    }
  }

  // remove the export file as it is no longer needed
  await rm(exportFilePath);

  debug(`Copying '${tmpDir}' to '${network.path}'`);
  await copy(tmpDir, network.path);

  return [network, chart];
};

/**
 * Archive the given network into a folder with the following content:
 *
 * ```
 * docker-compose.yml // compose file for network
 * volumes            // directory with all data files needed by nodes
 * export.json        // serialized network & chart objects
 * ```
 * @param network the network to archive
 * @param chart the associated chart
 * @param zipPath the full path to save the zip file
 * @return Path of created `.zip` file
 */
export const zipNetwork = async (
  network: Network,
  chart: IChart,
  zipPath: string,
): Promise<void> => {
  // save the network and chart to export.json in the network's folder
  const content = JSON.stringify({ network, chart });
  await writeFile(join(network.path, 'export.json'), content);
  // zip the network dir into the zip path
  const ipc = createIpcSender('NetworkUtil', 'app');
  await ipc(ipcChannels.zip, { source: network.path, destination: zipPath });
  // await zip(network.path, zipPath);
};

/**
 * Gets the LND node that is the backend for a tap or litd node
 */
export const getTapBackendNode = (nodeName: string, network: Network) => {
  const { lightning, tap } = network.nodes;
  const node = [...tap, ...lightning].find(n => n.name === nodeName);

  let tapNode: TapdNode | LitdNode | undefined = undefined;
  if (node?.type === 'tap' && (node as TapNode).implementation === 'tapd') {
    tapNode = node as TapdNode;
  } else if (
    node?.type === 'lightning' &&
    (node as LightningNode).implementation === 'litd'
  ) {
    tapNode = node as LitdNode;
  }
  if (tapNode && ['litd', 'tapd'].includes(tapNode.implementation)) {
    return network.nodes.lightning.find(n => n.name === tapNode.lndName);
  }
};

/**
 * Gets the tapd nodes in the network, which includes both tapd and litd nodes
 */
export const getTapdNodes = (network: Network) => {
  const { lightning, tap } = network.nodes;
  return [...lightning, ...tap]
    .filter(node => node.implementation === 'tapd' || node.implementation === 'litd')
    .map(mapToTapd);
};

/**
 * Maps a litd node to a tapd node. This is needed to reuse the TAP store and services
 * for both implementations.
 */
export const mapToTapd = (node: CommonNode): TapdNode => {
  // if the node is already a tapd node, return it
  if (node.type === 'tap' && (node as TapNode).implementation === 'tapd') {
    return node as TapdNode;
  }
  // if the node is not a litd node, throw an error
  if (node.type !== 'lightning' || (node as LightningNode).implementation !== 'litd') {
    throw new Error(`Node "${node.name}" is not a litd node`);
  }

  const litd = node as LitdNode;
  const tapd: TapdNode = {
    id: litd.id,
    networkId: litd.networkId,
    name: litd.name,
    type: 'tap',
    implementation: 'litd',
    version: litd.version,
    status: litd.status,
    lndName: litd.lndName,
    docker: litd.docker,
    paths: {
      tlsCert: litd.paths.litTlsCert,
      adminMacaroon: litd.paths.tapMacaroon,
    },
    ports: {
      grpc: litd.ports.web,
      rest: litd.ports.rest,
    },
  };
  return tapd;
};
