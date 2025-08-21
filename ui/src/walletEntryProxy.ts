import type { BridgeAction } from '@agoric/smart-wallet/src/smartWallet.js';
import { signAndBroadcastAction, type KeplrLike, type WalletLike } from './walletAction';

export interface ReifyOptions {
  targetName: string;
  wallet: WalletLike;
  keplr: KeplrLike;
  chainId: string;
  marshaller?: { toCapData: (obj: any) => { body: string; slots: string[] } };
  rpcEndpoint?: string;
}

export interface ReifyTools {
  setName: (name: string, overwrite?: boolean) => void;
  setId: (id: number) => void;
}

export const reifyWalletEntry = <T>(options: ReifyOptions): { target: T; tools: ReifyTools } => {
  const { targetName, wallet, keplr, chainId, marshaller, rpcEndpoint } = options;
  let saveResult: { name: string; overwrite?: boolean } | undefined;
  let customId: number | undefined;

  const target = new Proxy(
    {},
    {
      get(_target, method, _receiver) {
        if (typeof method !== 'string') {
          throw new Error('Method must be a string');
        }

        const impl = async (...args: any[]) => {
          const id = customId || Date.now();

          const action: BridgeAction = harden({
            method: 'invokeEntry',
            message: {
              id,
              targetName,
              method,
              args,
              saveResult,
            },
          });

          try {
            const result = await signAndBroadcastAction(action, wallet, keplr, chainId, marshaller, rpcEndpoint);
            return result;
          } catch (error) {
            console.error('Wallet entry invocation failed:', error);
            throw error;
          }
        };

        return impl;
      },
    },
  ) as T;

  const tools: ReifyTools = {
    setName(name: string, overwrite = false) {
      saveResult = { name, overwrite };
    },
    setId(id: number) {
      customId = id;
    },
  };

  return { target, tools };
};
