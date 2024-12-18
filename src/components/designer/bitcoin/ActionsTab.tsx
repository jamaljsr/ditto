import React from 'react';
import styled from '@emotion/styled';
import { Form } from 'antd';
import { BitcoinNode, Status } from 'shared/types';
import {
  AdvancedOptionsButton,
  RemoveNode,
  RestartNode,
  RenameNodeButton,
} from 'components/common';
import { ViewLogsButton } from 'components/dockerLogs';
import { OpenTerminalButton } from 'components/terminal';
import MineBlocksInput from './actions/MineBlocksInput';
import SendOnChainButton from './actions/SendOnChainButton';

const Styled = {
  Spacer: styled.div`
    height: 48px;
  `,
};

interface Props {
  node: BitcoinNode;
}

const ActionsTab: React.FC<Props> = ({ node }) => {
  return (
    <Form labelCol={{ span: 24 }}>
      {node.status === Status.Started && (
        <>
          <MineBlocksInput node={node} />
          <SendOnChainButton node={node} />
          <OpenTerminalButton node={node} />
          <ViewLogsButton node={node} />
          <Styled.Spacer />
        </>
      )}
      <RestartNode node={node} />
      <RenameNodeButton node={node} />
      <AdvancedOptionsButton node={node} />
      <RemoveNode node={node} />
    </Form>
  );
};

export default ActionsTab;
