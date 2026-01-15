/**
 * OpenPortfolio Form Component
 * Handles form input and triggers EIP-712 signatures for:
 * 1. Permit2 PermitTransferFrom (USDC allowance)
 * 2. OpenPortfolio intent with target allocations
 */

import { useState } from 'react';
import type { Account, Chain, Transport, WalletClient } from 'viem';

import { arbitrumSepolia as sepolia } from 'viem/chains';
import type { WithSignature } from '@agoric/orchestration/src/utils/viem.ts';
import type { SignedMessage, TargetAllocation } from '../evm-portfolio-types';
import {
  createOpenPortfolioMessage,
  parseUSDCAmount,
  SEPOLIA_CONTRACTS,
  validateAllocations,
} from '../open-portfolio-eip712';
import type { YmaxPermitWitnessTransferFromData } from '@agoric/portfolio-api/src/evm-wallet/eip712-messages.ts';

// Constants
const ONE_HOUR_IN_SECONDS = 3600n;

interface Props {
  userAddress: `0x${string}`;
  walletClient: WalletClient<Transport, Chain, Account>;
  onSigned: (result: SignedMessage) => void;
}

const POOL_OPTIONS = [
  'USDN',
  'Aave_Ethereum',
  'Aave_Arbitrum',
  'Aave_Optimism',
  'Aave_Base',
  'Compound_Ethereum',
  'Compound_Arbitrum',
  'Compound_Optimism',
  'Compound_Base',
];

