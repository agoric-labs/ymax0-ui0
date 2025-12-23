/**
 * EIP-712 utilities for OpenPortfolio intent and Permit2 signatures
 */

import type {
  EIP712Domain,
  EIP712Types,
  OpenPortfolioIntent,
  TargetAllocation,
  TokenAmount,
} from './evm-portfolio-types';

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
export const getOpenPortfolioTypes = (): EIP712Types => ({
  OpenPortfolio: [
    { name: 'depositor', type: 'address' },
    { name: 'deposit', type: 'TokenAmount' },
    { name: 'allocations', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
  TokenAmount: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
});

/**
 * Create OpenPortfolio intent message for EIP-712 signing
 *
 * @param depositorAddress - EVM address of the user (0x...)
 * @param depositAmount - Amount to deposit in smallest unit (e.g., 1000000 for 1 USDC)
 * @param allocations - Target allocations with portions
 * @param options - Optional nonce and deadline (defaults provided)
 * @returns EIP-712 message ready for signing
 */
export const createOpenPortfolioIntent = (
  depositorAddress: string,
  depositAmount: bigint,
  allocations: TargetAllocation[],
  options?: {
    nonce?: bigint;
    deadline?: bigint;
    tokenAddress?: string;
  },
): OpenPortfolioIntent => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const nonce = options?.nonce ?? now;
  const deadline = options?.deadline ?? now + 3600n; // 1 hour default
  const tokenAddress = options?.tokenAddress ?? SEPOLIA_CONTRACTS.USDC;

  // Convert allocations to a format compatible with EIP-712
  // Using JSON string to work around EIP-712's limitation with dynamic arrays
  const allocationsData = allocations.map(a => ({
    instrument: a.instrument,
    portion: a.portion.toString(),
  }));

  const deposit: TokenAmount = {
    token: tokenAddress,
    amount: depositAmount.toString(),
  };

  return {
    depositor: depositorAddress,
    deposit,
    allocations: JSON.stringify(allocationsData),
    nonce: nonce.toString(),
    deadline: deadline.toString(),
  };
};

/**
 * Format USDC amount for display (converts from smallest unit to human-readable)
 *
 * @param amount - Amount in smallest unit (e.g., 1000000 for 1 USDC)
 * @param decimals - Number of decimals (6 for USDC)
 * @returns Human-readable string (e.g., "1.0")
 */
export const formatUSDCAmount = (amount: bigint, decimals = 6): string => {
  const divisor = 10n ** BigInt(decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === 0n) {
    return wholePart.toString();
  }

  // Pad fractional part with leading zeros if needed
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  // Remove trailing zeros
  const trimmedFractional = fractionalStr.replace(/0+$/, '');

  return `${wholePart}.${trimmedFractional}`;
};

/**
 * Parse USDC amount from human-readable to smallest unit
 *
 * @param amount - Human-readable amount (e.g., "1.5" or "15")
 * @param decimals - Number of decimals (6 for USDC)
 * @returns Amount in smallest unit
 */
export const parseUSDCAmount = (amount: string, decimals = 6): bigint => {
  const parts = amount.split('.');
  const wholePart = BigInt(parts[0] || '0');
  const fractionalPart = parts[1] || '';

  // Pad or truncate fractional part to match decimals
  const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
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
export const validateAllocations = (
  allocations: TargetAllocation[],
): void => {
  if (allocations.length === 0) {
    throw new Error('At least one allocation is required');
  }

  for (const alloc of allocations) {
    if (alloc.portion <= 0) {
      throw new Error(`Invalid portion for ${alloc.instrument}: must be positive`);
    }
    if (!Number.isInteger(alloc.portion)) {
      throw new Error(`Invalid portion for ${alloc.instrument}: must be an integer`);
    }
  }

  // Check for duplicate instruments
  const instruments = new Set(allocations.map(a => a.instrument));
  if (instruments.size !== allocations.length) {
    throw new Error('Duplicate instruments in allocations');
  }
};
