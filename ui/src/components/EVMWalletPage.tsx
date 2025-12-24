/**
 * EVM Wallet Page
 * Allows opening a portfolio using an EVM wallet (MetaMask) with EIP-712 signatures
 * 
 * This page can be accessed directly at /evm-wallet
 */

import React, { useState } from 'react';
import type { WalletClient } from 'viem';
import { EVMWalletConnection } from './EVMWalletConnection';
import { OpenPortfolioForm } from './OpenPortfolioForm';
import type { SignedOpenPortfolio } from '../evm-portfolio-types';
import {
  invokeFactoryDirect,
  ensurePermit2Allowance,
  checkUSDCBalance,
} from '../evm-orchestration';
import { formatUSDCAmount } from '../open-portfolio-eip712';

/**
 * Mock EVM Handler (based on makeEVMHandler pattern from createAndDeposit.ts)
 * 
 * This testing app supports two execution styles:
 * 
 * 1. DIRECT STYLE (Issue #22): Mocks EMS, EMH, Orch, and Axelar
 *    - UI directly invokes Factory.testExecute on Sepolia
 *    - Skips app server, Agoric chain, and Axelar entirely
 * 
 * 2. MOCK CONSOLE STYLE: Logs the production flow for understanding
 *    - Shows what would happen in production
 *    - Production: UI → EMS → Agoric (EMH + Orch) → Axelar → EVM chain
 * 
 * Note: Nothing in this repository is production code.
 * In production, the UI would submit to an EVM Message Service (EMS) app server.
 */
const mockEVMHandler = {
  async handleOpenPortfolio(signed: SignedOpenPortfolio): Promise<void> {
    console.log('=== Mock Console: Production Flow ===');
    console.log('This testing page shows what WOULD happen in production:\n');
    console.log('1. UI submits signed intent to EVM Message Service (EMS) app server');
    console.log('2. EMS wraps the intent and submits an Agoric transaction');
    console.log('3. EVM Message Handler (EMH) on Agoric validates signatures');
    console.log('4. EMH passes to Ymax contract, which uses Orchestrator');
    console.log('5. Orchestrator sends IBC transaction to Axelar');
    console.log('6. Axelar GMP routes to EVM chain (Base in production, Sepolia in testing)');
    console.log('7. Factory contract creates wallet and deposits funds via Permit2\n');
    console.log('--- Signed Data for Production Flow ---');
    console.log('Permit Signature:', signed.permitSignature);
    console.log('Intent Signature:', signed.intentSignature);
    console.log('\n--- Permit2 Data ---');
    console.log(JSON.stringify(signed.permit, null, 2));
    console.log('\n--- OpenPortfolio Intent ---');
    console.log(JSON.stringify(signed.intent, null, 2));
    console.log('\n--- Allocations ---');
    console.log(JSON.stringify(signed.intent.allocations, null, 2));
    console.log('\n=== Direct Style (Issue #22) ===');
    console.log('The "Submit to Sepolia (Direct)" button MOCKS EMS, EMH, Orch, and Axelar');
    console.log('by calling Factory.testExecute directly from this browser.');
  }
};

