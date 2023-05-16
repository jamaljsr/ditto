import React, { useMemo } from 'react';
import { IChart } from '@mrblenny/react-flow-chart';
import { LightningNode, TaroNode } from 'shared/types';
import { Network } from 'types';
import BitcoindDetails from './bitcoind/BitcoindDetails';
import DefaultSidebar from './default/DefaultSidebar';
import LightningDetails from './lightning/LightningDetails';
import LinkDetails from './link/LinkDetails';
import TaroDetails from './taro/TaroDetails';

interface Props {
  network: Network;
  chart: IChart;
}

const Sidebar: React.FC<Props> = ({ network, chart }) => {
  const cmp = useMemo(() => {
    const { id, type } = chart.selected;

    if (type === 'node') {
      const { bitcoin, lightning, taro } = network.nodes;
      const node = [...bitcoin, ...lightning, ...taro].find(n => n.name === id);
      if (node && node.implementation === 'bitcoind') {
        return <BitcoindDetails node={node} />;
      } else if (node && node.type === 'lightning') {
        return <LightningDetails node={node as LightningNode} />;
      } else if (node && node.type === 'taro') {
        return <TaroDetails node={node as TaroNode} />;
      }
    } else if (type === 'link' && id) {
      const link = chart.links[id];
      return link && <LinkDetails link={link} network={network} />;
    }

    return <DefaultSidebar />;
  }, [network, chart.selected, chart.links]);

  return <>{cmp}</>;
};

export default Sidebar;
