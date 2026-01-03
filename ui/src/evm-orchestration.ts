/**
 * EVM Orchestration utilities for invoking Factory.testExecute
 * Based on createAndDeposit.ts pattern
 */

import {
  Account,
  Chain,
  encodeAbiParameters,
  Transport,
  type Address,
  type PublicClient,
  type WalletClient,
} from 'viem';

import { getContract } from 'viem';
import type { SignedOpenPortfolio } from './evm-portfolio-types';
import { SEPOLIA_CONTRACTS } from './open-portfolio-eip712';

/**
 * Factory contract ABI (minimal interface for testExecute)
 */
const FACTORY_ABI = [
  {
    name: 'testExecute',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'payload', type: 'bytes' }],
    outputs: [],
  },
] as const;

/**
 * ERC20 contract ABI (minimal interface for approve and allowance)
 */
const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/**
 * Convert a normal 65-byte ECDSA signature (r,s,v) into EIP-2098 64-byte (r,vs).
 * vs = s with the highest bit set if v == 28 (or == 1 in 0/1 form)
 *
 * EIP-2098 compact signatures save 1 byte and are used by many contracts
 * including the Factory contract for Permit2 verification.
 */
export const toEip2098 = (signature65: `0x${string}`): `0x${string}` => {
  // Remove 0x prefix for processing
  const sig = signature65.slice(2);

  if (sig.length !== 130) {
    throw new Error(
      `Invalid signature length: expected 130 hex chars, got ${sig.length}`,
    );
  }

  const r = sig.slice(0, 64);
  const s = sig.slice(64, 128);
  const v = parseInt(sig.slice(128, 130), 16);

  // Convert s to BigInt
  const sBig = BigInt('0x' + s);

  // High bit mask (bit 255)
  const HIGH_BIT = 1n << 255n;

  // If v == 28 (or v == 1 in normalized form), set high bit; otherwise clear it
  // v can be 27/28 (standard) or 0/1 (normalized)
  const shouldSetBit = v === 28 || v === 1;
  const vsBig = shouldSetBit ? sBig | HIGH_BIT : sBig;

  // Convert back to hex (32 bytes = 64 hex chars)
  const vsHex = vsBig.toString(16).padStart(64, '0');

  return `0x${r}${vsHex}`;
};

