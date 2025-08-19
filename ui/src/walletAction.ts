import { MsgWalletSpendAction } from '@agoric/cosmic-proto/agoric/swingset/msgs.js';
import { fromBech32 } from '@cosmjs/encoding';
import type { BridgeAction } from '@agoric/smart-wallet/src/smartWallet.js';
import type { StdFee } from '@cosmjs/stargate';
import { SigningStargateClient } from '@cosmjs/stargate';
import { Registry } from '@cosmjs/proto-signing';

const toAccAddress = (address: string): Uint8Array => {
  return fromBech32(address).data;
};

export interface KeplrLike {
  sendTx: (
    chainId: string,
    tx: Uint8Array,
    mode: any,
  ) => Promise<any>;
  getOfflineSigner: (chainId: string) => any;
}

export interface WalletLike {
  address: string;
  marshaller?: {
    toCapData: (obj: any) => { body: string; slots: string[] };
  };
}

export const signAndBroadcastAction = async (
  action: BridgeAction,
  wallet: WalletLike,
  keplr: KeplrLike,
  chainId: string,
  marshaller?: { toCapData: (obj: any) => { body: string; slots: string[] } },
  rpcEndpoint?: string,
): Promise<any> => {
  if (!marshaller) {
    throw new Error('Marshaller is required for signAndBroadcastAction');
  }

  if (!rpcEndpoint) {
    throw new Error('RPC endpoint is required for signAndBroadcastAction');
  }

  console.log('BridgeAction:', action);

  const msgSpend = MsgWalletSpendAction.fromPartial({
    owner: toAccAddress(wallet.address),
    spendAction: JSON.stringify(marshaller.toCapData(action)),
  });

  console.log('MsgWalletSpendAction:', msgSpend);

  const fee: StdFee = {
    amount: [{ denom: 'ubld', amount: '30000' }],
    gas: '197000',
  };

  // Create signing client using Keplr's offline signer
  const offlineSigner = keplr.getOfflineSigner(chainId);
  const registry = new Registry([[MsgWalletSpendAction.typeUrl, MsgWalletSpendAction]]);
  const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, offlineSigner, { registry });
  
  const result = await client.signAndBroadcast(
    wallet.address,
    [{ typeUrl: MsgWalletSpendAction.typeUrl, value: msgSpend }],
    fee,
  );
  
  return result;
};

export const createInvokeEntryAction = (
  targetName: string,
  method: string,
  args: any[],
  id: number = Date.now(),
): BridgeAction => {
  return {
    method: 'invokeEntry',
    message: {
      id,
      targetName,
      method,
      args,
    },
  };
};
