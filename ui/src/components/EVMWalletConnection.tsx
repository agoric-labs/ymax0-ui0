/**
 * EVM Wallet Connection Component
 * Handles MetaMask connection for EIP-712 signing
 */

import { useState } from 'react';
import {
  Account,
  createWalletClient,
  custom,
  type Chain,
  type Transport,
  type WalletClient,
} from 'viem';
import { arbitrumSepolia as sepolia } from 'viem/chains';

interface Props {
  address: string;
  onAddressChange: (address: `0x${string}` | '') => void;
  onClientChange: (
    client: WalletClient<Transport, Chain, Account> | null,
  ) => void;
}

export function EVMWalletConnection({
  address,
  onAddressChange,
  onClientChange,
}: Props) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>('');

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('MetaMask not found. Please install MetaMask.');
      return;
    }

    setConnecting(true);
    setError('');

    try {
      // Request account access
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];

      // Get the actual chainId from the wallet
      const chainIdHex = (await window.ethereum?.request({
        method: 'eth_chainId',
      })) as string;
      const chainId = parseInt(chainIdHex, 16);

      // Check if wallet is connected to the correct network
      if (chainId !== sepolia.id) {
        const networkName =
          chainId === 1 ? 'Ethereum Mainnet' : `chain ${chainId}`;
        setError(
          `Wrong network: You're connected to ${networkName} but this page requires Sepolia testnet (chain ID ${sepolia.id}). ` +
            `Please switch to Sepolia in MetaMask. See: https://support.metamask.io/networks-and-sidechains/managing-networks/how-to-add-a-custom-network-rpc/`,
        );
        setConnecting(false);
        return;
      }

      if (accounts && accounts.length > 0) {
        const client = createWalletClient({
          account: accounts[0] as `0x${string}`,
          transport: custom(window.ethereum),
          chain: sepolia,
        });

        onAddressChange(accounts[0] as `0x${string}`);
        onClientChange(client);
      } else {
        setError('No accounts found. Please unlock MetaMask.');
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(message);
      console.error('Wallet connection error:', err);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    onAddressChange('');
    onClientChange(null);
    setError('');
  };

  if (address) {
    return (
      <div
        style={{
          marginBottom: '30px',
          padding: '15px',
          background: '#d4edda',
          borderRadius: '4px',
          border: '1px solid #c3e6cb',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong>Connected (EVM):</strong> {address.slice(0, 6)}...
            {address.slice(-4)}
          </div>
          <button
            onClick={disconnect}
            style={{
              padding: '5px 10px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '30px' }}>
      <button
        onClick={connectWallet}
        disabled={connecting}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          background: connecting ? '#6c757d' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: connecting ? 'not-allowed' : 'pointer',
        }}
      >
        {connecting ? 'Connecting...' : 'Connect MetaMask'}
      </button>
      {error && (
        <div style={{ color: 'red', marginTop: '10px', fontSize: '14px' }}>
          {error}
        </div>
      )}
    </div>
  );
}
