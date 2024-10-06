import React from 'react';
import { SwapOutlined } from '@ant-design/icons';
import styled from '@emotion/styled';
import { Button, Tooltip } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import { useStoreActions, useStoreState } from 'store';
import { Network } from 'types';

const Styled = {
  Button: styled(Button)`
    margin-left: 8px;
  `,
};

interface Props {
  network: Network;
}

const BalanceChannelsButton: React.FC<Props> = ({ network }) => {
  const { l } = usePrefixedTranslation('cmps.common.BalanceChannelsButton');
  const { showBalanceChannels } = useStoreActions(s => s.modals);
  const { resetChannelsInfo } = useStoreActions(s => s.lightning);
  const { channelsInfo } = useStoreState(s => s.lightning);

  const showModal = async () => {
    await showBalanceChannels();
    await resetChannelsInfo(network);
  };

  return (
    channelsInfo.length > 0 && (
      <Tooltip title={l('btn')}>
        <Styled.Button onClick={showModal}>
          <SwapOutlined />
        </Styled.Button>
      </Tooltip>
    )
  );
};

export default BalanceChannelsButton;
