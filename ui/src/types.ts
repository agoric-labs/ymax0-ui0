// Re-export from ymax-client for consistency
import type { YieldProtocol, EVMChain, MovementDesc } from './ymax-client';
export type { YieldProtocol, EVMChain, MovementDesc };
export interface Brand {
  // Brand interface from ERTP
  [Symbol.toStringTag]: string;
}

// Environment and configuration types
export type Environment = 'mainnet' | 'devnet' | 'localhost';

export interface EndpointConfig {
  RPC: string;
  API: string;
  NETWORK_CONFIG: string;
  CHAIN_ID: string;
}

// Wallet connection type
export type Wallet = Awaited<
  ReturnType<typeof import('@agoric/web-components').makeAgoricWalletConnection>
>;

// Application state management
export interface AppState {
  wallet?: Wallet;
  offerUpInstance?: unknown;
  brands?: Record<string, unknown>;
  purses?: Array<Purse>; // Use the global Purse type
  instances?: Array<[string, unknown]>;
  offerId?: number;
  yProtocol?: YieldProtocol;
}

// Offer update callback type
export interface OfferUpdate {
  status: 'error' | 'accepted' | 'refunded';
  data?: unknown;
}

export type OfferUpdateCallback = (update: OfferUpdate) => void;
