import { NodeImplementation } from 'shared/types';
import { DockerConfig, DockerRepoState } from 'types';
import bitcoindLogo from 'resources/bitcoin.svg';
import clightningLogo from 'resources/clightning.png';
import eclairLogo from 'resources/eclair.png';
import lndLogo from 'resources/lnd.png';
import tapLogo from 'resources/tap.svg';
import packageJson from '../../package.json';

// App
export const APP_VERSION = packageJson.version;

// Docker
export const DOCKER_REPO = 'polarlightning';

// bitcoind
export const INITIAL_BLOCK_REWARD = 50;
export const BLOCKS_TIL_CONFIRMED = 6;
export const COINBASE_MATURITY_DELAY = 100;
// https://github.com/bitcoin/bitcoin/blob/v0.19.0.1/src/chainparams.cpp#L258
export const HALVING_INTERVAL = 150;

// designer chart
export const LOADING_NODE_ID = 'loading_id';

// currency
export enum Denomination {
  SATOSHIS = 'SATOSHIS',
  BITCOIN = 'BITCOIN',
}

export const denominationSymbols: { [key in Denomination]: string } = {
  SATOSHIS: 'sats',
  BITCOIN: 'BTC',
};

export const denominationNames: { [key in Denomination]: string } = {
  SATOSHIS: 'Satoshis',
  BITCOIN: 'Bitcoin',
};

/**
 * The starting port numbers for the different node types. These should
 * be sufficiently spaced apart to allow a dozen or so numbers higher and
 * not cause conflicts
 */
export const BasePorts: Record<NodeImplementation, Record<string, number>> = {
  bitcoind: {
    rest: 18443,
    p2p: 19444,
    zmqBlock: 28334,
    zmqTx: 29335,
  },
  LND: {
    rest: 8081,
    grpc: 10001,
    p2p: 9735,
  },
  'c-lightning': {
    rest: 8181,
    p2p: 9835,
    grpc: 11001,
  },
  eclair: {
    rest: 8281,
    p2p: 9935,
  },
  btcd: {},
  tapd: {
    grpc: 12029,
    rest: 8289,
  },
};

export const bitcoinCredentials = {
  user: 'polaruser',
  pass: 'polarpass',
  rpcauth:
    '5e5e98c21f5c814568f8b55d83b23c1c$$066b03f92df30b11de8e4b1b1cd5b1b4281aa25205bd57df9be82caf97a05526',
};

export const eclairCredentials = {
  pass: 'eclairpw',
};

