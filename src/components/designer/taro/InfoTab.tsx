import React from 'react';
import { Alert } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import { Status, TaroNode } from 'shared/types';
import { TaroBalance } from 'lib/taro/types';
import { useStoreState } from 'store';
import { dockerConfigs } from 'utils/constants';
import { StatusBadge } from 'components/common';
import DetailsList, { DetailValues } from 'components/common/DetailsList';
import AssetsList from './info/AssetsList';

interface Props {
  node: TaroNode;
}

const InfoTab: React.FC<Props> = ({ node }) => {
  const { l } = usePrefixedTranslation('cmps.designer.taro.InfoTab');
  const { nodes } = useStoreState(s => s.taro);
  const details: DetailValues = [
    { label: l('nodeType'), value: node.type },
    { label: l('implementation'), value: dockerConfigs[node.implementation]?.name },
    { label: l('version'), value: node.docker.image ? 'custom' : `v${node.version}` },
    {
      label: l('status'),
      value: (
        <StatusBadge
          status={node.status}
          text={l(`enums.status.${Status[node.status]}`)}
        />
      ),
    },
  ];

  if (node.docker.image) {
    details.splice(3, 0, { label: l('customImage'), value: node.docker.image });
  }

  let balances: TaroBalance[] | undefined = undefined;
  const nodeState = nodes[node.name];
  if (node.status === Status.Started && nodeState) {
    if (nodeState.balances) {
      balances = nodeState.balances;
    }
  }
  const title = balances && balances.length > 0 ? l('assets') : l('noassets');

  return (
    <>
      {node.status === Status.Error && node.errorMsg && (
        <Alert
          type="error"
          message={l('startError', { implementation: node.implementation })}
          description={node.errorMsg}
          closable={false}
          showIcon
        />
      )}
      <DetailsList details={details} />
      {balances && <AssetsList title={title} balances={balances} nodeName={node.name} />}
    </>
  );
};

export default InfoTab;
