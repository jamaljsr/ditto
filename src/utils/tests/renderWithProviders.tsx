import React from 'react';
import { Provider } from 'react-redux';
import { fireEvent, render } from '@testing-library/react';
import { Form } from 'antd';
import { ConnectedRouter } from 'connected-react-router';
import { StoreProvider } from 'easy-peasy';
import { createMemoryHistory } from 'history';
import { createReduxStore } from 'store';
import { BitcoinService, LightningService, StoreInjections, TapService } from 'types';

export const bitcoinServiceMock: jest.Mocked<BitcoinService> = {
  waitUntilOnline: jest.fn(),
  createDefaultWallet: jest.fn(),
  getBlockchainInfo: jest.fn(),
  getWalletInfo: jest.fn(),
  getNewAddress: jest.fn(),
  connectPeers: jest.fn(),
  sendFunds: jest.fn(),
  mine: jest.fn(),
};
export const lightningServiceMock: jest.Mocked<LightningService> = {
  getInfo: jest.fn(),
  getBalances: jest.fn(),
  getNewAddress: jest.fn(),
  getChannels: jest.fn(),
  getPeers: jest.fn(),
  connectPeers: jest.fn(),
  openChannel: jest.fn(),
  closeChannel: jest.fn(),
  createInvoice: jest.fn(),
  payInvoice: jest.fn(),
  decodeInvoice: jest.fn(),
  waitUntilOnline: jest.fn(),
  addListenerToNode: jest.fn(),
  removeListener: jest.fn(),
  subscribeChannelEvents: jest.fn(),
};
export const tapServiceMock: jest.Mocked<TapService> = {
  listAssets: jest.fn(),
  listBalances: jest.fn(),
  waitUntilOnline: jest.fn(),
  mintAsset: jest.fn(),
  finalizeBatch: jest.fn(),
  newAddress: jest.fn(),
  sendAsset: jest.fn(),
  decodeAddress: jest.fn(),
  assetRoots: jest.fn(),
  syncUniverse: jest.fn(),
  fundChannel: jest.fn(),
  addInvoice: jest.fn(),
  sendPayment: jest.fn(),
};
// injections allow you to mock the dependencies of redux store actions
export const injections: StoreInjections = {
  ipc: jest.fn(),
  settingsService: {
    load: jest.fn(),
    save: jest.fn(),
  },
  dockerService: {
    getVersions: jest.fn(),
    getImages: jest.fn(),
    saveComposeFile: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    startNode: jest.fn(),
    stopNode: jest.fn(),
    removeNode: jest.fn(),
    saveNetworks: jest.fn(),
    loadNetworks: jest.fn(),
    renameNodeDir: jest.fn(),
  },
  repoService: {
    load: jest.fn(),
    save: jest.fn(),
    checkForUpdates: jest.fn(),
  },
  bitcoinFactory: {
    getService: () => bitcoinServiceMock,
  },
  lightningFactory: {
    getService: () => lightningServiceMock,
  },
  tapFactory: {
    getService: () => tapServiceMock,
  },
  litdService: {
    status: jest.fn(),
    listSessions: jest.fn(),
    addSession: jest.fn(),
    revokeSession: jest.fn(),
    waitUntilOnline: jest.fn(),
  },
};
export const litdServiceMock = injections.litdService as jest.Mocked<
  typeof injections.litdService
>;

/**
 * Renders a component inside of the redux provider for state and
 * routing contexts. Some imported components such as <Link /> will
 * not render without this
 * @param cmp the component under test to render
 * @param options configuration options for providers
 */
export const renderWithProviders = (
  component: React.ReactElement,
  config?: { route?: string; initialState?: any; wrapForm?: boolean },
) => {
  const options = config || {};
  // use in-memory history for testing
  const history = createMemoryHistory();
  if (options.route) {
    history.push(options.route);
  }
  if (options.wrapForm) {
    component = <Form>{component}</Form>;
  }
  // provide initial state if any
  const initialState = options.initialState || {};
  const store = createReduxStore({ initialState, injections, history });
  const result = render(
    <StoreProvider store={store}>
      <Provider store={store as any}>
        <ConnectedRouter history={history}>{component}</ConnectedRouter>
      </Provider>
    </StoreProvider>,
  );

  // a helper to change the value of an antd <Select> component
  const changeSelect = (label: string, value: string) => {
    const { getByLabelText, getAllByText } = result;
    fireEvent.mouseDown(getByLabelText(label));
    // Select renders two lists of the options to the dom. click on the
    // second one if it exists, otherwise click the only one
    const options = getAllByText(value);
    fireEvent.click(options[1] || options[0]);
  };

  return { ...result, history, injections, store, changeSelect };
};
