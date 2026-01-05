/**
 * Tests for EVM orchestration utilities
 */

import { test } from 'vitest';
import {
  toEip2098,
  buildCreateAndDepositPayload,
  createAndDepositParams,
} from '../evm-orchestration';
import { decodeAbiParameters } from 'viem';
import { WITNESS_TYPE_STRING } from '../open-portfolio-eip712';

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
      permitted: [
        {
          token: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
          amount: 1000000n,
        },
      ],
      nonce: 1234567890n,
      deadline: 9999999999n,
    },
    witness: ('0x' + '00'.repeat(32)) as `0x${string}`,
    witnessTypeString: WITNESS_TYPE_STRING,
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
      permitted: [
        {
          token: token as `0x${string}`,
          amount: 5000000n,
        },
      ],
      nonce: 1111111111n,
      deadline: 8888888888n,
    },
    witness: ('0x' + '11'.repeat(32)) as `0x${string}`,
    witnessTypeString: WITNESS_TYPE_STRING,
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

test('encode and decode payload with witness', ({ expect }) => {
  // see https://sepolia.etherscan.io/tx/0x094db36eaaa9b790b1f1a95e31d03009522ccc3d7221a4b2df672f4f5efd022d
  // Real signature from transaction (converted to EIP-2098 compact format)
  const testData = {
    ownerStr: 'agoric1y3e3mlnrkuh6j2qcnlrtap42j8mzw240vwr78j',
    tokenOwner: '0x8Cb4b25E77844fC0632aCa14f1f9B23bdd654EbF' as `0x${string}`,
    permit: {
      permitted: [
        {
          token: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
          amount: 100000n,
        },
      ],
      nonce: 1766597619n,
      deadline: 1766601219n,
    },
    witness:
      '0xd443041db7847869b49b13ecc501a79cae10a56e8e2370af011c918ac9802541' as `0x${string}`,
    witnessTypeString: WITNESS_TYPE_STRING,
    signature:
      '0x8af0074ab3d12e5c53146aa5ac231822384c001ffeff512a4d83b2c9805bcb6b832e7d6896928733ebcf3537dfb1d73ba30f52e21cef12747d70aa8f3afe2d28' as `0x${string}`,
  };

  // Encode
  const payload = buildCreateAndDepositPayload(testData);

  // Decode
  const decoded = decodeAbiParameters(createAndDepositParams, payload);

  // Verify all fields match exactly
  expect(decoded.length).toBe(1);
  expect(decoded[0]).toStrictEqual(testData);
});

test('produces correct witness hash matching reference', async ({ expect }) => {
  // Reference witness hash from createAndDeposit.ts
  const expectedWitnessHash =
    '0xd2393ddb93d8a3d5629a02abe2471c2d9a2b961ff5f5a79a9ca1082accb865f2';

  // Parameters from reference implementation
  const witnessData = {
    owner: 'agoric1y3e3mlnrkuh6j2qcnlrtap42j8mzw240vwr64j',
    chainId: 11155111n, // Sepolia
    factory: '0x7bCB9A7Fcf5c18f617f6200915cB0269c032e30C' as `0x${string}`,
  };

  const witnessType = {
    CreateWallet: [
      { name: 'owner', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'factory', type: 'address' },
    ],
  };

  // Use ethers TypedDataEncoder to hash the witness (same as reference)
  const { TypedDataEncoder } = await import('ethers');
  const witnessHash = TypedDataEncoder.hashStruct(
    'CreateWallet',
    witnessType,
    witnessData,
  );

  // Verify it matches the reference exactly
  expect(witnessHash.toLowerCase()).toBe(expectedWitnessHash.toLowerCase());
});

test('matches reference implementation encoding exactly', ({ expect }) => {
  // reference: https://testnet.axelarscan.io/gmp/0xd38489817c701903848127ddf964a1faafff1936bfa3da83cf18fd2460dc1608-334024755
  const referenceHex =
    '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000008cb4b25e77844fc0632aca14f1f9b23bdd654ebf0000000000000000000000000000000000000000000000000000000000000120d443041db7847869b49b13ecc501a79cae10a56e8e2370af011c918ac980254100000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000280000000000000000000000000000000000000000000000000000000000000002d61676f72696331793365336d6c6e726b7568366a3271636e6c7274617034326a386d7a7732343076777237386a0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000019b8cb6fbf300000000000000000000000000000000000000000000000000000000695b534c00000000000000000000000000000000000000000000000000000000000000010000000000000000000000001c7d4b196cb0c7b01d743fbc6116a902379c723800000000000000000000000000000000000000000000000000000000000186a0000000000000000000000000000000000000000000000000000000000000007d43726561746557616c6c6574207769746e6573732943726561746557616c6c657428737472696e67206f776e65722c75696e7432353620636861696e49642c6164647265737320666163746f727929546f6b656e5065726d697373696f6e73286164647265737320746f6b656e2c75696e7432353620616d6f756e742900000000000000000000000000000000000000000000000000000000000000000000418af0074ab3d12e5c53146aa5ac231822384c001ffeff512a4d83b2c9805bcb6b032e7d6896928733ebcf3537dfb1d73ba30f52e21cef12747d70aa8f3afe2d281c00000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

  // Decode the reference payload to extract actual values used
  const decoded = decodeAbiParameters(createAndDepositParams, referenceHex);
  const referenceData = decoded[0];

  // Recreate with exact same parameters from decoded reference
  const payload = buildCreateAndDepositPayload({
    ownerStr: referenceData.ownerStr,
    tokenOwner: referenceData.tokenOwner,
    permit: {
      permitted: [...referenceData.permit.permitted],
      nonce: referenceData.permit.nonce,
      deadline: referenceData.permit.deadline,
    },
    witness: referenceData.witness,
    witnessTypeString: referenceData.witnessTypeString,
    signature: referenceData.signature,
  });

  expect(payload.toLowerCase()).toBe(referenceHex.toLowerCase());
});
