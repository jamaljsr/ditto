import React, { ReactElement } from 'react';
import { INode } from '@mrblenny/react-flow-chart';
import { Dropdown, MenuProps } from 'antd';
import { BitcoinNode, LightningNode, Status, TapNode } from 'shared/types';
import { useStoreState } from 'store';
import {
  AdvancedOptionsButton,
  RemoveNode,
  RestartNode,
  RenameNodeButton,
} from 'components/common';
import { ViewLogsButton } from 'components/dockerLogs';
import { OpenTerminalButton } from 'components/terminal';
import SendOnChainButton from './bitcoin/actions/SendOnChainButton';
import { OpenChannelButtons, PaymentButtons } from './lightning/actions';
import { MintAssetButton, NewAddressButton, SendAssetButton } from './tap/actions';

const addItemIf = (
  key: string,
  cmp: ReactElement,
  condition?: boolean,
): { key: string; label: ReactElement }[] => {
  if (condition === false) return [];
  return [{ key, label: cmp }];
};

interface Props {
  node: INode;
  children: ReactElement;
}

const NodeContextMenu: React.FC<Props> = ({ node: { id }, children }) => {
  const { activeId } = useStoreState(s => s.designer);
  const networks = useStoreState(s => s.network.networks);
  const network = networks.find(n => n.id === activeId);

  // don't add a context menu if there is no network found
  if (!network) return <>{children}</>;

  // find the network node by name
  const { bitcoin, lightning, tap } = network.nodes;
  const node = [...bitcoin, ...lightning, ...tap].find(n => n.name === id);
  // don't add a context menu if the node is not valid
  if (!node) return <>{children}</>;

  const isTap = node.type === 'tap' || node.implementation === 'litd';
  const isLN = node.type === 'lightning';
  const isBackend = node.type === 'bitcoin';
  const isStarted = node.status === Status.Started;

  let items: MenuProps['items'] = [];
  items = items.concat(
    addItemIf(
      'inv',
      <PaymentButtons menuType="create" node={node as LightningNode} />,
      isStarted && isLN,
    ),
    addItemIf(
      'pay',
      <PaymentButtons menuType="pay" node={node as LightningNode} />,
      isStarted && isLN,
    ),
    addItemIf(
      'outgoing',
      <OpenChannelButtons menuType="outgoing" node={node as LightningNode} />,
      isStarted && isLN,
    ),
    addItemIf(
      'incoming',
      <OpenChannelButtons menuType="incoming" node={node as LightningNode} />,
      isStarted && isLN,
    ),
    addItemIf(
      'sendAsset',
      <SendAssetButton type={'menu'} node={node as TapNode} />,
      isStarted && isTap,
    ),
    addItemIf(
      'newAddress',
      <NewAddressButton type={'menu'} node={node as TapNode} />,
      isStarted && isTap,
    ),
    addItemIf(
      'mintAsset',
      <MintAssetButton type={'menu'} node={node as TapNode} />,
      isStarted && isTap,
    ),
    addItemIf(
      'sendonchain',
      <SendOnChainButton type="menu" node={node as BitcoinNode} />,
      isStarted && isBackend,
    ),
    addItemIf('terminal', <OpenTerminalButton type="menu" node={node} />, isStarted),
    isStarted ? [{ type: 'divider' }] : [],
    addItemIf(
      'start',
      <RestartNode menuType="start" node={node} />,
      [Status.Stopped, Status.Error].includes(node.status),
    ),
    addItemIf(
      'stop',
      <RestartNode menuType="stop" node={node} />,
      [Status.Started].includes(node.status),
    ),
    addItemIf(
      'logs',
      <ViewLogsButton type="menu" node={node} />,
      [Status.Starting, Status.Started, Status.Error].includes(node.status),
    ),
    addItemIf('rename', <RenameNodeButton type="menu" node={node} />),
    addItemIf('options', <AdvancedOptionsButton type="menu" node={node} />),
    addItemIf('remove', <RemoveNode type="menu" node={node} />),
  );

  return (
    <Dropdown
      menu={{ items }}
      trigger={['contextMenu']}
      overlayClassName="polar-context-menu"
    >
      {children}
    </Dropdown>
  );
};

export default NodeContextMenu;
