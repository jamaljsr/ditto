import * as LITD from '@lightningpolar/litd-api';
import * as TAP from '@lightningpolar/tapd-api';
import { IChart } from '@mrblenny/react-flow-chart';
import { ChainInfo, WalletInfo } from 'bitcoin-core';
import {
  AnyNode,
  BitcoinNode,
  CommonNode,
  LightningNode,
  LitdNode,
  NodeImplementation,
  OpenChannelOptions,
  Status,
  TapNode,
} from 'shared/types';
import { IpcSender } from 'lib/ipc/ipcService';
import * as PLN from 'lib/lightning/types';
import * as PLIT from 'lib/litd/types';
import * as PTAP from 'lib/tap/types';
import { PolarPlatform } from 'utils/system';

export interface Network {
  id: number;
  name: string;
  description: string;
  status: Status;
  path: string;
  autoMineMode: AutoMineMode;
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
  startNode: (network: Network, node: CommonNode) => Promise<void>;
  stopNode: (network: Network, node: CommonNode) => Promise<void>;
  removeNode: (network: Network, node: CommonNode) => Promise<void>;
  saveNetworks: (networks: NetworksFile) => Promise<void>;
  loadNetworks: () => Promise<NetworksFile>;
  renameNodeDir: (network: Network, node: AnyNode, newName: string) => Promise<void>;
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

export interface BitcoinService {
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
  createInvoice: (
    node: LightningNode,
    amount: number,
    memo?: string,
    assetInfo?: { nodeId: string; scid: string; msats: string },
  ) => Promise<string>;
  payInvoice: (
    node: LightningNode,
    invoice: string,
    amount?: number,
    customRecords?: PLN.CustomRecords,
  ) => Promise<PLN.LightningNodePayReceipt>;
  decodeInvoice: (
    node: LightningNode,
    invoice: string,
  ) => Promise<PLN.LightningNodePaymentRequest>;
  addListenerToNode: (node: LightningNode) => Promise<void>;
  removeListener: (node: LightningNode) => Promise<void>;
  subscribeChannelEvents: (
    node: LightningNode,
    callback: (event: PLN.LightningNodeChannelEvent) => void,
  ) => Promise<void>;
}

export interface BitcoinFactoryInjection {
  getService: (node: BitcoinNode) => BitcoinService;
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
  fundChannel: (
    node: TapNode,
    peerPubkey: string,
    assetId: string,
    amount: number,
  ) => Promise<string>;
  addInvoice: (
    node: TapNode,
    assetId: string,
    amount: number,
    memo: string,
    expiry: number,
  ) => Promise<string>;
  sendPayment: (
    node: TapNode,
    assetId: string,
    invoice: string,
    feeLimitMsat: number,
    peerPubkey?: string,
  ) => Promise<PLN.LightningNodePayReceipt>;
}

export interface TapFactoryInjection {
  getService: (node: TapNode) => TapService;
}

export interface LitdLibrary {
  waitUntilOnline: (node: LitdNode) => Promise<void>;
  status: (node: LitdNode) => Promise<LITD.SubServerStatusResp>;
  listSessions: (node: LitdNode) => Promise<PLIT.Session[]>;
  addSession: (
    node: LitdNode,
    label: string,
    type: PLIT.Session['type'],
    expiresAt: number,
    mailboxServerAddr?: string,
  ) => Promise<PLIT.Session>;
  revokeSession: (node: LitdNode, localPublicKey: string) => Promise<void>;
}

export interface StoreInjections {
  ipc: IpcSender;
  settingsService: SettingsInjection;
  dockerService: DockerLibrary;
  repoService: RepoServiceInjection;
  bitcoinFactory: BitcoinFactoryInjection;
  lightningFactory: LightningFactoryInjection;
  tapFactory: TapFactoryInjection;
  litdService: LitdLibrary;
}

export interface NetworksFile {
  version: string;
  networks: Network[];
  charts: Record<number, IChart>;
}

export enum AutoMineMode {
  AutoOff = 0,
  Auto30s = 30,
  Auto1m = 60,
  Auto5m = 300,
  Auto10m = 600,
}
