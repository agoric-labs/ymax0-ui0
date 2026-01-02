// network.ts
import { createContext, useContext } from 'react';
import { Chain, Transport, type PublicClient } from 'viem';

export const PublicClientContext = createContext<PublicClient<
  Transport,
  Chain
> | null>(null);

export function useSepoliaPublicClient() {
  const transport = useContext(PublicClientContext);
  if (!transport) {
    throw new Error('PublicClientContext not provided');
  }
  return transport;
}
