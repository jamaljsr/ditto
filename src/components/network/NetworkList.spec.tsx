import React from 'react';
import { fireEvent } from '@testing-library/react';
import { Network } from 'types';
import { getNetwork, injections, renderWithProviders } from 'utils/tests';
import { NETWORK } from 'components/routing';
import NetworkList from './NetworkList';

describe('NetworkList Component', () => {
  const renderComponent = (initialNetworks?: Network[], collapse?: boolean) => {
    const initialState = {
      app: {
        sidebarCollapsed: collapse || false,
      },
      network: {
        networks: initialNetworks || [
          getNetwork(1, 'my network 1'),
          getNetwork(2, 'my network 2'),
          getNetwork(3, 'my network 3'),
        ],
      },
    };
    return renderWithProviders(<NetworkList />, { initialState });
  };

  it('should display a title', async () => {
    const { getByTestId } = renderComponent();
    expect(getByTestId('header')).toHaveTextContent('cmps.network-list.title');
  });

  it('should display a notification if it fails to load networks from disk', async () => {
    const loadMock = injections.dockerService.load as jest.Mock;
    loadMock.mockRejectedValue(new Error('error reading file'));
    const { findByText } = renderComponent([]);
    expect(await findByText('cmps.network-list.load-error-msg')).toBeInTheDocument();
  });

  it('should go to the new network screen when the create button is clicked', () => {
    const { getByTestId, history } = renderComponent([]);
    fireEvent.click(getByTestId('create-icon'));
    expect(history.location.pathname).toEqual(NETWORK);
  });

  it('should display a create icon if one or more networks exist', () => {
    const { getByTestId } = renderComponent();
    expect(getByTestId('create-icon')).toBeInTheDocument();
  });

  it('should display a create icon if no networks exist', () => {
    const { getByTestId } = renderComponent([]);
    expect(getByTestId('create-icon')).toBeInTheDocument();
  });

  it('should go to the new network screen when the create icon is clicked', () => {
    const { getByTestId, history } = renderComponent();
    fireEvent.click(getByTestId('create-icon'));
    expect(history.location.pathname).toEqual(NETWORK);
  });

  it('should display a list of network names', async () => {
    const { getByText } = renderComponent();
    expect(getByText('my network 1')).toBeInTheDocument();
    expect(getByText('my network 2')).toBeInTheDocument();
    expect(getByText('my network 3')).toBeInTheDocument();
  });

  it('should display the sidebar expanded', () => {
    const { queryByText } = renderComponent();
    expect(queryByText('cmps.network-list.title')).toBeInTheDocument();
  });

  it('should display the sidebar collapsed', () => {
    const { queryByText } = renderComponent(undefined, true);
    expect(queryByText('cmps.network-list.title')).not.toBeInTheDocument();
  });
});
