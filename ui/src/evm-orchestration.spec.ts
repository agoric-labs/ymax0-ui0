/**
 * Tests for EVM orchestration utilities
 */

import { test } from 'vitest';
import {
  toEip2098,
  buildCreateAndDepositPayload,
  createAndDepositParams,
} from './evm-orchestration';
import { decodeAbiParameters } from 'viem';
import { SEPOLIA_CONTRACTS } from './open-portfolio-eip712.ts';

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

test('decode viaAxelar tx', ({ expect }) => {
  // see https://sepolia.etherscan.io/tx/0xf79bc6d31c5403d918fcba9431498aee97e7e76b134c91ff2d054a2137add718
  const payload =
    '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000008cb4b25e77844fc0632aca14f1f9b23bdd654ebf0000000000000000000000001c7d4b196cb0c7b01d743fbc6116a902379c723800000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000019b36e47c210000000000000000000000000000000000000000000000000000000069455ada0000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000002d61676f726963317277776c65793535306b396d6d6b367571366d6d367a3475647267386b7975797666737a6a6b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000416877deb265f786e68290acb428d333f92fc350786b07bfcc49239e856de5d23f1d84c6e9d05c7862e1484dfc1ba772b4f0ad49121a43d9efa3b6ca8d3c0b35541c00000000000000000000000000000000000000000000000000000000000000';
  const decoded = decodeAbiParameters(createAndDepositParams, payload);
  expect(decoded.length).toBe(1);
  expect(decoded[0]).toStrictEqual({
    ownerStr: 'agoric1rwwley550k9mmk6uq6mm6z4udrg8kyuyvfszjk',
    tokenOwner: '0x8Cb4b25E77844fC0632aCa14f1f9B23bdd654EbF',
    permit: {
      deadline: 1766152922n,
      nonce: 1766152502305n,
      permitted: {
        amount: 1000000n,
        token: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      },
    },
    signature:
      '0x6877deb265f786e68290acb428d333f92fc350786b07bfcc49239e856de5d23f1d84c6e9d05c7862e1484dfc1ba772b4f0ad49121a43d9efa3b6ca8d3c0b35541c',
  });

  // XXX should check sig
});

test('decode testExecute tx', ({ expect }) => {
  const payload =
    '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000008cb4b25e77844fc0632aca14f1f9b23bdd654ebf0000000000000000000000001c7d4b196cb0c7b01d743fbc6116a902379c723800000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000019b36f68cd70000000000000000000000000000000000000000000000000000000069455e4e0000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000000001461676f72696331313736363135333730333031380000000000000000000000000000000000000000000000000000000000000000000000000000000000000041a6320b3b5fa95ab1a3e5944f0482b458afd067364484c8f0d312307b3ad21df97f0ac321665393c482454aebb6138ea4c961347d01bff69eae8f09b1612a03311b00000000000000000000000000000000000000000000000000000000000000';
  const decoded = decodeAbiParameters(createAndDepositParams, payload);
  expect(decoded.length).toBe(1);
  expect(decoded[0]).toStrictEqual({
    ownerStr: 'agoric11766153703018',
    tokenOwner: '0x8Cb4b25E77844fC0632aCa14f1f9B23bdd654EbF',
    permit: {
      deadline: 1766153806n,
      nonce: 1766153686231n,
      permitted: {
        amount: 1000000n,
        token: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      },
    },
    signature:
      '0xa6320b3b5fa95ab1a3e5944f0482b458afd067364484c8f0d312307b3ad21df97f0ac321665393c482454aebb6138ea4c961347d01bff69eae8f09b1612a03311b',
  });
});