export const createAndDepositParams = [
  {
    type: 'tuple',
    name: 'p',
    components: [
      { name: 'ownerStr', type: 'string' },
      { name: 'tokenOwner', type: 'address' },
      {
        name: 'permit',
        type: 'tuple',
        components: [
          {
            name: 'permitted',
            type: 'tuple',
            components: [
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
          },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
  },
] as const;

/**
 * Build the CreateAndDepositPayload for Factory.testExecute
 *
 * This encodes the permit and signature into the format expected by Factory.sol
 * The payload includes:
 * - ownerStr: Agoric address (e.g., "agoric1...")
 * - tokenOwner: EVM address of the token owner (EOA)
 * - permit: Permit2 PermitTransferFrom data
 * - signature: EIP-2098 compact signature (64 bytes)
 */
export const buildCreateAndDepositPayload = ({
  ownerStr,
  tokenOwner,
  permit,
  signature,
}: {
  ownerStr: string;
  tokenOwner: Address;
  permit: {
    permitted: { token: Address; amount: bigint };
    nonce: bigint;
    deadline: bigint;
  };
  signature: `0x${string}`;
}): `0x${string}` => {
  const abiEncodedData = encodeAbiParameters(createAndDepositParams, [
    { ownerStr, tokenOwner, permit, signature },
  ]);

  return abiEncodedData;
};

/**
 * Check and ensure USDC allowance for Permit2 contract
 *
 * Before using Permit2, the user must first approve the Permit2 contract
 * to spend their USDC tokens. This function checks the allowance and
 * prompts for approval if insufficient.
 *
 * See: https://medium.com/@rcontreraspimentel/a-comprehensive-guide-to-uniswaps-permit2-d945c7291d88
 */
export const ensurePermit2Allowance = async (
  amount: bigint,
  client: {
    public: PublicClient<Transport, Chain>;
    wallet: WalletClient<Transport, Chain, Account>;
  },
  onProgress?: (message: string) => void,
): Promise<void> => {
  const address = client.wallet.account.address;

  // Create separate contracts for read and write operations
  const usdc = getContract({
    address: SEPOLIA_CONTRACTS.USDC,
    abi: ERC20_ABI,
    client,
  });

  // Check current allowance
  const allowance = await usdc.read.allowance([
    address,
    SEPOLIA_CONTRACTS.PERMIT2,
  ]);

  const sufficient = allowance >= amount;
  onProgress?.(
    `USDC allowance to Permit2: ${allowance.toString()} ${sufficient ? '(sufficient)' : '(insufficient)'}`,
  );

  if (sufficient) return;

  // Request approval
  onProgress?.('Requesting USDC approval for Permit2...');

  const hash = await usdc.write.approve([SEPOLIA_CONTRACTS.PERMIT2, amount]);

  onProgress?.(`Approval transaction submitted: ${hash}`);
  onProgress?.('Waiting for confirmation...');

  // Wait for transaction to be mined
  await client.public.waitForTransactionReceipt({ hash });

  // Verify new allowance
  const newAllowance = await usdc.read.allowance([
    address,
    SEPOLIA_CONTRACTS.PERMIT2,
  ]);
  onProgress?.(`USDC allowance to Permit2 (after): ${newAllowance.toString()}`);
};

/**
 * Invoke Factory.testExecute directly on Sepolia
 *
 * This is the "direct" approach that bypasses Agoric/Axelar and submits
 * the transaction directly to the EVM chain for testing purposes.
 */
export const invokeFactoryDirect = async (
  walletClient: WalletClient<Transport, Chain, Account>,
  signedData: SignedOpenPortfolio,
  onProgress?: (message: string) => void,
): Promise<{ hash: `0x${string}` }> => {
  const address = walletClient.account?.address;
  if (!address) throw new Error('No wallet address available');

  onProgress?.('Converting signature to EIP-2098 format...');

  // Convert 65-byte signature to 64-byte compact format
  const signature2098 = toEip2098(signedData.permitSignature as `0x${string}`);

  onProgress?.(
    `Signature: ${signature2098.length - 2} bytes (EIP-2098 compact)`,
  );

  // Generate unique ownerStr (Agoric address) for create2
  // In production, this would be the actual Agoric address
  const ownerStr = `agoric1${Date.now()}`;

  onProgress?.(`Agoric address (ownerStr): ${ownerStr}`);

  // Build the payload
  onProgress?.('Building CreateAndDepositPayload...');

  const payload = buildCreateAndDepositPayload({
    ownerStr,
    tokenOwner: address,
    permit: {
      permitted: {
        token: signedData.permit.permitted.token as Address,
        amount: BigInt(signedData.permit.permitted.amount as string),
      },
      nonce: BigInt(signedData.permit.nonce as string),
      deadline: BigInt(signedData.permit.deadline as string),
    },
    signature: signature2098,
  });

  onProgress?.(`Payload encoded: ${payload.length - 2} bytes`);

  // Get the Factory contract
  const factory = getContract({
    address: SEPOLIA_CONTRACTS.FACTORY,
    abi: FACTORY_ABI,
    client: { wallet: walletClient },
  });

  onProgress?.('Invoking Factory.testExecute...');

  // Submit the transaction
  const hash = await factory.write.testExecute([payload]);

  onProgress?.(`Transaction submitted: ${hash}`);

  return { hash };
};

/**
 * Check USDC balance
 */
export const checkUSDCBalance = async (
  address: Account['address'],
  publicClient: PublicClient,
): Promise<bigint> => {
  const usdc = getContract({
    address: SEPOLIA_CONTRACTS.USDC,
    abi: ERC20_ABI,
    client: { public: publicClient },
  });

  const balance = await usdc.read.balanceOf([address]);
  return balance;
};
