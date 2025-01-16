import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react';
import { CommonNode, Status } from 'shared/types';
import { DockerLibrary } from 'types';
import { initChartFromNetwork } from 'utils/chart';
import { defaultRepoState } from 'utils/constants';
import { createBitcoindNetworkNode, createLndNetworkNode } from 'utils/network';
import {
  getNetwork,
  injections,
  lightningServiceMock,
  bitcoinServiceMock,
  renderWithProviders,
  suppressConsoleErrors,
  tapServiceMock,
  testNodeDocker,
} from 'utils/tests';
import RemoveNode from './RemoveNode';

const dockerServiceMock = injections.dockerService as jest.Mocked<DockerLibrary>;

describe('RemoveNode', () => {
  const renderComponent = (
    status?: Status,
    nodeName = 'alice',
    nodeType?: CommonNode['type'],
  ) => {
    const network = getNetwork(1, 'test network', status, 2);
    // add an extra lightning node to the network without a connected tapd node
    const lnd = defaultRepoState.images.LND;
    network.nodes.lightning.push(
      createLndNetworkNode(network, lnd.latest, lnd.compatibility, testNodeDocker),
    );

    if (status === Status.Error) {
      network.nodes.lightning.forEach(n => (n.errorMsg = 'test-error'));
    }
    const btcLatest = defaultRepoState.images.bitcoind.latest;
    network.nodes.bitcoin.push(
      createBitcoindNetworkNode(network, btcLatest, testNodeDocker),
    );
    const initialState = {
      network: {
        networks: [network],
      },
      designer: {
        allCharts: {
          1: initChartFromNetwork(network),
        },
        activeId: 1,
      },
      lightning: {
        nodes: {
          carol: {},
        },
      },
    };
    const { lightning, bitcoin, tap } = network.nodes;
    const node = [...lightning, ...bitcoin, ...tap].find(
      n => n.name === nodeName,
    ) as CommonNode;
    if (nodeType) node.type = nodeType;
    const cmp = <RemoveNode node={node} />;
    return renderWithProviders(cmp, { initialState, wrapForm: true });
  };

  describe('lightning node', () => {
    beforeEach(() => {
      lightningServiceMock.getChannels.mockResolvedValue([]);
    });

    it('should show the remove node modal', async () => {
      const { getByText, findByText } = renderComponent(Status.Started);
      expect(getByText('Remove')).toBeInTheDocument();
      fireEvent.click(getByText('Remove'));
      expect(
        await findByText('Are you sure you want to remove alice from the network?'),
      ).toBeInTheDocument();
      expect(getByText('Yes')).toBeInTheDocument();
      expect(getByText('Cancel')).toBeInTheDocument();
    });

    it('should remove the node with the network stopped', async () => {
      const { getByText, findByText, getByLabelText } = renderComponent(
        Status.Stopped,
        'carol',
      );
      expect(getByText('Remove')).toBeInTheDocument();
      fireEvent.click(getByText('Remove'));
      fireEvent.click(await findByText('Yes'));
      // wait for the error notification to be displayed
      await waitFor(() => getByLabelText('check-circle'));
      expect(
        getByText('The node carol has been removed from the network'),
      ).toBeInTheDocument();
      expect(dockerServiceMock.removeNode).toBeCalledTimes(0);
    });

    it('should remove the node with the network started', async () => {
      const { getByText, findByText, getByLabelText } = renderComponent(
        Status.Started,
        'carol',
      );
      expect(getByText('Remove')).toBeInTheDocument();
      fireEvent.click(getByText('Remove'));
      fireEvent.click(await findByText('Yes'));
      // wait for the error notification to be displayed
      await waitFor(() => getByLabelText('check-circle'));
      expect(
        getByText('The node carol has been removed from the network'),
      ).toBeInTheDocument();
      expect(dockerServiceMock.removeNode).toBeCalledTimes(1);
    });

    it('should display an error if removing the node fails', async () => {
      // antd Modal.confirm logs a console error when onOk fails
      // this suppresses those errors from being displayed in test runs
      await suppressConsoleErrors(async () => {
        dockerServiceMock.removeNode.mockRejectedValue(new Error('test error'));
        const { getByText, findByText, getByLabelText } = renderComponent(
          Status.Started,
          'carol',
        );
        expect(getByText('Remove')).toBeInTheDocument();
        fireEvent.click(getByText('Remove'));
        fireEvent.click(await findByText('Yes'));
        // wait for the error notification to be displayed
        await waitFor(() => getByLabelText('close-circle'));
        expect(getByText('Unable to remove the node')).toBeInTheDocument();
        expect(getByText('test error')).toBeInTheDocument();
      });
    });
  });

  describe('bitcoin node', () => {
    beforeEach(() => {
      lightningServiceMock.getChannels.mockResolvedValue([]);
      lightningServiceMock.waitUntilOnline.mockResolvedValue(Promise.resolve());
      bitcoinServiceMock.waitUntilOnline.mockResolvedValue(Promise.resolve());
      tapServiceMock.waitUntilOnline.mockResolvedValue(Promise.resolve());
    });

    it('should show the remove node modal', async () => {
      const { getByText, findByText } = renderComponent(Status.Started, 'backend1');
      expect(getByText('Remove')).toBeInTheDocument();
      fireEvent.click(getByText('Remove'));
      expect(
        await findByText('Are you sure you want to remove backend1 from the network?'),
      ).toBeInTheDocument();
      expect(getByText('Yes')).toBeInTheDocument();
      expect(getByText('Cancel')).toBeInTheDocument();
    });

    it('should remove the node with the network stopped', async () => {
      const { getByText, findByText, getByLabelText } = renderComponent(
        Status.Stopped,
        'backend1',
      );
      expect(getByText('Remove')).toBeInTheDocument();
      fireEvent.click(getByText('Remove'));
      fireEvent.click(await findByText('Yes'));
      // wait for the error notification to be displayed
      await waitFor(() => getByLabelText('check-circle'));
      expect(
        await findByText('The node backend1 has been removed from the network'),
      ).toBeInTheDocument();
      expect(dockerServiceMock.saveComposeFile).toBeCalledTimes(1);
    });

    it('should remove the node with the network started', async () => {
      const { getByText, findByText, getByLabelText } = renderComponent(
        Status.Started,
        'backend1',
      );
      expect(getByText('Remove')).toBeInTheDocument();
      fireEvent.click(getByText('Remove'));
      fireEvent.click(await findByText('Yes'));
      // wait for the error notification to be displayed
      await waitFor(() => getByLabelText('check-circle'));
      expect(
        getByText('The node backend1 has been removed from the network'),
      ).toBeInTheDocument();
      expect(dockerServiceMock.saveComposeFile).toBeCalledTimes(2);
    });

    it('should display an error if removing the node fails', async () => {
      // antd Modal.confirm logs a console error when onOk fails
      // this suppresses those errors from being displayed in test runs
      await suppressConsoleErrors(async () => {
        dockerServiceMock.saveComposeFile.mockRejectedValue(new Error('test error'));
        const { getByText, findByText, getByLabelText } = renderComponent(
          Status.Stopped,
          'backend1',
        );
        expect(getByText('Remove')).toBeInTheDocument();
        fireEvent.click(getByText('Remove'));
        fireEvent.click(await findByText('Yes'));
        // wait for the error notification to be displayed
        await waitFor(() => getByLabelText('close-circle'));
        expect(getByText('Unable to remove the node')).toBeInTheDocument();
        expect(getByText('test error')).toBeInTheDocument();
      });
    });
  });

  describe('tap node', () => {
    it('should show the remove node modal', async () => {
      const { getByText, findByText } = renderComponent(Status.Started, 'alice-tap');
      expect(getByText('Remove')).toBeInTheDocument();
      fireEvent.click(getByText('Remove'));
      expect(
        await findByText('Are you sure you want to remove alice-tap from the network?'),
      ).toBeInTheDocument();
      expect(getByText('Yes')).toBeInTheDocument();
      expect(getByText('Cancel')).toBeInTheDocument();
    });

    it('should remove the node with the network stopped', async () => {
      const { getByText, findByText, getByLabelText } = renderComponent(
        Status.Stopped,
        'bob-tap',
      );
      expect(getByText('Remove')).toBeInTheDocument();
      fireEvent.click(getByText('Remove'));
      fireEvent.click(await findByText('Yes'));
      // wait for the error notification to be displayed
      await waitFor(() => getByLabelText('check-circle'));
      expect(
        getByText('The node bob-tap has been removed from the network'),
      ).toBeInTheDocument();
      expect(dockerServiceMock.removeNode).toBeCalledTimes(0);
    });

    it('should remove the node with the network started', async () => {
      const { getByText, findByText, getByLabelText } = renderComponent(
        Status.Started,
        'alice-tap',
      );
      expect(getByText('Remove')).toBeInTheDocument();
      fireEvent.click(getByText('Remove'));
      fireEvent.click(await findByText('Yes'));
      // wait for the error notification to be displayed
      await waitFor(() => getByLabelText('check-circle'));
      expect(
        getByText('The node alice-tap has been removed from the network'),
      ).toBeInTheDocument();
      expect(dockerServiceMock.removeNode).toBeCalledTimes(1);
    });

    it('should display an error if removing the node fails', async () => {
      // antd Modal.confirm logs a console error when onOk fails
      // this suppresses those errors from being displayed in test runs
      await suppressConsoleErrors(async () => {
        dockerServiceMock.removeNode.mockRejectedValue(new Error('test error'));
        const { getByText, findByText, getByLabelText } = renderComponent(
          Status.Started,
          'alice-tap',
        );
        expect(getByText('Remove')).toBeInTheDocument();
        fireEvent.click(getByText('Remove'));
        fireEvent.click(await findByText('Yes'));
        // wait for the error notification to be displayed
        await waitFor(() => getByLabelText('close-circle'));
        expect(getByText('Unable to remove the node')).toBeInTheDocument();
        expect(getByText('test error')).toBeInTheDocument();
      });
    });
  });

  describe('invalid node type', () => {
    it('should display the invalid node msg', async () => {
      // antd Modal.confirm logs a console error when onOk fails
      // this suppresses those errors from being displayed in test runs
      await suppressConsoleErrors(async () => {
        const { getByText, findByText } = renderComponent(
          Status.Started,
          'alice',
          'invalid-type' as CommonNode['type'],
        );
        expect(getByText('Remove')).toBeInTheDocument();
        fireEvent.click(getByText('Remove'));
        fireEvent.click(await findByText('Yes'));
        expect(await findByText(`Unknown node type 'invalid-type'`)).toBeInTheDocument();
      });
    });
  });
});
