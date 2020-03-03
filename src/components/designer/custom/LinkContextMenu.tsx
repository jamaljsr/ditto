import React, { ReactNode } from 'react';
import { ILink } from '@mrblenny/react-flow-chart';
import { Dropdown, Menu } from 'antd';
import { useStoreState } from 'store';
import { LinkProperties } from 'utils/chart';
import ChangeBackendButton from '../link/ChangeBackendButton';
import CloseChannelButton from '../link/CloseChannelButton';

interface Props {
  link: ILink;
}

const LinkContextMenu: React.FC<Props> = ({ link, children }) => {
  const { activeId } = useStoreState(s => s.designer);
  const network = useStoreState(s => s.network.networkById(activeId));
  const { type, channelPoint } = (link.properties as LinkProperties) || {};

  let menuItem: ReactNode;
  if (type === 'open-channel') {
    // find the lightning node by name
    const node = network.nodes.lightning.find(n => n.name === link.from.nodeId);
    // don't add a context menu if the node is not valid
    if (node) {
      menuItem = (
        <CloseChannelButton type="menu" node={node} channelPoint={channelPoint} />
      );
    }
  } else if (type === 'backend') {
    menuItem = (
      <ChangeBackendButton
        type="menu"
        lnName={link.from.nodeId}
        backendName={link.to.nodeId as string}
      />
    );
  }

  // don't add a context menu if there is no menu item
  if (!menuItem) return <>{children}</>;

  return (
    <Dropdown
      overlay={
        <Menu style={{ width: 200 }}>
          <Menu.Item>{menuItem}</Menu.Item>
        </Menu>
      }
      trigger={['contextMenu']}
    >
      {children}
    </Dropdown>
  );
};

export default LinkContextMenu;