export function EVMWalletPage() {
  const [evmAddress, setEvmAddress] = useState('');
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [signedData, setSignedData] = useState<SignedOpenPortfolio | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);

  // Check USDC balance when wallet connects
  React.useEffect(() => {
    if (walletClient) {
      checkUSDCBalance(walletClient)
        .then(setUsdcBalance)
        .catch((err) => console.error('Failed to check USDC balance:', err));
    }
  }, [walletClient]);

  const addProgress = (message: string) => {
    setProgressLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleSigned = async (result: SignedOpenPortfolio) => {
    setSignedData(result);
    setSubmitted(false);
    setTxHash('');
    setProgressLog([]);
    setError('');
  };

  const handleSubmitDirect = async () => {
    if (!signedData || !walletClient) return;

    setSubmitting(true);
    setError('');
    setProgressLog([]);
    setTxHash('');

    try {
      addProgress('Starting direct Sepolia submission...');
      
      // Step 1: Ensure Permit2 allowance
      addProgress('Checking USDC allowance for Permit2...');
      const amount = BigInt(signedData.permit.permitted.amount);
      
      await ensurePermit2Allowance(walletClient, amount, addProgress);
      
      // Step 2: Invoke Factory.testExecute
      addProgress('Invoking Factory.testExecute on Sepolia...');
      const { hash } = await invokeFactoryDirect(walletClient, signedData, addProgress);
      
      setTxHash(hash);
      addProgress(`✓ Transaction submitted successfully!`);
      addProgress(`View on Etherscan: https://sepolia.etherscan.io/tx/${hash}`);
      
      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit transaction';
      setError(message);
      addProgress(`✗ Error: ${message}`);
      console.error('Submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMockSubmit = () => {
    if (!signedData) return;
    
    setProgressLog([]);
    addProgress('=== Mock Handler: Production Flow (Console Logging) ===');
    addProgress('This shows what WOULD happen in production:\n');
    addProgress('1. UI → EVM Message Service (EMS) app server');
    addProgress('   Submit signed intent to app server endpoint');
    addProgress('');
    addProgress('2. EMS → Agoric chain');
    addProgress('   EMS wraps intent and submits Agoric transaction');
    addProgress('');
    addProgress('3. Agoric: EVM Message Handler (EMH)');
    addProgress('   EMH validates signatures and recovers signer address');
    addProgress('');
    addProgress('4. Agoric: Ymax Contract + Orchestrator');
    addProgress('   Ymax contract uses Orchestration to send IBC transaction');
    addProgress('');
    addProgress('5. Axelar GMP');
    addProgress('   Axelar routes IBC message to target EVM chain');
    addProgress('');
    addProgress('6. EVM Chain: Factory Contract');
    addProgress('   Factory creates wallet and deposits via Permit2');
    addProgress('');
    addProgress('Note: Nothing in this repository is production code.');
    addProgress('The "Submit to Sepolia (Direct)" button MOCKS steps 1-5.');
    
    mockEVMHandler.handleOpenPortfolio(signedData);
    
    setSubmitted(true);
  };

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ marginBottom: '10px' }}>Open Portfolio with EVM Wallet</h1>
        <p style={{ color: '#666', fontSize: '14px' }}>
          This page demonstrates EIP-712 signature collection for opening a Ymax portfolio
          using an EVM wallet like MetaMask. You'll be prompted to sign two messages:
        </p>
        <ol style={{ color: '#666', fontSize: '14px', marginTop: '10px' }}>
          <li><strong>Permit2 Transfer:</strong> Allows the Factory contract to move your USDC</li>
          <li><strong>OpenPortfolio Intent:</strong> Specifies deposit amount and target allocations</li>
        </ol>
        <p style={{ 
          color: '#856404', 
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeeba',
          borderRadius: '4px',
          padding: '10px',
          fontSize: '14px',
          marginTop: '15px'
        }}>
          <strong>Testing Options:</strong><br />
          • <strong>Submit to Sepolia (Direct):</strong> Mocks EMS, EMH, Orch, and Axelar by directly calling Factory.testExecute<br />
          • <strong>View Mock Flow:</strong> Logs the production flow (UI → EMS → Agoric → Axelar → EVM chain)
        </p>
      </div>

      {usdcBalance !== null && (
        <div style={{
          marginBottom: '20px',
          padding: '10px',
          background: '#e7f3ff',
          border: '1px solid #b3d7ff',
          borderRadius: '4px',
          fontSize: '14px',
        }}>
          <strong>USDC Balance:</strong> {formatUSDCAmount(usdcBalance)} USDC
        </div>
      )}

      <div style={{ 
        background: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        <EVMWalletConnection
          address={evmAddress}
          onAddressChange={setEvmAddress}
          onClientChange={setWalletClient}
        />

        {evmAddress && walletClient && (
          <OpenPortfolioForm
            userAddress={evmAddress}
            walletClient={walletClient}
            onSigned={handleSigned}
          />
        )}

        {signedData && !submitted && (
          <div style={{ 
            marginTop: '30px',
            padding: '20px',
            background: '#d1ecf1',
            border: '1px solid #bee5eb',
            borderRadius: '4px'
          }}>
            <h3 style={{ marginTop: 0 }}>Signatures Collected ✓</h3>
            <p style={{ fontSize: '14px', marginBottom: '15px' }}>
              Both signatures have been collected successfully. Choose how to submit:
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={handleSubmitDirect}
                disabled={submitting}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                {submitting ? 'Submitting...' : 'Submit to Sepolia (Direct)'}
              </button>
              <button
                onClick={handleMockSubmit}
                disabled={submitting}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  background: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                View Mock Flow (Console)
              </button>
            </div>
          </div>
        )}

        {progressLog.length > 0 && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            background: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            maxHeight: '300px',
            overflowY: 'auto',
          }}>
            <h4 style={{ marginTop: 0, fontSize: '16px' }}>Progress Log:</h4>
            <pre style={{
              fontSize: '12px',
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'Monaco, Consolas, monospace',
            }}>
              {progressLog.join('\n')}
            </pre>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: '20px',
            padding: '15px',
            background: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            color: '#721c24',
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {submitted && txHash && (
          <div style={{
            marginTop: '30px',
            padding: '20px',
            background: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '4px'
          }}>
            <h3 style={{ marginTop: 0, color: '#155724' }}>✓ Transaction Submitted</h3>
            <p style={{ fontSize: '14px', color: '#155724', marginBottom: '10px' }}>
              Your transaction has been submitted to Sepolia testnet.
            </p>
            <div style={{ marginTop: '15px' }}>
              <strong style={{ color: '#155724' }}>Transaction Hash:</strong>
              <div style={{
                marginTop: '5px',
                padding: '10px',
                background: 'white',
                borderRadius: '4px',
                fontFamily: 'Monaco, Consolas, monospace',
                fontSize: '12px',
                wordBreak: 'break-all',
              }}>
                {txHash}
              </div>
              <a 
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: '10px',
                  padding: '8px 16px',
                  background: '#155724',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              >
                View on Etherscan →
              </a>
            </div>
          </div>
        )}

        {submitted && !txHash && (
          <div style={{
            marginTop: '30px',
            padding: '20px',
            background: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '4px'
          }}>
            <h3 style={{ marginTop: 0, color: '#155724' }}>✓ Mock Submission Complete</h3>
            <p style={{ fontSize: '14px', color: '#155724', marginBottom: '10px' }}>
              Signed data has been logged to the browser console.
            </p>
            <p style={{ fontSize: '14px', color: '#155724' }}>
              <strong>Production Flow (via Agoric + Axelar):</strong>
            </p>
            <ol style={{ fontSize: '14px', color: '#155724', marginLeft: '20px' }}>
              <li>App server submits to Agoric endpoint (walletFactory invokeEntry)</li>
              <li>Agoric chain validates signatures and forwards to Ymax contract</li>
              <li>Ymax contract orchestrates via IBC to Axelar</li>
              <li>Axelar GMP routes to EVM chain (Base/Sepolia)</li>
              <li>Factory contract creates wallet and deposits via Permit2</li>
              <li>UI polls vstorage for portfolio creation status</li>
            </ol>
          </div>
        )}
      </div>

      <div style={{ 
        marginTop: '30px',
        padding: '15px',
        background: '#e7f3ff',
        border: '1px solid #b3d7ff',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <h4 style={{ marginTop: 0 }}>Architecture Overview</h4>
        <p style={{ marginBottom: '10px' }}>
          <strong>Direct to Sepolia (Testing):</strong><br/>
          UI → Factory.testExecute → Sepolia Testnet
        </p>
        <p style={{ marginBottom: '10px' }}>
          <strong>Production (via Agoric + Axelar):</strong><br/>
          UI → Agoric Endpoint → IBC → Axelar → EVM Chain (Base/Sepolia)
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Mock (Console Only):</strong><br/>
          UI → Console Logging (for understanding the flow)
        </p>
      </div>
    </div>
  );
}
