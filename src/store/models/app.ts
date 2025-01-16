import { getI18n } from 'react-i18next';
import { shell } from 'electron';
import { warn } from 'electron-log';
import { notification } from 'antd';
import { ArgsProps } from 'antd/lib/notification';
import { push } from 'connected-react-router';
import { Action, action, Computed, computed, Thunk, thunk } from 'easy-peasy';
import { ipcChannels } from 'shared';
import { NodeImplementation } from 'shared/types';
import {
  AppSettings,
  CustomImage,
  DockerRepoState,
  DockerRepoUpdates,
  DockerVersions,
  ManagedImage,
  StoreInjections,
} from 'types';
import { BasePorts, defaultRepoState } from 'utils/constants';
import { isWindows } from 'utils/system';
import { changeTheme } from 'utils/theme';
import { NETWORK_VIEW } from 'components/routing';
import { RootModel } from './';

export interface NotifyOptions {
  message: string;
  description?: string;
  error?: Error;
}

export interface AppModel {
  initialized: boolean;
  settings: AppSettings;
  dockerVersions: DockerVersions;
  // images that have been pulled/downloaded from Docker Hub
  dockerImages: string[];
  // all images that are available on Docker Hub
  dockerRepoState: DockerRepoState;
  computedManagedImages: Computed<AppModel, ManagedImage[]>;
  setInitialized: Action<AppModel, boolean>;
  setSettings: Action<AppModel, Partial<AppSettings>>;
  loadSettings: Thunk<AppModel, void, StoreInjections, RootModel>;
  updateSettings: Thunk<AppModel, Partial<AppSettings>, StoreInjections, RootModel>;
  updateManagedImage: Thunk<AppModel, ManagedImage, StoreInjections, RootModel>;
  saveCustomImage: Thunk<AppModel, CustomImage, StoreInjections, RootModel>;
  removeCustomImage: Thunk<AppModel, CustomImage, StoreInjections, RootModel>;
  initialize: Thunk<AppModel, void, StoreInjections, RootModel>;
  setDockerVersions: Action<AppModel, DockerVersions>;
  getDockerVersions: Thunk<AppModel, { throwErr?: boolean }, StoreInjections, RootModel>;
  setDockerImages: Action<AppModel, string[]>;
  getDockerImages: Thunk<AppModel, void, StoreInjections, RootModel>;
  setRepoState: Action<AppModel, DockerRepoState>;
  loadRepoState: Thunk<AppModel, void, StoreInjections, RootModel>;
  saveRepoState: Thunk<AppModel, DockerRepoState, StoreInjections, RootModel>;
  queryRepoUpdates: Thunk<AppModel, void, StoreInjections, RootModel>;
  checkForRepoUpdates: Thunk<
    AppModel,
    void,
    StoreInjections,
    RootModel,
    Promise<DockerRepoUpdates>
  >;
  notify: Action<AppModel, NotifyOptions>;
  navigateTo: Thunk<AppModel, string>;
  navigateToNetwork: Thunk<AppModel, number, StoreInjections, RootModel>;
  openInBrowser: Action<AppModel, string>;
  openWindow: Thunk<AppModel, string, StoreInjections, RootModel>;
  clearAppCache: Thunk<AppModel, void, StoreInjections, RootModel>;
}

