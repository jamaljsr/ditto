import React from 'react';
import { fireEvent, waitForElement } from '@testing-library/react';
import { getNetwork, injections, renderWithProviders } from 'utils/tests';
import Home from './Home';

describe('Home component', () => {
  const renderComponent = () => {
    const initialState = {
      network: {
        networks: [
          getNetwork(1, 'my network 1'),
          getNetwork(2, 'my network 2'),
          getNetwork(3, 'my network 3'),
        ],
      },
    };
    return renderWithProviders(<Home />, { initialState });
  };

  it('should display a notification if it fails to load networks from disk', async () => {
    const loadMock = injections.dockerService.load as jest.Mock;
    loadMock.mockRejectedValue(new Error('error reading file'));
    const { findByText } = renderComponent();
    expect(await findByText('error reading file')).toBeInTheDocument();
  });

  it('should display a list of networks', async () => {
    const { getByText } = renderComponent();
    await waitForElement(() => getByText('Click Me!'));
    expect(getByText('my network 1')).toBeInTheDocument();
    expect(getByText('my network 2')).toBeInTheDocument();
    expect(getByText('my network 3')).toBeInTheDocument();
  });

  it('should contain a "Click Me!" button', async () => {
    const { getByText } = renderComponent();
    await waitForElement(() => getByText('Click Me!'));
    expect(getByText('Click Me!')).toBeInTheDocument();
  });

  it('should contain a link to Counter page', async () => {
    const { getByText } = renderComponent();
    await waitForElement(() => getByText('Click Me!'));
    expect(getByText('Network')).toBeInTheDocument();
  });

  it('should not show alert message', async () => {
    const { queryByText, getByText } = renderComponent();
    await waitForElement(() => getByText('Click Me!'));
    expect(queryByText('Success Tips')).toBeNull();
  });

  it('should show alert after button is clicked', async () => {
    const { getByText } = renderComponent();
    await waitForElement(() => getByText('Click Me!'));
    const btn = getByText('Click Me!');
    fireEvent.click(btn);
    expect(getByText('Success Tips')).toBeInTheDocument();
  });
});
