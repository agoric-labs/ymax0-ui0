/**
 * EIP-712 utilities for OpenPortfolio intent and Permit2 signatures
 */

import { Address } from 'viem';
import {
  getPermitWitnessTransferFromData,
  type TokenPermissions,
} from './evm/permit2/signatureTransfer.ts';
import { type TargetAllocation, getYmaxWitness } from './evm/ymax-eip712.ts';

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
 * Create OpenPortfolio intent message for EIP-712 signing
 *
 * Note: The depositor can be recovered from the signature using ecRecover.
 *
 * @param depositAmount - Amount to deposit in smallest unit (e.g., 1000000 for 1 USDC)
 * @param allocations - Target allocations with portions
 * @param options - Optional nonce and deadline (defaults provided)
 * @returns EIP-712 message ready for signing
 */
export const createOpenPortfolioMessage = (
  depositAmount: bigint,
  allocations: TargetAllocation[],
  options: {
    nonce?: bigint;
    deadline?: bigint;
    tokenAddress?: Address;
    factoryAddress?: Address;
    permit2Address?: Address;
    chainId?: bigint | number;
  } = {},
) => {
  const {
    nonce = BigInt(Math.floor(Date.now() / 1000)), // XXX ambient Date.now()
    deadline = nonce + ONE_HOUR_IN_SECONDS,
    tokenAddress = SEPOLIA_CONTRACTS.USDC,
    factoryAddress = SEPOLIA_CONTRACTS.FACTORY,
    permit2Address = SEPOLIA_CONTRACTS.PERMIT2,
    chainId = SEPOLIA_CONTRACTS.CHAIN_ID,
  } = options;

  const deposit: TokenPermissions = {
    token: tokenAddress,
    amount: depositAmount,
  };

  const witness = getYmaxWitness('OpenPortfolio', { allocations });

  return getPermitWitnessTransferFromData(
    { permitted: deposit, spender: factoryAddress, nonce, deadline },
    permit2Address,
    chainId,
    witness,
  );
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
