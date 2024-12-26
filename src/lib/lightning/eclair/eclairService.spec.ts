import { WalletInfo } from 'bitcoin-core';
import bitcoindService from 'lib/bitcoin/bitcoind/bitcoindService';
import { defaultRepoState } from 'utils/constants';
import { defaultStateBalances, defaultStateInfo, getNetwork } from 'utils/tests';
import { eclairService } from './';
import * as eclairApi from './eclairApi';
import * as ELN from './types';

jest.mock('./eclairApi');
jest.mock('lib/bitcoin/bitcoind/bitcoindService');
jest.mock('utils/async', () => {
  const actualAsync = jest.requireActual('utils/async');
  return {
    waitFor: (conditionFunc: () => Promise<any>): Promise<any> => {
      return actualAsync.waitFor(conditionFunc, 0.1, 0.5);
    },
  };
});

const eclairApiMock = eclairApi as jest.Mocked<typeof eclairApi>;
const bitcoindServiceMock = bitcoindService as jest.Mocked<typeof bitcoindService>;

describe('EclairService', () => {
  const network = getNetwork();
  const node = network.nodes.lightning[2];
  const backend = network.nodes.bitcoin[0];

  it('should get node info', async () => {
    const infoResponse: Partial<ELN.GetInfoResponse> = {
      nodeId: 'asdf',
      alias: '',
      publicAddresses: ['1.1.1.1:9735'],
      blockHeight: 0,
    };
    eclairApiMock.httpPost.mockResolvedValue(infoResponse);
    const expected = defaultStateInfo({
      pubkey: 'asdf',
      rpcUrl: 'asdf@1.1.1.1:9735',
      syncedToChain: true,
    });
    const actual = await eclairService.getInfo(node);
    expect(actual).toEqual(expected);
  });

  it('should get wallet balance', async () => {
    const ballanceResponse: Partial<WalletInfo> = {
      balance: 0.00001,
      unconfirmed_balance: 0,
      immature_balance: 0,
    };
    bitcoindServiceMock.getWalletInfo.mockResolvedValue(ballanceResponse as any);

    const expected = defaultStateBalances({ confirmed: '1000', total: '1000' });
    const actual = await eclairService.getBalances(node, backend);
    expect(actual).toEqual(expected);
  });

  it('should fail to get balance with an invalid backend', async () => {
    const err = 'EclairService getBalances: backend was not specified';
    await expect(eclairService.getBalances(node)).rejects.toThrow(err);
  });

  it('should get new address', async () => {
    const expected = { address: 'abcdef' };
    eclairApiMock.httpPost.mockResolvedValue(expected.address);
    const actual = await eclairService.getNewAddress(node);
    expect(actual).toEqual(expected);
  });

  describe('getChannels', () => {
    let chanResponse: ELN.ChannelResponse;

    beforeEach(() => {
      chanResponse = {
        nodeId: 'abcdef',
        channelId: '65sdfd7',
        state: ELN.ChannelState.NORMAL,
        data: {
          commitments: {
            params: {
              localParams: {
                isInitiator: false,
                isChannelOpener: false,
              },
              channelFlags: {
                announceChannel: false,
              },
            },
            active: [
              {
                fundingTx: {
                  amountSatoshis: 0,
                },
                localCommit: {
                  spec: {
                    toLocal: 0,
                    toRemote: 0,
                  },
                },
              },
            ],
            localParams: {
              isFunder: false,
              isInitiator: false,
            },
            channelFlags: {
              announceChannel: true,
            },
            localCommit: {
              spec: {
                toLocal: 250000000,
                toRemote: 0,
              },
            },
            commitInput: {
              amountSatoshis: 250000,
            },
          },
        },
      };
    });

    it('should get a list of channels for v0.7.0', async () => {
      const node7 = { ...node, version: '0.7.0' };
      chanResponse.data.commitments.localParams.isFunder = true;

      eclairApiMock.httpPost.mockResolvedValue([chanResponse]);
      const expected = [expect.objectContaining({ pubkey: 'abcdef' })];
      const actual = await eclairService.getChannels(node7);
      expect(actual).toEqual(expected);
    });

    it('should get a list of channels for v0.8.0', async () => {
      const node8 = { ...node, version: '0.8.0' };
      chanResponse.data.commitments.localParams.isInitiator = true;

      eclairApiMock.httpPost.mockResolvedValue([chanResponse]);
      const expected = [expect.objectContaining({ pubkey: 'abcdef' })];
      const actual = await eclairService.getChannels(node8);
      expect(actual).toEqual(expected);
    });

    it('should get a list of channels for v0.9.0 and v0.10.0', async () => {
      const node9 = { ...node, version: '0.9.0' };
      chanResponse.data.commitments.params.localParams.isInitiator = true;

      eclairApiMock.httpPost.mockResolvedValue([chanResponse]);
      const expected = [expect.objectContaining({ pubkey: 'abcdef' })];
      const actual = await eclairService.getChannels(node9);
      expect(actual).toEqual(expected);
    });

    it('should get a list of channels for v0.11.0', async () => {
      const node11 = { ...node, version: '0.11.0' };
      chanResponse.data.commitments.params.localParams.isChannelOpener = true;

      eclairApiMock.httpPost.mockResolvedValue([chanResponse]);
      const expected = [expect.objectContaining({ pubkey: 'abcdef' })];
      const actual = await eclairService.getChannels(node11);
      expect(actual).toEqual(expected);
    });
  });

  it('should get a list of peers', async () => {
    const peersResponse: ELN.PeerResponse[] = [
      {
        nodeId: 'abcdef',
        state: 'CONNECTED',
        address: '1.1.1.1:9735',
        channels: 1,
      },
      {
        nodeId: 'hijklm',
        state: 'DISCONNECTED',
        channels: 2,
      },
    ];
    eclairApiMock.httpPost.mockResolvedValue(peersResponse);
    const peers = await eclairService.getPeers(node);
    expect(peers[0].pubkey).toEqual('abcdef');
    expect(peers[0].address).toEqual('1.1.1.1:9735');
    expect(peers[1].pubkey).toEqual('hijklm');
    expect(peers[1].address).toEqual('');
  });

  it('should connect to peers', async () => {
    const peerResponse = { uri: 'abcdef@1.1.1.1:9735' };
    eclairApiMock.httpPost.mockResolvedValueOnce([]); // peers
    eclairApiMock.httpPost.mockResolvedValue(peerResponse); // connect
    const rpcUrls = ['b@2.2.2.2:9735', 'c@3.3.3.3:9735'];
    await eclairService.connectPeers(node, rpcUrls);
    expect(eclairApiMock.httpPost).toHaveBeenCalledTimes(3);
    expect(eclairApiMock.httpPost).toHaveBeenCalledWith(node, 'connect', {
      uri: rpcUrls[0],
    });
    expect(eclairApiMock.httpPost).toHaveBeenCalledWith(node, 'connect', {
      uri: rpcUrls[1],
    });
  });

  it('should not throw an error when connecting peers', async () => {
    eclairApiMock.httpPost.mockResolvedValueOnce(['p@x.x.x.x:9735']); // peers
    eclairApiMock.httpPost.mockRejectedValue(new Error('test-error')); // connect
    const rpcUrls = ['b@2.2.2.2:9735', 'c@3.3.3.3:9735'];
    await expect(eclairService.connectPeers(node, rpcUrls)).resolves.not.toThrow();
  });

  it('should open a channel', async () => {
    eclairApiMock.httpPost.mockResolvedValueOnce(['p@x.x.x.x:9735']); // peers
    eclairApiMock.httpPost.mockResolvedValueOnce(undefined); // connect
    eclairApiMock.httpPost.mockResolvedValueOnce('txid'); // open
    const rpcUrl = 'abc@1.1.1.1:9735';
    const amountSats = '100000';
    const res = await eclairService.openChannel({
      from: node,
      toRpcUrl: rpcUrl,
      amount: amountSats,
      isPrivate: false,
    });
    expect(res.txid).toEqual('txid');
    expect(res.index).toEqual(0);
  });

  it('should open a private channel', async () => {
    eclairApiMock.httpPost.mockResolvedValueOnce(['p@x.x.x.x:9735']); // peers
    eclairApiMock.httpPost.mockResolvedValueOnce(undefined); // connect
    eclairApiMock.httpPost.mockResolvedValueOnce('txid'); // open
    const rpcUrl = 'abc@1.1.1.1:9735';
    const amountSats = '100000';
    const res = await eclairService.openChannel({
      from: node,
      toRpcUrl: rpcUrl,
      amount: amountSats,
      isPrivate: true,
    });
    expect(res.txid).toEqual('txid');
    expect(res.index).toEqual(0);
    expect(eclairApiMock.httpPost).toHaveBeenCalledWith(
      {
        backendName: 'backend1',
        docker: { command: '', image: '' },
        id: 2,
        implementation: 'eclair',
        name: 'carol',
        networkId: 1,
        ports: { p2p: 9937, rest: 8283 },
        status: 3,
        type: 'lightning',
        version: defaultRepoState.images.eclair.latest,
      },
      'open',
      {
        channelFlags: 0,
        fundingSatoshis: 100000,
        fundingFeeBudgetSatoshis: 50000,
        nodeId: 'abc',
      },
    );
  });

  it('should close a channel', async () => {
    eclairApiMock.httpPost.mockResolvedValueOnce('txid'); // close
    const res = await eclairService.closeChannel(node, 'chanId');
    expect(res).toEqual('txid');
  });

  it('should create an invoice', async () => {
    const createInvResponse: Partial<ELN.CreateInvoiceResponse> = {
      serialized: 'lnbc100xyz',
    };
    eclairApiMock.httpPost.mockResolvedValue(createInvResponse); // createinvoice
    const res = await eclairService.createInvoice(node, 100000);
    expect(res).toEqual('lnbc100xyz');
    expect(eclairApiMock.httpPost).toHaveBeenCalledWith(
      node,
      'createinvoice',
      expect.objectContaining({ description: `Payment to ${node.name}` }),
    );
    const res2 = await eclairService.createInvoice(node, 100000, 'test-memo');
    expect(res2).toEqual('lnbc100xyz');
    expect(eclairApiMock.httpPost).toHaveBeenCalledWith(
      node,
      'createinvoice',
      expect.objectContaining({ description: 'test-memo' }),
    );
  });

  it('should throw if decodeInvoice when called', async () => {
    await expect(eclairService.decodeInvoice(node)).rejects.toThrow(
      'decodeInvoice is not implemented for eclair nodes',
    );
  });

  describe('pay invoice', () => {
    const mockResponses = (v8: boolean) => {
      const payReq = {
        nodeId: 'abcdef',
        amount: 100000,
      };
      const sentInfoResponse = (type: string, failMode?: string) => [
        {
          id: 'invId',
          paymentRequest: v8 ? undefined : payReq,
          invoice: v8 ? payReq : undefined,
          status: {
            type,
            paymentPreimage: 'pre-image',
            failures:
              failMode === 'empty'
                ? []
                : failMode === 'msg'
                ? [
                    {
                      failureMessage: 'sent-error',
                    },
                  ]
                : undefined,
          },
        },
      ];

      eclairApiMock.httpPost.mockResolvedValueOnce('invId'); // payinvoice
      eclairApiMock.httpPost.mockResolvedValueOnce([]); // getsentinfo
      eclairApiMock.httpPost.mockResolvedValueOnce(sentInfoResponse('failed')); // getsentinfo
      eclairApiMock.httpPost.mockResolvedValueOnce(sentInfoResponse('failed', 'empty')); // getsentinfo
      eclairApiMock.httpPost.mockResolvedValueOnce(sentInfoResponse('failed', 'msg')); // getsentinfo
      eclairApiMock.httpPost.mockResolvedValueOnce(sentInfoResponse('sent')); // getsentinfo
      eclairApiMock.httpPost.mockResolvedValue(sentInfoResponse('sent')); // getsentinfo
    };

    it('should pay an invoice for < v0.8.0', async () => {
      mockResponses(false);
      const res = await eclairService.payInvoice(node, 'lnbc100xyz');
      expect(res.preimage).toEqual('pre-image');
      expect(res.amount).toEqual(100);
      expect(res.destination).toEqual('abcdef');
      // test payments with amount specified
      eclairService.payInvoice(node, 'lnbc100xyz', 1000);
      expect(eclairApiMock.httpPost).toHaveBeenCalledWith(
        node,
        'payinvoice',
        expect.objectContaining({
          amountMsat: 1000000,
        }),
      );
    });

    it('should pay an invoice for >= v0.8.0', async () => {
      mockResponses(true);
      const res = await eclairService.payInvoice(node, 'lnbc100xyz');
      expect(res.preimage).toEqual('pre-image');
      expect(res.amount).toEqual(100);
      expect(res.destination).toEqual('abcdef');
      // test payments with amount specified
      eclairService.payInvoice(node, 'lnbc100xyz', 1000);
      expect(eclairApiMock.httpPost).toHaveBeenCalledWith(
        node,
        'payinvoice',
        expect.objectContaining({
          amountMsat: 1000000,
        }),
      );
    });
  });

  describe('waitUntilOnline', () => {
    it('should wait successfully', async () => {
      eclairApiMock.httpPost.mockResolvedValue({ publicAddresses: [] });
      await expect(eclairService.waitUntilOnline(node)).resolves.not.toThrow();
      expect(eclairApiMock.httpPost).toHaveBeenCalledTimes(1);
    });

    it('should throw error if waiting fails', async () => {
      eclairApiMock.httpPost.mockRejectedValue(new Error('test-error'));
      await expect(eclairService.waitUntilOnline(node, 0.5, 1)).rejects.toThrow(
        'test-error',
      );
      expect(eclairApiMock.httpPost).toHaveBeenCalledTimes(7);
    });
  });

  describe('subscribeChannelEvents', () => {
    it('should successfully subscribe to channel events', async () => {
      const mockListener = {
        on: jest.fn(),
      } as unknown as ELN.EclairWebSocket;

      const mockCallback = jest.fn();

      jest.spyOn(eclairApi, 'getListener').mockReturnValue(mockListener);

      await eclairService.subscribeChannelEvents(node, mockCallback);

      // Simulate receiving messages of different types
      const messageHandlers = (mockListener.on as jest.Mock).mock.calls;
      for (const [eventName, handler] of messageHandlers) {
        if (eventName === 'message') {
          // Simulate message of type 'channel-created'
          handler(JSON.stringify({ type: 'channel-created' }));

          // Expect callback to be called with { type: 'Pending' }
          expect(mockCallback).toHaveBeenCalledWith({ type: 'Pending' });

          // Simulate message of type 'channel-opened'
          handler(JSON.stringify({ type: 'channel-opened' }));

          // Expect callback to be called with { type: 'Open' }
          expect(mockCallback).toHaveBeenCalledWith({ type: 'Open' });

          // Simulate message of type 'channel-closed'
          handler(JSON.stringify({ type: 'channel-closed' }));

          // Expect callback to be called with { type: 'Closed' }
          expect(mockCallback).toHaveBeenCalledWith({ type: 'Closed' });

          // Simulate message of unknown type
          handler(JSON.stringify({ type: 'unknown-type' }));

          // Expect callback to be called with { type: 'Unknown' }
          expect(mockCallback).toHaveBeenCalledWith({ type: 'Unknown' });
        }
      }
      expect(eclairApi.getListener).toHaveBeenCalledWith(node);
    });

    it('should throw an error when the implementation is not eclair', async () => {
      const lndNode = getNetwork().nodes.lightning[0];
      const mockCallback = jest.fn();
      await expect(
        eclairService.subscribeChannelEvents(lndNode, mockCallback),
      ).rejects.toThrow("EclairService cannot be used for 'LND' nodes");
    });

    it('should add listener to node', async () => {
      eclairService.addListenerToNode(node);
      expect(eclairApi.setupListener).toHaveBeenCalled();
    });

    it('should remove Listener', async () => {
      eclairService.removeListener(node);
      expect(eclairApi.removeListener).toHaveBeenCalled();
    });
  });
});
