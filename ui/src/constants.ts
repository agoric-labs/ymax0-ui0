// Configuration constants for the application
export const DECIMAL_PLACES = {
  USDC: 6,
  BLD: 6,
  IST: 6,
} as const;

export const DEFAULT_VALUES = {
  USDC_AMOUNT: 1_250_000n, // 1.25 USDC
  BLD_FEE_AMOUNT: 20_000_000n, // 20 BLD
  POSITION_TYPE: 'Aave',
} as const;

export const BRAND_NAMES = {
  USDC: 'usdc',
  POC26: 'poc26',
  BLD: 'bld',
  IST: 'IST',
  ITEMS: 'Items',
} as const;

export const CONTRACT_NAMES = {
  YMAX: 'ymax0',
} as const;

export const CHAINS = {
  AGORIC_DEV: 'agoricdev-25',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NO_CONTRACT_INSTANCE: 'No contract instance found on the chain RPC: ',
  NO_WALLET_CONNECTION: 'Cannot connect to Agoric ',
  NO_SMART_WALLET: 'no smart wallet at that address',
  BRAND_NOT_AVAILABLE:
    'Required brand ({brandName}) is not available in purses.',
  NO_PREVIOUS_OFFER:
    'No previous offer ID found. Please make an initial offer first.',
  ENVIRONMENT_CHANGED:
    'Environment changed. Please refresh the page to reconnect the wallet with the new environment.',
} as const;
