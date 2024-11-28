import React from 'react';
import styled from '@emotion/styled';
import { Alert, Button, Col, Form, InputNumber, Row, Select, Slider } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import { LightningNode, Status } from 'shared/types';
import { useStoreActions } from 'store';
import { ActivityInfo, Network } from 'types';
import { AddActivityInvalidState } from './default/cards/ActivityDesignerCard';

const Styled = {
  ActivityGen: styled.div`
    display: flex;
    flex-direction: column;
    row-gap: 10px;
    align-items: start;
    width: 100%;
    border-radius: 4px;
  `,
  Divider: styled.div`
    height: 1px;
    width: 100%;
    margin: 15px 0;
    background: #545353e6;
    opacity: 0.5;
  `,
  DeleteButton: styled(Button)`
    border: none;
    height: 100%;
    color: red;
    opacity: 0.6;
    &:hover {
      background: red;
      color: #fff;
      border: 1px solid #fff;
    }
  `,
  AmountInput: styled(InputNumber)`
    width: 100%;
    border-radius: 4px;
    margin: 0 0 10px 0;
    padding: 5px 0;
  `,
  ActivityForm: styled(Form)`
    display: flex;
    flex-direction: column;
    row-gap: 10px;
    align-items: start;
    width: 100%;
    border-radius: 4px;
    border: 1px solid #545353e6;
    padding: 10px;
  `,
  Label: styled.p`
    margin: 0;
    padding: 0;
  `,
  NodeWrapper: styled.div`
    display: flex;
    align-items: center;
    justify-content: start;
    column-gap: 15px;
    width: 100%;
  `,
  NodeSelect: styled(Select)`
    width: 100%;
    border-radius: 4px;
    margin: 0 0 10px 0;
  `,
  Save: styled(Button)<{ canSave: boolean }>`
    width: 100%;
    opacity: ${props => (props.canSave ? '1' : '0.6')};
    cursor: ${props => (props.canSave ? 'pointer' : 'not-allowed')};
    &:hover {
      background: ${props => (props.canSave ? '#d46b08' : '')};
    }
  `,
  Cancel: styled(Button)`
    width: 100%;
  `,
};

interface ActivityUpdater {
  <K extends keyof ActivityInfo>(params: { name: K; value: ActivityInfo[K] }): void;
}

interface Props {
  visible: boolean;
  activityInfo: ActivityInfo;
  network: Network;
  addActivityInvalidState: AddActivityInvalidState | null;
  setAddActivityInvalidState: (state: AddActivityInvalidState | null) => void;
  toggle: () => void;
  updater: ActivityUpdater;
  reset: () => void;
}

// TODO: export from somewhere
interface SimulationActivityArgs {
  source: LightningNode;
  destination: LightningNode;
  intervalSecs: number;
  amountMsat: number;
}

