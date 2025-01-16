export enum Status {
  Starting,
  Started,
  Stopping,
  Stopped,
  Error,
}

export interface CommonNode {
  id: number;
  networkId: number;
  name: string;
  type: 'bitcoin' | 'lightning' | 'tap';
  version: string;
  status: Status;
  errorMsg?: string;
  docker: {
    image: string;
    command: string;
  };
}

export interface LightningNode extends CommonNode {
  type: 'lightning';
  implementation: 'LND' | 'c-lightning' | 'eclair' | 'litd';
  backendName: string;
  ports: Record<string, number | undefined>;
}

export interface LndNode extends LightningNode {
  implementation: 'LND';
  paths: {
    tlsCert: string;
    adminMacaroon: string;
    invoiceMacaroon: string;
    readonlyMacaroon: string;
  };
  ports: {
    rest: number;
    grpc: number;
    p2p: number;
  };
}

export interface CLightningNode extends LightningNode {
  implementation: 'c-lightning';
  paths: {
    rune: string;
    tlsCert?: string;
    tlsClientCert?: string;
    tlsClientKey?: string;
  };
  ports: {
    rest: number;
    grpc: number;
    p2p: number;
  };
}

export interface EclairNode extends LightningNode {
  implementation: 'eclair';
  ports: {
    rest: number;
    p2p: number;
  };
}

export interface BitcoinNode extends CommonNode {
  type: 'bitcoin';
  implementation: 'bitcoind' | 'btcd';
  peers: string[];
  ports: Record<string, number>;
}

export interface BitcoindNode extends BitcoinNode {
  implementation: 'bitcoind';
  ports: {
    rpc: number;
    p2p: number;
    zmqBlock: number;
    zmqTx: number;
  };
}

export interface TapNode extends CommonNode {
  type: 'tap';
  implementation: 'tapd' | 'litd';
  ports: Record<string, number | undefined>;
}

export interface TapdNode extends TapNode {
  lndName: string;
  paths: {
    tlsCert: string;
    adminMacaroon: string;
  };
  ports: {
    rest: number;
    grpc: number;
  };
}

export interface LitdNode extends LightningNode {
  implementation: 'litd';
  // lndName is the name of the lnd node that the lit node is connected to. For litd,
  // this will always be the same as the litd node name, since it runs tapd integrated.
  // We keep it also under this field for consistency with TapdNode. It greatly simplifies
  // the code used to get the lnd node name that the lit node is connected to.
  lndName: string;
  paths: {
    // lnd paths
    tlsCert: string;
    adminMacaroon: string;
    invoiceMacaroon: string;
    readonlyMacaroon: string;
    // lit paths
    litTlsCert: string;
    litMacaroon: string;
    // tap paths
    tapMacaroon: string;
  };
  ports: {
    rest: number;
    grpc: number;
    p2p: number;
    web: number;
  };
}

export type NodeImplementation =
  | BitcoinNode['implementation']
  | LightningNode['implementation']
  | TapNode['implementation'];

export type AnyNode = BitcoinNode | LightningNode | TapNode;

export type TapSupportedNode = TapdNode | LitdNode;

export interface OpenChannelOptions {
  from: LightningNode;
  toRpcUrl: string;
  amount: string;
  isPrivate: boolean;
}
