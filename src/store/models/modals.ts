import { Action, action, Thunk, thunk } from 'easy-peasy';
import * as PLIT from 'lib/litd/types';
import { StoreInjections } from 'types';
import { getTapBackendNode } from 'utils/network';
import { RootModel } from './';

interface OpenChannelModel {
  visible: boolean;
  to?: string;
  from?: string;
  linkId?: string;
}

interface ChangeBackendModel {
  visible: boolean;
  lnName?: string;
  backendName?: string;
  linkId?: string;
}

interface CreateInvoiceModel {
  visible: boolean;
  nodeName?: string;
  amount?: number;
  // displayed after the invoice is created
  invoice?: string;
  assetName?: string;
}

interface PayInvoiceModel {
  visible: boolean;
  nodeName?: string;
}

interface AdvancedOptionsModel {
  visible: boolean;
  nodeName?: string;
  command?: string;
  defaultCommand?: string;
}

interface BalanceChannelsModel {
  visible: boolean;
}

interface ImageUpdatesModel {
  visible: boolean;
}

interface SendOnChainModel {
  visible: boolean;
  backendName?: string;
  toAddress?: string;
  amount?: number;
}

interface AssetInfoModel {
  visible: boolean;
  nodeName?: string;
  assetId?: string;
}

interface MintAssetModel {
  visible: boolean;
  nodeName?: string;
  networkId?: number;
  lndName?: string;
}

interface NewAddressModel {
  visible: boolean;
  nodeName?: string;
  networkId?: number;
}

interface SendAssetModel {
  visible: boolean;
  nodeName?: string;
  networkId?: number;
  lndName?: string;
}

interface ChangeTapBackendModel {
  visible: boolean;
  tapName?: string;
  lndName?: string;
  linkId?: string;
}

interface RenameNodeModel {
  visible: boolean;
  oldNodeName?: string;
}

interface LncSessionInfoModel {
  visible: boolean;
  sessionId?: string;
  nodeName?: string;
}

interface AddLncSessionModel {
  visible: boolean;
  nodeName?: string;
  // form values entered by the user
  label?: string;
  type?: PLIT.Session['type'];
  mailboxServerAddr?: string;
  expiresAt?: number;
  // success values returned by the API
  pairingPhrase?: string;
}

