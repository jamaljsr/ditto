import React, { useMemo } from 'react';
import { IChart } from '@mrblenny/react-flow-chart';
import { BitcoindNode, LightningNode, TapNode } from 'shared/types';
import { Network } from 'types';
import BitcoindDetails from './bitcoin/BitcoinDetails';
import DefaultSidebar from './default/DefaultSidebar';
import LightningDetails from './lightning/LightningDetails';
import LinkDetails from './link/LinkDetails';
import TapDetails from './tap/TapDetails';

interface Props {
  network: Network;
  chart: IChart;
}

const Sidebar: React.FC<Props> = ({ network, chart }) => {
  const cmp = useMemo(() => {
    const { id, type } = chart.selected;

    if (type === 'node') {
      const { bitcoin, lightning, tap } = network.nodes;
      const node = [...bitcoin, ...lightning, ...tap].find(n => n.name === id);
      if (node && node.implementation === 'bitcoind') {
        return <BitcoindDetails node={node as BitcoindNode} />;
      } else if (node && node.type === 'lightning') {
        return <LightningDetails node={node as LightningNode} />;
      } else if (node && node.type === 'tap') {
        return <TapDetails node={node as TapNode} />;
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
