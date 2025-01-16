import { routerMiddleware } from 'connected-react-router';
import { createStore, createTypedHooks } from 'easy-peasy';
import { createHashHistory, History } from 'history';
import { createLogger } from 'redux-logger';
import { BitcoinFactory } from 'lib/bitcoin';
import { dockerService, repoService } from 'lib/docker';
import { createIpcSender } from 'lib/ipc/ipcService';
import { LightningFactory } from 'lib/lightning';
import { litdService } from 'lib/litd';
import { settingsService } from 'lib/settings';
import { TapFactory } from 'lib/tap';
import { createModel, RootModel } from 'store/models';
import { StoreInjections } from 'types';

export const hashHistory = createHashHistory();

export const createReduxStore = (options?: {
  initialState?: any;
  injections?: StoreInjections;
  history?: History | undefined;
}) => {
  const config = Object.assign({ history: hashHistory }, options);
  const { initialState, injections, history } = config;
  // Redux store Configuration
  const middleware = [];

  // Skip redux logs in console during the tests
  if (process.env.NODE_ENV !== 'test') {
    // Logging Middleware
    const logger = createLogger({
      collapsed: true,
      diff: true,
      predicate: (getState, action) => {
        // don't show thunk success actions in the console.
        // they can still be viewed in Redux DevTools if necessary
        return !/.*\(success\)/.test(action.type);
      },
    });

    middleware.push(logger);
  }

  // Router Middleware
  const router = routerMiddleware(history);
  middleware.push(router);

  const models = createModel(history);

  // create easy-peasy store
  return createStore(models, {
    initialState,
    injections,
    middleware,
  });
};

// using injections allows for more easily mocking of dependencies in store actions
// see https://easy-peasy.now.sh/docs/tutorials/testing.html#mocking-calls-to-services
const injections: StoreInjections = {
  ipc: createIpcSender('AppModel', 'app'),
  settingsService,
  dockerService,
  repoService,
  bitcoinFactory: new BitcoinFactory(),
  lightningFactory: new LightningFactory(),
  tapFactory: new TapFactory(),
  litdService,
};

const store = createReduxStore({ injections });

// export hooks directly from the store to get proper type inference
const typedHooks = createTypedHooks<RootModel>();
export const { useStoreActions, useStoreDispatch, useStoreState } = typedHooks;

// enable hot reload for models
if (process.env.NODE_ENV !== 'production') {
  if ((module as any).hot) {
    (module as any).hot.accept('./models', () => {
      const models = createModel(hashHistory);
      store.reconfigure(models);
    });
  }
}

export default store;
