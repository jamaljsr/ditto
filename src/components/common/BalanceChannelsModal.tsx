import React from 'react';
import { PercentageOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Col, Modal, Row, Slider } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import { useStoreActions, useStoreState } from 'store';
import { ChannelInfo, Network } from 'types';
import { format } from 'utils/units';
import styled from '@emotion/styled';

interface Props {
  network: Network;
}

const Styled = {
  Button: styled(Button)`
    width: 100%;
  `,
};

const BalanceChannelsModal: React.FC<Props> = ({ network }) => {
  const { l } = usePrefixedTranslation('cmps.common.BalanceChannelsModal');
  const { channelsInfo } = useStoreState(s => s.lightning);
  const { visible } = useStoreState(s => s.modals.balanceChannels);
  const { hideBalanceChannels } = useStoreActions(s => s.modals);
  const {
    resetChannelsInfo,
    manualBalanceChannelsInfo,
    autoBalanceChannelsInfo,
    updateBalanceOfChannels,
  } = useStoreActions(s => s.lightning);

  return (
    <Modal
      title="Balance Channels"
      open={visible}
      okText={l('update')}
      cancelText={l('close')}
      onOk={() => updateBalanceOfChannels(network)}
      onCancel={() => hideBalanceChannels()}
    >
      {/* sliders */}
      {channelsInfo.map((channel: ChannelInfo, index: number) => {
        const { to, from, id, remoteBalance, localBalance, nextLocalBalance } = channel;
        const total = Number(remoteBalance) + Number(localBalance);
        return (
          <div key={id}>
            <Row>
              <Col span={12}>
                {from}
                <br />
                {format(nextLocalBalance)}
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                {to}
                <br />
                {format(total - nextLocalBalance)}
              </Col>
            </Row>
            <Slider
              value={nextLocalBalance}
              onChange={value => manualBalanceChannelsInfo({ value, index })}
              min={0}
              max={total}
            />
          </div>
        );
      })}
      {/* end sliders */}
      <br />
      <Row gutter={10}>
        <Col span={12}>
          <Styled.Button onClick={() => resetChannelsInfo(network)}>
            <ReloadOutlined /> <span>{l('reset')}</span>
          </Styled.Button>
        </Col>
        <Col span={12}>
          <Styled.Button onClick={() => autoBalanceChannelsInfo()}>
            <PercentageOutlined /> <span>{l('autoBalance')}</span>
          </Styled.Button>
        </Col>
      </Row>
    </Modal>
  );
};

export default BalanceChannelsModal;
