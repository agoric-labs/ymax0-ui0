/**
 * Types for EVM wallet portfolio integration with EIP-712 signatures
 */

import type {
  PermitTransferFrom,
  PermitBatchTransferFrom,
} from '@uniswap/permit2-sdk';
import type { AbiTypeToPrimitiveType as EVM_T } from 'abitype';
import { TypedDataDomain } from 'viem';

export type { PermitTransferFrom, PermitBatchTransferFrom };

/**
 * Target allocation for portfolio positions.
 * Uses 'portion' (not 'basisPoints') to allow flexible ratios.
 * The denominator is implicitly the sum of all portions.
 *
 * Examples:
 * - [{instrument: 'A', portion: 60}, {instrument: 'B', portion: 40}] => 60:40 ratio
 * - [{instrument: 'A', portion: 6}, {instrument: 'B', portion: 4}] => 6:4 ratio (same as 60:40)
 */
export interface TargetAllocation {
  instrument: string;
  portion: EVM_T<'uint256'>; // Numerator; denominator is sum of all portions
}

/**
 * Amount with token address for EIP-712
 * Using address ensures MetaMask displays the correct token icon
 */
export interface TokenAmount {
  token: EVM_T<'address'>; // ERC-20 token address (e.g., USDC)
  amount: EVM_T<'uint256'>; // Amount in smallest unit (e.g., 1_000_000n for 1 USDC with 6 decimals)
}

/**
 * EIP-712 Domain for YMax Portfolio Authorization
 * chainId is required for proper EIP-712 validation
 */
export interface EIP712Domain extends TypedDataDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract?: EVM_T<'address'>; // Optional: only needed if validating against a specific contract
}

/**
 * OpenPortfolio intent message for EIP-712 signing
 * Note: depositor address is not included as it can be recovered from the signature
 * Allocations are an array of Allocation structs for clear MetaMask display
 */
export interface OpenPortfolioIntent {
  deposit: TokenAmount;
  allocations: Readonly<
    Array<{ instrument: string; portion: EVM_T<'uint256'> }>
  >;
  nonce: EVM_T<'uint256'>; // Unique nonce (typically timestamp)
  deadline: EVM_T<'uint256'>; // Unix timestamp
}

/**
 * Witness data for Permit2 signature
 * Adds additional validated data to the permit signature
 *
 * TODO: This witness structure is preliminary and may change based on
 * final Factory contract requirements. See createAndDeposit.ts for reference.
 */
export interface CreateWalletWitness {
  owner: string; // Agoric smart wallet owner address
  chainId: EVM_T<'uint256'>; // EVM chain ID
  factory: EVM_T<'address'>; // Factory contract address
}

/**
 * Combined signed data for submission
 * Uses Permit2 PermitBatchTransferFrom type (array of permitted tokens)
 */
export interface SignedOpenPortfolio {
  permitSignature: string;
  permit: PermitBatchTransferFrom;
  intent: OpenPortfolioIntent;
  witness: `0x${string}`;
  // not needed? witnessTypeString: string;
}
