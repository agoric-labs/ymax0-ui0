import { useState } from 'react';
import {
  type Account,
  type Chain,
  type Transport,
  type WalletClient,
} from 'viem';
import { arbitrumSepolia as sepolia } from 'viem/chains';
import type {
  DelegateAllocationMessage,
  SignedMessage,
} from '../evm-portfolio-types';
import {
  ONE_HOUR_IN_SECONDS,
  SEPOLIA_CONTRACTS,
} from '../open-portfolio-eip712';

interface Props {
  userAddress: `0x${string}`;
  walletClient: WalletClient<Transport, Chain, Account>;
  onSigned: (result: SignedMessage) => void;
}

export function DelegateAllocationForm({
  userAddress,
  walletClient,
  onSigned,
}: Props) {
  const [portfolioId, setPortfolioId] = useState('1');
  const [accountHolder, setAccountHolder] = useState('');
  const [canSetAllocation, setCanSetAllocation] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');

  const signMessage = async () => {
    setSigning(true);
    setError('');
    try {
      if (walletClient.chain.id !== sepolia.id) {
        throw new Error(
          `Wrong network: connected to chain ${walletClient.chain.id}, expected ${sepolia.id}`,
        );
      }
      if (!/^\d+$/.test(portfolioId) || BigInt(portfolioId) <= 0n) {
        throw new Error('Portfolio ID must be a positive integer');
      }
      if (!/^agoric1[0-9a-z]+$/.test(accountHolder)) {
        throw new Error('Account holder must be a valid agoric1 address');
      }

      const nonce = BigInt(`${Date.now()}`);
      const deadline =
        BigInt(Math.floor(Date.now() / 1000)) + ONE_HOUR_IN_SECONDS;

      const data = {
        domain: {
          name: 'Ymax',
          version: '1',
          chainId: walletClient.chain.id,
          verifyingContract: SEPOLIA_CONTRACTS.FACTORY,
        },
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ] as const,
          DelegateAllocation: [
            { name: 'accountHolder', type: 'string' },
            { name: 'portfolio', type: 'uint256' },
            { name: 'canSetAllocation', type: 'bool' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ] as const,
        },
        primaryType: 'DelegateAllocation' as const,
        message: {
          accountHolder,
          portfolio: BigInt(portfolioId),
          canSetAllocation,
          nonce,
          deadline,
        },
      } satisfies Omit<DelegateAllocationMessage, 'signature'>;

      const signature = await walletClient.signTypedData({
        account: userAddress,
        ...data,
      });

      onSigned({
        ...data,
        signature,
      } satisfies DelegateAllocationMessage);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign message');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div style={{ marginBottom: '30px' }}>
      <h2>Delegate Allocation Control</h2>
      <p style={{ color: '#666', fontSize: '14px' }}>
        Sign a standalone <code>DelegateAllocation</code> EIP-712 operation
        with a camelCase field named <code>accountHolder</code>.
      </p>

      <div style={{ marginBottom: '14px' }}>
        <label
          style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}
        >
          Portfolio ID:
        </label>
        <input
          type="number"
          min="1"
          value={portfolioId}
          onChange={e => setPortfolioId(e.target.value)}
          disabled={signing}
          style={{ padding: '8px', width: '200px' }}
        />
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label
          style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}
        >
          Account Holder Address:
        </label>
        <input
          type="text"
          value={accountHolder}
          onChange={e => setAccountHolder(e.target.value.trim())}
          disabled={signing}
          placeholder="agoric1..."
          style={{ padding: '8px', width: '100%', maxWidth: '480px' }}
        />
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '14px',
        }}
      >
        <input
          type="checkbox"
          checked={canSetAllocation}
          onChange={e => setCanSetAllocation(e.target.checked)}
          disabled={signing}
        />
        Allow allocation updates
      </label>

      {error && (
        <div
          style={{
            marginBottom: '12px',
            padding: '10px',
            background: '#f8d7da',
            border: '1px solid #f5c6cb',
            color: '#721c24',
            borderRadius: '4px',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      <button
        onClick={signMessage}
        disabled={signing}
        style={{
          padding: '10px 20px',
          fontSize: '14px',
          background: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: signing ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
          opacity: signing ? 0.6 : 1,
        }}
      >
        {signing ? 'Signing...' : 'Sign DelegateAllocation'}
      </button>
    </div>
  );
}