export const dockerConfigs: Record<NodeImplementation, DockerConfig> = {
  LND: {
    name: 'LND',
    imageName: 'polarlightning/lnd',
    logo: lndLogo,
    platforms: ['mac', 'linux', 'windows'],
    volumeDirName: 'lnd',
    command: [
      'lnd',
      '--noseedbackup',
      '--debuglevel=debug',
      '--trickledelay=5000',
      '--alias={{name}}',
      '--externalip={{name}}',
      '--tlsextradomain={{name}}',
      '--tlsextradomain={{containerName}}',
      '--tlsextradomain=host.docker.internal',
      '--listen=0.0.0.0:9735',
      '--rpclisten=0.0.0.0:10009',
      '--restlisten=0.0.0.0:8080',
      '--bitcoin.active',
      '--bitcoin.regtest',
      '--bitcoin.node=bitcoind',
      '--bitcoind.rpchost={{backendName}}',
      '--bitcoind.rpcuser={{rpcUser}}',
      '--bitcoind.rpcpass={{rpcPass}}',
      '--bitcoind.zmqpubrawblock=tcp://{{backendName}}:28334',
      '--bitcoind.zmqpubrawtx=tcp://{{backendName}}:28335',
    ].join('\n  '),
    // if vars are modified, also update composeFile.ts & the i18n strings for cmps.nodes.CommandVariables
    variables: ['name', 'containerName', 'backendName', 'rpcUser', 'rpcPass'],
  },
  'c-lightning': {
    name: 'Core Lightning',
    imageName: 'polarlightning/clightning',
    logo: clightningLogo,
    platforms: ['mac', 'linux'],
    volumeDirName: 'c-lightning',
    command: [
      'lightningd',
      '--alias={{name}}',
      '--addr={{name}}',
      '--addr=0.0.0.0:9735',
      '--network=regtest',
      '--bitcoin-rpcuser={{rpcUser}}',
      '--bitcoin-rpcpassword={{rpcPass}}',
      '--bitcoin-rpcconnect={{backendName}}',
      '--bitcoin-rpcport=18443',
      '--log-level=debug',
      '--dev-bitcoind-poll=2',
      '--dev-fast-gossip',
      '--grpc-port=11001',
      '--log-file=-', // log to stdout
      '--log-file=/home/clightning/.lightning/debug.log',
      '--plugin=/opt/c-lightning-rest/plugin.js',
      '--rest-port=8080',
      '--rest-protocol=http',
    ].join('\n  '),
    // if vars are modified, also update composeFile.ts & the i18n strings for cmps.nodes.CommandVariables
    variables: ['name', 'backendName', 'rpcUser', 'rpcPass'],
    dataDir: 'lightningd',
    apiDir: 'rest-api',
  },
  eclair: {
    name: 'Eclair',
    imageName: 'polarlightning/eclair',
    logo: eclairLogo,
    platforms: ['mac', 'linux', 'windows'],
    volumeDirName: 'eclair',
    command: [
      'polar-eclair',
      '--node-alias={{name}}',
      '--server.public-ips.0={{name}}',
      '--server.port=9735',
      '--api.enabled=true',
      '--api.binding-ip=0.0.0.0',
      '--api.port=8080',
      '--api.password={{eclairPass}}',
      '--chain=regtest',
      '--bitcoind.host={{backendName}}',
      '--bitcoind.rpcport=18443',
      '--bitcoind.rpcuser={{rpcUser}}',
      '--bitcoind.rpcpassword={{rpcPass}}',
      '--bitcoind.zmqblock=tcp://{{backendName}}:28336',
      '--bitcoind.zmqtx=tcp://{{backendName}}:28335',
      '--datadir=/home/eclair/.eclair',
      '--printToConsole=true',
      '--on-chain-fees.feerate-tolerance.ratio-low=0.00001',
      '--on-chain-fees.feerate-tolerance.ratio-high=10000.0',
      '--channel.max-htlc-value-in-flight-percent=100',
      '--channel.max-htlc-value-in-flight-msat=5000000000000', // 50 BTC since 1000 msats = 1 sat = 1/10^7 btc
    ].join('\n  '),
    // if vars are modified, also update composeFile.ts & the i18n strings for cmps.nodes.CommandVariables
    variables: ['name', 'eclairPass', 'backendName', 'rpcUser', 'rpcPass'],
  },
  bitcoind: {
    name: 'Bitcoin Core',
    imageName: 'polarlightning/bitcoind',
    logo: bitcoindLogo,
    platforms: ['mac', 'linux', 'windows'],
    volumeDirName: 'bitcoind',
    command: [
      'bitcoind',
      '-server=1',
      '-regtest=1',
      '-rpcauth={{rpcUser}}:{{rpcAuth}}',
      '-debug=1',
      '-zmqpubrawblock=tcp://0.0.0.0:28334',
      '-zmqpubrawtx=tcp://0.0.0.0:28335',
      '-zmqpubhashblock=tcp://0.0.0.0:28336',
      '-txindex=1',
      '-dnsseed=0',
      '-upnp=0',
      '-rpcbind=0.0.0.0',
      '-rpcallowip=0.0.0.0/0',
      '-rpcport=18443',
      '-rest',
      '-listen=1',
      '-listenonion=0',
      '-fallbackfee=0.0002',
      '-blockfilterindex=1',
      '-peerblockfilters=1',
    ].join('\n  '),
    // if vars are modified, also update composeFile.ts & the i18n strings for cmps.nodes.CommandVariables
    variables: ['rpcUser', 'rpcAuth'],
  },
  btcd: {
    name: 'btcd',
    imageName: '',
    logo: '',
    platforms: ['mac', 'linux', 'windows'],
    volumeDirName: 'btcd',
    command: '',
    variables: [],
  },
  tapd: {
    name: 'Taproot Assets',
    imageName: 'polarlightning/tapd',
    logo: tapLogo,
    platforms: ['mac', 'linux', 'windows'],
    volumeDirName: 'tapd',
    command: [
      'tapd',
      '--network=regtest',
      '--debuglevel=debug',
      '--tlsextradomain={{name}}',
      '--tlsextradomain={{containerName}}',
      '--rpclisten=0.0.0.0:10029',
      '--restlisten=0.0.0.0:8089',
      '--lnd.host={{lndName}}:10009',
      '--lnd.macaroonpath=/home/tap/.lnd/data/chain/bitcoin/regtest/admin.macaroon',
      '--lnd.tlspath=/home/tap/.lnd/tls.cert',
      '--allow-public-uni-proof-courier',
      '--allow-public-stats',
      '--universe.public-access',
    ].join('\n  '),
    // if vars are modified, also update composeFile.ts & the i18n strings for cmps.nodes.CommandVariables
    variables: ['name', 'containerName', 'lndName'],
  },
};

