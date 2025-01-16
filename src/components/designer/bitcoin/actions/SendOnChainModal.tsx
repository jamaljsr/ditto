import React, { useCallback, useMemo, useState } from 'react';
import { useAsyncCallback } from 'react-async-hook';
import { Checkbox, Col, Form, Input, InputNumber, Modal, Row, Select } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import { BitcoinNode } from 'shared/types';
import { useStoreActions, useStoreState } from 'store';
import { Network } from 'types';
import { format } from 'utils/units';
import { getNetworkBackendId } from 'utils/network';

interface Props {
  network: Network;
}

const SendOnChainModal: React.FC<Props> = ({ network }) => {
  const { l } = usePrefixedTranslation('cmps.designer.bitcoind.actions.SendOnChainModal');
  const [form] = Form.useForm();
  const { visible, backendName } = useStoreState(s => s.modals.sendOnChain);
  const { nodes } = useStoreState(s => s.bitcoin);
  const { hideSendOnChain } = useStoreActions(s => s.modals);
  const { notify } = useStoreActions(s => s.app);
  const { sendFunds } = useStoreActions(s => s.bitcoin);
  const [selected, setSelected] = useState(backendName || '');

  const balance: number = useMemo(() => {
    const node = network.nodes.bitcoin.find(n => n.name === selected);
    if (nodes && node?.name && node?.networkId) {
      return nodes[getNetworkBackendId(node as BitcoinNode)]?.walletInfo?.balance || 0;
    }
    return 0;
  }, [selected, nodes, l]);

  const changeAsync = useAsyncCallback(
    async (node: BitcoinNode, toAddress: string, amount: number, autoMine: boolean) => {
      try {
        if (amount > balance)
          throw new Error(l('balanceError', { backendName: node.name, balance }));
        const txid = await sendFunds({ node, toAddress, amount, autoMine });
        notify({
          message: l('successTitle', { amount }),
          description: l('successDesc', { txid }),
        });
        hideSendOnChain();
      } catch (error: any) {
        notify({ message: l('submitError'), error });
      }
    },
  );

  const handleSubmit = useCallback(() => {
    const { bitcoin } = network.nodes;
    const { backendName, toAddress, amount, autoMine } = form.getFieldsValue();
    const backend = bitcoin.find(n => n.name === backendName);
    if (!backend || !toAddress || !amount) return;
    changeAsync.execute(backend, toAddress, amount, autoMine);
  }, []);

  return (
    <>
      <Modal
        title={l('title')}
        open={visible}
        onCancel={() => hideSendOnChain()}
        destroyOnClose
        cancelText={l('cancelBtn')}
        okText={l('okBtn')}
        okButtonProps={{
          loading: changeAsync.loading,
        }}
        onOk={form.submit}
      >
        <Form
          form={form}
          layout="vertical"
          hideRequiredMark
          colon={false}
          initialValues={{ backendName, autoMine: true }}
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="backendName"
                label={l('backendNameLabel')}
                rules={[{ required: true, message: l('cmps.forms.required') }]}
              >
                <Select
                  disabled={changeAsync.loading}
                  onChange={v => setSelected(`${v}`)}
                >
                  {network.nodes.bitcoin.map(node => (
                    <Select.Option key={node.name} value={node.name}>
                      {node.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="amount"
                label={l('amountLabel') + ' (BTC)'}
                help={`${l('balance')}: ${format(balance)} BTC`}
                rules={[{ required: true, message: l('cmps.forms.required') }]}
              >
                <InputNumber<number>
                  min={0.00001}
                  disabled={changeAsync.loading}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="toAddress"
            label={l('toAddressLabel')}
            rules={[{ required: true, message: l('cmps.forms.required') }]}
          >
            <Input
              placeholder="bcrt1qww06tf46equds8dx0x5jl9tmd6djqyu5u70mc4"
              disabled={changeAsync.loading}
            />
          </Form.Item>
          <Form.Item name="autoMine" valuePropName="checked">
            <Checkbox disabled={changeAsync.loading}>{l('autoMine')}</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default SendOnChainModal;
