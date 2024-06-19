import * as TAP from '@lightningpolar/tapd-api';
import { IChart } from '@mrblenny/react-flow-chart';
import { ChainInfo, WalletInfo } from 'bitcoin-core';
import {
  BitcoinNode,
  CommonNode,
  LightningNode,
  NodeImplementation,
  OpenChannelOptions,
  Status,
  TapNode,
} from 'shared/types';
import { IpcSender } from 'lib/ipc/ipcService';
import * as PLN from 'lib/lightning/types';
import * as PTAP from 'lib/tap/types';
import { PolarPlatform } from 'utils/system';

export interface Network {
  id: number;
  name: string;
  status: Status;
  path: string;
  autoMineMode: AutoMineMode;
  simulationActivities: SimulationActivity[];
  nodes: {
    bitcoin: BitcoinNode[];
    lightning: LightningNode[];
    tap: TapNode[];
  };
}

/**
 * Managed images are hard-coded with docker images pushed to the
 * Docker Hub polarlightning repo
 */
export interface ManagedImage {
  implementation: NodeImplementation;
  version: string;
  command: string;
}

/**
 * Custom images are created by the user using docker images that only
 * exist locally on the user's machine
 */
export interface CustomImage {
  id: string;
  name: string;
  implementation: NodeImplementation;
  dockerImage: string;
  command: string;
}

/**
 * The base ports for each implementation
 */
export interface NodeBasePorts {
  LND: { rest: number; grpc: number };
  'c-lightning': { rest: number; grpc: number };
  eclair: { rest: number };
  bitcoind: { rest: number };
  tapd: { rest: number; grpc: number };
}

export interface AppSettings {
  lang: string;
  theme: 'light' | 'dark';
  showAllNodeVersions: boolean;
  checkForUpdatesOnStartup: boolean;
  /** lists of docker image customizations */
  nodeImages: {
    managed: ManagedImage[];
    custom: CustomImage[];
  };
  /** The default number of each node when creating a new network */
  newNodeCounts: Record<NodeImplementation, number>;
  basePorts: NodeBasePorts;
}

export interface SettingsInjection {
  save: (settings: AppSettings) => Promise<void>;
  load: () => Promise<AppSettings | undefined>;
}

export interface DockerVersions {
  docker: string;
  compose: string;
}

export interface DockerConfig {
  name: string;
  imageName: string;
  logo: string;
  platforms: PolarPlatform[];
  volumeDirName: string;
  command: string;
  variables: string[];
  dataDir?: string;
  apiDir?: string;
  env?: Record<string, string>;
}

export interface DockerRepoImage {
  latest: string;
  versions: string[];
  /**
   * a mapping of the image version to the highest compatible bitcoind version
   */
  compatibility?: Record<string, string>;
}

export interface DockerRepoState {
  /**
   * the version of the repo state file. Used to quickly identify updates
   */
  version: number;
  images: Record<NodeImplementation, DockerRepoImage>;
}

export interface DockerRepoUpdates {
  state: DockerRepoState;
  updates?: Record<NodeImplementation, string[]>;
}

export interface DockerLibrary {
  getVersions: (throwOnError?: boolean) => Promise<DockerVersions>;
  getImages: () => Promise<string[]>;
  saveComposeFile: (network: Network) => Promise<void>;
  start: (network: Network) => Promise<void>;
  stop: (network: Network) => Promise<void>;
  startSimulationActivity: (network: Network) => Promise<void>;
  stopSimulationActivity: (network: Network) => Promise<void>;
  startNode: (network: Network, node: CommonNode) => Promise<void>;
  stopNode: (network: Network, node: CommonNode) => Promise<void>;
  removeNode: (network: Network, node: CommonNode) => Promise<void>;
  saveNetworks: (networks: NetworksFile) => Promise<void>;
  loadNetworks: () => Promise<NetworksFile>;
}

export interface RepoServiceInjection {
  save: (settings: DockerRepoState) => Promise<void>;
  load: () => Promise<DockerRepoState | undefined>;
  checkForUpdates: (currState: DockerRepoState) => Promise<DockerRepoUpdates>;
}

export interface BitcoindLibrary {
  waitUntilOnline: (node: BitcoinNode) => Promise<void>;
  createDefaultWallet: (node: BitcoinNode) => Promise<void>;
  getBlockchainInfo: (node: BitcoinNode) => Promise<ChainInfo>;
  getWalletInfo: (node: BitcoinNode) => Promise<WalletInfo>;
  getNewAddress: (node: BitcoinNode) => Promise<string>;
  connectPeers: (node: BitcoinNode) => Promise<void>;
  mine: (numBlocks: number, node: BitcoinNode) => Promise<string[]>;
  sendFunds: (node: BitcoinNode, addr: string, amount: number) => Promise<string>;
}

