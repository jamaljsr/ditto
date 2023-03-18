import React, { useCallback } from 'react';
import { UnorderedListOutlined } from '@ant-design/icons';
import styled from '@emotion/styled';
import { Button, Divider, Space } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import { TaroBalance } from 'lib/taro/types';
import { useStoreActions } from 'store';
import { format } from 'utils/units';
import DetailsList, { DetailValues } from 'components/common/DetailsList';
import AssetInfoDrawer from './AssetInfoDrawer';

const Styled = {
  Wrapper: styled.div``,
  Empty: styled.p`
    text-align: center;
  `,
};

interface Props {
  title: string;
  balances: TaroBalance[];
  nodeName: string;
}

const AssetsList: React.FC<Props> = ({ title, balances, nodeName }) => {
  const { l } = usePrefixedTranslation('cmps.designer.taro.AssetsList');
  const { showAssetInfo } = useStoreActions(s => s.modals);

  const handleClick = useCallback(
    (assetId: string) => () => showAssetInfo({ assetId, nodeName }),
    [nodeName],
  );

  const assetDetails: DetailValues = [];
  balances
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(asset => {
      assetDetails.push({
        label: asset.name,
        value: (
          <Space>
            {format(asset.balance)}
            <Button
              type="text"
              icon={<UnorderedListOutlined />}
              onClick={handleClick(asset.id)}
            />
          </Space>
        ),
      });
    });

  const { Wrapper } = Styled;
  return (
    <Wrapper>
      <Divider>{title}</Divider>
      {balances && balances.length > 0 ? (
        <DetailsList details={assetDetails} />
      ) : (
        <Styled.Empty>{l('noAssets')}</Styled.Empty>
      )}
      <AssetInfoDrawer />
    </Wrapper>
  );
};

export default AssetsList;
