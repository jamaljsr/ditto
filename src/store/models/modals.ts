import { Action, action, Thunk, thunk } from 'easy-peasy';
import { StoreInjections } from 'types';
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
  invoice?: string;
  amount?: number;
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
}

interface NewAddressModel {
  visible: boolean;
  nodeName?: string;
  amount?: string;
  genesisBootstrapInfo?: string;
  address?: string;
}

export interface ModalsModel {
  openChannel: OpenChannelModel;
  changeBackend: ChangeBackendModel;
  createInvoice: CreateInvoiceModel;
  payInvoice: PayInvoiceModel;
  advancedOptions: AdvancedOptionsModel;
  imageUpdates: ImageUpdatesModel;
  sendOnChain: SendOnChainModel;
  assetInfo: AssetInfoModel;
  mintAsset: MintAssetModel;
  newAddress: NewAddressModel;
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
  showMintAsset: Thunk<ModalsModel, Partial<MintAssetModel>, StoreInjections>;
  hideMintAsset: Thunk<ModalsModel>;
  showNewAddress: Thunk<ModalsModel, Partial<NewAddressModel>, StoreInjections>;
  hideNewAddress: Thunk<ModalsModel>;
  setNewAddress: Action<ModalsModel, Partial<NewAddressModel>>;
}

const modalsModel: ModalsModel = {
  openChannel: { visible: false },
  mintAsset: { visible: false },
  newAddress: { visible: false },
  changeBackend: { visible: false },
  createInvoice: { visible: false },
  payInvoice: { visible: false },
  advancedOptions: { visible: false },
  imageUpdates: { visible: false },
  sendOnChain: { visible: false },
  assetInfo: { visible: false },
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
  showCreateInvoice: thunk((actions, { nodeName, invoice, amount }) => {
    actions.setCreateInvoice({ visible: true, nodeName, invoice, amount });
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
  showMintAsset: thunk((actions, { nodeName }) => {
    actions.setMintAsset({ visible: true, nodeName });
  }),
  hideMintAsset: thunk(actions => {
    actions.setMintAsset({ visible: false });
  }),
  setMintAsset: action((state, payload) => {
    state.mintAsset = {
      ...state.mintAsset,
      ...payload,
    };
  }),
  //New Taro Address Modal
  showNewAddress: thunk((actions, { nodeName }) => {
    actions.setNewAddress({ visible: true, nodeName });
  }),
  hideNewAddress: thunk(actions => {
    actions.setNewAddress({ visible: false });
  }),
  setNewAddress: action((state, payload) => {
    state.newAddress = {
      ...state.newAddress,
      ...payload,
    };
  }),
};

export default modalsModel;
