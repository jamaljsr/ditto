import React from 'react';
import { Alert } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import { BitcoinNode, Status } from 'shared/types';
import { useStoreState } from 'store';
import { dockerConfigs } from 'utils/constants';
import { ellipseInner } from 'utils/strings';
import { CopyIcon, DetailsList, StatusBadge } from 'components/common';
import { DetailValues } from 'components/common/DetailsList';
import { getNetworkBackendId } from 'utils/network';

interface Props {
  node: BitcoinNode;
}

const InfoTab: React.FC<Props> = ({ node }) => {
  const { l } = usePrefixedTranslation('cmps.designer.bitcoind.InfoTab');
  const { nodes } = useStoreState(s => s.bitcoin);
  const details: DetailValues = [
    { label: l('nodeType'), value: node.type },
    { label: l('implementation'), value: dockerConfigs[node.implementation].name },
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

  const nodeState = nodes[getNetworkBackendId(node)];
  if (
    node.status === Status.Started &&
    nodeState &&
    nodeState.chainInfo &&
    nodeState.walletInfo
  ) {
    const { chainInfo, walletInfo } = nodeState;
    details.push(
      { label: l('spendableBalance'), value: `${walletInfo.balance} BTC` },
      { label: l('immatureBalance'), value: `${walletInfo.immature_balance} BTC` },
      { label: l('blockHeight'), value: chainInfo.blocks },
      {
        label: l('blockHash'),
        value: (
          <CopyIcon
            label={l('blockHash')}
            value={chainInfo.bestblockhash}
            text={ellipseInner(chainInfo.bestblockhash)}
          />
        ),
      },
    );
  }

  return (
    <>
      {node.status === Status.Error && node.errorMsg && (
        <Alert
          type="error"
          message={l('startError')}
          description={node.errorMsg}
          closable={false}
          showIcon
        />
      )}
      <DetailsList details={details} />
    </>
  );
};

export default InfoTab;
