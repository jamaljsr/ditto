import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FieldTimeOutlined } from '@ant-design/icons';
import styled from '@emotion/styled';
import { Button, Dropdown, MenuProps, Tooltip } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { usePrefixedTranslation } from 'hooks';
import { useStoreActions, useStoreState } from 'store';
import { AutoMineMode, Network } from 'types';

const Styled = {
  Button: styled(Button)`
    margin-left: 8px;
  `,
  RemainingBar: styled.div`
    transition: width 400ms ease-in-out;
    background: #d46b08;
    position: absolute;
    width: 100%;
    height: 3px;
    bottom: 0;
    left: 0;
  `,
};

interface Props {
  network: Network;
}

const getRemainingPercentage = (mode: AutoMineMode, startTime: number) => {
  if (mode === AutoMineMode.AutoOff) return 0;
  else {
    const elapsedTime = Date.now() - startTime;
    const autoMineInterval = 1000 * mode;
    const remainingTime = autoMineInterval - (elapsedTime % autoMineInterval);
    const remainingPercentage = (100 * remainingTime) / autoMineInterval;

    return remainingPercentage;
  }
};

const AutoMineButton: React.FC<Props> = ({ network }) => {
  const { l } = usePrefixedTranslation('cmps.designer.AutoMineButton');
  const { autoMine } = useStoreActions(s => s.network);
  const autoMiner = useStoreState(s => s.network.autoMiners[network.id]);
  const [remainingPercentage, setRemainingPercentage] = useState(0);
  const [tickTimer, setTickTimer] = useState<NodeJS.Timer | undefined>(undefined);

  useEffect(() => {
    return () => {
      clearInterval(tickTimer);
      setTickTimer(undefined);
    };
  }, []);

  useEffect(() => {
    let tt = tickTimer;
    clearInterval(tt);

    const setPercentage = () => {
      setRemainingPercentage(
        getRemainingPercentage(network.autoMineMode, autoMiner?.startTime || 0),
      );
    };

    if (network.autoMineMode === AutoMineMode.AutoOff) {
      setPercentage();
      setTickTimer(undefined);
    } else {
      tt = setInterval(() => {
        setPercentage();
      }, 1000);
      setTickTimer(tt);
    }
    return () => {
      clearInterval(tt);
    };
  }, [network.autoMineMode]);

  const autoMineStatusShortMap = useMemo(() => {
    return {
      [AutoMineMode.AutoOff]: l('autoOff'),
      [AutoMineMode.Auto30s]: l('autoThirtySecondsShort'),
      [AutoMineMode.Auto1m]: l('autoOneMinuteShort'),
      [AutoMineMode.Auto5m]: l('autoFiveMinutesShort'),
      [AutoMineMode.Auto10m]: l('autoTenMinutesShort'),
    };
  }, [l]);

  const handleAutoMineModeChanged: MenuProps['onClick'] = useCallback(
    (info: { key: string | number }) => {
      info.key == AutoMineMode.AutoOff
        ? setRemainingPercentage(0)
        : setRemainingPercentage(100);
      autoMine({
        mode: +info.key,
        id: network.id,
      });
    },
    [network, autoMine],
  );

  function createMenuItem(key: AutoMineMode): ItemType {
    return {
      label: autoMineStatusShortMap[key],
      key: String(key),
    };
  }

  const menu: MenuProps = {
    selectedKeys: [String(network.autoMineMode || AutoMineMode.AutoOff)],
    onClick: handleAutoMineModeChanged,
    items: [
      createMenuItem(AutoMineMode.AutoOff),
      {
        type: 'divider',
      },
      createMenuItem(AutoMineMode.Auto30s),
      createMenuItem(AutoMineMode.Auto1m),
      createMenuItem(AutoMineMode.Auto5m),
      createMenuItem(AutoMineMode.Auto10m),
    ],
  };

  return (
    <Tooltip title={l('autoMineBtnTip')}>
      <Dropdown menu={menu} trigger={['hover']} overlayClassName="polar-context-menu">
        <Styled.Button icon={<FieldTimeOutlined />} loading={autoMiner?.mining}>
          {l('autoMine')}: {autoMineStatusShortMap[network.autoMineMode]}
          <Styled.RemainingBar
            style={{
              width: `${remainingPercentage}%`,
            }}
          />
        </Styled.Button>
      </Dropdown>
    </Tooltip>
  );
};

export default AutoMineButton;