/**
 * The URL containing the metadata for the images available on Docker Hub. If the contents of
 * this URL is newer than the state defined below, then the user can update their local list of
 * images and use new versions without needing to update the Polar app
 */
export const REPO_STATE_URL =
  'https://raw.githubusercontent.com/jamaljsr/polar/master/docker/nodes.json';

/**
 * this defines the hard-coded list of docker images available in the Polar app. When new images
 * are pushed to Docker Hub, this list should be updated along with the /docker/nodes.json file.
 */
export const defaultRepoState: DockerRepoState = {
  version: 59,
  images: {
    LND: {
      latest: '0.17.5-beta',
      versions: [
        '0.18.0-beta.rc1',
        '0.17.5-beta',
        '0.17.4-beta',
        '0.17.3-beta',
        '0.17.2-beta',
        '0.17.1-beta',
        '0.17.0-beta',
        '0.16.4-beta',
        '0.16.2-beta',
        '0.16.1-beta',
        '0.16.0-beta',
        '0.15.5-beta',
        '0.14.3-beta',
        '0.13.1-beta',
      ],
      // not all LND versions are compatible with all bitcoind versions.
      // this mapping specifies the highest compatible bitcoind for each LND version
      compatibility: {
        '0.18.0-beta.rc1': '27.0',
        '0.17.5-beta': '27.0',
        '0.17.4-beta': '27.0',
        '0.17.3-beta': '27.0',
        '0.17.2-beta': '27.0',
        '0.17.1-beta': '27.0',
        '0.17.0-beta': '27.0',
        '0.16.4-beta': '27.0',
        '0.16.2-beta': '27.0',
        '0.16.1-beta': '27.0',
        '0.16.0-beta': '27.0',
        '0.15.5-beta': '27.0',
        '0.14.3-beta': '27.0',
        '0.13.1-beta': '27.0',
      },
    },
    'c-lightning': {
      latest: '23.05.2',
      versions: ['23.05.2', '23.02.2', '22.11', '0.12.0', '0.11.2', '0.10.2'],
    },
    eclair: {
      latest: '0.10.0',
      versions: ['0.10.0', '0.9.0', '0.8.0', '0.7.0', '0.6.2', '0.5.0'],
    },
    bitcoind: {
      latest: '27.0',
      versions: ['27.0', '26.0', '25.0', '24.0', '23.0', '22.0', '0.21.1'],
    },
    btcd: {
      latest: '',
      versions: [],
    },
    tapd: {
      latest: '0.3.3-alpha',
      versions: ['0.3.3-alpha', '0.3.2-alpha'],
      compatibility: {
        '0.3.3-alpha': '0.16.0-beta',
        '0.3.2-alpha': '0.16.0-beta',
      },
    },
  },
};
