/// <reference types="vite/client" />

declare module '@agoric/ui-components' {
  export const stringifyAmountValue;
}

declare module '@agoric/store' {
  export const makeCopyBag;
}

// MetaMask EIP-1193 Provider
interface Window {
  ethereum?: {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  };
}
