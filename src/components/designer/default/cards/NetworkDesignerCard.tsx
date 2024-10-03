import React from 'react';
import { CloudSyncOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import styled from '@emotion/styled';
import { Button } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import { NodeImplementation } from 'shared/types';
import { useStoreActions, useStoreState } from 'store';
import { dockerConfigs } from 'utils/constants';
import { getPolarPlatform } from 'utils/system';
import DraggableNode from './../DraggableNode';

const Styled = {
  AddNodes: styled.h3`
    margin-top: 30px;
  `,
  AddDesc: styled.p`
    opacity: 0.5;
    font-size: 12px;
  `,
  Nodes: styled.div`
    display: flex;
    flex-direction: column;
  `,
  NodeRow: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
  Arrow: styled.span<{ visible?: boolean; collapsible?: boolean }>`
    margin-top: ${props => (props.visible ? 20 : 0)}px;
    width: 25px;
    text-align: right;

    > .anticon {
      opacity: 0.4;
      display: ${props => (props.collapsible ? 'inline' : 'none')};
      cursor: pointer;

      &:hover {
        opacity: 1;
      }
    }
  `,
  UpdatesButton: styled(Button)`
    margin-top: 30px;
  `,
};

const NetworkDesignerCard: React.FC = () => {
  const { l } = usePrefixedTranslation('cmps.designer.default.cards.NetworkDesignerCard');

  const { showImageUpdates } = useStoreActions(s => s.modals);
  const { settings, dockerRepoState } = useStoreState(s => s.app);
  const currPlatform = getPolarPlatform();

  const [expanded, setExpanded] = React.useState<NodeImplementation[]>([]);

  const toggleExpanded = (type: NodeImplementation) => {
    if (expanded.includes(type)) {
      setExpanded(expanded.filter(t => t !== type));
    } else {
      setExpanded([...expanded, type]);
    }
  };

  const toggleModal = () => showImageUpdates();

  const nodes: {
    label: string;
    logo: string;
    version: string;
    type: NodeImplementation;
    collapsible: boolean;
    visible: boolean;
    customId?: string;
  }[] = [];

  // add custom nodes
  settings.nodeImages.custom.forEach(image => {
    const { logo, platforms } = dockerConfigs[image.implementation];
    const { latest } = dockerRepoState.images[image.implementation];
    if (!platforms.includes(currPlatform)) return;
    nodes.push({
      label: image.name,
      logo,
      version: latest,
      type: image.implementation,
      collapsible: false,
      customId: image.id,
      visible: true,
    });
  });

  // add managed nodes
  Object.entries(dockerRepoState.images).forEach(([key, entry]) => {
    const type = key as NodeImplementation;
    const { name, logo, platforms } = dockerConfigs[type as NodeImplementation];
    if (!platforms.includes(currPlatform)) return;
    if (!entry.latest) return;

    nodes.push({
      label: `${name} v${entry.latest}`,
      logo,
      version: entry.latest,
      type,
      collapsible: entry.versions.length > 1,
      visible: true,
    });
    entry.versions
      .filter(v => v != entry.latest)
      .forEach(version => {
        const label = `${name} v${version}`;
        const collapsible = false;
        const visible = expanded.includes(type);
        nodes.push({ label, logo, version, collapsible, visible, type });
      });
  });

  return (
    <div>
      <p>{l('mainDesc')}</p>
      <Styled.AddNodes>{l('addNodesTitle')}</Styled.AddNodes>
      <Styled.AddDesc>{l('addNodesDesc')}</Styled.AddDesc>
      <Styled.Nodes>
        {nodes.map(({ label, logo, version, type, collapsible, visible, customId }) => (
          <Styled.NodeRow key={label}>
            <DraggableNode
              key={label}
              label={label}
              icon={logo}
              properties={{ type, version, customId }}
              visible={visible}
            />
            <Styled.Arrow visible={visible} collapsible={collapsible}>
              {expanded.includes(type) ? (
                <UpOutlined onClick={() => toggleExpanded(type)} />
              ) : (
                <DownOutlined onClick={() => toggleExpanded(type)} />
              )}
            </Styled.Arrow>
          </Styled.NodeRow>
        ))}
      </Styled.Nodes>
      <Styled.UpdatesButton
        type="link"
        block
        icon={<CloudSyncOutlined />}
        onClick={toggleModal}
      >
        {l('checkUpdates')}
      </Styled.UpdatesButton>
    </div>
  );
};

export default NetworkDesignerCard;
