import React, { useEffect } from 'react';
import { FullscreenOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import styled from '@emotion/styled';
import { FlowChart } from '@mrblenny/react-flow-chart';
import { Button } from 'antd';
import { useDebounce } from 'hooks';
import { useTheme } from 'hooks/useTheme';
import { useStoreActions, useStoreState } from 'store';
import { Network } from 'types';
import { Loader, RenameNodeModal } from 'components/common';
import AdvancedOptionsModal from 'components/common/AdvancedOptionsModal';
import SendOnChainModal from './bitcoin/actions/SendOnChainModal';
import { Link, NodeInner, Port, Ports } from './custom';
import { CanvasOuterDark, CanvasOuterLight } from './custom/CanvasOuter';
import {
  ChangeBackendModal,
  CreateInvoiceModal,
  OpenChannelModal,
  PayInvoiceModal,
} from './lightning/actions';
import LncAddSessionModal from './lightning/connect/LncAddSessionModal';
import Sidebar from './Sidebar';
import {
  ChangeTapBackendModal,
  MintAssetModal,
  NewAddressModal,
  SendAssetModal,
} from './tap/actions';

const Styled = {
  Designer: styled.div`
    position: relative;
    flex: 1;
    overflow: hidden;
    margin: 0 -16px;
  `,
  FlowChart: styled(FlowChart)`
    height: 100%;
  `,
  ZoomButtons: styled(Button.Group)`
    position: absolute;
    bottom: 16px;
    right: 390px;
  `,
};

interface Props {
  network: Network;
  updateStateDelay?: number;
}

const NetworkDesigner: React.FC<Props> = ({ network, updateStateDelay = 3000 }) => {
  const theme = useTheme();
  const { zoomIn, zoomOut, zoomReset, ...callbacks } = useStoreActions(s => s.designer);
  const {
    openChannel,
    mintAsset,
    sendAsset,
    newAddress,
    createInvoice,
    payInvoice,
    changeBackend,
    sendOnChain,
    advancedOptions,
    changeTapBackend,
    renameNode,
    addLncSession,
  } = useStoreState(s => s.modals);

  const { save } = useStoreActions(s => s.network);
  const chart = useStoreState(s => s.designer.activeChart);
  // prevent saving the new chart on every callback
  // which can be many, ex: onDragNode, onDragCanvas, etc
  const debouncedChart = useDebounce(chart, updateStateDelay);
  useEffect(() => {
    // save to disk when the chart is changed (debounced)
    if (debouncedChart) save();
  }, [debouncedChart, save]);

  if (!chart) return <Loader />;
  return (
    <Styled.Designer>
      <Styled.FlowChart
        chart={chart}
        config={{ snapToGrid: true }}
        Components={{
          CanvasOuter: theme.name === 'dark' ? CanvasOuterDark : CanvasOuterLight,
          NodeInner,
          Link,
          Port,
          Ports,
        }}
        callbacks={callbacks}
      />
      <Styled.ZoomButtons>
        <Button icon={<ZoomInOutlined />} onClick={zoomIn} />
        <Button icon={<ZoomOutOutlined />} onClick={zoomOut} />
        <Button
          icon={<FullscreenOutlined />}
          onClick={zoomReset}
          disabled={chart.scale === 1}
        />
      </Styled.ZoomButtons>
      <Sidebar network={network} chart={chart} />
      {openChannel.visible && <OpenChannelModal network={network} />}
      {createInvoice.visible && <CreateInvoiceModal network={network} />}
      {payInvoice.visible && <PayInvoiceModal network={network} />}
      {changeBackend.visible && <ChangeBackendModal network={network} />}
      {sendOnChain.visible && <SendOnChainModal network={network} />}
      {advancedOptions.visible && <AdvancedOptionsModal network={network} />}
      {mintAsset.visible && <MintAssetModal network={network} />}
      {newAddress.visible && <NewAddressModal network={network} />}
      {changeTapBackend.visible && <ChangeTapBackendModal network={network} />}
      {sendAsset.visible && <SendAssetModal network={network} />}
      {renameNode.visible && <RenameNodeModal network={network} />}
      {addLncSession.visible && <LncAddSessionModal network={network} />}
    </Styled.Designer>
  );
};

export default NetworkDesigner;
