/**
 * EVM Wallet Connection Component
 * Handles MetaMask connection for EIP-712 signing
 */

import { useState } from 'react';
import { createWalletClient, custom, type WalletClient } from 'viem';

interface Props {
  address: string;
  onAddressChange: (address: string) => void;
  onClientChange: (client: WalletClient | null) => void;
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

      if (accounts && accounts.length > 0) {
        // Create viem wallet client without specifying chain
        // This allows it to detect the actual connected chain from the wallet
        const client = createWalletClient({
          account: accounts[0] as `0x${string}`,
          transport: custom(window.ethereum),
        });

        onAddressChange(accounts[0]);
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
