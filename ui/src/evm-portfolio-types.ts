/**
 * Types for EVM wallet portfolio integration with EIP-712 signatures
 */

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
  token: string; // ERC-20 token address (e.g., USDC)
  amount: string; // Amount in smallest unit (e.g., "1000000" for 1 USDC with 6 decimals)
}

/**
 * EIP-712 Domain for YMax Portfolio Authorization
 */
export interface EIP712Domain {
  name: string;
  version: string;
  chainId?: number;
  verifyingContract?: string;
}

/**
 * EIP-712 Types definition
 */
export type EIP712Types = Record<string, Array<{ name: string; type: string }>>;

/**
 * OpenPortfolio intent message for EIP-712 signing
 */
export interface OpenPortfolioIntent {
  depositor: string; // EVM address of the user
  deposit: TokenAmount; // Deposit amount with token address
  allocations: string; // JSON-encoded allocation for EIP-712 compatibility
  nonce: string; // Unique nonce (typically timestamp)
  deadline: string; // Unix timestamp
}

/**
 * Permit2 SignatureTransfer permit structure
 * Standard from @uniswap/permit2-sdk
 */
export interface PermitTransferFrom {
  permitted: {
    token: string; // Token contract address
    amount: string; // Amount in wei/smallest unit
  };
  spender: string; // Address allowed to spend (Factory contract)
  nonce: string; // Unique per permit
  deadline: string; // Unix timestamp
}

/**
 * Combined signed data for submission
 */
export interface SignedOpenPortfolio {
  permitSignature: string;
  intentSignature: string;
  permit: PermitTransferFrom;
  intent: OpenPortfolioIntent;
}
