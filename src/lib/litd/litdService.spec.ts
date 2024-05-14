import * as LITD from '@lightningpolar/litd-api';
import { defaultLitdListSessions, defaultLitdSession, defaultLitdStatus } from 'shared';
import { LitdNode } from 'shared/types';
import { defaultRepoState } from 'utils/constants';
import { createNetwork } from 'utils/network';
import { testManagedImages } from 'utils/tests';
import litdProxyClient from './litdProxyClient';
import litdService from './litdService';

jest.mock('electron-log');
jest.mock('./litdProxyClient');

describe('LitdService', () => {
  const network = createNetwork({
    id: 1,
    name: 'my network',
    lndNodes: 0,
    clightningNodes: 0,
    eclairNodes: 0,
    bitcoindNodes: 1,
    tapdNodes: 0,
    litdNodes: 1,
    repoState: defaultRepoState,
    managedImages: testManagedImages,
    customImages: [],
  });
  const node = network.nodes.lightning[0] as LitdNode;

  it('should get status', async () => {
    const status = {
      subServers: {
        lit: { disabled: false, running: true, error: '', customStatus: '' },
      },
    };
    const apiResponse = defaultLitdStatus(status);
    const expected = defaultLitdStatus(status);
    litdProxyClient.status = jest.fn().mockResolvedValue(apiResponse);
    const actual = await litdService.status(node);
    expect(actual).toEqual(expected);
  });

  it('should get LNC sessions', async () => {
    const apiResponse = defaultLitdListSessions({
      sessions: [defaultLitdSession({ label: 'test' })],
    });
    const expected = [expect.objectContaining({ label: 'test' })];
    litdProxyClient.listSessions = jest.fn().mockResolvedValue(apiResponse);
    const actual = await litdService.listSessions(node);
    expect(actual).toEqual(expected);
  });

  it.each([
    [LITD.SessionState.STATE_CREATED, 'Created'],
    [LITD.SessionState.STATE_IN_USE, 'In Use'],
    [LITD.SessionState.STATE_REVOKED, 'Revoked'],
    [LITD.SessionState.STATE_EXPIRED, 'Expired'],
  ])('should map session state %s', async (litdState, state) => {
    const apiResponse = defaultLitdListSessions({
      sessions: [defaultLitdSession({ label: 'test', sessionState: litdState })],
    });
    litdProxyClient.listSessions = jest.fn().mockResolvedValue(apiResponse);
    const expected = [expect.objectContaining({ state })];
    const actual = await litdService.listSessions(node);
    expect(actual).toEqual(expected);
  });

  it.each([
    [LITD.SessionType.TYPE_MACAROON_READONLY, 'Read Only'],
    [LITD.SessionType.TYPE_MACAROON_ADMIN, 'Admin'],
    [LITD.SessionType.TYPE_MACAROON_CUSTOM, 'Custom'],
    [LITD.SessionType.TYPE_UI_PASSWORD, 'UI Password'],
    [LITD.SessionType.TYPE_AUTOPILOT, 'Autopilot'],
    [LITD.SessionType.TYPE_MACAROON_ACCOUNT, 'Account'],
  ])('should map session state %s', async (litdType, type) => {
    const apiResponse = defaultLitdListSessions({
      sessions: [defaultLitdSession({ label: 'test', sessionType: litdType })],
    });
    litdProxyClient.listSessions = jest.fn().mockResolvedValue(apiResponse);
    const expected = [expect.objectContaining({ type })];
    const actual = await litdService.listSessions(node);
    expect(actual).toEqual(expected);
  });

  it('should add Admin LNC session', async () => {
    const apiResponse = {
      session: defaultLitdSession({ label: 'test' }),
    };
    const expected = expect.objectContaining({ label: 'test' });
    litdProxyClient.addSession = jest.fn().mockResolvedValue(apiResponse);
    const actual = await litdService.addSession(node, 'test', 'Admin', 123456);
    expect(actual).toEqual(expected);
    expect(litdProxyClient.addSession).toHaveBeenCalledWith(node, {
      label: 'test',
      sessionType: 'TYPE_MACAROON_ADMIN',
      expiryTimestampSeconds: 123,
      mailboxServerAddr: undefined,
      devServer: true,
    });
  });

  it('should add Read-only LNC session', async () => {
    const apiResponse = {
      session: defaultLitdSession({ label: 'test' }),
    };
    const expected = expect.objectContaining({ label: 'test' });
    litdProxyClient.addSession = jest.fn().mockResolvedValue(apiResponse);
    const actual = await litdService.addSession(node, 'test', 'Read Only', 123456);
    expect(actual).toEqual(expected);
    expect(litdProxyClient.addSession).toHaveBeenCalledWith(node, {
      label: 'test',
      sessionType: 'TYPE_MACAROON_READONLY',
      expiryTimestampSeconds: 123,
      mailboxServerAddr: undefined,
      devServer: true,
    });
  });

  it('should revoke an LNC session', async () => {
    await expect(litdService.revokeSession(node, 'abcd')).resolves.not.toThrow();
  });
});
