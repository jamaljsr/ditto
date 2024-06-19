import React from 'react';
import { CloudSyncOutlined } from '@ant-design/icons';
import styled from '@emotion/styled';
import { Button, Switch } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import DraggableNode from '../DraggableNode';

const Styled = {
  AddNodes: styled.h3`
    margin-top: 30px;
  `,
  AddDesc: styled.p`
    opacity: 0.5;
    font-size: 12px;
  `,
  Toggle: styled.div`
    display: flex;
    justify-content: space-between;
    margin: 10px 5px;
  `,
  UpdatesButton: styled(Button)`
    margin-top: 30px;
  `,
};

interface Node {
  label: string;
  logo: string;
  version: string;
  type: string;
  latest: boolean;
  customId?: string;
}

interface Props {
  nodes: Node[];
  showAll: boolean;
  toggleVersions: () => void;
  toggleModal: () => void;
  visible: boolean;
}

const NetworkDesignerCard: React.FC<Props> = ({
  nodes,
  showAll,
  toggleVersions,
  toggleModal,
  visible,
}) => {
  const { l } = usePrefixedTranslation('cmps.designer.default.cards.NetworkDesignerCard');
  if (!visible) return null;
  return (
    <>
      <div>
        <p>{l('mainDesc')}</p>
      </div>
      <Styled.AddNodes>{l('addNodesTitle')}</Styled.AddNodes>
      <Styled.AddDesc>{l('addNodesDesc')}</Styled.AddDesc>
      <Styled.Toggle>
        <span>{l('showVersions')}</span>
        <Switch checked={showAll} onClick={toggleVersions} />
      </Styled.Toggle>
      {nodes.map(({ label, logo, version, latest, type, customId }) => (
        <DraggableNode
          key={label}
          label={label}
          desc={showAll && latest ? 'latest' : ''}
          icon={logo}
          properties={{ type, version, customId }}
          visible={showAll || latest}
        />
      ))}
      <Styled.UpdatesButton
        type="link"
        block
        icon={<CloudSyncOutlined />}
        onClick={toggleModal}
      >
        {l('checkUpdates')}
      </Styled.UpdatesButton>
    </>
  );
};

export default NetworkDesignerCard;
