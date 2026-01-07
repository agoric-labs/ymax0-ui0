/**
 * Types for EVM wallet portfolio integration with EIP-712 signatures
 */

import type { Address, AbiTypeToPrimitiveType as EVM_T } from 'abitype';
import type {
  TargetAllocation,
  YmaxPermitWitnessTransferFromData,
  YmaxStandaloneOperationData,
} from './evm/ymax-eip712.ts';
import type { PermitTransferFrom } from './evm/permit2/signatureTransfer';
import type { Bech32Address } from '@agoric/cosmic-proto/address-hooks.js';
import type { WithSignature } from './evm/viem.ts';

export { type TargetAllocation };

export type SignedMessage =
  | WithSignature<YmaxPermitWitnessTransferFromData<'OpenPortfolio'>>
  | WithSignature<YmaxPermitWitnessTransferFromData<'Rebalance'>>
  | WithSignature<YmaxStandaloneOperationData<'Rebalance'>>
  | WithSignature<YmaxPermitWitnessTransferFromData<'Deposit'>>
  | never;

/**
 * EVM payload expected by CreateAndDeposit in the factory contract.
 * See https://github.com/agoric-labs/agoric-to-axelar-local/blob/rs-permit2-contract-changes/packages/axelar-local-dev-cosmos/src/__tests__/contracts/DepositFactory.sol#L40-L54
 */
export type CreateAndDepositPayload = {
  lcaOwner: Bech32Address;
  tokenOwner: Address;
  permit: Readonly<PermitTransferFrom>;
  witness: EVM_T<'bytes32'>;
  witnessTypeString: string;
  signature: EVM_T<'bytes'>;
};
