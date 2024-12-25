import { useAsyncCallback } from 'react-async-hook';
import { useStoreActions } from 'store';
import { Network } from 'types';
import usePrefixedTranslation from './usePrefixedTranslation';

interface MiningAsync {
  execute: () => void;
  loading: boolean;
}

export const useMiningAsync = (network: Network, blocks = 1): MiningAsync => {
  const bitcoinNode = network.nodes.bitcoin[0];
  const { notify } = useStoreActions((s: any) => s.app);
  const { mine } = useStoreActions((s: any) => s.bitcoin);
  const { l } = usePrefixedTranslation('cmps.network.NetworkActions');

  return useAsyncCallback(async () => {
    try {
      await mine({ blocks, node: bitcoinNode });
    } catch (error: any) {
      notify({ message: l('mineError'), error });
    }
  });
};
