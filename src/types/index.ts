import { IChart } from '@mrblenny/react-flow-chart';
import { ChainInfo } from 'bitcoin-core';

export interface LocalConfig {
  fallbackLng: string;
  languages: {
    [key: string]: string;
  };
}

export enum Status {
  Starting,
  Started,
  Stopping,
  Stopped,
  Error,
}

export interface CommonNode {
  id: number;
  name: string;
  type: 'bitcoin' | 'lightning';
  status: Status;
}

export interface BitcoinNode extends CommonNode {
  type: 'bitcoin';
  implementation: 'bitcoind' | 'btcd';
}

export interface LightningNode extends CommonNode {
  type: 'lightning';
  implementation: 'LND' | 'c-lightning' | 'eclair';
  backendName: string;
}

export interface Network {
  id: number;
  name: string;
  status: Status;
  path: string;
  design?: IChart;
  nodes: {
    bitcoin: BitcoinNode[];
    lightning: LightningNode[];
  };
}

export interface DockerLibrary {
  create: (network: Network) => Promise<void>;
  start: (network: Network) => Promise<void>;
  stop: (network: Network) => Promise<void>;
  save: (networks: Network[]) => Promise<void>;
  load: () => Promise<Network[]>;
}

export interface BitcoindLibrary {
  getBlockchainInfo: () => Promise<ChainInfo>;
  mine: (numBlocks: number) => Promise<string[]>;
}

export interface StoreInjections {
  dockerService: DockerLibrary;
  bitcoindService: BitcoindLibrary;
}
