import React from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react';
import { Status } from 'shared/types';
import { initChartFromNetwork } from 'utils/chart';
import { defaultRepoState } from 'utils/constants';
import { createLndNetworkNode } from 'utils/network';
import {
  getNetwork,
  renderWithProviders,
  testNodeDocker,
  testRepoState,
} from 'utils/tests';
import ChangeTaroBackendModal from './ChangeTaroBackendModal';

describe('ChangeTaroBackendModal', () => {
  let unmount: () => void;

  const renderComponent = async (
    status?: Status,
    taroName = 'alice-taro',
    lndName = 'alice',
  ) => {
    const network = getNetwork(1, 'test network', status, 2);
    const { compatibility } = defaultRepoState.images.LND;
    const otherLND = createLndNetworkNode(
      network,
      network.nodes.lightning[0].version,
      compatibility,
      testNodeDocker,
    );
    network.nodes.lightning.push(otherLND);
    const oldLnd = createLndNetworkNode(
      network,
      '0.7.1-beta',
      compatibility,
      testNodeDocker,
      status,
    );
    network.nodes.lightning.push(oldLnd);
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
        changeTaroBackend: {
          visible: true,
          taroName,
          lndName,
        },
      },
    };
    const cmp = <ChangeTaroBackendModal network={network} />;
    const result = renderWithProviders(cmp, { initialState });
    unmount = result.unmount;
    return { ...result, network };
  };

  afterEach(() => {
    unmount();
  });

  it('should render labels', async () => {
    const { getByText } = await renderComponent();
    expect(getByText('Change Taro Node Backend')).toBeInTheDocument();
    expect(getByText('Taro Node')).toBeInTheDocument();
    expect(getByText('LND Node')).toBeInTheDocument();
    expect(getByText('alice-taro')).toBeInTheDocument();
    expect(getByText('alice')).toBeInTheDocument();
  });

  it('should render button', async () => {
    const { getByText } = await renderComponent();
    const btn = getByText('Change Backend');
    expect(btn).toBeInTheDocument();
    expect(btn.parentElement).toBeInstanceOf(HTMLButtonElement);
  });

  it('should hide modal when cancel is clicked', async () => {
    const { getByText, queryByText } = await renderComponent();
    const btn = getByText('Cancel');
    expect(btn).toBeInTheDocument();
    expect(btn.parentElement).toBeInstanceOf(HTMLButtonElement);
    fireEvent.click(getByText('Cancel'));
    expect(queryByText('Cancel')).not.toBeInTheDocument();
  });

  it('should remove chart link when cancel is clicked', async () => {
    const { getByText, store } = await renderComponent();
    const { designer } = store.getActions();
    const linkId = 'xxxx';
    const link = { linkId, fromNodeId: 'alice-taro', fromPortId: 'lndbackend' } as any;
    // create a new link which will open the modal
    act(() => {
      designer.onLinkStart(link);
    });
    act(() => {
      designer.onLinkComplete({
        ...link,
        toNodeId: 'carol',
        toPortId: 'lndbackend',
      } as any);
    });
    expect(store.getState().designer.activeChart.links[linkId]).toBeTruthy();
    await waitFor(() => {
      expect(store.getState().modals.changeTaroBackend.linkId).toBe('xxxx');
    });
    fireEvent.click(getByText('Cancel'));
    await waitFor(() => {
      expect(store.getState().designer.activeChart.links[linkId]).toBeUndefined();
    });
  });

  it('should display the compatibility warning for older LND node', async () => {
    const { getByText, queryByText, changeSelect, store } = await renderComponent();
    store.getActions().app.setRepoState(testRepoState);
    const warning =
      `alice-taro is running tarod v0.2.0-alpha which is compatible with LND v0.16.0-beta and newer.` +
      ` dave is running LND v0.7.1-beta so it cannot be used.`;
    expect(queryByText(warning)).not.toBeInTheDocument();
    expect(getByText('Cancel')).toBeInTheDocument();
    changeSelect('LND Node', 'dave');
    expect(getByText(warning)).toBeInTheDocument();
    changeSelect('LND Node', 'alice');
    expect(queryByText(warning)).not.toBeInTheDocument();
  });

  it('should not display the compatibility warning', async () => {
    const { queryByLabelText, changeSelect, store } = await renderComponent(
      Status.Stopped,
      'bob',
    );
    const warning = queryByLabelText('exclamation-circle');
    const repoState = testRepoState;
    delete repoState.images.tarod.compatibility;
    changeSelect('Taro Node', 'alice-taro');
    changeSelect('LND Node', 'alice');
    store.getActions().app.setRepoState(repoState);
    expect(warning).not.toBeInTheDocument();
  });

  describe('with form submitted', () => {
    it('should update the backend successfully', async () => {
      const { getByText, changeSelect, store } = await renderComponent();
      changeSelect('LND Node', 'bob');
      fireEvent.click(getByText('Change Backend'));
      await waitFor(() => {
        expect(store.getState().modals.changeTaroBackend.visible).toBe(false);
      });
      expect(getByText('The alice-taro node will use bob')).toBeInTheDocument();
    });

    it('should succeed if a previous link does not exist', async () => {
      const { getByText, changeSelect, store } = await renderComponent();
      store.getActions().designer.removeLink('alice-taro-alice');
      changeSelect('LND Node', 'bob');
      fireEvent.click(getByText('Change Backend'));
      await waitFor(() => {
        expect(store.getState().modals.changeTaroBackend.visible).toBe(false);
      });
      expect(getByText('The alice-taro node will use bob')).toBeInTheDocument();
    });

    // it('should error if the backend is not changed', async () => {
    //   const { getByText, changeSelect } = await renderComponent();
    //   changeSelect('LND Node', 'alice');
    //   fireEvent.click(getByText('Change Backend'));
    //   await waitFor(() => {
    //     expect(
    //       getByText("The node 'alice-taro' is already connected to 'alice'"),
    //     ).toBeInTheDocument();
    //   });
    // });

    it('should do nothing if an invalid node is selected', async () => {
      const { getByText } = await renderComponent(Status.Stopped, 'invalid');
      fireEvent.click(getByText('Change Backend'));
      await waitFor(() => {
        expect(getByText('Change Backend')).toBeInTheDocument();
      });
    });
  });
});