const ActivityGenerator: React.FC<Props> = ({
  visible,
  network,
  activityInfo,
  addActivityInvalidState,
  setAddActivityInvalidState,
  toggle,
  reset,
  updater,
}) => {
  if (!visible) return null;

  const { l } = usePrefixedTranslation('cmps.designer.ActivityGenerator');

  const { sourceNode, targetNode, frequency, amount } = activityInfo;

  const { lightning } = network.nodes;

  // get store actions for adding activities
  const { addSimulationActivity } = useStoreActions(s => s.network);

  const handleAddActivity = async () => {
    setAddActivityInvalidState(null);
    if (!sourceNode || !targetNode) {
      setAddActivityInvalidState({
        state: 'error',
        message: 'Please select both source and target nodes.',
        action: 'save',
      });
      return;
    }

    const activity: SimulationActivityArgs = {
      source: sourceNode,
      destination: targetNode,
      amountMsat: amount,
      intervalSecs: frequency,
    };

    addSimulationActivity({ networkId: network.id, ...activity });
    reset();
    toggle();
  };

  const handleSourceNodeChange = (selectedNodeName: string) => {
    const selectedNode = lightning.find(n => n.name === selectedNodeName);
    if (selectedNode?.name !== targetNode?.name) {
      updater({ name: 'sourceNode', value: selectedNode });
    }
  };

  const handleTargetNodeChange = (selectedNodeName: string) => {
    const selectedNode = lightning.find(n => n.name === selectedNodeName);
    if (selectedNode?.name !== sourceNode?.name) {
      updater({ name: 'targetNode', value: selectedNode });
    }
  };

  const handleFrequencyChange = (newValue: number) => {
    updater({ name: 'frequency', value: newValue < 1 ? 1 : newValue });
  };

  const handleAmountChange = (newValue: number) => {
    updater({ name: 'amount', value: newValue < 1 ? 1 : newValue });
  };

  const handleCancel = () => {
    toggle();
    reset();
  };

  const sourceNodes = React.useMemo(() => {
    return lightning
      .filter(n => n.status === Status.Started)
      .filter(n => n.implementation !== 'eclair') // Exclude eclair nodes, as sim-ln doesnt currently support it
      .filter(n => !targetNode || n.id !== targetNode.id);
  }, [lightning, targetNode]);

  const targetNodes = React.useMemo(() => {
    return lightning
      .filter(n => n.status === Status.Started)
      .filter(n => n.implementation !== 'eclair') // Exclude eclair nodes, as sim-ln doesnt currently support it
      .filter(n => !sourceNode || n.id !== sourceNode.id);
  }, [lightning, sourceNode]);

  return (
    <Styled.ActivityGen>
      <Styled.ActivityForm>
        <Styled.Label>{l('sourceNode')}</Styled.Label>
        <Styled.NodeSelect
          value={sourceNode?.name}
          onChange={e => handleSourceNodeChange(e as string)}
        >
          {sourceNodes.map(n => (
            <Select.Option key={`${n.id}-${n.name}`} value={n.name}>
              {n.name}
            </Select.Option>
          ))}
        </Styled.NodeSelect>

        <Styled.Label>{l('destinationNode')}</Styled.Label>
        <Styled.NodeSelect
          value={targetNode?.name}
          onChange={e => handleTargetNodeChange(e as string)}
        >
          {targetNodes.map(n => (
            <Select.Option key={`${n.id}-${n.name}`} value={n.name}>
              {n.name}
            </Select.Option>
          ))}
        </Styled.NodeSelect>

        <Styled.Label>{l('frequency')}</Styled.Label>
        <IntegerStep frequency={frequency} onChange={handleFrequencyChange} />

        <Styled.Label>{l('amount')}</Styled.Label>
        <Styled.AmountInput
          placeholder={l('amountPlaceholder')}
          value={amount}
          onChange={e => handleAmountChange(e as number)}
        />

        <Styled.NodeWrapper>
          <Styled.Cancel onClick={handleCancel}>{l('cancel')}</Styled.Cancel>
          <Styled.Save
            type="primary"
            canSave={!!sourceNode && !!targetNode}
            onClick={handleAddActivity}
          >
            {l('save')}
          </Styled.Save>
        </Styled.NodeWrapper>
      </Styled.ActivityForm>
      {addActivityInvalidState?.state && addActivityInvalidState.action === 'save' && (
        <Alert
          key={addActivityInvalidState.state}
          onClose={() => setAddActivityInvalidState(null)}
          type="warning"
          message={addActivityInvalidState?.message || l('startWarning')}
          closable={true}
          showIcon
        />
      )}
    </Styled.ActivityGen>
  );
};

const IntegerStep: React.FC<{
  frequency: number;
  onChange: (newValue: number) => void;
}> = ({ frequency, onChange }) => {
  return (
    <Row style={{ width: '100%' }}>
      <Col span={15}>
        <Slider min={1} max={100} value={frequency} onChange={onChange} />
      </Col>
      <Col span={4}>
        <InputNumber
          min={1}
          style={{ margin: '0 16px' }}
          value={frequency}
          onChange={newValue => onChange(newValue ?? 1)}
        />
      </Col>
    </Row>
  );
};

export default ActivityGenerator;