export interface ModalsModel {
  openChannel: OpenChannelModel;
  changeBackend: ChangeBackendModel;
  createInvoice: CreateInvoiceModel;
  payInvoice: PayInvoiceModel;
  advancedOptions: AdvancedOptionsModel;
  balanceChannels: BalanceChannelsModel;
  imageUpdates: ImageUpdatesModel;
  sendOnChain: SendOnChainModel;
  assetInfo: AssetInfoModel;
  mintAsset: MintAssetModel;
  newAddress: NewAddressModel;
  sendAsset: SendAssetModel;
  renameNode: RenameNodeModel;
  lncSessionInfo: LncSessionInfoModel;
  addLncSession: AddLncSessionModel;
  changeTapBackend: ChangeTapBackendModel;
  setOpenChannel: Action<ModalsModel, OpenChannelModel>;
  showOpenChannel: Thunk<ModalsModel, Partial<OpenChannelModel>, StoreInjections>;
  hideOpenChannel: Thunk<ModalsModel, void, StoreInjections, RootModel>;
  setChangeBackend: Action<ModalsModel, ChangeBackendModel>;
  showChangeBackend: Thunk<ModalsModel, Partial<ChangeBackendModel>, StoreInjections>;
  hideChangeBackend: Thunk<ModalsModel, void, StoreInjections, RootModel>;
  setCreateInvoice: Action<ModalsModel, CreateInvoiceModel>;
  showCreateInvoice: Thunk<ModalsModel, Partial<CreateInvoiceModel>, StoreInjections>;
  hideCreateInvoice: Thunk<ModalsModel, void, StoreInjections, RootModel>;
  setPayInvoice: Action<ModalsModel, PayInvoiceModel>;
  showPayInvoice: Thunk<ModalsModel, Partial<PayInvoiceModel>, StoreInjections>;
  hidePayInvoice: Thunk<ModalsModel, void, StoreInjections, RootModel>;
  setAdvancedOptions: Action<ModalsModel, AdvancedOptionsModel>;
  showAdvancedOptions: Thunk<ModalsModel, Partial<AdvancedOptionsModel>, StoreInjections>;
  hideAdvancedOptions: Thunk<ModalsModel, void, StoreInjections, RootModel>;
  hideBalanceChannels: Thunk<ModalsModel, void, StoreInjections, RootModel>;
  showBalanceChannels: Thunk<ModalsModel, void, StoreInjections>;
  setBalanceChannels: Action<ModalsModel, BalanceChannelsModel>;
  setImageUpdates: Action<ModalsModel, ImageUpdatesModel>;
  showImageUpdates: Thunk<ModalsModel, void, StoreInjections>;
  hideImageUpdates: Thunk<ModalsModel, void, StoreInjections, RootModel>;
  setSendOnChain: Action<ModalsModel, SendOnChainModel>;
  showSendOnChain: Thunk<ModalsModel, Partial<SendOnChainModel>, StoreInjections>;
  hideSendOnChain: Thunk<ModalsModel, void, StoreInjections, RootModel>;
  setAssetInfo: Action<ModalsModel, AssetInfoModel>;
  showAssetInfo: Thunk<ModalsModel, Partial<AssetInfoModel>, StoreInjections>;
  hideAssetInfo: Thunk<ModalsModel, void, StoreInjections, RootModel>;
  setMintAsset: Action<ModalsModel, Partial<MintAssetModel>>;
  showMintAsset: Thunk<ModalsModel, Partial<MintAssetModel>, StoreInjections, RootModel>;
  hideMintAsset: Thunk<ModalsModel>;
  showNewAddress: Thunk<
    ModalsModel,
    Partial<NewAddressModel>,
    StoreInjections,
    RootModel
  >;
  hideNewAddress: Thunk<ModalsModel>;
  setNewAddress: Action<ModalsModel, Partial<NewAddressModel>>;
  setSendAsset: Action<ModalsModel, SendAssetModel>;
  hideSendAsset: Thunk<ModalsModel>;
  showSendAsset: Thunk<ModalsModel, Partial<SendAssetModel>, StoreInjections, RootModel>;
  showChangeTapBackend: Thunk<
    ModalsModel,
    Partial<ChangeTapBackendModel>,
    StoreInjections
  >;
  hideChangeTapBackend: Thunk<ModalsModel, void, StoreInjections, RootModel>;
  setChangeTapBackend: Action<ModalsModel, Partial<ChangeTapBackendModel>>;
  setRenameNode: Action<ModalsModel, RenameNodeModel>;
  showRenameNode: Thunk<ModalsModel, Partial<RenameNodeModel>, StoreInjections>;
  hideRenameNode: Thunk<ModalsModel, void, StoreInjections, RootModel>;
  setLncSessionInfo: Action<ModalsModel, LncSessionInfoModel>;
  showLncSessionInfo: Thunk<ModalsModel, Partial<LncSessionInfoModel>, StoreInjections>;
  hideLncSessionInfo: Thunk<ModalsModel, void, StoreInjections, RootModel>;
  setAddLncSession: Action<ModalsModel, AddLncSessionModel>;
  showAddLncSession: Thunk<ModalsModel, Partial<AddLncSessionModel>, StoreInjections>;
  hideAddLncSession: Thunk<ModalsModel, void, StoreInjections, RootModel>;
}

