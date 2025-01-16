import React, { useCallback } from 'react';
import { LinkOutlined } from '@ant-design/icons';
import { Button, Form } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import { BitcoinNode } from 'shared/types';
import { useStoreActions } from 'store';

interface Props {
  node: BitcoinNode;
  type?: 'button' | 'menu';
}

const SendOnChainButton: React.FC<Props> = ({ node, type }) => {
  const { l } = usePrefixedTranslation('cmps.designer.bitcoind.SendOnChainButton');
  const { showSendOnChain } = useStoreActions(s => s.modals);
  const handleClick = useCallback(
    () => showSendOnChain({ backendName: node.name }),
    [node],
  );

  // render a menu item inside of the NodeContextMenu
  if (type === 'menu') {
    return (
      <div onClick={handleClick}>
        <LinkOutlined />
        <span>{l('menu')}</span>
      </div>
    );
  }

  return (
    <Form.Item label={l('title')} colon={false}>
      <Button icon={<LinkOutlined />} block onClick={handleClick}>
        {l('btn')}
      </Button>
    </Form.Item>
  );
};

export default SendOnChainButton;
