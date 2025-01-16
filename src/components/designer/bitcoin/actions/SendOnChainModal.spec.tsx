import React from 'react';
import { fireEvent } from '@testing-library/dom';
import { waitFor } from '@testing-library/react';
import { Status } from 'shared/types';
import { initChartFromNetwork } from 'utils/chart';
import { defaultRepoState } from 'utils/constants';
import { createNetwork } from 'utils/network';
import {
  renderWithProviders,
  suppressConsoleErrors,
  testManagedImages,
  bitcoinServiceMock,
} from 'utils/tests';
import SendOnChainModal from './SendOnChainModal';

describe('SendOnChainModal', () => {
  let unmount: () => void;

  const renderComponent = async (backendName = 'backend1') => {
    const network = createNetwork({
      id: 1,
      name: 'test network',
      description: 'network description',
      lndNodes: 2,
      clightningNodes: 1,
      eclairNodes: 1,
      bitcoindNodes: 3,
      tapdNodes: 0,
      litdNodes: 0,
      status: Status.Started,
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
        sendOnChain: {
          visible: true,
          backendName,
        },
      },
    };
    const cmp = <SendOnChainModal network={network} />;
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
    expect(getByText('From Bitcoin Node')).toBeInTheDocument();
    expect(getByText('Amount (BTC)')).toBeInTheDocument();
    expect(getByText('Destination Onchain Address')).toBeInTheDocument();
    expect(
      getByText('Automatically mine 6 blocks to confirm the transaction'),
    ).toBeInTheDocument();
  });

  it('should render form inputs', async () => {
    const { getByLabelText } = await renderComponent();
    expect(getByLabelText('From Bitcoin Node')).toBeInTheDocument();
    expect(getByLabelText('Amount (BTC)')).toBeInTheDocument();
    expect(getByLabelText('Destination Onchain Address')).toBeInTheDocument();
    expect(
      getByLabelText('Automatically mine 6 blocks to confirm the transaction'),
    ).toBeInTheDocument();
  });

  it('should render button', async () => {
    const { getByText } = await renderComponent();
    const btn = getByText('Send');
    expect(btn).toBeInTheDocument();
    expect(btn.parentElement).toBeInstanceOf(HTMLButtonElement);
  });

  it('should hide modal when cancel is clicked', async () => {
    const { getByText, queryByText } = await renderComponent();
    const btn = getByText('Cancel');
    expect(btn).toBeInTheDocument();
    expect(btn.parentElement).toBeInstanceOf(HTMLButtonElement);
    fireEvent.click(getByText('Cancel'));
    await waitFor(() => {
      expect(queryByText('Cancel')).not.toBeInTheDocument();
    });
  });

  it('should display an error if form is not valid', async () => {
    await suppressConsoleErrors(async () => {
      const { findByText, getByText } = await renderComponent();
      fireEvent.click(getByText('Send'));
      expect(await findByText('required')).toBeInTheDocument();
    });
  });

  it('should do nothing if an invalid node is selected', async () => {
    const { getByText, getByLabelText } = await renderComponent('invalid');
    fireEvent.change(getByLabelText('Amount (BTC)'), { target: { value: '0.001' } });
    fireEvent.change(getByLabelText('Destination Onchain Address'), {
      target: { value: 'bc1...' },
    });
    fireEvent.click(getByText('Send'));
    await waitFor(() => {
      expect(getByText('Send')).toBeInTheDocument();
    });
  });

  it('should display the correct balance for the selected backend', async () => {
    bitcoinServiceMock.getWalletInfo.mockResolvedValueOnce({ balance: 123 } as any);
    bitcoinServiceMock.getWalletInfo.mockResolvedValueOnce({ balance: 456 } as any);
    bitcoinServiceMock.getWalletInfo.mockResolvedValueOnce({ balance: 0 } as any);
    const { findByText, changeSelect, store, network } = await renderComponent();
    store.getActions().bitcoin.getInfo(network.nodes.bitcoin[0]);
    store.getActions().bitcoin.getInfo(network.nodes.bitcoin[1]);
    store.getActions().bitcoin.getInfo(network.nodes.bitcoin[2]);
    expect(await findByText('Balance: 123 BTC')).toBeInTheDocument();
    changeSelect('From Bitcoin Node', 'backend2');
    expect(await findByText('Balance: 456 BTC')).toBeInTheDocument();
    changeSelect('From Bitcoin Node', 'backend3');
    expect(await findByText('Balance: 0 BTC')).toBeInTheDocument();
  });

  describe('with form submitted', () => {
    beforeEach(() => {
      bitcoinServiceMock.getWalletInfo.mockResolvedValue({ balance: 123 } as any);
      bitcoinServiceMock.mine.mockResolvedValue([]);
      bitcoinServiceMock.sendFunds.mockResolvedValue('txid123');
    });

    it('should send coins successfully', async () => {
      const { getByText, getByLabelText, store, network } = await renderComponent();
      store.getActions().bitcoin.getInfo(network.nodes.bitcoin[0]);
      fireEvent.change(getByLabelText('Amount (BTC)'), { target: { value: '0.001' } });
      fireEvent.change(getByLabelText('Destination Onchain Address'), {
        target: { value: 'bc1...' },
      });
      fireEvent.click(getByText('Send'));
      await waitFor(() => {
        expect(store.getState().modals.sendOnChain.visible).toBe(false);
      });
      const node = network.nodes.bitcoin[0];
      expect(bitcoinServiceMock.sendFunds).toHaveBeenCalledWith(node, 'bc1...', 0.001);
      expect(bitcoinServiceMock.mine).toHaveBeenCalledWith(6, node);
    });

    it('should not mine block when the option is unchecked', async () => {
      const { getByText, getByLabelText, store, network } = await renderComponent();
      store.getActions().bitcoin.getInfo(network.nodes.bitcoin[0]);
      fireEvent.change(getByLabelText('Amount (BTC)'), { target: { value: '0.001' } });
      fireEvent.change(getByLabelText('Destination Onchain Address'), {
        target: { value: 'bc1...' },
      });
      fireEvent.click(
        getByText('Automatically mine 6 blocks to confirm the transaction'),
      );
      fireEvent.click(getByText('Send'));
      await waitFor(() => {
        expect(store.getState().modals.sendOnChain.visible).toBe(false);
      });
      const node = network.nodes.bitcoin[0];
      expect(bitcoinServiceMock.sendFunds).toHaveBeenCalledWith(node, 'bc1...', 0.001);
      expect(bitcoinServiceMock.mine).not.toHaveBeenCalled();
    });

    it('should display an error when amount is above balance', async () => {
      const { getByText, getByLabelText, store, network } = await renderComponent();
      store.getActions().bitcoin.getInfo(network.nodes.bitcoin[0]);
      fireEvent.change(getByLabelText('Amount (BTC)'), { target: { value: '125' } });
      fireEvent.change(getByLabelText('Destination Onchain Address'), {
        target: { value: 'bc1...' },
      });
      fireEvent.click(getByText('Send'));
      await waitFor(() => {
        expect(getByText('Unable to send coins')).toBeInTheDocument();
      });
      expect(
        getByText('Amount must be less than the backend1 balance of 123 BTC'),
      ).toBeInTheDocument();
    });

    it('should display an error when sending funds fails', async () => {
      bitcoinServiceMock.sendFunds.mockRejectedValue(new Error('error-msg'));
      const { getByText, getByLabelText, store, network } = await renderComponent();
      store.getActions().bitcoin.getInfo(network.nodes.bitcoin[0]);
      fireEvent.change(getByLabelText('Amount (BTC)'), { target: { value: '0.001' } });
      fireEvent.change(getByLabelText('Destination Onchain Address'), {
        target: { value: 'bc1...' },
      });
      fireEvent.click(getByText('Send'));
      await waitFor(() => {
        expect(getByText('Unable to send coins')).toBeInTheDocument();
      });
      expect(getByText('error-msg')).toBeInTheDocument();
    });
  });
});
