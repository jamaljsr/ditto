import React from 'react';
import { ILink } from '@mrblenny/react-flow-chart';
import { fireEvent, waitFor } from '@testing-library/react';
import { Status } from 'shared/types';
import { LightningNodeChannelAsset } from 'lib/lightning/types';
import { initChartFromNetwork } from 'utils/chart';
import {
  getNetwork,
  lightningServiceMock,
  renderWithProviders,
  suppressConsoleErrors,
  bitcoinServiceMock,
} from 'utils/tests';
import Channel from './Channel';

describe('Channel component', () => {
  const renderComponent = (
    status = Status.Stopped,
    sourceNode = 'alice',
    destNode = 'bob',
    assets?: LightningNodeChannelAsset[],
  ) => {
    const network = getNetwork(1, 'test network', status);
    const fromNode = network.nodes.lightning.find(node => node.name === sourceNode);
    const toNode = network.nodes.lightning.find(node => node.name === destNode);
    if (!fromNode || !toNode) {
      throw new Error(`Node with name ${sourceNode} or ${destNode} was not found`);
    }
    const link: ILink = {
      id: 'asdf',
      from: { nodeId: sourceNode, portId: 'asdf' },
      to: { nodeId: destNode, portId: 'asdf' },
      properties: {
        type: 'open-channel',
        capacity: '1000',
        fromBalance: '600',
        toBalance: '400',
        direction: 'ltr',
        status: 'Open',
        channelPoint: '884b29be9946380937cba43cefe431b75c1a9ad3c45184e55f444eda09e56150',
        isPrivate: false,
        assets,
      },
    };
    const initialState = {
      network: {
        networks: [network],
      },
      designer: {
        activeId: 1,
        allCharts: {
          [1]: initChartFromNetwork(network),
        },
      },
    };
    const result = renderWithProviders(
      <Channel link={link} from={fromNode} to={toNode} />,
      {
        initialState,
      },
    );
    return { ...result, fromNode, toNode, link };
  };

  describe('Channel Details', () => {
    it('should display Status', () => {
      const { getAllByText } = renderComponent();
      expect(getAllByText('Status')).toHaveLength(3);
      expect(getAllByText('Stopped')).toHaveLength(2);
    });

    it('should display Capacity', () => {
      const { getByText } = renderComponent();
      expect(getByText('Capacity')).toBeInTheDocument();
      expect(getByText('1,000 sats')).toBeInTheDocument();
    });

    it('should display Source Balance', () => {
      const { getByText } = renderComponent();
      expect(getByText('Source Balance')).toBeInTheDocument();
      expect(getByText('600 sats')).toBeInTheDocument();
    });

    it('should display Destination Balance', () => {
      const { getByText } = renderComponent();
      expect(getByText('Destination Balance')).toBeInTheDocument();
      expect(getByText('600 sats')).toBeInTheDocument();
    });

    it('should display "Channel Point" when source node is LND (alice)', () => {
      const { getByText } = renderComponent(Status.Stopped, 'alice', 'bob');
      expect(getByText('Channel Point')).toBeInTheDocument();
      expect(getByText('884b...e56150')).toBeInTheDocument();
    });

    it('should display "Channel ID" when source node is CLN (bob)', () => {
      const { getByText } = renderComponent(Status.Stopped, 'bob', 'alice');
      expect(getByText('Channel ID')).toBeInTheDocument();
      expect(getByText('884b...e56150')).toBeInTheDocument();
    });

    it('should display "Channel ID" when source node is Eclair (carol)', () => {
      const { getByText } = renderComponent(Status.Stopped, 'carol', 'bob');
      expect(getByText('Channel ID')).toBeInTheDocument();
      expect(getByText('884b...e56150')).toBeInTheDocument();
    });

    it('should display isPrivate', () => {
      const { getByText } = renderComponent();
      expect(getByText('Is Private')).toBeInTheDocument();
      expect(getByText('false')).toBeInTheDocument();
    });
  });

  describe('LND Source Details', () => {
    it('should display Name', () => {
      const { getByText, fromNode } = renderComponent();
      expect(getByText(fromNode.name)).toBeInTheDocument();
    });

    it('should display Implementation', () => {
      const { getAllByText, fromNode } = renderComponent();
      expect(getAllByText(fromNode.implementation)).toHaveLength(1);
    });

    it('should display Version', () => {
      const { getAllByText, fromNode } = renderComponent();
      expect(getAllByText(`v${fromNode.version}`)).toHaveLength(1);
    });

    it('should display Status', () => {
      const { getAllByText, fromNode } = renderComponent();
      expect(getAllByText(Status[fromNode.status])).toHaveLength(2);
    });
  });

  describe('CLN Destination Details', () => {
    it('should display Name', () => {
      const { getByText, toNode } = renderComponent();
      expect(getByText(toNode.name)).toBeInTheDocument();
    });

    it('should display Implementation', () => {
      const { getAllByText, toNode } = renderComponent();
      expect(getAllByText(toNode.implementation)).toHaveLength(1);
    });

    it('should display Version', () => {
      const { getAllByText, toNode } = renderComponent();
      expect(getAllByText(`v${toNode.version}`)).toHaveLength(1);
    });

    it('should display Status', () => {
      const { getAllByText, toNode } = renderComponent();
      expect(getAllByText(Status[toNode.status])).toHaveLength(2);
    });
  });

  describe('Close Channel', () => {
    beforeEach(() => {
      lightningServiceMock.closeChannel.mockResolvedValue(true);
      lightningServiceMock.getChannels.mockResolvedValue([]);
      bitcoinServiceMock.mine.mockResolvedValue(['txid']);
    });

    it('should show the close channel modal', async () => {
      const { getByText, findByText } = renderComponent(Status.Started);
      expect(getByText('Close Channel')).toBeInTheDocument();
      fireEvent.click(getByText('Close Channel'));
      expect(
        await findByText('Are you sure you want to close this channel?'),
      ).toBeInTheDocument();
      expect(getByText('Yes')).toBeInTheDocument();
      expect(getByText('Cancel')).toBeInTheDocument();
    });

    it('should close the channel successfully', async () => {
      const { getByText, findByText, getByLabelText } = renderComponent(Status.Started);
      expect(getByText('Close Channel')).toBeInTheDocument();
      fireEvent.click(getByText('Close Channel'));
      // antd creates two modals in the DOM for some silly reason. Need to click one
      fireEvent.click(await findByText('Yes'));
      // wait for the error notification to be displayed
      await waitFor(() => getByLabelText('check-circle'));
      expect(getByText('The channel has been closed')).toBeInTheDocument();
      expect(lightningServiceMock.closeChannel).toHaveBeenCalledTimes(1);
      expect(bitcoinServiceMock.mine).toHaveBeenCalledTimes(1);
    });

    it('should display an error if the node is not started', async () => {
      const { getByText, getByLabelText } = renderComponent(Status.Stopped);
      expect(getByText('Close Channel')).toBeInTheDocument();
      fireEvent.click(getByText('Close Channel'));
      // wait for the error notification to be displayed
      await waitFor(() => getByLabelText('close-circle'));
      expect(getByText('Unable to close the channel')).toBeInTheDocument();
      expect(getByText('The source node must be Started')).toBeInTheDocument();
    });

    it('should display an error if closing the channel fails', async () => {
      // antd Modal.confirm logs a console error when onOk fails
      // this suppresses those errors from being displayed in test runs
      await suppressConsoleErrors(async () => {
        lightningServiceMock.closeChannel.mockRejectedValue(new Error('test error'));
        const { getByText, findByText, getByLabelText } = renderComponent(Status.Started);
        expect(getByText('Close Channel')).toBeInTheDocument();
        fireEvent.click(getByText('Close Channel'));
        // antd creates two modals in the DOM for some silly reason. Need to click one
        fireEvent.click(await findByText('Yes'));
        // wait for the error notification to be displayed
        await waitFor(() => getByLabelText('close-circle'));
        expect(getByText('Unable to close the channel')).toBeInTheDocument();
        expect(getByText('test error')).toBeInTheDocument();
      });
    });
  });

  describe('with assets', () => {
    it('should display list of assets', async () => {
      const asset: LightningNodeChannelAsset = {
        id: 'testId',
        name: 'test asset',
        capacity: '2,345',
        localBalance: '1,647',
        remoteBalance: '853',
      };
      const { getByText } = renderComponent(Status.Stopped, 'alice', 'bob', [asset]);
      expect(getByText('test asset')).toBeInTheDocument();
      expect(getByText('(Taproot Asset)')).toBeInTheDocument();
      expect(getByText('testId')).toBeInTheDocument();
      expect(getByText('Asset ID')).toBeInTheDocument();
      expect(getByText('testId')).toBeInTheDocument();
      expect(getByText('2,345')).toBeInTheDocument();
      expect(getByText('1,647')).toBeInTheDocument();
      expect(getByText('853')).toBeInTheDocument();
    });
  });
});
