import React from 'react';
import { fireEvent, waitFor } from '@testing-library/dom';
import { Status } from 'shared/types';
import {
  getNetwork,
  lightningServiceMock,
  renderWithProviders,
  tapServiceMock,
  bitcoinServiceMock,
} from 'utils/tests';
import MineBlocksInput from './MineBlocksInput';

describe('MineBlocksInput', () => {
  const renderComponent = (status?: Status) => {
    const network = getNetwork(1, 'test network', status, 2);
    const initialState = {
      network: {
        networks: [network],
      },
    };
    const cmp = <MineBlocksInput node={network.nodes.bitcoin[0]} />;
    const result = renderWithProviders(cmp, { initialState, wrapForm: true });
    return {
      ...result,
      input: result.container.querySelector('input') as HTMLInputElement,
      btn: result.getByText('Mine').parentElement as HTMLElement,
    };
  };

  it('should render label', () => {
    const { getByText } = renderComponent();
    expect(getByText('Manually Mine Blocks')).toBeInTheDocument();
  });

  it('should render button', () => {
    const { btn } = renderComponent();
    expect(btn).toBeInTheDocument();
    expect(btn).toBeInstanceOf(HTMLButtonElement);
  });

  it('should render input field', () => {
    const { input } = renderComponent();
    expect(input).toBeInTheDocument();
    expect(input).toBeInstanceOf(HTMLInputElement);
  });

  it('should use a default value of 6 for the input', () => {
    const { input } = renderComponent();
    expect(input.value).toEqual('6');
  });

  it('should mine a block when the button is clicked', async () => {
    const mineMock = bitcoinServiceMock.mine as jest.Mock;
    mineMock.mockResolvedValue(true);
    const { input, btn, store } = renderComponent();
    const numBlocks = 5;
    fireEvent.change(input, { target: { value: numBlocks } });
    fireEvent.click(btn);
    const node = store.getState().network.networks[0].nodes.bitcoin[0];
    await waitFor(() => {
      expect(mineMock).toBeCalledWith(numBlocks, node);
    });
  });

  it('should mine 1 block when a invalid value is specified', async () => {
    const mineMock = bitcoinServiceMock.mine as jest.Mock;
    mineMock.mockResolvedValue(true);
    const { input, btn, store } = renderComponent();
    fireEvent.change(input, { target: { value: 'asdf' } });
    fireEvent.click(btn);
    const node = store.getState().network.networks[0].nodes.bitcoin[0];
    await waitFor(() => {
      expect(mineMock).toBeCalledWith(6, node);
    });
  });

  it('should display an error if mining fails', async () => {
    const mineMock = bitcoinServiceMock.mine as jest.Mock;
    mineMock.mockRejectedValue(new Error('connection failed'));
    const { input, btn, findByText } = renderComponent();
    const numBlocks = 5;
    fireEvent.change(input, { target: { value: numBlocks } });
    fireEvent.click(btn);
    expect(await findByText(/connection failed/)).toBeInTheDocument();
  });

  it('should display an error if blocks is below 1', async () => {
    const { input, btn, findByText } = renderComponent();
    const numBlocks = -5;
    fireEvent.change(input, { target: { value: numBlocks } });
    fireEvent.click(btn);
    expect(await findByText(/must be a positive number/)).toBeInTheDocument();
  });

  it('should display an error if lightning nodes cannot update after mining', async () => {
    const mineMock = bitcoinServiceMock.mine as jest.Mock;
    mineMock.mockResolvedValue(true);
    lightningServiceMock.getInfo.mockRejectedValueOnce(new Error('info-error'));
    const { input, btn, findByText } = renderComponent(Status.Started);
    const numBlocks = 5;
    fireEvent.change(input, { target: { value: numBlocks } });
    fireEvent.click(btn);
    expect(await findByText('info-error')).toBeInTheDocument();
  });

  it('should display an error if tap nodes cannot update after mining', async () => {
    const mineMock = bitcoinServiceMock.mine as jest.Mock;
    mineMock.mockResolvedValue(true);
    tapServiceMock.listAssets.mockRejectedValueOnce(new Error('info-error'));
    const { input, btn, findByText } = renderComponent(Status.Started);
    const numBlocks = 5;
    fireEvent.change(input, { target: { value: numBlocks } });
    fireEvent.click(btn);
    expect(await findByText('info-error')).toBeInTheDocument();
  });
});