const appModel: AppModel = {
  // state properties
  initialized: false,
  settings: {
    lang: getI18n().language,
    theme: 'dark',
    checkForUpdatesOnStartup: false,
    nodeImages: {
      managed: [],
      custom: [],
    },
    newNodeCounts: {
      LND: 1,
      'c-lightning': 1,
      eclair: 1,
      bitcoind: 1,
      btcd: 0,
      tapd: 0,
      litd: 0,
    },
    basePorts: {
      LND: { grpc: BasePorts.LND.grpc, rest: BasePorts.LND.rest },
      bitcoind: { rest: BasePorts.bitcoind.rest },
      'c-lightning': {
        grpc: BasePorts['c-lightning'].grpc,
        rest: BasePorts['c-lightning'].rest,
      },
      eclair: { rest: BasePorts.eclair.rest },
      tapd: { grpc: BasePorts.tapd.grpc, rest: BasePorts.tapd.rest },
    },
  },
  dockerVersions: { docker: '', compose: '' },
  dockerImages: [],
  dockerRepoState: defaultRepoState,
  // computed properties
  computedManagedImages: computed(state => {
    // the list of managed nodes should be computed to merge the user-defined
    // commands with the hard-coded nodes
    const nodes: ManagedImage[] = [];
    const { managed } = state.settings.nodeImages;
    Object.entries(state.dockerRepoState.images).forEach(([type, entry]) => {
      entry.versions.forEach(version => {
        // search for a custom command saved in settings
        const m = managed.find(n => n.implementation === type && n.version === version);
        nodes.push({
          implementation: type as NodeImplementation,
          version,
          command: m ? m.command : '',
        });
      });
    });
    return nodes;
  }),
  // reducer actions (mutations allowed thx to immer)
  setInitialized: action((state, initialized) => {
    state.initialized = initialized;
  }),
  initialize: thunk(async (actions, _, { getStoreActions, getState }) => {
    await actions.loadSettings();
    await actions.loadRepoState();
    await getStoreActions().network.load();
    await actions.getDockerVersions({});
    await actions.getDockerImages();
    if (getState().settings.checkForUpdatesOnStartup) {
      await actions.queryRepoUpdates();
    }
    actions.setInitialized(true);
  }),
  setSettings: action((state, settings) => {
    state.settings = {
      ...state.settings,
      ...settings,
    };
  }),
  loadSettings: thunk(async (actions, _, { injections, getState }) => {
    // before loading settings, set the default CLN count to 0 on Windows
    if (isWindows()) {
      actions.setSettings({
        newNodeCounts: {
          ...getState().settings.newNodeCounts,
          LND: 2,
          'c-lightning': 0,
        },
      });
    }

    const settings = await injections.settingsService.load();
    if (settings) {
      actions.setSettings(settings);
      await getI18n().changeLanguage(settings.lang);
      changeTheme(settings.theme || 'dark');
    }
  }),
  updateSettings: thunk(async (actions, updates, { injections, getState }) => {
    actions.setSettings(updates);
    const { settings } = getState();
    await injections.settingsService.save(settings);
    if (updates.lang) await getI18n().changeLanguage(settings.lang);
    if (updates.theme) changeTheme(updates.theme);
  }),
  updateManagedImage: thunk(async (actions, node, { getState }) => {
    const { nodeImages } = getState().settings;
    // create a list of nodes excluding the one being updated
    const managed = nodeImages.managed.filter(
      n => !(n.implementation === node.implementation && n.version === node.version),
    );
    // add the updated node to the list if the command is not blank
    if (node.command) managed.push(node);
    // update the settings in state and on disk
    await actions.updateSettings({
      nodeImages: { ...nodeImages, managed },
    });
  }),
  saveCustomImage: thunk(async (actions, node, { getState }) => {
    const { nodeImages } = getState().settings;
    let custom: CustomImage[];
    if (node.id) {
      // if updating, overwrite the existing node
      custom = nodeImages.custom.map(c => (c.id === node.id ? node : c));
    } else {
      // add new node
      node.id = `${Date.now()}`;
      custom = [node, ...nodeImages.custom];
    }
    // update the settings in state and on disk
    await actions.updateSettings({
      nodeImages: { ...nodeImages, custom },
    });
  }),
  removeCustomImage: thunk(async (actions, node, { getState }) => {
    const { nodeImages } = getState().settings;
    // remove the custom node
    const custom = nodeImages.custom.filter(c => c.id !== node.id);
    // update the settings in state and on disk
    await actions.updateSettings({
      nodeImages: { ...nodeImages, custom },
    });
  }),
  setDockerVersions: action((state, versions) => {
    state.dockerVersions = versions;
  }),
  getDockerVersions: thunk(async (actions, { throwErr }, { injections }) => {
    const versions = await injections.dockerService.getVersions(throwErr);
    actions.setDockerVersions(versions);
  }),
  setDockerImages: action((state, images) => {
    state.dockerImages = images;
  }),
  getDockerImages: thunk(async (actions, payload, { injections }) => {
    const images = await injections.dockerService.getImages();
    actions.setDockerImages(images);
  }),
  setRepoState: action((state, repoState) => {
    state.dockerRepoState = repoState;
  }),
  loadRepoState: thunk(async (actions, _, { injections, getState }) => {
    const defaultState = getState().dockerRepoState;
    const fileState = await injections.repoService.load();
    // only use the file version if it is greater than the default hard-coded version
    if (fileState && fileState.version > defaultState.version) {
      actions.setRepoState(fileState);
    }
  }),
  saveRepoState: thunk(async (actions, repoState, { injections }) => {
    await injections.repoService.save(repoState);
    actions.setRepoState(repoState);
  }),
  queryRepoUpdates: thunk(async (actions, payload, { getStoreActions }) => {
    try {
      const res = await actions.checkForRepoUpdates();
      if (res.updates) {
        getStoreActions().modals.showImageUpdates();
      }
    } catch (error) {
      // just log errors and don't display them in the UI
      warn('Failed to check for image updates', error);
    }
  }),
  checkForRepoUpdates: thunk(async (actions, payload, { injections, getState }) => {
    const { dockerRepoState } = getState();
    return injections.repoService.checkForUpdates(dockerRepoState);
  }),
  notify: action((state, { message, description, error }) => {
    const options = {
      placement: 'bottomRight',
      bottom: 50,
    } as ArgsProps;
    if (!error) {
      notification.success({
        ...options,
        message: message,
        description,
      });
    } else {
      let desc = description || error.message;
      if (desc.length > 255) desc = desc.slice(0, 255) + '...';
      notification.error({
        ...options,
        duration: 10,
        message: message,
        description: desc,
      });
      warn(message, error);
    }
  }),
  navigateTo: thunk((actions, route, { dispatch }) => {
    dispatch(push(route));
  }),
  navigateToNetwork: thunk((actions, id, { dispatch, getStoreActions }) => {
    // Navigating to a network requires a bit more work than just changing the route.
    // This may be able to be refactored into a useAsync func in NetworkView
    // set the active chart Id
    getStoreActions().designer.setActiveId(id);
    // reset the lightning nodes state
    getStoreActions().lightning.clearNodes();
    // reset the bitcoin nodes state
    getStoreActions().bitcoin.clearNodes();
    // reset the tap nodes state
    getStoreActions().tap.clearNodes();
    // change the route
    dispatch(push(NETWORK_VIEW(id)));
  }),
  openInBrowser: action((state, url) => {
    shell.openExternal(url);
  }),
  openWindow: thunk(async (actions, url, { injections }) => {
    await injections.ipc(ipcChannels.openWindow, { url });
  }),
  clearAppCache: thunk(async (actions, payload, { injections }) => {
    await injections.ipc(ipcChannels.clearCache);
  }),
};

export default appModel;
