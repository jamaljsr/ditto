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
  version: string;
  status: Status;
}

export interface BitcoinNode extends CommonNode {
  type: 'bitcoin';
  implementation: 'bitcoind' | 'btcd';
}

export interface LightningNode extends CommonNode {
  type: 'lightning';
  implementation: 'lnd' | 'clightning' | 'eclair';
  backendName: string;
}

export interface Network {
  id: number;
  name: string;
  status: Status;
  path: string;
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

export interface StoreInjections {
  dockerService: DockerLibrary;
}
