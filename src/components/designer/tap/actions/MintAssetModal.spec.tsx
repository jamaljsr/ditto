import React from 'react';
import { fireEvent } from '@testing-library/dom';
import { waitFor } from '@testing-library/react';
import { Status, TapNode } from 'shared/types';
import { initChartFromNetwork } from 'utils/chart';
import { defaultRepoState } from 'utils/constants';
import { createLitdNetworkNode } from 'utils/network';
import {
  defaultTapAsset,
  getNetwork,
  lightningServiceMock,
  renderWithProviders,
  tapServiceMock,
  testNodeDocker,
  bitcoinServiceMock,
} from 'utils/tests';
import MintAssetModal from './MintAssetModal';

describe('MintAssetModal', () => {
  let unmount: () => void;
  let node: TapNode;

  const renderComponent = async (nodeName = 'alice-tap', showModal = true) => {
    const network = getNetwork(1, 'test network', Status.Started, 2);
    node = network.nodes.tap[0];

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
    };
    const cmp = <MintAssetModal network={network} />;
    const result = renderWithProviders(cmp, { initialState });
    if (showModal) {
      await result.store
        .getActions()
        .modals.showMintAsset({ nodeName, networkId: network.id });
    }
    unmount = result.unmount;
    return {
      ...result,
      network,
    };
  };

  afterEach(() => unmount());

  it('should render labels', async () => {
    const { getByText } = await renderComponent();
    expect(getByText('Mint an asset for alice-tap')).toBeInTheDocument();
    expect(getByText('Asset Type')).toBeInTheDocument();
    expect(getByText('Asset Name')).toBeInTheDocument();
    expect(getByText('Supply')).toBeInTheDocument();
    expect(getByText('Decimal Places')).toBeInTheDocument();
    expect(getByText('Finalize batch to mint asset immediately')).toBeInTheDocument();
  });

  it('should render form inputs', async () => {
    const { getByLabelText } = await renderComponent();
    expect(getByLabelText('Asset Name')).toBeInTheDocument();
    expect(getByLabelText('Supply')).toBeInTheDocument();
  });

  it('should render button', async () => {
    const { getByText } = await renderComponent();
    const btn = getByText('Mint');
    expect(btn).toBeInTheDocument();
    expect(btn.parentElement).toBeInstanceOf(HTMLButtonElement);
  });

  it('should update amount when type changes', async () => {
    const { getByLabelText, changeSelect } = await renderComponent();
    expect(getByLabelText('Supply')).toHaveValue('100,000');
    changeSelect('Asset Type', 'Collectible');
    expect(getByLabelText('Supply')).toHaveValue('1');
    changeSelect('Asset Type', 'Normal');
    expect(getByLabelText('Supply')).toHaveValue('100,000');
  });

  it('should hide modal when cancel is clicked', async () => {
    const { getByText, queryByText, store } = await renderComponent();
    const btn = getByText('Cancel');
    expect(btn).toBeInTheDocument();
    expect(btn.parentElement).toBeInstanceOf(HTMLButtonElement);
    fireEvent.click(btn);
    await waitFor(() => {
      expect(store.getState().modals.mintAsset.visible).toBe(false);
      expect(queryByText('Cancel')).not.toBeInTheDocument();
    });
  });

  describe('mint asset', () => {
    const balances = (confirmed: string) => ({
      confirmed,
      unconfirmed: '200',
      total: '300',
    });

    beforeEach(() => {
      // make each node's balance different
      lightningServiceMock.getBalances.mockImplementation(node =>
        Promise.resolve(balances((node.id + 100).toString())),
      );
      tapServiceMock.mintAsset.mockResolvedValue({
        pendingBatch: {
          batchTxid: 'mocked-txid',
          batchKey: Buffer.from('mocked success!'),
          assets: [],
          state: 'BATCH_STATE_FINALIZED',
          batchPsbt: Buffer.from(''),
          heightHint: 0,
          createdAt: '',
        },
      });

      lightningServiceMock.getBalances.mockResolvedValue({
        confirmed: '10000',
        unconfirmed: '20000',
        total: '30000',
      });
      tapServiceMock.listAssets.mockResolvedValue([
        defaultTapAsset({
          name: 'LUSD',
          type: 'NORMAL',
          amount: '100',
        }),
      ]);
      tapServiceMock.assetRoots.mockResolvedValue([
        {
          id: 'test-asset-id',
          name: 'LUSD',
          rootSum: 1000,
        },
      ]);
    });

    it('should mint normal asset', async () => {
      const { getByText, getByLabelText } = await renderComponent();
      fireEvent.change(getByLabelText('Supply'), { target: { value: '100' } });
      fireEvent.change(getByLabelText('Asset Name'), { target: { value: 'test' } });
      fireEvent.click(getByText('Mint'));
      await waitFor(() => {
        expect(tapServiceMock.mintAsset).toHaveBeenCalled();
        expect(bitcoinServiceMock.mine).toHaveBeenCalledTimes(1);
      });
    });

    it('should mint collectible asset', async () => {
      const { getByText, getByLabelText, changeSelect } = await renderComponent();
      changeSelect('Asset Type', 'Collectible');
      expect(getByLabelText('Supply')).toHaveAttribute('disabled');
      fireEvent.change(getByLabelText('Asset Name'), { target: { value: 'test' } });
      fireEvent.click(getByText('Mint'));
      await waitFor(() => {
        expect(tapServiceMock.mintAsset).toHaveBeenCalledWith(
          node,
          expect.objectContaining({
            asset: expect.objectContaining({ assetType: 'COLLECTIBLE' }),
          }),
        );
        expect(bitcoinServiceMock.mine).toHaveBeenCalledTimes(1);
      });
    });

    it('should display a warning when the LND balance is low', async () => {
      lightningServiceMock.getBalances.mockResolvedValue({
        confirmed: '0',
        unconfirmed: '0',
        total: '0',
      });
      const { findByText, getByText } = await renderComponent();
      fireEvent.click(getByText('Deposit enough sats to alice to pay on-chain fees'));
      expect(
        await findByText('Insufficient balance on lnd node alice'),
      ).toBeInTheDocument();
    });

    it('should not display warning with missing balance info', async () => {
      const { getByText, queryByText, store } = await renderComponent();
      expect(getByText('Mint')).toBeInTheDocument();
      expect(lightningServiceMock.getBalances).toHaveBeenCalled();
      // clear the store to re-render the component without node data
      store.getActions().lightning.clearNodes();
      expect(
        queryByText('Insufficient balance on lnd node alice'),
      ).not.toBeInTheDocument();
    });

    it('should deposit enough funds to mint', async () => {
      lightningServiceMock.getBalances.mockResolvedValue({
        confirmed: '0',
        unconfirmed: '0',
        total: '0',
      });
      const { getByText, getByLabelText } = await renderComponent();
      fireEvent.change(getByLabelText('Supply'), { target: { value: '100' } });
      fireEvent.change(getByLabelText('Asset Name'), { target: { value: 'test' } });

      await waitFor(() => {
        expect(lightningServiceMock.getBalances).toHaveBeenCalled();
      });
      fireEvent.click(getByText('Mint'));
      await waitFor(() => {
        expect(lightningServiceMock.getNewAddress).toHaveBeenCalled();
      });
    });

    it('should call new address when send is clicked for tapd', async () => {
      lightningServiceMock.getBalances.mockResolvedValue({
        confirmed: '0',
        unconfirmed: '0',
        total: '0',
      });
      const { getByLabelText, getByText, network, store } = await renderComponent(
        'invalid',
        false,
      );
      const litdNode = createLitdNetworkNode(
        network,
        defaultRepoState.images.litd.latest,
        defaultRepoState.images.litd.compatibility,
        testNodeDocker,
      );
      network.nodes.lightning.push(litdNode);
      await store
        .getActions()
        .modals.showMintAsset({ nodeName: litdNode.name, networkId: network.id });
      await waitFor(() => {
        expect(lightningServiceMock.getBalances).toHaveBeenCalled();
      });
      fireEvent.change(getByLabelText('Supply'), { target: { value: '100' } });
      fireEvent.change(getByLabelText('Asset Name'), { target: { value: 'test' } });

      await waitFor(() => {
        expect(lightningServiceMock.getBalances).toHaveBeenCalled();
      });
      fireEvent.click(getByText('Mint'));
      await waitFor(() => {
        expect(lightningServiceMock.getNewAddress).toHaveBeenCalled();
      });
    });

    it('should display an error when minting fails', async () => {
      tapServiceMock.mintAsset.mockRejectedValue(new Error('error-msg'));
      const { getByText, getByLabelText, findByText } = await renderComponent();
      const btn = getByText('Mint');
      expect(btn).toBeInTheDocument();
      expect(btn.parentElement).toBeInstanceOf(HTMLButtonElement);
      fireEvent.change(getByLabelText('Supply'), { target: { value: '100' } });
      fireEvent.change(getByLabelText('Asset Name'), { target: { value: 'test' } });
      fireEvent.click(getByText('Mint'));
      expect(await findByText('Failed to mint 100 test')).toBeInTheDocument();
      expect(await findByText('error-msg')).toBeInTheDocument();
    });

    it('should not mint with an invalid node name', async () => {
      const { findByText, getByLabelText } = await renderComponent('invalid-node');
      expect(await findByText('Mint')).toBeInTheDocument();
      fireEvent.change(getByLabelText('Supply'), { target: { value: '100' } });
      fireEvent.change(getByLabelText('Asset Name'), { target: { value: 'test' } });
      fireEvent.click(await findByText('Mint'));
      await waitFor(() => {
        expect(tapServiceMock.mintAsset).not.toHaveBeenCalled();
      });
      expect(await findByText('Mint')).toBeInTheDocument();
    });
  });
});
