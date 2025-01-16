import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react';
import {
  defaultStateInfo,
  getNetwork,
  lightningServiceMock,
  renderWithProviders,
  bitcoinServiceMock,
} from 'utils/tests';
import { Deposit } from './';

describe('Deposit', () => {
  const renderComponent = () => {
    const network = getNetwork(1, 'test network');
    const initialState = {
      network: {
        networks: [network],
      },
    };
    const node = network.nodes.lightning[0];
    const cmp = <Deposit node={node} />;
    const result = renderWithProviders(cmp, { initialState, wrapForm: true });
    return {
      ...result,
      input: result.container.querySelector('input') as HTMLInputElement,
      btn: result.getByText('Deposit').parentElement as HTMLElement,
    };
  };

  beforeEach(() => {
    bitcoinServiceMock.sendFunds.mockResolvedValue('txid');
    lightningServiceMock.getNewAddress.mockResolvedValue({ address: 'bc1aaaa' });
    lightningServiceMock.getInfo.mockResolvedValue(
      defaultStateInfo({
        alias: 'my-node',
        pubkey: 'abcdef',
        syncedToChain: true,
      }),
    );
    lightningServiceMock.getBalances.mockResolvedValue({
      confirmed: '100',
      unconfirmed: '200',
      total: '300',
    });
  });

  it('should render label', () => {
    const { getByText } = renderComponent();
    expect(getByText('Deposit Funds')).toBeInTheDocument();
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

  it('should use a default value of 100000 for the input', () => {
    const { input } = renderComponent();
    expect(input.value).toEqual('1,000,000');
  });

  it('should deposit funds when the button is clicked', async () => {
    const { input, btn, getByText } = renderComponent();
    const amount = '250000';
    fireEvent.change(input, { target: { value: amount } });
    fireEvent.click(btn);
    await waitFor(() => getByText('Deposited 250,000 sats to alice'));
    expect(lightningServiceMock.getNewAddress).toBeCalledTimes(1);
    expect(bitcoinServiceMock.sendFunds).toBeCalledWith(
      expect.anything(),
      'bc1aaaa',
      0.0025,
    );
  });

  it('should deposit funds when an invalid value is specified', async () => {
    const { input, btn, getByText } = renderComponent();
    fireEvent.change(input, { target: { value: 'asdf' } });
    fireEvent.blur(input);
    fireEvent.click(btn);
    await waitFor(() => getByText('Deposited 1,000,000 sats to alice'));
    expect(lightningServiceMock.getNewAddress).toBeCalledTimes(1);
    expect(bitcoinServiceMock.sendFunds).toBeCalledWith(
      expect.anything(),
      'bc1aaaa',
      0.01,
    );
  });

  it('should display an error if mining fails', async () => {
    bitcoinServiceMock.sendFunds.mockRejectedValue(new Error('connection failed'));
    const { input, btn, findByText } = renderComponent();
    const numBlocks = 5;
    fireEvent.change(input, { target: { value: numBlocks } });
    fireEvent.click(btn);
    expect(await findByText(/connection failed/)).toBeInTheDocument();
  });
});
