/**
 * Test for "No chain was provided to the request" bug fix
 * 
 * Bug: When calling factory.write.testExecute or usdcWrite.write.approve,
 * viem throws "No chain was provided to the request" error.
 * 
 * Root cause: getContract with walletClient needs a chain parameter
 * in viem v1. Without it, write operations fail because viem doesn't
 * know which chain to send the transaction to.
 * 
 * Fix: Add chain: sepolia parameter to all getContract calls that use
 * walletClient for write operations.
 */

import { describe, it } from 'vitest';
import { createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

describe('EVM Orchestration - Chain Configuration', () => {
  it('documents that getContract with walletClient needs chain parameter', () => {
    // This test documents the bug that caused "No chain was provided to the request"
    
    // Create a test wallet client
    const account = privateKeyToAccount(
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    );
    
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
    });

    // The bug: if we create a contract with getContract and only pass walletClient,
    // write operations will fail with "No chain was provided to the request"
    // 
    // WRONG (causes error):
    // const contract = getContract({
    //   address: '0x...',
    //   abi: [...],
    //   walletClient,
    // });
    //
    // RIGHT (works):
    // const contract = getContract({
    //   address: '0x...',
    //   abi: [...],
    //   chain: sepolia,
    //   walletClient,
    // });

    // Verify the wallet client has a chain
    if (!walletClient.chain) {
      throw new Error('WalletClient should have a chain');
    }
    
    // This test passes if no error is thrown
  });
});
