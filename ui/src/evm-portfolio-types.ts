/**
 * Types for EVM wallet portfolio integration with EIP-712 signatures
 */

import type { PermitTransferFrom } from '@uniswap/permit2-sdk';

export type { PermitTransferFrom };

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
  portion: number; // Numerator; denominator is sum of all portions
}

/**
 * Amount with token address for EIP-712
 * Using address ensures MetaMask displays the correct token icon
 */
export interface TokenAmount {
  token: `0x${string}`; // ERC-20 token address (e.g., USDC)
  amount: `${number}`; // Amount in smallest unit (e.g., "1000000" for 1 USDC with 6 decimals)
}

/**
 * EIP-712 Domain for YMax Portfolio Authorization
 * chainId is required for proper EIP-712 validation
 */
export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract?: string; // Optional: only needed if validating against a specific contract
}

/**
 * EIP-712 Types definition
 * TODO: Check if viem exports a standard type for this
 */
export type EIP712Types = Record<string, Array<{ name: string; type: string }>>;

/**
 * OpenPortfolio intent message for EIP-712 signing
 * Note: depositor address is not included as it can be recovered from the signature
 * Allocations are an array of Allocation structs for clear MetaMask display
 */
export interface OpenPortfolioIntent {
  deposit: TokenAmount; // Deposit amount with token address
  allocations: Array<{ instrument: string; portion: `${number}` }>; // Array of allocations
  nonce: `${number}`; // Unique nonce (typically timestamp)
  deadline: `${number}`; // Unix timestamp
}

/**
 * Combined signed data for submission
 * Uses standard Permit2 PermitTransferFrom type
 */
export interface SignedOpenPortfolio {
  permitSignature: string;
  intentSignature: string;
  permit: {
    permitted: {
      token: string;
      amount: string;
    };
    spender: string;
    nonce: string;
    deadline: string;
  };
  intent: OpenPortfolioIntent;
}