const modalsModel: ModalsModel = {
  // state properties
  openChannel: { visible: false },
  mintAsset: { visible: false },
  sendAsset: { visible: false },
  newAddress: { visible: false },
  changeBackend: { visible: false },
  createInvoice: { visible: false },
  payInvoice: { visible: false },
  advancedOptions: { visible: false },
  balanceChannels: { visible: false },
  imageUpdates: { visible: false },
  sendOnChain: { visible: false },
  assetInfo: { visible: false },
  changeTapBackend: { visible: false },
  renameNode: { visible: false },
  lncSessionInfo: { visible: false },
  addLncSession: { visible: false },
  // reducer actions (mutations allowed thx to immer)
  setOpenChannel: action((state, payload) => {
    state.openChannel = {
      ...state.openChannel,
      ...payload,
    };
  }),
  showOpenChannel: thunk((actions, { to, from, linkId }) => {
    actions.setOpenChannel({ visible: true, to, from, linkId });
  }),
  hideOpenChannel: thunk((actions, payload, { getStoreActions, getState }) => {
    const { linkId } = getState().openChannel;
    if (linkId) {
      // remove the link on the chart if the channel was not opened
      getStoreActions().designer.removeLink(linkId);
    }
    actions.setOpenChannel({
      visible: false,
      to: undefined,
      from: undefined,
      linkId: undefined,
    });
  }),
  setChangeBackend: action((state, payload) => {
    state.changeBackend = {
      ...state.changeBackend,
      ...payload,
    };
  }),
  showChangeBackend: thunk((actions, { lnName, backendName, linkId }) => {
    actions.setChangeBackend({ visible: true, lnName, backendName, linkId });
  }),
  hideChangeBackend: thunk((actions, payload, { getStoreActions, getState }) => {
    const { linkId } = getState().changeBackend;
    if (linkId) {
      // remove the link on the chart if the backend wasn't changed
      getStoreActions().designer.removeLink(linkId);
    }
    actions.setChangeBackend({
      visible: false,
      lnName: undefined,
      backendName: undefined,
      linkId: undefined,
    });
  }),
  setCreateInvoice: action((state, payload) => {
    state.createInvoice = {
      ...state.createInvoice,
      ...payload,
    };
  }),
  showCreateInvoice: thunk((actions, { nodeName, invoice, amount, assetName }) => {
    actions.setCreateInvoice({ visible: true, nodeName, invoice, amount, assetName });
  }),
  hideCreateInvoice: thunk(actions => {
    actions.setCreateInvoice({
      visible: false,
      nodeName: undefined,
      invoice: undefined,
      amount: undefined,
    });
  }),
  setPayInvoice: action((state, payload) => {
    state.payInvoice = {
      ...state.payInvoice,
      ...payload,
    };
  }),
  showPayInvoice: thunk((actions, { nodeName }) => {
    actions.setPayInvoice({ visible: true, nodeName });
  }),
  hidePayInvoice: thunk(actions => {
    actions.setPayInvoice({
      visible: false,
      nodeName: undefined,
    });
  }),
  setAdvancedOptions: action((state, payload) => {
    state.advancedOptions = {
      ...state.advancedOptions,
      ...payload,
    };
  }),
  showAdvancedOptions: thunk((actions, { nodeName, command, defaultCommand }) => {
    actions.setAdvancedOptions({ visible: true, nodeName, command, defaultCommand });
  }),
  hideAdvancedOptions: thunk(actions => {
    actions.setAdvancedOptions({
      visible: false,
      nodeName: undefined,
      command: undefined,
      defaultCommand: undefined,
    });
  }),
  setBalanceChannels: action((state, payload) => {
    state.balanceChannels = {
      ...state.balanceChannels,
      ...payload,
    };
  }),
  showBalanceChannels: thunk(actions => {
    actions.setBalanceChannels({ visible: true });
  }),
  hideBalanceChannels: thunk(actions => {
    actions.setBalanceChannels({ visible: false });
  }),

  setImageUpdates: action((state, payload) => {
    state.imageUpdates = {
      ...state.imageUpdates,
      ...payload,
    };
  }),
  showImageUpdates: thunk(actions => {
    actions.setImageUpdates({ visible: true });
  }),
  hideImageUpdates: thunk(actions => {
    actions.setImageUpdates({ visible: false });
  }),
  setSendOnChain: action((state, payload) => {
    state.sendOnChain = {
      ...state.sendOnChain,
      ...payload,
    };
  }),
  showSendOnChain: thunk((actions, { toAddress, backendName, amount }) => {
    actions.setSendOnChain({ visible: true, toAddress, backendName, amount });
  }),
  hideSendOnChain: thunk(actions => {
    actions.setSendOnChain({
      visible: false,
      toAddress: undefined,
      backendName: undefined,
      amount: undefined,
    });
  }),
  setAssetInfo: action((state, payload) => {
    state.assetInfo = {
      ...state.assetInfo,
      ...payload,
    };
  }),
  showAssetInfo: thunk((actions, { assetId, nodeName }) => {
    actions.setAssetInfo({ visible: true, assetId, nodeName });
  }),
  hideAssetInfo: thunk(actions => {
    actions.setAssetInfo({
      visible: false,
      assetId: undefined,
      nodeName: undefined,
    });
  }),
  showMintAsset: thunk(
    async (actions, { nodeName, networkId }, { getStoreState, getStoreActions }) => {
      actions.setMintAsset({ visible: true, nodeName });

      // get the wallet balance for the associated LND node when we show the modal
      const network = getStoreState().network.networks.find(n => n.id === networkId);
      if (nodeName && network) {
        const lndNode = getTapBackendNode(nodeName, network);
        if (lndNode) {
          await getStoreActions().lightning.getWalletBalance(lndNode);
          actions.setMintAsset({ lndName: lndNode.name });
        }
      }
    },
  ),
  hideMintAsset: thunk(actions => {
    actions.setMintAsset({
      visible: false,
      nodeName: undefined,
      networkId: undefined,
      lndName: undefined,
    });
  }),
  setMintAsset: action((state, payload) => {
    state.mintAsset = {
      ...state.mintAsset,
      ...payload,
    };
  }),
  showNewAddress: thunk(
    (actions, { nodeName, networkId }, { getStoreState, getStoreActions }) => {
      actions.setNewAddress({ visible: true, nodeName, networkId });

      // get the wallet balance for the associated LND node when we show the modal
      const network = getStoreState().network.networks.find(n => n.id === networkId);
      if (network) {
        getStoreActions().designer.syncChart(network);
      }
    },
  ),
  hideNewAddress: thunk(actions => {
    actions.setNewAddress({ visible: false });
  }),
  setNewAddress: action((state, payload) => {
    state.newAddress = {
      ...state.newAddress,
      ...payload,
    };
  }),
  showSendAsset: thunk(
    async (actions, { nodeName, networkId }, { getStoreState, getStoreActions }) => {
      actions.setSendAsset({ visible: true, nodeName });

      // get the wallet balance for the associated LND node when we show the modal
      const network = getStoreState().network.networks.find(n => n.id === networkId);
      if (nodeName && network) {
        const lndNode = getTapBackendNode(nodeName, network);
        if (lndNode) {
          await getStoreActions().lightning.getWalletBalance(lndNode);
          actions.setSendAsset({ visible: true, lndName: lndNode.name });
        }
      }
    },
  ),
  hideSendAsset: thunk(actions => {
    actions.setSendAsset({ visible: false });
  }),
  setSendAsset: action((state, payload) => {
    state.sendAsset = {
      ...state.sendAsset,
      ...payload,
    };
  }),
  showChangeTapBackend: thunk((actions, { tapName, lndName, linkId }) => {
    actions.setChangeTapBackend({ visible: true, tapName, lndName, linkId });
  }),
  hideChangeTapBackend: thunk((actions, payload, { getStoreActions, getState }) => {
    const { linkId } = getState().changeTapBackend;
    if (linkId) {
      // remove the link on the chart if the backend wasn't changed
      getStoreActions().designer.removeLink(linkId);
    }
    actions.setChangeTapBackend({ visible: false });
  }),
  setChangeTapBackend: action((state, payload) => {
    state.changeTapBackend = {
      ...state.changeTapBackend,
      ...payload,
    };
  }),
  setRenameNode: action((state, payload) => {
    state.renameNode = {
      ...state.renameNode,
      ...payload,
    };
  }),
  showRenameNode: thunk((actions, { oldNodeName }) => {
    actions.setRenameNode({ visible: true, oldNodeName });
  }),
  hideRenameNode: thunk(actions => {
    actions.setRenameNode({
      visible: false,
      oldNodeName: undefined,
    });
  }),
  setLncSessionInfo: action((state, payload) => {
    state.lncSessionInfo = {
      ...state.lncSessionInfo,
      ...payload,
    };
  }),
  showLncSessionInfo: thunk((actions, { sessionId, nodeName }) => {
    actions.setLncSessionInfo({ visible: true, sessionId, nodeName });
  }),
  hideLncSessionInfo: thunk(actions => {
    actions.setLncSessionInfo({
      visible: false,
      sessionId: undefined,
      nodeName: undefined,
    });
  }),
  setAddLncSession: action((state, payload) => {
    state.addLncSession = {
      ...state.addLncSession,
      ...payload,
    };
  }),
  showAddLncSession: thunk((actions, { nodeName, pairingPhrase }) => {
    actions.setAddLncSession({ visible: true, nodeName, pairingPhrase });
  }),
  hideAddLncSession: thunk(actions => {
    actions.setAddLncSession({
      visible: false,
      nodeName: undefined,
    });
  }),
};

export default modalsModel;
