/**
 * EVM Wallet Page
 * Allows opening a portfolio using an EVM wallet (MetaMask) with EIP-712 signatures
 * 
 * This page can be accessed directly at /evm-wallet
 */

import { useState } from 'react';
import type { WalletClient } from 'viem';
import { EVMWalletConnection } from './EVMWalletConnection';
import { OpenPortfolioForm } from './OpenPortfolioForm';
import type { SignedOpenPortfolio } from '../evm-portfolio-types';

/**
 * Mock EVM Handler (based on makeEVMHandler pattern from createAndDeposit.ts)
 * In production, this would submit to an Agoric endpoint which forwards via IBC to Axelar
 * and then to the EVM chain (Base/Sepolia).
 */
const mockEVMHandler = {
  async handleOpenPortfolio(signed: SignedOpenPortfolio): Promise<void> {
    console.log('=== Mock EVM Handler ===');
    console.log('In production, this would:');
    console.log('1. Submit to Agoric endpoint (via walletFactory invokeEntry)');
    console.log('2. Agoric chain validates signatures and submits to Ymax contract');
    console.log('3. Ymax contract uses Orchestration to send via IBC to Axelar');
    console.log('4. Axelar GMP routes to EVM chain (Base/Sepolia)');
    console.log('5. Factory contract creates wallet and deposits funds via Permit2');
    console.log('\n--- Signed Data ---');
    console.log('Permit Signature:', signed.permitSignature);
    console.log('Intent Signature:', signed.intentSignature);
    console.log('\n--- Permit2 Data ---');
    console.log(JSON.stringify(signed.permit, null, 2));
    console.log('\n--- OpenPortfolio Intent ---');
    console.log(JSON.stringify(signed.intent, null, 2));
    console.log('\n--- Allocations (parsed) ---');
    const allocations = JSON.parse(signed.intent.allocations);
    console.log(JSON.stringify(allocations, null, 2));
  }
};

export function EVMWalletPage() {
  const [evmAddress, setEvmAddress] = useState('');
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [signedData, setSignedData] = useState<SignedOpenPortfolio | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSigned = async (result: SignedOpenPortfolio) => {
    setSignedData(result);
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!signedData) return;

    try {
      await mockEVMHandler.handleOpenPortfolio(signedData);
      setSubmitted(true);
      alert('Signed data logged to console. Check browser console for details.\n\nIn production, this would be submitted via Agoric → IBC → Axelar → EVM chain.');
    } catch (err) {
      console.error('Submission error:', err);
      alert('Error during submission. Check console for details.');
    }
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
          <strong>Note:</strong> This is a testing interface. Signed data is logged to the console.
          In production, signatures would be sent to an Agoric endpoint for submission via IBC → Axelar → EVM chain.
        </p>
      </div>

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
              Both signatures have been collected successfully. In production, these would be
              submitted to an Agoric endpoint for processing.
            </p>
            <button
              onClick={handleSubmit}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                background: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              View Signed Data (Console)
            </button>
          </div>
        )}

        {submitted && (
          <div style={{
            marginTop: '30px',
            padding: '20px',
            background: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '4px'
          }}>
            <h3 style={{ marginTop: 0, color: '#155724' }}>✓ Submission Complete</h3>
            <p style={{ fontSize: '14px', color: '#155724', marginBottom: '10px' }}>
              Signed data has been logged to the browser console.
            </p>
            <p style={{ fontSize: '14px', color: '#155724' }}>
              <strong>Next Steps (Production):</strong>
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
          <strong>Current (Mock):</strong> UI → Mock Handler → Console Logging
        </p>
        <p style={{ marginBottom: '10px' }}>
          <strong>Production (via Agoric + Axelar):</strong><br/>
          UI → Agoric Endpoint → IBC → Axelar → EVM Chain (Base/Sepolia)
        </p>
        <p style={{ marginBottom: 0 }}>
          <strong>Stretch (Direct to Sepolia):</strong><br/>
          UI → Sepolia RPC (bypassing Agoric/Axelar for testing)
        </p>
      </div>
    </div>
  );
}
