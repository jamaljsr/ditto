import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import { useAsyncCallback } from 'react-async-hook';
import { Redirect, RouteComponentProps } from 'react-router';
import { info } from 'electron-log';
import styled from '@emotion/styled';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Modal, PageHeader, Tooltip } from 'antd';
import { usePrefixedTranslation } from 'hooks';
import { useTheme } from 'hooks/useTheme';
import { Status } from 'shared/types';
import { useStoreActions, useStoreState } from 'store';
import { ThemeColors } from 'theme/colors';
import { getMissingImages, getNetworkBackendId } from 'utils/network';
import { StatusTag } from 'components/common';
import NetworkDesigner from 'components/designer/NetworkDesigner';
import { HOME } from 'components/routing';
import NetworkActions from './NetworkActions';

const Styled = {
  Empty: styled(Empty)`
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  `,
  NetworkView: styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
  `,
  PageHeader: styled(PageHeader)<{ colors: ThemeColors['pageHeader'] }>`
    border: 1px solid ${props => props.colors.border};
    border-radius: 2px;
    background-color: ${props => props.colors.background};
    margin-bottom: 10px;
    flex: 0;
  `,
  NetworkInput: styled.div`
    display: flex;
    flex-direction: column;
  `,
  NameInput: styled(Input)`
    width: 500px;
    margin-bottom: 8px;
  `,
  DescriptionInput: styled(Input.TextArea)`
    width: 500px;
  `,
  NetworkDesigner: styled(NetworkDesigner)`
    flex: 1;
  `,
  Error: styled.pre`
    font-size: 11px;
  `,
};

interface MatchParams {
  id?: string;
}

const NetworkView: React.FC<RouteComponentProps<MatchParams>> = ({ match }) => {
  useEffect(() => info('Rendering NetworkView component'), []);
  const { l } = usePrefixedTranslation('cmps.network.NetworkView');

  const theme = useTheme();
  const { networks } = useStoreState(s => s.network);
  const networkId = parseInt(match.params.id || '');
  const network = networks.find(n => n.id === networkId);

  const [editing, setEditing] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');

  const { dockerImages } = useStoreState(s => s.app);
  const { nodes: bitcoinData } = useStoreState(s => s.bitcoin);
  const { navigateTo, notify } = useStoreActions(s => s.app);
  const { clearActiveId } = useStoreActions(s => s.designer);
  const { getInfo } = useStoreActions(s => s.bitcoin);
  const { toggle, rename, remove, exportNetwork } = useStoreActions(s => s.network);
  const toggleAsync = useAsyncCallback(toggle);
  const renameAsync = useAsyncCallback(
    async (payload: { id: number; name: string; description: string }) => {
      try {
        await rename(payload);
        setEditing(false);
      } catch (error: any) {
        notify({ message: l('renameError'), error });
      }
    },
  );
  const exportAsync = useAsyncCallback(async (id: number, name: string) => {
    try {
      const destination = await exportNetwork({ id });
      // the destination is undefined if Cancel is clicked on the SaveDialog
      if (destination) {
        notify({
          message: l('exportSuccess', { name }),
          description: l('exportSuccessDesc', { destination }),
        });
      }
    } catch (error: any) {
      notify({ message: l('exportError'), error });
    }
  });

  const showRemoveModal = (networkId: number, name: string) => {
    Modal.confirm({
      title: l('deleteTitle'),
      content: l('deleteContent'),
      okText: l('deleteConfirmBtn'),
      okType: 'danger',
      cancelText: l('deleteCancelBtn'),
      onOk: async () => {
        try {
          await remove(networkId);
          notify({ message: l('deleteSuccess', { name }) });
          // no need to navigate away since it will be done by useEffect below
        } catch (error: any) {
          notify({ message: l('deleteError'), error });
          throw error;
        }
      },
    });
  };

  const handleBackClick = useCallback(() => {
    navigateTo(HOME);
    clearActiveId();
  }, [navigateTo, clearActiveId]);

  useEffect(() => {
    const fetchInfo = async () => {
      // fetch bitcoin data if not present to show the block height
      if (network && network.status === Status.Started && network.nodes.bitcoin[0]) {
        const name = getNetworkBackendId(network.nodes.bitcoin[0]);
        if (!(bitcoinData && bitcoinData[name] && bitcoinData[name].chainInfo)) {
          try {
            await getInfo(network.nodes.bitcoin[0]);
          } catch (error: any) {
            notify({ message: l('getInfoError'), error });
          }
        }
      }
    };
    fetchInfo();
    // intentionally pass an empty deps array because we
    // only want to run this hook on mount
    // eslint-disable-next-line
  }, []);

  if (!network) {
    return <Redirect to={HOME} />;
  }

  let header: ReactNode;
  if (editing) {
    header = (
      <Styled.PageHeader
        colors={theme.pageHeader}
        title={
          <Styled.NetworkInput>
            <Styled.NameInput
              name="newNetworkName"
              value={editingName}
              onChange={e => setEditingName(e.target.value)}
              placeholder={l('namePhl')}
            />
            <Styled.DescriptionInput
              name="newNetworkDescription"
              value={editingDescription}
              onChange={e => setEditingDescription(e.target.value)}
              placeholder={l('descriptionPhl')}
              size="small"
              maxLength={100}
              autoSize
            />
          </Styled.NetworkInput>
        }
        extra={[
          <Button
            key="save"
            type="primary"
            loading={renameAsync.loading}
            onClick={() =>
              renameAsync.execute({
                id: network.id,
                name: editingName,
                description: editingDescription,
              })
            }
          >
            {l('renameSave')}
          </Button>,
          <Button key="cancel" type="link" onClick={() => setEditing(false)}>
            {l('renameCancel')}
          </Button>,
        ]}
      />
    );
  } else {
    header = (
      <Styled.PageHeader
        colors={theme.pageHeader}
        title={
          <>
            {`${network.name} `}
            {network.description && (
              <Tooltip title={network.description}>
                <InfoCircleOutlined />
              </Tooltip>
            )}
          </>
        }
        onBack={handleBackClick}
        tags={<StatusTag status={network.status} />}
        extra={
          <NetworkActions
            network={network}
            onClick={() => toggleAsync.execute(network.id)}
            onRenameClick={() => {
              setEditing(true);
              setEditingName(network.name);
              setEditingDescription(network.description);
            }}
            onDeleteClick={() => showRemoveModal(network.id, network.name)}
            onExportClick={() => exportAsync.execute(network.id, network.name)}
          />
        }
      />
    );
  }
  const missingImages = getMissingImages(network, dockerImages);
  const showNotice =
    [Status.Stopped, Status.Starting].includes(network.status) &&
    missingImages.length > 0;

  return (
    <Styled.NetworkView>
      {header}
      {showNotice && (
        <Alert
          type="info"
          message={l('missingImages')}
          description={missingImages.join(', ')}
          showIcon
        />
      )}
      {toggleAsync.error && (
        <Alert
          type="error"
          message={<Styled.Error>{toggleAsync.error.message}</Styled.Error>}
        />
      )}
      <Styled.NetworkDesigner network={network} />
    </Styled.NetworkView>
  );
};

export default NetworkView;
