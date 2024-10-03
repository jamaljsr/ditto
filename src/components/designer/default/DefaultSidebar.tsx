import React from 'react';
import { usePrefixedTranslation } from 'hooks';
import SidebarCard from '../SidebarCard';
import NetworkDesignerCard from './cards/NetworkDesignerCard';
import ActivityDesignerCard from './cards/ActivityDesignerCard';

const DefaultSidebar: React.FC = () => {
  const [designerType, setDesignerType] = React.useState('network');
  const { l } = usePrefixedTranslation('cmps.designer.default.DefaultSidebar');

  const tabHeaders = [
    { key: 'network', tab: l('networkTitle') },
    { key: 'activity', tab: l('activityTitle') },
  ];

  const tabContents: Record<string, React.ReactNode> = {
    network: <NetworkDesignerCard />,
    activity: <ActivityDesignerCard />,
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
