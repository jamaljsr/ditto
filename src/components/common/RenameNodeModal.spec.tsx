import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react';
import { Status } from 'shared/types';
import * as asyncUtil from 'utils/async';
import { initChartFromNetwork } from 'utils/chart';
import { defaultRepoState } from 'utils/constants';
import { createNetwork } from 'utils/network';
import {
  injections,
  lightningServiceMock,
  bitcoinServiceMock,
  litdServiceMock,
  renderWithProviders,
  tapServiceMock,
  testManagedImages,
} from 'utils/tests';
import RenameNodeModal from './RenameNodeModal';

jest.mock('utils/async');
const asyncUtilMock = asyncUtil as jest.Mocked<typeof asyncUtil>;

const dockerServiceMock = injections.dockerService as jest.Mocked<
  typeof injections.dockerService
>;

describe('RenameNodeModal', () => {
  let unmount: () => void;

  const renderComponent = async (status?: Status, nodeName = 'alice') => {
    const network = createNetwork({
      id: 1,
      name: 'test network',
      description: 'network description',
      lndNodes: 2,
      clightningNodes: 1,
      eclairNodes: 1,
      litdNodes: 1,
      bitcoindNodes: 3,
      tapdNodes: 1,
      status,
      repoState: defaultRepoState,
      managedImages: testManagedImages,
      customImages: [],
    });
    const initialState = {
      network: {
        networks: [network],
      },
      designer: {
        activeId: network.id,
        allCharts: {
          [network.id]: initChartFromNetwork(network),
        },
      },
      modals: {
        renameNode: {
          visible: true,
          oldNodeName: nodeName,
        },
      },
    };
    const cmp = <RenameNodeModal network={network} />;
    const result = renderWithProviders(cmp, { initialState });
    unmount = result.unmount;
    return {
      ...result,
      network,
    };
  };

  afterEach(() => unmount());

  it('should render labels', async () => {
    const { getByText } = await renderComponent();
    expect(getByText('Rename Node alice')).toBeInTheDocument();
    expect(getByText('New Node Name')).toBeInTheDocument();
  });

  it('should render form inputs', async () => {
    const { getByLabelText } = await renderComponent();
    expect(getByLabelText('New Node Name')).toBeInTheDocument();
  });

  it('should render button', async () => {
    const { getByText } = await renderComponent();
    const btn = getByText('Save');
    expect(btn).toBeInTheDocument();
    expect(btn.parentElement).toBeInstanceOf(HTMLButtonElement);
  });

  it('should render a alert for started nodes', async () => {
    const { getByText } = await renderComponent(Status.Started);
    expect(
      getByText('The network will be restarted to perform this operation'),
    ).toBeInTheDocument();
  });

  it('should hide modal when cancel is clicked', async () => {
    const { getByText, queryByText } = await renderComponent();
    const btn = getByText('Cancel');
    expect(btn).toBeInTheDocument();
    expect(btn.parentElement).toBeInstanceOf(HTMLButtonElement);
    fireEvent.click(getByText('Cancel'));
    expect(queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('should do nothing if an invalid node name is used', async () => {
    const { getByText } = await renderComponent(Status.Stopped, 'invalid');
    fireEvent.click(getByText('Save'));
    await waitFor(() => {
      expect(getByText('Save')).toBeInTheDocument();
    });
  });

  describe('with form submitted', () => {
    it('should update the Lightning node name', async () => {
      const { getByText, getByLabelText, store } = await renderComponent();
      fireEvent.change(getByLabelText('New Node Name'), { target: { value: 'test' } });
      fireEvent.click(getByText('Save'));
      await waitFor(() => {
        expect(store.getState().modals.advancedOptions.visible).toBe(false);
        expect(store.getState().network.networks[0].nodes.lightning[0].name).toBe('test');
      });
      expect(getByText('The node alice has been renamed to test')).toBeInTheDocument();
    });

    it('should update the TAP node name', async () => {
      const { getByText, getByLabelText, store } = await renderComponent(
        Status.Stopped,
        'alice-tap',
      );
      fireEvent.change(getByLabelText('New Node Name'), { target: { value: 'test' } });
      fireEvent.click(getByText('Save'));
      await waitFor(() => {
        expect(store.getState().modals.advancedOptions.visible).toBe(false);
        expect(store.getState().network.networks[0].nodes.tap[0].name).toBe('test');
      });
      expect(
        getByText('The node alice-tap has been renamed to test'),
      ).toBeInTheDocument();
    });

    it('should update the started Backend node name', async () => {
      asyncUtilMock.delay.mockResolvedValue(Promise.resolve());
      lightningServiceMock.waitUntilOnline.mockResolvedValue();
      bitcoinServiceMock.waitUntilOnline.mockResolvedValue();
      tapServiceMock.waitUntilOnline.mockResolvedValue();
      litdServiceMock.waitUntilOnline.mockResolvedValue();
      const { getByText, getByLabelText, store } = await renderComponent(
        Status.Started,
        'backend1',
      );
      fireEvent.change(getByLabelText('New Node Name'), { target: { value: 'test' } });
      fireEvent.click(getByText('Save'));
      await waitFor(() => {
        expect(store.getState().modals.advancedOptions.visible).toBe(false);
        expect(store.getState().network.networks[0].nodes.bitcoin[0].name).toBe('test');
      });
      expect(getByText('The node backend1 has been renamed to test')).toBeInTheDocument();
    });

    it('should display an error if it fails', async () => {
      dockerServiceMock.saveComposeFile.mockRejectedValue(new Error('test-error'));
      const { getByText, getByLabelText } = await renderComponent();
      fireEvent.change(getByLabelText('New Node Name'), { target: { value: 'test' } });
      fireEvent.click(getByText('Save'));
      await waitFor(() => {
        expect(getByText('Unable to rename the node')).toBeInTheDocument();
        expect(getByText('test-error')).toBeInTheDocument();
      });
    });
  });
});
