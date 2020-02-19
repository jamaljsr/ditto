import React, { useEffect } from 'react';
import { info } from 'electron-log';
import styled from '@emotion/styled';
import { Button, Card, Col, Form, Input, InputNumber, PageHeader, Row } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import { useTheme } from 'hooks/useTheme';
import { useStoreActions } from 'store';
import { ThemeColors } from 'theme/colors';
import { isWindows } from 'utils/system';
import { HOME } from 'components/routing';

const Styled = {
  PageHeader: styled(PageHeader)<{ colors: ThemeColors['pageHeader'] }>`
    border: 1px solid ${props => props.colors.border};
    border-radius: 2px;
    background-color: ${props => props.colors.background};
    margin-bottom: 10px;
    flex: 0;
  `,
};

const NewNetwork: React.SFC = () => {
  useEffect(() => info('Rendering NewNetwork component'), []);

  const { l } = usePrefixedTranslation('cmps.network.NewNetwork');
  const theme = useTheme();
  const { navigateTo } = useStoreActions(s => s.app);
  const { addNetwork } = useStoreActions(s => s.network);

  const handleSubmit = (values: any) => {
    addNetwork(values);
  };

  return (
    <>
      <Styled.PageHeader
        title={l('title')}
        colors={theme.pageHeader}
        onBack={() => navigateTo(HOME)}
      />
      <Card>
        <Form
          layout="vertical"
          colon={false}
          initialValues={{
            lndNodes: isWindows() ? 3 : 2,
            clightningNodes: isWindows() ? 0 : 1,
            bitcoindNodes: 1,
          }}
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label={l('nameLabel')}
            rules={[{ required: true, message: l('cmps.forms.required') }]}
          >
            <Input placeholder={l('namePhldr')} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="lndNodes"
                label={l('lndNodesLabel')}
                rules={[{ required: true, message: l('cmps.forms.required') }]}
              >
                <InputNumber min={0} max={10} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="clightningNodes"
                label={l('clightningNodesLabel')}
                extra={isWindows() ? l('clightningWindows') : ''}
                rules={[{ required: true, message: l('cmps.forms.required') }]}
              >
                <InputNumber min={0} max={10} disabled={isWindows()} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="bitcoindNodes"
                label={l('bitcoindNodesLabel')}
                rules={[{ required: true, message: l('cmps.forms.required') }]}
              >
                <InputNumber min={1} max={10} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              {l('btnCreate')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </>
  );
};

export default NewNetwork;
