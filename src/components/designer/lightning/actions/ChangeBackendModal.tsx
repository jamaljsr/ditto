import React from 'react';
import { useAsyncCallback } from 'react-async-hook';
import { SwapOutlined } from '@ant-design/icons';
import styled from '@emotion/styled';
import { Alert, Col, Form, Modal, Row, Select } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import { Status } from 'shared/types';
import { useStoreActions, useStoreState } from 'store';
import { Network } from 'types';
import { isVersionCompatible } from 'utils/strings';
import LightningNodeSelect from 'components/common/form/LightningNodeSelect';

const Styled = {
  IconCol: styled(Col)`
    display: flex;
    justify-content: center;
    align-items: center;
  `,
  Restart: styled.p`
    font-style: italic;
    opacity: 0.6;
  `,
};

interface Props {
  network: Network;
}

const ChangeBackendModal: React.FC<Props> = ({ network }) => {
  const { l } = usePrefixedTranslation(
    'cmps.designer.lightning.actions.ChangeBackendModal',
  );
  const [form] = Form.useForm();
  const { visible, lnName, backendName } = useStoreState(s => s.modals.changeBackend);
  const { dockerRepoState } = useStoreState(s => s.app);
  const { hideChangeBackend } = useStoreActions(s => s.modals);
  const { updateBackendNode } = useStoreActions(s => s.network);
  const { notify } = useStoreActions(s => s.app);

  const changeAsync = useAsyncCallback(async (ln: string, backend: string) => {
    try {
      await updateBackendNode({
        id: network.id,
        lnName: ln,
        backendName: backend,
      });
      notify({
        message: l('successTitle'),
        description: l('successDesc', { ln, backend }),
      });
      hideChangeBackend();
    } catch (error) {
      notify({ message: l('submitError'), error });
    }
  });

  const lnSelected: string = form.getFieldValue('lnNode') || lnName;
  const backendSelected: string = form.getFieldValue('backendNode') || backendName;
  const { lightning, bitcoin } = network.nodes;
  const ln = lightning.find(n => n.name === lnSelected);
  const backend = bitcoin.find(n => n.name === backendSelected);
  let compatWarning: string | undefined;
  if (ln && backend) {
    const { compatibility } = dockerRepoState.images[ln.implementation];
    if (compatibility) {
      const requiredVersion = compatibility[ln.version];
      if (!isVersionCompatible(backend.version, requiredVersion)) {
        compatWarning = l('compatWarning', { ln, backend, requiredVersion });
      }
    }
  }

  const handleSubmit = () => {
    if (!ln || !backend) return;
    changeAsync.execute(ln.name, backend.name);
  };

  return (
    <>
      <Modal
        title={l('title')}
        visible={visible}
        onCancel={() => hideChangeBackend()}
        destroyOnClose
        cancelText={l('cancelBtn')}
        okText={l('okBtn')}
        okButtonProps={{
          loading: changeAsync.loading,
          disabled: !!compatWarning,
        }}
        onOk={form.submit}
      >
        <p>{l('description')}</p>
        <Form
          form={form}
          hideRequiredMark
          colon={false}
          initialValues={{ lnNode: lnName, backendNode: backendName }}
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={10}>
              <LightningNodeSelect
                network={network}
                name="lnNode"
                form={form}
                label={l('lnNodeLabel')}
                disabled={changeAsync.loading}
              />
            </Col>
            <Styled.IconCol span={4}>
              <SwapOutlined style={{ fontSize: '2em', opacity: 0.5 }} />
            </Styled.IconCol>
            <Col span={10}>
              <Form.Item
                name="backendNode"
                label={l('backendNodeLabel')}
                rules={[{ required: true, message: l('cmps.forms.required') }]}
              >
                <Select disabled={changeAsync.loading}>
                  {network.nodes.bitcoin.map(node => (
                    <Select.Option key={node.name} value={node.name}>
                      {node.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          {network.status === Status.Started && (
            <Styled.Restart>
              {l('restartNotice', { name: form.getFieldValue('lnNode') || lnName })}
            </Styled.Restart>
          )}
          {compatWarning && (
            <Alert type="warning" message={compatWarning} closable={false} showIcon />
          )}
        </Form>
      </Modal>
    </>
  );
};

export default ChangeBackendModal;
