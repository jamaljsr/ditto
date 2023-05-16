import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { Form } from 'antd';
import { Status } from 'shared/types';
import { getNetwork } from 'utils/tests';
import TapNodeSelect from './TapNodeSelect';

describe('TapNodeSelect', () => {
  const renderComponent = () => {
    const network = getNetwork(1, 'test network', Status.Stopped, 3);
    const TestForm = () => {
      const [form] = Form.useForm();
      return (
        <Form form={form}>
          <TapNodeSelect
            network={network}
            name="from"
            label="Tap Nodes"
            nodeStatus={Status.Stopped}
          />
        </Form>
      );
    };
    const result = render(<TestForm />);
    return {
      ...result,
      network,
    };
  };

  it('should display the label and input', () => {
    const { getByText, getByLabelText } = renderComponent();
    expect(getByText('Tap Nodes')).toBeInTheDocument();
    expect(getByLabelText('Tap Nodes')).toBeInTheDocument();
  });

  it('should display the nodes', async () => {
    const { getAllByText, getByLabelText } = renderComponent();
    fireEvent.mouseDown(getByLabelText('Tap Nodes'));
    expect(getAllByText('alice-tap')[0]).toBeInTheDocument();
    expect(getAllByText('bob-tap')[0]).toBeInTheDocument();
    expect(getAllByText('carol-tap')[0]).toBeInTheDocument();
    fireEvent.click(getAllByText('carol-tap')[0]);
  });
});