export interface LightningService {
  waitUntilOnline: (node: LightningNode) => Promise<void>;
  getInfo: (node: LightningNode) => Promise<PLN.LightningNodeInfo>;
  getBalances: (
    node: LightningNode,
    backend?: BitcoinNode,
  ) => Promise<PLN.LightningNodeBalances>;
  getNewAddress: (node: LightningNode) => Promise<PLN.LightningNodeAddress>;
  getChannels: (node: LightningNode) => Promise<PLN.LightningNodeChannel[]>;
  getPeers: (node: LightningNode) => Promise<PLN.LightningNodePeer[]>;
  connectPeers: (node: LightningNode, rpcUrls: string[]) => Promise<void>;
  openChannel: (options: OpenChannelOptions) => Promise<PLN.LightningNodeChannelPoint>;
  closeChannel: (node: LightningNode, channelPoint: string) => Promise<any>;
  createInvoice: (node: LightningNode, amount: number, memo?: string) => Promise<string>;
  payInvoice: (
    node: LightningNode,
    invoice: string,
    amount?: number,
  ) => Promise<PLN.LightningNodePayReceipt>;
  addListenerToNode: (node: LightningNode) => Promise<void>;
  removeListener: (node: LightningNode) => Promise<void>;
  subscribeChannelEvents: (
    node: LightningNode,
    callback: (event: PLN.LightningNodeChannelEvent) => void,
  ) => Promise<void>;
}

export interface LightningFactoryInjection {
  getService: (node: LightningNode) => LightningService;
}

export interface TapService {
  waitUntilOnline: (node: TapNode) => Promise<void>;
  listAssets: (node: TapNode) => Promise<PTAP.TapAsset[]>;
  listBalances: (node: TapNode) => Promise<PTAP.TapBalance[]>;
  mintAsset: (
    node: TapNode,
    req: TAP.MintAssetRequestPartial,
  ) => Promise<TAP.MintAssetResponse>;
  finalizeBatch: (node: TapNode) => Promise<TAP.FinalizeBatchResponse>;
  newAddress: (node: TapNode, assetId: string, amt: string) => Promise<PTAP.TapAddress>;
  sendAsset: (
    from: TapNode,
    req: TAP.SendAssetRequestPartial,
  ) => Promise<PTAP.TapSendAssetReceipt>;
  decodeAddress: (
    node: TapNode,
    req: TAP.DecodeAddrRequestPartial,
  ) => Promise<PTAP.TapAddress>;
  assetRoots: (node: TapNode) => Promise<PTAP.TapAssetRoot[]>;
  syncUniverse: (node: TapNode, universeHost: string) => Promise<TAP.SyncResponse>;
}

export interface TapFactoryInjection {
  getService: (node: TapNode) => TapService;
}

export interface StoreInjections {
  ipc: IpcSender;
  settingsService: SettingsInjection;
  dockerService: DockerLibrary;
  repoService: RepoServiceInjection;
  bitcoindService: BitcoindLibrary;
  lightningFactory: LightningFactoryInjection;
  tapFactory: TapFactoryInjection;
}

export interface NetworksFile {
  version: string;
  networks: Network[];
  charts: Record<number, IChart>;
}

/**
 * A running lightning node that is used in the simulation activity
 */
export interface SimulationActivityNode {
  id: string;
  label: string;
  type: LightningNode['implementation'];
  address: string;
  macaroon: string;
  tlsCert: string;
  clientCert?: string;
  clientKey?: string;
}

/**
 * A simulation activity is a payment from one node to another
 * at a given interval and amount
 */
export interface SimulationActivity {
  id: number;
  source: SimulationActivityNode;
  destination: SimulationActivityNode;
  intervalSecs: number;
  amountMsat: number;
  networkId: number;
}
export interface ActivityInfo {
  id: number | undefined;
  sourceNode: LightningNode | undefined;
  targetNode: LightningNode | undefined;
  amount: number;
  frequency: number;
}

export enum AutoMineMode {
  AutoOff = 0,
  Auto30s = 30,
  Auto1m = 60,
  Auto5m = 300,
  Auto10m = 600,
}
