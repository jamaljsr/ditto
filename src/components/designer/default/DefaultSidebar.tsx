import React, { ReactNode } from 'react';
import styled from '@emotion/styled';
import { Button } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import { NodeImplementation } from 'shared/types';
import { useStoreActions, useStoreState } from 'store';
import { Network } from 'types';
import { dockerConfigs } from 'utils/constants';
import { getPolarPlatform } from 'utils/system';
import SidebarCard from '../SidebarCard';
import ActivityDesignerCard from './cards/ActivityDesignerCard';
import NetworkDesignerCard from './cards/NetworkDesignerCard';

const Styled = {
  Title: styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    > p {
      margin: 0;
      font-size: 16px;
    }
  `,
  DesignerButtons: styled(Button.Group)`
    display: flex;
    justify-content: center;
    column-gap: 1px;
    align-items: center;
    height: 40px;
    border-radius: 4px;
    cursor: pointer;
  `,
  Button: styled(Button)<{ active: boolean }>`
    padding: 0;
    margin: 0;
    width: 40px;
    height: 40px;
    color: ${props => (props.active ? '#d46b08' : 'gray')};
    background: ${props => (props.active ? '#000' : '')};
    border: ${props => (props.active ? '1px solid #d46b08' : '')};

    &:hover {
      background: #d46b08;
      color: #f7f2f2f2;
    }

    &:focus {
      background: ${props => (props.active ? '#000' : '#d46b08')};
      color: ${props => (props.active ? '#f7f2f2f2' : '#000')};
    }
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
  network: Network;
}

const DefaultSidebar: React.FC<Props> = ({ network }) => {
  const [designerType, setDesignerType] = React.useState('network');
  const { l } = usePrefixedTranslation('cmps.designer.default.DefaultSidebar');

  const { updateSettings } = useStoreActions(s => s.app);
  const { showImageUpdates } = useStoreActions(s => s.modals);
  const { settings, dockerRepoState } = useStoreState(s => s.app);
  const showAll = settings.showAllNodeVersions;
  const currPlatform = getPolarPlatform();

  const toggleVersions = () => updateSettings({ showAllNodeVersions: !showAll });
  const toggleModal = () => showImageUpdates();

  const nodes: Node[] = [];

  const tabHeaders = [
    { key: 'network', tab: l('networkTitle') },
    { key: 'activity', tab: l('activityTitle') },
  ];
  const tabContents: Record<string, ReactNode> = {
    network: (
      <NetworkDesignerCard
        nodes={nodes}
        showAll={showAll}
        toggleVersions={toggleVersions}
        toggleModal={toggleModal}
        visible={designerType === 'network'}
      />
    ),
    activity: (
      <ActivityDesignerCard visible={designerType === 'activity'} network={network} />
    ),
  };

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
      latest: true,
      customId: image.id,
    });
  });

  // add managed nodes
  Object.entries(dockerRepoState.images).forEach(([type, entry]) => {
    const { name, logo, platforms } = dockerConfigs[type as NodeImplementation];
    if (!platforms.includes(currPlatform)) return;
    entry.versions.forEach(version => {
      const label = `${name} v${version}`;
      const latest = version === entry.latest;
      nodes.push({ label, logo, version, type, latest });
    });
  });

  return (
    <SidebarCard
      tabList={tabHeaders}
      activeTabKey={designerType}
      onTabChange={setDesignerType}
    >
      <Styled.Title>
        {designerType === 'network' ? (
          <p>{l('networkTitle')}</p>
        ) : (
          <p>{l('activityTitle')}</p>
        )}
      </Styled.Title>
      {tabContents[designerType]}
    </SidebarCard>
  );
};

export default DefaultSidebar;
