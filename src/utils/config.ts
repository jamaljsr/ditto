import { remote } from 'electron';
import { join } from 'path';
import { NodeImplementation } from 'shared/types';
import { Network } from 'types';
import { dockerConfigs } from './constants';
import { existsSync } from 'fs';

/**
 * XDG-compliant path where application data is stored
 */
export const xdgDataPath = join(remote.app.getPath('home'), '.local', 'share', 'polar');

/**
 * root path where application data is stored
 */
export const dataPath = existsSync(xdgDataPath)
  ? xdgDataPath
  : join(remote.app.getPath('home'), '.polar');

/**
 * legacy path where application data was stored in v0.1.0
 */
export const legacyDataPath = join(remote.app.getPath('userData'), 'data');

/**
 * path where networks data is stored
 */
export const networksPath = join(dataPath, 'networks');

/**
 * returns a path to store data for an individual node
 */
export const nodePath = (
  network: Network,
  implementation: NodeImplementation | 'simln',
  name: string,
): string =>
  join(network.path, 'volumes', dockerConfigs[implementation].volumeDirName, name);
