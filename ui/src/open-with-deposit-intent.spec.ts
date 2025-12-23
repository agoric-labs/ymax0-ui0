/**
 * Tests for OpenPortfolio intent EIP-712 data structures
 *
 * These tests verify the EIP-712 schema for opening a portfolio with deposit,
 * including portion-based target allocations and proper token address handling
 * for MetaMask display.
 */

import { describe, it, expect } from 'vitest';
import { hashTypedData } from 'viem';
import type { TargetAllocation } from './evm-portfolio-types';
import {
  createOpenPortfolioIntent,
  getOpenPortfolioDomain,
  getOpenPortfolioTypes,
  formatUSDCAmount,
  parseUSDCAmount,
  validateAllocations,
  SEPOLIA_CONTRACTS,
} from './open-portfolio-eip712';

describe('OpenPortfolio EIP-712 Intent', () => {
  const TEST_ADDRESS = '0x1234567890123456789012345678901234567890';

  describe('createOpenPortfolioIntent', () => {
    it('creates valid intent structure with portion-based allocations', () => {
      const allocations: TargetAllocation[] = [
        { instrument: 'USDN', portion: 60 },
        { instrument: 'Aave_Ethereum', portion: 40 },
      ];

      const intent = createOpenPortfolioIntent(
        TEST_ADDRESS,
        1_000_000n, // 1 USDC
        allocations,
        { nonce: 12345n, deadline: 67890n },
      );

      expect(intent.depositor).toBe(TEST_ADDRESS);
      expect(intent.deposit.token).toBe(SEPOLIA_CONTRACTS.USDC);
      expect(intent.deposit.amount).toBe('1000000');
      expect(intent.nonce).toBe('12345');
      expect(intent.deadline).toBe('67890');

      // Verify allocations are JSON-encoded
      const parsedAllocations = JSON.parse(intent.allocations);
      expect(parsedAllocations).toHaveLength(2);
      expect(parsedAllocations[0]).toEqual({ instrument: 'USDN', portion: '60' });
      expect(parsedAllocations[1]).toEqual({ instrument: 'Aave_Ethereum', portion: '40' });
    });

    it('supports flexible portion ratios (60:40 same as 6:4)', () => {
      const allocations1: TargetAllocation[] = [
        { instrument: 'A', portion: 60 },
        { instrument: 'B', portion: 40 },
      ];

      const allocations2: TargetAllocation[] = [
        { instrument: 'A', portion: 6 },
        { instrument: 'B', portion: 4 },
      ];

      const intent1 = createOpenPortfolioIntent(TEST_ADDRESS, 1000n, allocations1, {
        nonce: 1n,
        deadline: 100n,
      });

      const intent2 = createOpenPortfolioIntent(TEST_ADDRESS, 1000n, allocations2, {
        nonce: 1n,
        deadline: 100n,
      });

      // Both should create valid intents with different portion values but same ratio
      const parsed1 = JSON.parse(intent1.allocations);
      const parsed2 = JSON.parse(intent2.allocations);

      expect(parsed1[0].portion).toBe('60');
      expect(parsed2[0].portion).toBe('6');

      // Verify ratio is the same: 60/100 === 6/10
      const total1 = 60 + 40;
      const total2 = 6 + 4;
      expect(60 / total1).toBeCloseTo(6 / total2);
    });

    it('includes token address for MetaMask USDC icon display', () => {
      const allocations: TargetAllocation[] = [{ instrument: 'USDN', portion: 100 }];

      const intent = createOpenPortfolioIntent(TEST_ADDRESS, 15_000_000n, allocations);

      // Token address must be present in deposit
      expect(intent.deposit.token).toBe(SEPOLIA_CONTRACTS.USDC);
      // Verify it's a valid Ethereum address
      expect(intent.deposit.token).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('uses default nonce and deadline if not provided', () => {
      const allocations: TargetAllocation[] = [{ instrument: 'USDN', portion: 100 }];

      const before = BigInt(Math.floor(Date.now() / 1000));
      const intent = createOpenPortfolioIntent(TEST_ADDRESS, 1_000_000n, allocations);
      const after = BigInt(Math.floor(Date.now() / 1000));

      const nonce = BigInt(intent.nonce);
      const deadline = BigInt(intent.deadline);

      // Nonce should be approximately current timestamp
      expect(nonce).toBeGreaterThanOrEqual(before);
      expect(nonce).toBeLessThanOrEqual(after + 1n);

      // Deadline should be ~1 hour after nonce
      expect(deadline - nonce).toBeGreaterThanOrEqual(3599n);
      expect(deadline - nonce).toBeLessThanOrEqual(3601n);
    });
  });

  describe('EIP-712 encoding and validation', () => {
    it('produces EIP-712 encodable message', () => {
      const allocations: TargetAllocation[] = [
        { instrument: 'USDN', portion: 50 },
        { instrument: 'Aave_Ethereum', portion: 50 },
      ];

      const intent = createOpenPortfolioIntent(
        TEST_ADDRESS,
        1_000_000n,
        allocations,
        { nonce: 1n, deadline: 100n },
      );

      const domain = getOpenPortfolioDomain(SEPOLIA_CONTRACTS.CHAIN_ID);
      const types = getOpenPortfolioTypes();

      // Should not throw when hashing
      expect(() => {
        hashTypedData({
          domain,
          types,
          primaryType: 'OpenPortfolio',
          message: intent,
        });
      }).not.toThrow();

      // Verify hash can be computed
      const hash = hashTypedData({
        domain,
        types,
        primaryType: 'OpenPortfolio',
        message: intent,
      });
      expect(hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });

    it('produces consistent hash for same input', () => {
      const allocations: TargetAllocation[] = [{ instrument: 'USDN', portion: 100 }];

      const intent1 = createOpenPortfolioIntent(
        TEST_ADDRESS,
        1_000_000n,
        allocations,
        { nonce: 42n, deadline: 1000n },
      );

      const intent2 = createOpenPortfolioIntent(
        TEST_ADDRESS,
        1_000_000n,
        allocations,
        { nonce: 42n, deadline: 1000n },
      );

      const domain = getOpenPortfolioDomain(SEPOLIA_CONTRACTS.CHAIN_ID);
      const types = getOpenPortfolioTypes();

      const hash1 = hashTypedData({
        domain,
        types,
        primaryType: 'OpenPortfolio',
        message: intent1,
      });
      const hash2 = hashTypedData({
        domain,
        types,
        primaryType: 'OpenPortfolio',
        message: intent2,
      });

      expect(hash1).toBe(hash2);
    });

    it('produces different hash for different allocations', () => {
      const allocations1: TargetAllocation[] = [
        { instrument: 'A', portion: 60 },
        { instrument: 'B', portion: 40 },
      ];

      const allocations2: TargetAllocation[] = [
        { instrument: 'A', portion: 50 },
        { instrument: 'B', portion: 50 },
      ];

      const intent1 = createOpenPortfolioIntent(
        TEST_ADDRESS,
        1_000_000n,
        allocations1,
        { nonce: 1n, deadline: 100n },
      );

      const intent2 = createOpenPortfolioIntent(
        TEST_ADDRESS,
        1_000_000n,
        allocations2,
        { nonce: 1n, deadline: 100n },
      );

      const domain = getOpenPortfolioDomain(SEPOLIA_CONTRACTS.CHAIN_ID);
      const types = getOpenPortfolioTypes();

      const hash1 = hashTypedData({
        domain,
        types,
        primaryType: 'OpenPortfolio',
        message: intent1,
      });
      const hash2 = hashTypedData({
        domain,
        types,
        primaryType: 'OpenPortfolio',
        message: intent2,
      });

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('formatUSDCAmount', () => {
    it('formats whole USDC amounts correctly', () => {
      expect(formatUSDCAmount(1_000_000n)).toBe('1');
      expect(formatUSDCAmount(15_000_000n)).toBe('15');
      expect(formatUSDCAmount(1000_000_000n)).toBe('1000');
    });

    it('formats fractional USDC amounts correctly', () => {
      expect(formatUSDCAmount(1_500_000n)).toBe('1.5');
      expect(formatUSDCAmount(1_250_000n)).toBe('1.25');
      expect(formatUSDCAmount(1_234_567n)).toBe('1.234567');
    });

    it('formats zero correctly', () => {
      expect(formatUSDCAmount(0n)).toBe('0');
    });

    it('handles small fractional amounts', () => {
      expect(formatUSDCAmount(1n)).toBe('0.000001');
      expect(formatUSDCAmount(100n)).toBe('0.0001');
    });
  });

  describe('parseUSDCAmount', () => {
    it('parses whole USDC amounts correctly', () => {
      expect(parseUSDCAmount('1')).toBe(1_000_000n);
      expect(parseUSDCAmount('15')).toBe(15_000_000n);
      expect(parseUSDCAmount('1000')).toBe(1000_000_000n);
    });

    it('parses fractional USDC amounts correctly', () => {
      expect(parseUSDCAmount('1.5')).toBe(1_500_000n);
      expect(parseUSDCAmount('1.25')).toBe(1_250_000n);
      expect(parseUSDCAmount('1.234567')).toBe(1_234_567n);
    });

    it('handles zero correctly', () => {
      expect(parseUSDCAmount('0')).toBe(0n);
      expect(parseUSDCAmount('0.0')).toBe(0n);
    });

    it('handles amounts with trailing zeros', () => {
      expect(parseUSDCAmount('1.500000')).toBe(1_500_000n);
    });

    it('truncates amounts with too many decimals', () => {
      expect(parseUSDCAmount('1.1234567890')).toBe(1_123_456n);
    });

    it('round-trips correctly', () => {
      const amounts = [
        1_000_000n,
        15_000_000n,
        1_500_000n,
        1_234_567n,
      ];

      for (const amount of amounts) {
        const formatted = formatUSDCAmount(amount);
        const parsed = parseUSDCAmount(formatted);
        expect(parsed).toBe(amount);
      }
    });
  });

  describe('validateAllocations', () => {
    it('accepts valid allocations', () => {
      const validAllocations: TargetAllocation[] = [
        { instrument: 'A', portion: 60 },
        { instrument: 'B', portion: 40 },
      ];

      expect(() => validateAllocations(validAllocations)).not.toThrow();
    });

    it('accepts single allocation', () => {
      const singleAllocation: TargetAllocation[] = [
        { instrument: 'USDN', portion: 100 },
      ];

      expect(() => validateAllocations(singleAllocation)).not.toThrow();
    });

    it('accepts different portion scales', () => {
      const allocations: TargetAllocation[] = [
        { instrument: 'A', portion: 6 },
        { instrument: 'B', portion: 4 },
      ];

      expect(() => validateAllocations(allocations)).not.toThrow();
    });

    it('rejects empty allocations', () => {
      expect(() => validateAllocations([])).toThrow('At least one allocation is required');
    });

    it('rejects zero portions', () => {
      const badAllocations: TargetAllocation[] = [
        { instrument: 'A', portion: 0 },
      ];

      expect(() => validateAllocations(badAllocations)).toThrow('must be positive');
    });

    it('rejects negative portions', () => {
      const badAllocations: TargetAllocation[] = [
        { instrument: 'A', portion: -10 },
      ];

      expect(() => validateAllocations(badAllocations)).toThrow('must be positive');
    });

    it('rejects non-integer portions', () => {
      const badAllocations: TargetAllocation[] = [
        { instrument: 'A', portion: 60.5 },
      ];

      expect(() => validateAllocations(badAllocations)).toThrow('must be an integer');
    });

    it('rejects duplicate instruments', () => {
      const badAllocations: TargetAllocation[] = [
        { instrument: 'A', portion: 50 },
        { instrument: 'A', portion: 50 },
      ];

      expect(() => validateAllocations(badAllocations)).toThrow('Duplicate instruments');
    });
  });

  describe('Three-instrument allocation examples', () => {
    it('handles 30:40:30 allocation', () => {
      const allocations: TargetAllocation[] = [
        { instrument: 'USDN', portion: 30 },
        { instrument: 'Aave_Ethereum', portion: 40 },
        { instrument: 'Compound_Arbitrum', portion: 30 },
      ];

      const intent = createOpenPortfolioIntent(
        TEST_ADDRESS,
        1_000_000n,
        allocations,
        { nonce: 1n, deadline: 100n },
      );

      const parsed = JSON.parse(intent.allocations);
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toEqual({ instrument: 'USDN', portion: '30' });
      expect(parsed[1]).toEqual({ instrument: 'Aave_Ethereum', portion: '40' });
      expect(parsed[2]).toEqual({ instrument: 'Compound_Arbitrum', portion: '30' });

      // Verify total portions
      const total = parsed.reduce((sum: number, a: { portion: string }) => sum + parseInt(a.portion), 0);
      expect(total).toBe(100);
    });

    it('handles 3:4:3 allocation (same ratio as 30:40:30)', () => {
      const allocations: TargetAllocation[] = [
        { instrument: 'USDN', portion: 3 },
        { instrument: 'Aave_Ethereum', portion: 4 },
        { instrument: 'Compound_Arbitrum', portion: 3 },
      ];

      validateAllocations(allocations); // Should not throw

      const intent = createOpenPortfolioIntent(
        TEST_ADDRESS,
        1_000_000n,
        allocations,
        { nonce: 1n, deadline: 100n },
      );

      const parsed = JSON.parse(intent.allocations);
      const total = parsed.reduce((sum: number, a: { portion: string }) => sum + parseInt(a.portion), 0);
      expect(total).toBe(10);

      // Verify ratios are equivalent
      expect(3 / 10).toBeCloseTo(30 / 100);
      expect(4 / 10).toBeCloseTo(40 / 100);
    });
  });
});
