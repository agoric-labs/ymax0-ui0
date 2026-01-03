/**
 * Test for allowance checking
 *
 * This test verifies that ensurePermit2Allowance properly checks allowance
 * using separate read and write contract instances.
 *
 * Bug captured: "Cannot read properties of undefined (reading 'allowance')"
 * The issue was using getContract with client: { public, wallet } which doesn't
 * properly set up the read methods. Fixed by using separate contract instances.
 */

import { test } from 'vitest';
import { createPublicClient, createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ensurePermit2Allowance } from './evm-orchestration';

test('ensurePermit2Allowance should query allowance from publicClient', async ({
  expect,
}) => {
  // Create a test account
  const testPrivateKey = ('0x' + '1'.repeat(64)) as `0x${string}`;
  const account = privateKeyToAccount(testPrivateKey);

  // Create public, wallet clients
  const transport = http('https://ethereum-sepolia-rpc.publicnode.com');
  const client = {
    public: createPublicClient({ transport, chain: sepolia }),
    wallet: createWalletClient({ transport, chain: sepolia, account }),
  };

  const amount = 1000000n; // 1 USDC (6 decimals)

  const messages: string[] = [];
  const onProgress = (msg: string) => messages.push(msg);

  // This should query allowance successfully
  // The fix: use separate contract instances for read (publicClient) and write (walletClient)
  try {
    await ensurePermit2Allowance(amount, client, onProgress);

    // Should have recorded the allowance check
    expect(
      messages.some(msg => msg.includes('USDC allowance to Permit2')),
    ).toBe(true);
  } catch (error) {
    // Network errors are OK (we're testing contract setup, not actual RPC calls)
    // But we should NOT get "Cannot read properties of undefined" errors
    const errorMsg = error instanceof Error ? error.message : String(error);
    expect(errorMsg).not.toMatch(/Cannot read properties of undefined/);
    expect(errorMsg).not.toMatch(/read.*allowance/);
  }
});
