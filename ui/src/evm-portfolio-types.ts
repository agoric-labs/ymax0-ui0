/**
 * Types for EVM wallet portfolio integration with EIP-712 signatures
 */

import type { Address, AbiTypeToPrimitiveType as EVM_T } from 'abitype';
import type {
  TargetAllocation,
  YmaxPermitWitnessTransferFromData,
  YmaxStandaloneOperationData,
} from '@agoric/portfolio-api/src/evm-wallet/eip712-messages.ts';
import type { PermitTransferFrom } from '@agoric/orchestration/src/utils/permit2.ts';
import type { Bech32Address } from '@agoric/cosmic-proto/address-hooks.js';
import type { WithSignature } from '@agoric/orchestration/src/utils/viem.ts';

export type { TargetAllocation };

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
