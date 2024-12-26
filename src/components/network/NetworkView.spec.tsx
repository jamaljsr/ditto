import React from 'react';
import electron from 'electron';
import * as log from 'electron-log';
import fsExtra from 'fs-extra';
import { act, fireEvent, waitFor } from '@testing-library/react';
import { createMemoryHistory } from 'history';
import { Status } from 'shared/types';
import * as ipc from 'lib/ipc/ipcService';
import { initChartFromNetwork } from 'utils/chart';
import { defaultRepoState } from 'utils/constants';
import {
  getNetwork,
  injections,
  lightningServiceMock,
  renderWithProviders,
  suppressConsoleErrors,
  testCustomImages,
  bitcoinServiceMock,
} from 'utils/tests';
import NetworkView from './NetworkView';

jest.mock('lib/ipc/ipcService');

const fsMock = fsExtra as jest.Mocked<typeof fsExtra>;
const logMock = log as jest.Mocked<typeof log>;
const ipcMock = ipc as jest.Mocked<typeof ipc>;
const dialogMock = electron.remote.dialog as jest.Mocked<typeof electron.remote.dialog>;
const dockerServiceMock = injections.dockerService as jest.Mocked<
  typeof injections.dockerService
>;

describe('NetworkView Component', () => {
  const renderComponent = (
    id: string | undefined,
    status?: Status,
    images?: string[],
    withBitcoinData = true,
  ) => {
    const network = getNetwork(1, 'test network', status, 0, 'network description');
    const bitcoinData = {
      nodes: {
        '1-backend1': {
          chainInfo: {
            blocks: 123,
            bestblockhash: 'abcdef',
          },
          walletInfo: {
            balance: 10,
            immature_balance: 20,
          },
        },
      },
    };
    const initialState = {
      app: {
        dockerImages: images || [],
      },
      network: {
        networks: [network],
      },
      designer: {
        activeId: network.id,
        allCharts: {
          1: initChartFromNetwork(network),
        },
      },
      bitcoin: withBitcoinData ? bitcoinData : undefined,
    };
    const route = `/network/${id}`;
    const history = createMemoryHistory({ initialEntries: [route] });
    const location = { pathname: route, search: '', hash: '', state: undefined };
    const match = { params: { id }, isExact: true, path: '', url: route };
    const cmp = <NetworkView history={history} location={location} match={match} />;
    const result = renderWithProviders(cmp, { initialState, route });
    return {
      ...result,
      network,
    };
  };

  beforeEach(() => {
    lightningServiceMock.waitUntilOnline.mockResolvedValue();
    bitcoinServiceMock.waitUntilOnline.mockResolvedValue();
    dockerServiceMock.getImages.mockResolvedValue([]);
  });

  it('should not render if the network is not found', () => {
    const { queryByText } = renderComponent('99');
    expect(queryByText('test network')).toBeNull();
  });

  it('should not render if the network id is not provided', () => {
    const { queryByText } = renderComponent(undefined);
    expect(queryByText('test network')).toBeNull();
  });

  it('should render the network name', () => {
    const { getByText } = renderComponent('1');
    expect(getByText('test network')).toBeInTheDocument();
  });

  it('should render the tooltip for the network description', async () => {
    const { getAllByLabelText, findByText } = renderComponent('1');
    fireEvent.mouseOver(getAllByLabelText('info-circle')[0]);
    expect(await findByText('network description')).toBeInTheDocument();
  });

  it('should navigate home when back button clicked', () => {
    const { getByLabelText, history } = renderComponent('1');
    const backBtn = getByLabelText('Back');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(history.location.pathname).toEqual('/');
  });

  it('should render an error if necessary', async () => {
    const errorMsg = 'failed to start';
    // mock dockerService.start to throw an error
    const mockDockerStart = injections.dockerService.start as jest.Mock;
    mockDockerStart.mockRejectedValueOnce(new Error(errorMsg));
    const { getByText, findByText } = renderComponent('1');
    fireEvent.click(getByText('Start'));
    expect(await findByText(errorMsg)).toBeInTheDocument();
  });

  it('should change UI when network is started', async () => {
    const { getByText } = renderComponent('1');
    const primaryBtn = getByText('Start');
    fireEvent.click(primaryBtn);
    // should switch to stopping immediately
    expect(primaryBtn).toHaveTextContent('Starting');
    // should change to stopped after some time
    await waitFor(() => {
      expect(primaryBtn).toHaveTextContent('Stop');
    });
  });

  it('should change UI when network is stopped', async () => {
    const { getByText } = renderComponent('1', Status.Started);
    const primaryBtn = getByText('Stop');
    fireEvent.click(primaryBtn);
    // should switch to stopping immediately
    expect(primaryBtn).toHaveTextContent('Stopping');
    // should change to stopped after some time
    await waitFor(() => {
      expect(primaryBtn).toHaveTextContent('Start');
    });
  });

  it('should do nothing when network is starting', async () => {
    const { getByText } = renderComponent('1', Status.Starting);
    const primaryBtn = getByText('Starting', { selector: 'button span' });
    fireEvent.click(primaryBtn);
    // should remain the same since button should be disabled
    expect(primaryBtn).toHaveTextContent('Starting');
  });

  describe('missing images', () => {
    const lndLatest = defaultRepoState.images.LND.latest;
    const msg =
      'Starting this network will take a bit longer than normal because it uses docker images that have not been downloaded yet.';
    const pulledImages = [
      `polarlightning/lnd:${defaultRepoState.images.LND.latest}`,
      `polarlightning/clightning:${defaultRepoState.images['c-lightning'].latest}`,
      `polarlightning/eclair:${defaultRepoState.images.eclair.latest}`,
      `polarlightning/bitcoind:${defaultRepoState.images.bitcoind.latest}`,
    ];

    it('should display a message if the docker images are not downloaded', async () => {
      const { getByText } = renderComponent('1');
      expect(getByText(msg)).toBeInTheDocument();
    });

    it('should not display a message if the docker images are found', async () => {
      const { queryByText } = renderComponent('1', Status.Stopped, pulledImages);
      expect(queryByText(msg)).toBeNull();
    });

    it('should display a message if a node is added', async () => {
      const { getByText, queryByText, store } = renderComponent(
        '1',
        Status.Stopped,
        pulledImages,
      );
      expect(queryByText(msg)).toBeNull();
      await act(async () => {
        const settings = {
          nodeImages: {
            managed: [],
            custom: testCustomImages,
          },
        };
        store.getActions().app.setSettings(settings);
        const addArgs = { id: 1, type: 'LND', version: lndLatest, customId: '123' };
        await store.getActions().network.addNode(addArgs);
      });
      expect(getByText(msg)).toBeInTheDocument();
    });
  });

  describe('node state', () => {
    beforeEach(() => {
      bitcoinServiceMock.getBlockchainInfo.mockResolvedValue({
        blocks: 321,
        bestblockhash: 'abcdef',
      } as any);
      bitcoinServiceMock.getWalletInfo.mockResolvedValue({
        balance: 10,
        immature_balance: 20,
      } as any);
    });

    it('should fetch bitcoin data when mounted', async () => {
      const { findByText } = renderComponent('1', Status.Started, [], false);
      // wait for the new chain height to be displayed on mount
      expect(await findByText('height: 321')).toBeInTheDocument();
    });

    it('should handle an error when fetching bitcoin data on mount', async () => {
      bitcoinServiceMock.getBlockchainInfo.mockRejectedValue(new Error('test-err'));
      const { findByText } = renderComponent('1', Status.Started, [], false);
      expect(
        await findByText('Failed to fetch the bitcoin block height'),
      ).toBeInTheDocument();
      expect(await findByText('test-err')).toBeInTheDocument();
    });

    it('should not fetch bitcoin data if it is already in the store', async () => {
      renderComponent('1', Status.Started, [], true);
      expect(bitcoinServiceMock.getBlockchainInfo).not.toHaveBeenCalled();
    });
  });

  describe('rename network', () => {
    it('should show the rename inputs for the network name and description', async () => {
      const { getByLabelText, findByText, findByDisplayValue } = renderComponent('1');
      fireEvent.mouseOver(getByLabelText('more'));
      fireEvent.click(await findByText('Rename'));
      const nameInput = (await findByDisplayValue('test network')) as HTMLInputElement;
      expect(nameInput).toBeInTheDocument();
      expect(nameInput.type).toBe('text');
      const descriptionInput = (await findByText(
        'network description',
      )) as HTMLTextAreaElement;
      expect(descriptionInput).toBeInTheDocument();
      expect(descriptionInput.type).toBe('textarea');
      fireEvent.click(await findByText('Cancel'));
      expect(nameInput).not.toBeInTheDocument();
      expect(descriptionInput).not.toBeInTheDocument();
      expect(await findByText('Start')).toBeInTheDocument();
    });

    it('should rename the network name and description', async () => {
      const { getByLabelText, findByText, findByDisplayValue, store } =
        renderComponent('1');
      fireEvent.mouseOver(getByLabelText('more'));
      fireEvent.click(await findByText('Rename'));
      const nameInput = await findByDisplayValue('test network');
      fireEvent.change(nameInput, { target: { value: 'new network name' } });
      const descriptionInput = await findByText('network description');
      fireEvent.change(descriptionInput, {
        target: { value: 'new description' },
      });
      fireEvent.click(await findByText('Save'));
      expect(store.getState().network.networkById(1).name).toBe('new network name');
      expect(store.getState().network.networkById(1).description).toBe('new description');
      expect(await findByText('Start')).toBeInTheDocument();
    });

    it('should display an error if renaming fails', async () => {
      const { getByLabelText, findByText, findByDisplayValue } = renderComponent('1');
      fireEvent.mouseOver(getByLabelText('more'));
      fireEvent.click(await findByText('Rename'));
      const input = await findByDisplayValue('test network');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.click(await findByText('Save'));
      expect(await findByText('Failed to rename the network')).toBeInTheDocument();
    });

    it('should not display tooltip for description field if renamed to empty string', async () => {
      const { getAllByLabelText, getByLabelText, findByText } = renderComponent('1');
      const infoIcon = getAllByLabelText('info-circle')[0];
      expect(infoIcon).toBeInTheDocument();
      fireEvent.mouseOver(infoIcon);
      expect(await findByText('network description')).toBeInTheDocument();

      fireEvent.mouseOver(getByLabelText('more'));
      fireEvent.click(await findByText('Rename'));
      const descriptionInput = await findByText('network description');
      fireEvent.change(descriptionInput, { target: { value: '' } });
      fireEvent.click(await findByText('Save'));
      expect(infoIcon).not.toBeInTheDocument();
    });
  });

  describe('delete network', () => {
    it('should show the confirm modal', async () => {
      const { getByLabelText, getByText, findByText } = renderComponent('1');
      fireEvent.mouseOver(getByLabelText('more'));
      fireEvent.click(await findByText('Delete'));
      expect(
        await findByText('Are you sure you want to delete this network?'),
      ).toBeInTheDocument();
      expect(getByText('Yes')).toBeInTheDocument();
      expect(getByText('Cancel')).toBeInTheDocument();
    });

    it('should delete the network', async () => {
      const { getByLabelText, getByText, findByText, network } = renderComponent(
        '1',
        Status.Started,
      );
      fireEvent.mouseOver(getByLabelText('more'));
      fireEvent.click(await findByText('Delete'));
      fireEvent.click(await findByText('Yes'));
      // wait for the error notification to be displayed
      await waitFor(() => getByLabelText('check-circle'));
      expect(
        getByText("The network 'test network' and its data has been deleted!"),
      ).toBeInTheDocument();
      expect(fsMock.remove).toHaveBeenCalledWith(expect.stringContaining(network.path));
    });

    it('should display an error if the delete fails', async () => {
      // antd Modal.confirm logs a console error when onOk fails
      // this suppresses those errors from being displayed in test runs
      await suppressConsoleErrors(async () => {
        fsMock.remove = jest.fn().mockRejectedValue(new Error('cannot delete'));
        const { getByLabelText, getByText, findByText, store } = renderComponent('1');
        fireEvent.mouseOver(getByLabelText('more'));
        fireEvent.click(await findByText('Delete'));
        fireEvent.click(await findByText('Yes'));
        // wait for the error notification to be displayed
        await waitFor(() => getByLabelText('close-circle'));
        expect(getByText('cannot delete')).toBeInTheDocument();
        expect(store.getState().network.networks).toHaveLength(1);
        expect(store.getState().designer.allCharts[1]).toBeDefined();
      });
    });
  });

  describe('export network', () => {
    beforeEach(() => {
      const sender = jest.fn().mockResolvedValue(undefined);
      ipcMock.createIpcSender.mockReturnValue(sender);
    });

    it('should fail to export a running network', async () => {
      const { getByLabelText, findByText } = renderComponent('1', Status.Started);
      fireEvent.mouseOver(getByLabelText('more'));
      fireEvent.click(await findByText('Export'));
      expect(
        await findByText('The network must be stopped to be exported'),
      ).toBeInTheDocument();
    });

    it('should export a stopped network', async () => {
      dialogMock.showSaveDialog.mockResolvedValue({ filePath: 'file.zip' } as any);
      const { findByText, getByLabelText } = renderComponent('1');
      fireEvent.mouseOver(getByLabelText('more'));
      fireEvent.click(await findByText('Export'));
      expect(
        await findByText("Exported 'test network'", { exact: false }),
      ).toBeInTheDocument();
    });

    it('should not export the network if the user closes the file save dialogue', async () => {
      // returns undefined if user closes the window
      dialogMock.showSaveDialog.mockResolvedValue({} as any);
      const { queryByText, findByText, getByLabelText } = renderComponent('1');
      fireEvent.mouseOver(getByLabelText('more'));
      fireEvent.click(await findByText('Export'));
      await waitFor(() => {
        expect(logMock.info).toHaveBeenCalledWith('User aborted network export');
      });
      expect(dialogMock.showSaveDialog).toHaveBeenCalled();
      expect(queryByText("Exported 'test network'", { exact: false })).toBeNull();
    });
  });
});
