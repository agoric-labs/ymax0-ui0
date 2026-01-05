/**
 * EIP-712 utilities for OpenPortfolio intent and Permit2 signatures
 */

import { TypedDataParameter } from 'viem';
import { SignTypedDataParameters } from 'viem/actions';
import type {
  EIP712Domain,
  OpenPortfolioIntent,
  TargetAllocation,
  TokenAmount,
} from './evm-portfolio-types';
import { sepolia } from 'viem/chains';

/**
 * Contract addresses for Sepolia testnet
 * Source: https://docs.uniswap.org/contracts/v4/deployments#sepolia-11155111
 * Source: https://developers.circle.com/stablecoins/usdc-contract-addresses#testnet
 */
export const SEPOLIA_CONTRACTS = {
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  FACTORY: '0x9F9684d7FA7318698a0030ca16ECC4a01944836b', // YMax Factory
  CHAIN_ID: 11155111,
} as const;

/**
 * Time constants
 */
export const ONE_HOUR_IN_SECONDS = 3600n;

/**
 * Get EIP-712 domain for OpenPortfolio intent
 */
export const getOpenPortfolioDomain = (chainId: number): EIP712Domain => ({
  name: 'YMax Portfolio Authorization',
  version: '1',
  chainId,
});

/**
 * Get EIP-712 types for OpenPortfolio intent
 */
export const OpenPortfolioTypes = {
  OpenPortfolio: [
    { name: 'deposit', type: 'TokenAmount' },
    { name: 'allocations', type: 'Allocation[]' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
  TokenAmount: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  Allocation: [
    { name: 'instrument', type: 'string' },
    { name: 'portion', type: 'uint256' },
  ],
} as const satisfies Record<string, readonly TypedDataParameter[]>;

/**
 * Create OpenPortfolio intent message for EIP-712 signing
 *
 * Note: depositorAddress parameter is kept for validation but not included in the message.
 * The depositor can be recovered from the signature using ecRecover.
 *
 * @param depositAmount - Amount to deposit in smallest unit (e.g., 1000000 for 1 USDC)
 * @param allocations - Target allocations with portions
 * @param options - Optional nonce and deadline (defaults provided)
 * @returns EIP-712 message ready for signing
 */
export const createOpenPortfolioIntent = (
  depositAmount: bigint,
  allocations: TargetAllocation[],
  options: {
    nonce?: bigint;
    deadline?: bigint;
    tokenAddress?: `0x${string}`;
  } = {},
): OpenPortfolioIntent => {
  const {
    nonce = BigInt(Math.floor(Date.now() / 1000)), // XXX ambient Date.now()
    deadline = nonce + ONE_HOUR_IN_SECONDS,
    tokenAddress = SEPOLIA_CONTRACTS.USDC,
  } = options;

  const deposit: TokenAmount = { token: tokenAddress, amount: depositAmount };

  return { deposit, allocations, nonce, deadline };
};

export const makeOpenPortfolioSignedData = (
  account: `0x${string}`,
  depositAmount: bigint,
  allocations: TargetAllocation[],
  options: {
    nonce?: bigint;
    deadline?: bigint;
    tokenAddress?: `0x${string}`;
    chainId?: number;
  } = {},
): SignTypedDataParameters<typeof OpenPortfolioTypes, 'OpenPortfolio'> => {
  const { tokenAddress = SEPOLIA_CONTRACTS.USDC, chainId = sepolia.id } =
    options;
  const domain = getOpenPortfolioDomain(chainId);
  const message = createOpenPortfolioIntent(depositAmount, allocations, {
    ...options,
    tokenAddress,
  });
  return {
    account,
    domain,
    types: OpenPortfolioTypes,
    primaryType: 'OpenPortfolio',
    message,
  };
};

/**
 * Format USDC amount for display (converts from smallest unit to human-readable)
 *
 * @param amount - Amount in smallest unit (e.g., 1000000 for 1 USDC)
 * @param decimals - Number of decimals (6 for USDC)
 * @returns Human-readable string (e.g., "1.0")
 */
export const formatUSDCAmount = (amount: bigint, decimals = 6): `${number}` => {
  const divisor = 10n ** BigInt(decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === 0n) {
    return `${wholePart}` as `${number}`;
  }

  // Pad fractional part with leading zeros if needed
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  // Remove trailing zeros
  const trimmedFractional = fractionalStr.replace(/0+$/, '');

  return `${wholePart}.${trimmedFractional}` as `${number}`;
};

/**
 * Parse USDC amount from human-readable to smallest unit
 *
 * @param amount - Human-readable amount (e.g., "1.5" or "15")
 * @param decimals - Number of decimals (6 for USDC)
 * @returns Amount in smallest unit
 */
export const parseUSDCAmount = (amount: `${number}`, decimals = 6): bigint => {
  const parts = amount.split('.');
  const wholePart = BigInt(parts[0] || '0');
  const fractionalPart = parts[1] || '';

  // Pad or truncate fractional part to match decimals
  const paddedFractional = fractionalPart
    .padEnd(decimals, '0')
    .slice(0, decimals);
  const fractionalValue = BigInt(paddedFractional);

  const multiplier = 10n ** BigInt(decimals);
  return wholePart * multiplier + fractionalValue;
};

/**
 * Validate allocations sum and structure
 *
 * @param allocations - Target allocations to validate
 * @throws Error if allocations are invalid
 */
export const validateAllocations = (allocations: TargetAllocation[]): void => {
  if (allocations.length === 0) {
    throw new Error('At least one allocation is required');
  }

  for (const alloc of allocations) {
    if (typeof alloc.portion !== 'bigint') {
      throw new Error(
        `Invalid portion for ${alloc.instrument}: must be an integer`,
      );
    }
    if (alloc.portion <= 0n) {
      throw new Error(
        `Invalid portion for ${alloc.instrument}: must be positive`,
      );
    }
  }

  // Check for duplicate instruments
  const instruments = new Set(allocations.map(a => a.instrument));
  if (instruments.size !== allocations.length) {
    throw new Error('Duplicate instruments in allocations');
  }
};

/**
 * Witness utilities for Permit2 signatures
 *
 * TODO: Witness parameters are preliminary and may need adjustments
 * based on final contract requirements. See createAndDeposit.ts for reference.
 */

/**
 * Witness type definition for EIP-712
 * This defines the structure of the witness data
 */
export const WITNESS_TYPE = {
  CreateWallet: [
    { name: 'allocations', type: 'Allocation[]' },
    { name: 'nonce', type: 'uint256' },
    // note: chainId is in permit2 domain; factory address is spender in message

    // UX / legibility ideas, to confirm with product
    { name: 'operation', type: 'string' },
  ],
  Allocation: [
    { name: 'instrument', type: 'string' },
    { name: 'portion', type: 'uint256' },
  ],
};

/**
 * Witness type string for Permit2
 * Format: "[WitnessType] witness)[WitnessTypeDefinition]TokenPermissions(address token,uint256 amount)"
 */
export const WITNESS_TYPE_STRING =
  'CreateWallet witness)CreateWallet(string owner,uint256 chainId,address factory)TokenPermissions(address token,uint256 amount)' as const;
