import React from 'react';
import { fireEvent, wait } from '@testing-library/react';
import { renderWithProviders, getNetwork } from 'utils/tests';
import { NETWORK } from 'components/Routes';
import NetworkList from './NetworkList';

describe('NetworkList Component', () => {
  const renderComponent = (initialNetworks?: Network[]) => {
    const initialState = {
      network: {
        networks: initialNetworks || [
          getNetwork(0, 'my network 1'),
          getNetwork(1, 'my network 2'),
          getNetwork(2, 'my network 3'),
        ],
      },
    };
    return renderWithProviders(<NetworkList />, { initialState });
  };

  it('should display a title', () => {
    const { getByTestId } = renderComponent();
    expect(getByTestId('header')).toHaveTextContent('cmps.network-list.title');
  });

  it('should display a big create button if no networks exist', () => {
    const { getByText } = renderComponent([]);
    expect(getByText('cmps.network-list.create-button')).toBeTruthy();
  });

  it('should not display a create button if one or more networks exist', () => {
    const { queryByText } = renderComponent();
    expect(queryByText('cmps.network-list.create-button')).toBeNull();
  });

  it('should go to the new network screen when the create button is clicked', () => {
    const { getByText, history } = renderComponent([]);
    fireEvent.click(getByText('cmps.network-list.create-button'));
    expect(history.location.pathname).toEqual(NETWORK);
  });

  it('should display a create icon if one or more networks exist', () => {
    const { getByTestId } = renderComponent();
    expect(getByTestId('create-icon')).toBeTruthy();
  });

  it('should not display a create icon if no networks exist', () => {
    const { queryByTestId } = renderComponent([]);
    expect(queryByTestId('create-icon')).toBeNull();
  });

  it('should go to the new network screen when the create icon is clicked', () => {
    const { getByTestId, history } = renderComponent();
    fireEvent.click(getByTestId('create-icon'));
    expect(history.location.pathname).toEqual(NETWORK);
  });

  it('should display a list of network names', async () => {
    const { getByText } = renderComponent();
    expect(getByText('my network 1')).toBeTruthy();
    expect(getByText('my network 2')).toBeTruthy();
    expect(getByText('my network 3')).toBeTruthy();
  });

  it('should show all networks collapsed by default', () => {
    const { queryByText } = renderComponent();
    expect(queryByText('cmps.network-list.start')).toBeNull();
    expect(queryByText('cmps.network-list.edit')).toBeNull();
    expect(queryByText('cmps.network-list.delete')).toBeNull();
  });

  it('should toggle open a selected network', () => {
    const { queryByText, getByText } = renderComponent();
    expect(queryByText('cmps.network-list.start')).toBeNull();
    fireEvent.click(getByText('my network 1'));
    expect(queryByText('cmps.network-list.start')).toBeTruthy();
  });

  it('should display start/edit/delete links for selected network', () => {
    const { queryByText, getByText } = renderComponent();
    fireEvent.click(getByText('my network 1'));
    expect(queryByText('cmps.network-list.start')).toBeTruthy();
    expect(queryByText('cmps.network-list.edit')).toBeTruthy();
    expect(queryByText('cmps.network-list.delete')).toBeTruthy();
  });

  it('should toggle a selected network closed when clicked again', () => {
    const { queryByText, getByText } = renderComponent();
    expect(queryByText('cmps.network-list.start')).toBeNull();
    fireEvent.click(getByText('my network 1'));
    expect(queryByText('cmps.network-list.start')).toBeVisible();
    fireEvent.click(getByText('my network 1'));
    wait(() => {
      // wait for the menu animation to complete
      expect(queryByText('cmps.network-list.start')).not.toBeVisible();
    });
  });
});