export function OpenPortfolioForm({
  userAddress,
  walletClient,
  onSigned,
}: Props) {
  const [amount, setAmount] = useState<`${number}`>('15'); // Default 15 USDC
  const [allocations, setAllocations] = useState<TargetAllocation[]>([
    { instrument: 'USDN', portion: 60n },
    { instrument: 'Aave_Ethereum', portion: 40n },
  ]);
  const [signing, setSigning] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [error, setError] = useState<string>('');

  const currentChainId = walletClient.chain.id;
  const networkName = walletClient.chain.name;

  const addAllocation = () => {
    setAllocations([...allocations, { instrument: 'USDN', portion: 0n }]);
  };

  const updateAllocation = (
    index: number,
    field: keyof TargetAllocation,
    value: string | number,
  ) => {
    const updated = [...allocations];
    switch (field) {
      case 'portion':
        updated[index] = {
          ...updated[index],
          portion: BigInt(value),
        };
        break;
      case 'instrument':
        if (typeof value !== 'string') throw Error('bug!');
        updated[index] = { ...updated[index], instrument: value };
    }
    setAllocations(updated);
  };

  const removeAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const totalPortions = allocations.reduce(
    (sum, alloc) => sum + Number(alloc.portion),
    0,
  );

  const signMessages = async (timeStamp: number) => {
    if (totalPortions === 0) {
      setError('Total allocation must be greater than zero');
      return;
    }

    setSigning(true);
    setError('');

    try {
      // Validate allocations
      validateAllocations(allocations);

      // Parse amount to smallest unit (6 decimals for USDC)
      const amountInSmallestUnit = parseUSDCAmount(amount);

      if (amountInSmallestUnit === 0n) {
        setError('Amount must be greater than zero');
        setSigning(false);
        return;
      }

      // Check if wallet is connected to the correct network
      if (currentChainId !== sepolia.id) {
        const networkName =
          currentChainId === 1 ? 'Ethereum Mainnet' : `chain ${currentChainId}`;
        setError(
          `Wrong network: You're connected to ${networkName} but this page requires Sepolia testnet (chain ID ${SEPOLIA_CONTRACTS.CHAIN_ID}). ` +
            `Please switch to Sepolia in MetaMask. See: https://support.metamask.io/networks-and-sidechains/managing-networks/how-to-add-a-custom-network-rpc/`,
        );
        setSigning(false);
        return;
      }

      // Sign Permit2 PermitBatchWitnessTransferFrom
      setCurrentStep('Signing Permit2...');

      const deadline =
        BigInt(Math.floor(Date.now() / 1000)) + ONE_HOUR_IN_SECONDS;
      const nonce = BigInt(`${timeStamp}`.replace(/[^0-9]/g, ''));

      const data = createOpenPortfolioMessage(
        amountInSmallestUnit,
        allocations,
        { nonce, deadline, chainId: currentChainId },
      );

      console.log('Permit2 signature request:', data);

      const permitSignature = await walletClient.signTypedData({
        account: userAddress,
        ...data,
      });

      const signedData = {
        ...data,
        signature: permitSignature,
      } satisfies WithSignature<
        YmaxPermitWitnessTransferFromData<'OpenPortfolio'>
      >;

      console.log('Permit2 signature received:', permitSignature);
      setCurrentStep('');
      onSigned(signedData);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to sign messages';
      setError(message);
      console.error('Signature error:', err);
      setCurrentStep('');
    } finally {
      setSigning(false);
    }
  };

  return (
    <div style={{ marginBottom: '30px' }}>
      <h2>Open Portfolio with Deposit</h2>

      {/* Network Status Info */}
      <div
        style={{
          marginBottom: '20px',
          padding: '12px',
          background:
            BigInt(currentChainId) === BigInt(SEPOLIA_CONTRACTS.CHAIN_ID)
              ? '#d1ecf1'
              : '#fff3cd',
          border: `1px solid ${BigInt(currentChainId) === BigInt(SEPOLIA_CONTRACTS.CHAIN_ID) ? '#bee5eb' : '#ffeeba'}`,
          borderRadius: '4px',
          fontSize: '14px',
        }}
      >
        <strong>Network:</strong> {networkName} (Chain ID:{' '}
        {currentChainId ?? 'detecting...'})
        {BigInt(currentChainId) !== BigInt(SEPOLIA_CONTRACTS.CHAIN_ID) &&
          currentChainId !== null && (
            <div style={{ marginTop: '8px', color: '#856404' }}>
              ⚠️ Please switch to <strong>Sepolia testnet</strong> to use this
              page.{' '}
              <a
                href="https://support.metamask.io/networks-and-sidechains/managing-networks/how-to-add-a-custom-network-rpc/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#004085', textDecoration: 'underline' }}
              >
                How to add Sepolia
              </a>
            </div>
          )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label
          style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}
        >
          Deposit Amount (USDC):
        </label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value as `${number}`)}
          style={{ padding: '8px', width: '200px' }}
          placeholder="15"
          disabled={signing}
        />
        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          Enter amount in USDC (e.g., "15" or "15.5")
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label
          style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}
        >
          Target Allocation:
        </label>

        {allocations.map((alloc, index) => {
          const percentage =
            totalPortions > 0
              ? ((Number(alloc.portion) / totalPortions) * 100).toFixed(1)
              : '0.0';

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '10px',
                alignItems: 'center',
              }}
            >
              <select
                value={alloc.instrument}
                onChange={e =>
                  updateAllocation(index, 'instrument', e.target.value)
                }
                style={{ padding: '5px', flex: 1 }}
                disabled={signing}
              >
                {POOL_OPTIONS.map(pool => (
                  <option key={pool} value={pool}>
                    {pool}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={Number(alloc.portion)}
                onChange={e =>
                  updateAllocation(index, 'portion', e.target.value)
                }
                style={{ padding: '5px', width: '100px' }}
                placeholder="Portion"
                min="0"
                disabled={signing}
              />
              <span
                style={{ fontSize: '12px', color: '#666', minWidth: '60px' }}
              >
                ({percentage}%)
              </span>
              <button
                onClick={() => removeAllocation(index)}
                style={{
                  padding: '5px 10px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: signing ? 'not-allowed' : 'pointer',
                }}
                disabled={signing}
              >
                Remove
              </button>
            </div>
          );
        })}

        <button
          onClick={addAllocation}
          style={{
            padding: '8px 16px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: signing ? 'not-allowed' : 'pointer',
            marginTop: '10px',
          }}
          disabled={signing}
        >
          + Add Allocation
        </button>

        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          Total: {totalPortions} portions (100%)
        </div>
      </div>

      <button
        onClick={ev => signMessages(ev.timeStamp)}
        disabled={signing || totalPortions === 0}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          background: signing || totalPortions === 0 ? '#6c757d' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: signing || totalPortions === 0 ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
        }}
      >
        {signing ? currentStep || 'Signing...' : 'Open Portfolio'}
      </button>

      {error && (
        <div
          style={{
            color: '#721c24',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            padding: '12px',
            marginTop: '15px',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}
    </div>
  );
}
