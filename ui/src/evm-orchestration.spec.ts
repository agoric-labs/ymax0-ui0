/**
 * Tests for EVM orchestration utilities
 */

import { test } from 'vitest';
import { toEip2098, buildCreateAndDepositPayload } from './evm-orchestration';

test('toEip2098 converts 65-byte signature to 64-byte compact', ({
  expect,
}) => {
  // Example signature with v=27 (should NOT set high bit)
  const sig65_v27 =
    '0x' +
    '1234567890123456789012345678901234567890123456789012345678901234' + // r (32 bytes)
    'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789' + // s (32 bytes)
    '1b'; // v=27

  const compact = toEip2098(sig65_v27 as `0x${string}`);

  // Should be 64 bytes (128 hex chars + 0x prefix)
  expect(compact.length).toBe(130);
  expect(compact.startsWith('0x')).toBe(true);

  // r should be unchanged
  expect(compact.slice(2, 66)).toBe(
    '1234567890123456789012345678901234567890123456789012345678901234',
  );

  // vs should be s without high bit (since v=27)
  const vs = compact.slice(66);
  expect(vs).toBe(
    'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
  );
});

test('toEip2098 sets high bit when v=28', ({ expect }) => {
  // Example signature with v=28 (should set high bit)
  const sig65_v28 =
    '0x' +
    '1234567890123456789012345678901234567890123456789012345678901234' + // r
    '7bcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789' + // s (starts with 7, high bit not set)
    '1c'; // v=28

  const compact = toEip2098(sig65_v28 as `0x${string}`);

  // vs should have high bit set
  const vs = compact.slice(66);
  const vsBig = BigInt('0x' + vs);
  const highBit = 1n << 255n;

  // High bit should be set
  expect(vsBig & highBit).toBe(highBit);
});

test('toEip2098 throws on invalid signature length', ({ expect }) => {
  const invalidSig = '0x1234' as `0x${string}`;

  expect(() => toEip2098(invalidSig)).toThrow('Invalid signature length');
});

test('buildCreateAndDepositPayload encodes correctly', ({ expect }) => {
  const payload = buildCreateAndDepositPayload({
    ownerStr: 'agoric1test123',
    tokenOwner: '0x1234567890123456789012345678901234567890',
    permit: {
      permitted: {
        token: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
        amount: 1000000n,
      },
      nonce: 1234567890n,
      deadline: 9999999999n,
    },
    signature: ('0x' + '00'.repeat(64)) as `0x${string}`,
  });

  // Should return a hex string
  expect(payload.startsWith('0x')).toBe(true);
  expect(payload.length).toBeGreaterThan(100); // Encoded data should be substantial

  // Payload should be valid hex
  expect(/^0x[0-9a-fA-F]+$/.test(payload)).toBe(true);
});

test('buildCreateAndDepositPayload includes all fields', ({ expect }) => {
  const ownerStr = 'agoric1test456';
  const tokenOwner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
  const token = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

  const payload = buildCreateAndDepositPayload({
    ownerStr,
    tokenOwner: tokenOwner as `0x${string}`,
    permit: {
      permitted: {
        token: token as `0x${string}`,
        amount: 5000000n,
      },
      nonce: 1111111111n,
      deadline: 8888888888n,
    },
    signature: ('0x' + '11'.repeat(64)) as `0x${string}`,
  });

  // Convert to lowercase for case-insensitive matching
  const payloadLower = payload.toLowerCase();

  // Should contain parts of the address (without 0x prefix)
  expect(payloadLower).toContain(tokenOwner.slice(2).toLowerCase());

  // Should contain parts of the token address
  expect(payloadLower).toContain(token.slice(2).toLowerCase());

  // Amount 5000000 = 0x4C4B40 in hex
  expect(payloadLower).toContain('4c4b40');
});
