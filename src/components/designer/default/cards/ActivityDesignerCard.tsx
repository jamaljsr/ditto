import React, { useState } from 'react';
import { useAsyncCallback } from 'react-async-hook';
import {
  ArrowDownOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  CopyOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import styled from '@emotion/styled';
import { Alert, Button, Tooltip } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import { useTheme } from 'hooks/useTheme';
import { Status } from 'shared/types';
import { useStoreActions } from 'store';
import { ThemeColors } from 'theme/colors';
import { ActivityInfo, Network, SimulationActivity } from 'types';
import ActivityGenerator from '../../ActivityGenerator';

const Styled = {
  AddNodes: styled.div`
    display: flex;
    align-items: center;
    width: 100%;
    margin: 30px 0 10px 0;
    > h3 {
      margin: 0;
      padding: 0;
    }
  `,
  AddDesc: styled.p`
    opacity: 0.5;
    font-size: 12px;
    margin-bottom: 20px;
  `,
  ActivityButtons: styled(Button.Group)`
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    border-radius: 4px;
    cursor: pointer;
  `,
  Activity: styled(Button)<{ colors: ThemeColors['dragNode'] }>`
    display: flex;
    align-items: center;
    justify-content: space-between;
    overflow: hidden;
    opacity: 1;
    width: 100%;
    height: 46px;
    padding: 10px 15px;
    margin-top: 20px;
    border: 1px solid ${props => props.colors.border};
    box-shadow: 4px 2px 9px ${props => props.colors.shadow};
    border-radius: 4px;
    font-weight: bold;

    &:hover {
      border: 1px solid #d46b08;
      color: #f7f2f2f2;
    }
  `,
  CopyButton: styled(Button)`
    border: none;
    height: 100%;
    opacity: 0.5;

    &:hover {
      opacity: 1;
    }
  `,
  Divider: styled.div`
    height: 1px;
    width: 100%;
    margin: 30px 0 20px 0;
    background: #545353e6;
    opacity: 0.5;
  `,
  DeleteButton: styled(Button)`
    border: none;
    height: 100%;
    color: red;
    opacity: 0.5;

    &:hover {
      color: red;
      opacity: 1;
    }
  `,
  NodeWrapper: styled.div`
    display: flex;
    align-items: center;
    justify-content: start;
    column-gap: 15px;
    width: 100%;
  `,
  StartStopButton: styled(Button)<{ active: boolean; colors: ThemeColors['dragNode'] }>`
    padding: 10px 15px;
    margin: 40px 0 0 0;
    width: 100%;
    height: 46px;
    color: ${props => (props.active ? '#d46b08' : '#fff')};
    background: ${props => (props.active ? '#000' : '')};
    border: 1px solid ${props => props.colors.border};
    box-shadow: 4px 2px 9px ${props => props.colors.shadow};

    &:hover {
      background: #d46b08;
      color: #fff;
    }

    &:focus {
      background: ${props => (props.active ? '#000' : '#d46b08')};
      color: ${props => (props.active ? '#f7f2f2f2' : '#000')};
    }
  `,
  Toggle: styled(Button)`
    border: none;
    opacity: 0.6;
    margin-left: 10px;

    &:hover {
      color: #fff;
      border: 1px solid #fff;
    }

    &:focus {
      color: #fff;
      border: 1px solid #fff;
    }
  `,
};

interface Props {
  network: Network;
  visible: boolean;
}

export interface AddActivityInvalidState {
  state: 'warning' | 'error';
  action: 'start' | 'save';
  message: string;
}

const defaultActivityInfo: ActivityInfo = {
  id: undefined,
  sourceNode: undefined,
  targetNode: undefined,
  amount: 1,
  frequency: 1,
};

const ActivityDesignerCard: React.FC<Props> = ({ visible, network }) => {
  const [isSimulationActive, setIsSimulationActive] = React.useState(false);
  const [isAddActivityActive, setIsAddActivityActive] = React.useState(false);
  const [addActivityInvalidState, setAddActivityInvalidState] =
    useState<AddActivityInvalidState | null>(null);
  const [activityInfo, setActivityInfo] = useState<ActivityInfo>(defaultActivityInfo);

  const theme = useTheme();
  const { l } = usePrefixedTranslation(
    'cmps.designer.default.cards.ActivityDesignerCard',
  );
  const {
    addSimulationActivity,
    removeSimulationActivity,
    startSimulation,
    stopSimulation,
  } = useStoreActions(s => s.network);
  const { notify } = useStoreActions(s => s.app);
  const { lightning } = network.nodes;

  const activities = network.simulationActivities ?? [];
  const numberOfActivities = activities.length;

  const startSimulationActivity = useAsyncCallback(async () => {
    try {
      if (network.status !== Status.Started) {
        setAddActivityInvalidState({
          state: 'warning',
          message: l('startWarning'),
          action: 'start',
        });
        setIsSimulationActive(false);
        return;
      }
      if (numberOfActivities === 0) {
        setIsAddActivityActive(true);
        setAddActivityInvalidState({
          state: 'warning',
          message: l('NoActivityAddedWarning'),
          action: 'start',
        });
        setIsSimulationActive(false);
        return;
      }
      const allNotStartedNodesSet = new Set();
      const nodes = network.simulationActivities.flatMap(activity => {
        const activityNodes = new Set([
          activity.source.label,
          activity.destination.label,
        ]);
        return lightning
          .filter(node => node.status !== Status.Started && activityNodes.has(node.name))
          .filter(node => {
            const notStarted = !allNotStartedNodesSet.has(node.name);
            if (notStarted) {
              allNotStartedNodesSet.add(node.name);
            }
            return notStarted;
          });
      });
      if (nodes.length > 0) {
        setIsAddActivityActive(true);
        setAddActivityInvalidState({
          state: 'warning',
          message: l('startWarning'),
          action: 'start',
        });
        setIsSimulationActive(false);
        return;
      }
      setAddActivityInvalidState(null);
      if (isSimulationActive) {
        setIsSimulationActive(false);
        await stopSimulation({ id: network.id });
        return;
      }
      setIsSimulationActive(true);
      await startSimulation({ id: network.id });
    } catch (error: any) {
      setIsSimulationActive(false);
      notify({ message: l('startError'), error });
    }
  });

  const toggleAddActivity = () => {
    setIsAddActivityActive(prev => !prev);
  };

  const handleRemoveActivity = async (
    e: React.MouseEvent<HTMLElement, MouseEvent>,
    activity: SimulationActivity,
  ) => {
    e.stopPropagation();
    await removeSimulationActivity(activity);
  };

  const handleDuplicateActivity = async (
    e: React.MouseEvent<HTMLElement, MouseEvent>,
    activity: SimulationActivity,
  ) => {
    e.stopPropagation();
    await addSimulationActivity(activity);
  };

  const resolveLabelToNode = (name: string) => {
    const selectedNode = lightning.find(n => n.name === name);
    return selectedNode;
  };
  const handleSelectActivity = (activity: SimulationActivity) => {
    const sourceNode = resolveLabelToNode(activity.source.label);
    const targetNode = resolveLabelToNode(activity.destination.label);
    setActivityInfo({
      id: activity.id,
      sourceNode,
      targetNode,
      amount: activity.amountMsat,
      frequency: activity.intervalSecs,
    });
    setIsAddActivityActive(true);
  };

  const resolveUpdater = <T extends keyof ActivityInfo>({
    name,
    value,
  }: {
    name: T;
    value: ActivityInfo[T];
  }) => {
    setActivityInfo(prev => ({ ...prev, [name]: value }));
  };

  const reset = () => {
    setActivityInfo(defaultActivityInfo);
  };

  const primaryCtaText = () => {
    if (!isSimulationActive && startSimulationActivity.loading) {
      return l('stopping');
    }
    if (isSimulationActive && startSimulationActivity.loading) {
      return l('starting');
    }
    if (isSimulationActive && !startSimulationActivity.loading) {
      return l('stop');
    }
    return l('start');
  };

  if (!visible) return null;
  return (
    <>
      <div>
        <p>{l('mainDesc')}</p>
      </div>
      <Styled.AddNodes>
        <h3>{l('addActivitiesTitle')}</h3>
        <Styled.Toggle
          type="ghost"
          size="small"
          shape="circle"
          icon={isAddActivityActive ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          onClick={toggleAddActivity}
        />
      </Styled.AddNodes>
      <Styled.AddDesc>{l('addActivitiesDesc')}</Styled.AddDesc>
      <ActivityGenerator
        visible={isAddActivityActive}
        activities={activities}
        activityInfo={activityInfo}
        network={network}
        addActivityInvalidState={addActivityInvalidState}
        setAddActivityInvalidState={setAddActivityInvalidState}
        toggle={toggleAddActivity}
        updater={resolveUpdater}
        reset={reset}
      />
      <Styled.Divider />
      <p>
        {l('activities')}
        {` (${numberOfActivities})`}
      </p>
      <Styled.ActivityButtons>
        {activities.map(activity => (
          <Styled.Activity
            key={`id-${activity.id}-${activity.source.address}-${activity.destination.address}`}
            colors={theme.dragNode}
            onClick={() => handleSelectActivity(activity)}
          >
            <Styled.NodeWrapper>
              <span>{activity.source.label}</span>
              <ArrowRightOutlined />
              <span>{activity.destination.label}</span>
            </Styled.NodeWrapper>
            <Tooltip title={l('duplicateBtnTip')}>
              <Styled.CopyButton
                onClick={e => handleDuplicateActivity(e, activity)}
                icon={<CopyOutlined />}
              />
            </Tooltip>
            <Styled.DeleteButton
              onClick={e => handleRemoveActivity(e, activity)}
              icon={<DeleteOutlined />}
            />
          </Styled.Activity>
        ))}
      </Styled.ActivityButtons>
      {addActivityInvalidState?.state && addActivityInvalidState.action === 'start' && (
        <Alert
          key={addActivityInvalidState.state}
          onClose={() => setAddActivityInvalidState(null)}
          type="warning"
          message={addActivityInvalidState?.message || l('startWarning')}
          closable={true}
          showIcon
          style={{ marginTop: 20 }}
        />
      )}
      <Styled.StartStopButton
        colors={theme.dragNode}
        active={isSimulationActive}
        onClick={startSimulationActivity.execute}
        loading={startSimulationActivity.loading}
        disabled={startSimulationActivity.loading}
      >
        {primaryCtaText()}
      </Styled.StartStopButton>
    </>
  );
};

export default ActivityDesignerCard;
