import React from 'react';
import { usePrefixedTranslation } from 'hooks';
import { Network } from 'types';
import SidebarCard from '../SidebarCard';
import NetworkDesignerCard from './cards/NetworkDesignerCard';
import ActivityDesignerCard from './cards/ActivityDesignerCard';

interface Props {
  network: Network;
}

const DefaultSidebar: React.FC<Props> = ({ network }) => {
  const [designerType, setDesignerType] = React.useState('network');
  const { l } = usePrefixedTranslation('cmps.designer.default.DefaultSidebar');

  const tabHeaders = [
    { key: 'network', tab: l('networkTitle') },
    { key: 'activity', tab: l('activityTitle') },
  ];

  const tabContents: Record<string, React.ReactNode> = {
    network: <NetworkDesignerCard />,
    activity: (
      <ActivityDesignerCard visible={designerType === 'activity'} network={network} />
    ),
  };

  return (
    <SidebarCard
      tabList={tabHeaders}
      activeTabKey={designerType}
      onTabChange={setDesignerType}
    >
      {tabContents[designerType]}
    </SidebarCard>
  );
};

export default DefaultSidebar;
