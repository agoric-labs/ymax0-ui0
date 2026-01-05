/**
 * Tests for OpenPortfolio intent EIP-712 data structures
 *
 * These tests verify the EIP-712 schema for opening a portfolio with deposit,
 * including portion-based target allocations and proper token address handling
 * for MetaMask display.
 */

import { hashTypedData } from 'viem';
import { describe, expect, it } from 'vitest';
import type { TargetAllocation } from './evm-portfolio-types';
import {
  createOpenPortfolioIntent,
  formatUSDCAmount,
  getOpenPortfolioDomain,
  OpenPortfolioTypes,
  parseUSDCAmount,
  SEPOLIA_CONTRACTS,
  validateAllocations,
} from './open-portfolio-eip712';

describe('OpenPortfolio EIP-712 Intent', () => {
  describe('createOpenPortfolioIntent', () => {
    it('creates valid intent structure with portion-based allocations', () => {
      const allocations: TargetAllocation[] = [
        { instrument: 'USDN', portion: 60n },
        { instrument: 'Aave_Ethereum', portion: 40n },
      ];

      const intent = createOpenPortfolioIntent(
        1_000_000n, // 1 USDC
        allocations,
        { nonce: 12345n, deadline: 67890n },
      );

      // Note: depositor is not in the message - it can be recovered from signature
      expect(intent.deposit.token).toBe(SEPOLIA_CONTRACTS.USDC);
      expect(intent.deposit.amount).toBe(1000000n);
      expect(intent.nonce).toBe(12345n);
      expect(intent.deadline).toBe(67890n);

      // Verify allocations are array of structs (not JSON, not parallel arrays)
      expect(intent.allocations).toEqual([
        { instrument: 'USDN', portion: 60n },
        { instrument: 'Aave_Ethereum', portion: 40n },
      ]);
    });

    it('supports flexible portion ratios (60:40 same as 6:4)', () => {
      const allocations1: TargetAllocation[] = [
        { instrument: 'A', portion: 60n },
        { instrument: 'B', portion: 40n },
      ];

      const allocations2: TargetAllocation[] = [
        { instrument: 'A', portion: 6n },
        { instrument: 'B', portion: 4n },
      ];

      const intent1 = createOpenPortfolioIntent(1000n, allocations1, {
        nonce: 1n,
        deadline: 100n,
      });

      const intent2 = createOpenPortfolioIntent(1000n, allocations2, {
        nonce: 1n,
        deadline: 100n,
      });

      // Both should create valid intents with different portion values but same ratio
      expect(intent1.allocations).toEqual([
        { instrument: 'A', portion: 60n },
        { instrument: 'B', portion: 40n },
      ]);
      expect(intent2.allocations).toEqual([
        { instrument: 'A', portion: 6n },
        { instrument: 'B', portion: 4n },
      ]);

      // Verify ratio is the same: 60/100 === 6/10
      const total1 = 60 + 40;
      const total2 = 6 + 4;
      expect(60 / total1).toBeCloseTo(6 / total2);
    });

    it('includes token address for MetaMask USDC icon display', () => {
      const allocations: TargetAllocation[] = [
        { instrument: 'USDN', portion: 100n },
      ];

      const intent = createOpenPortfolioIntent(15_000_000n, allocations);

      // Token address must be present in deposit
      expect(intent.deposit.token).toBe(SEPOLIA_CONTRACTS.USDC);
      // Verify it's a valid Ethereum address
      expect(intent.deposit.token).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('uses default nonce and deadline if not provided', () => {
      const allocations: TargetAllocation[] = [
        { instrument: 'USDN', portion: 100n },
      ];

      const before = BigInt(Math.floor(Date.now() / 1000));
      const intent = createOpenPortfolioIntent(1_000_000n, allocations);
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
        { instrument: 'USDN', portion: 50n },
        { instrument: 'Aave_Ethereum', portion: 50n },
      ];

      const intent = createOpenPortfolioIntent(1_000_000n, allocations, {
        nonce: 1n,
        deadline: 100n,
      });

      const domain = getOpenPortfolioDomain(SEPOLIA_CONTRACTS.CHAIN_ID);
      const types = OpenPortfolioTypes;

      // Should not throw when hashing
      expect(() => {
        hashTypedData({
          domain,
          types: OpenPortfolioTypes,
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
      const allocations: TargetAllocation[] = [
        { instrument: 'USDN', portion: 100n },
      ];

      const intent1 = createOpenPortfolioIntent(1_000_000n, allocations, {
        nonce: 42n,
        deadline: 1000n,
      });

      const intent2 = createOpenPortfolioIntent(1_000_000n, allocations, {
        nonce: 42n,
        deadline: 1000n,
      });

      const domain = getOpenPortfolioDomain(SEPOLIA_CONTRACTS.CHAIN_ID);

      const hash1 = hashTypedData({
        domain,
        types: OpenPortfolioTypes,
        primaryType: 'OpenPortfolio',
        message: intent1,
      });
      const hash2 = hashTypedData({
        domain,
        types: OpenPortfolioTypes,
        primaryType: 'OpenPortfolio',
        message: intent2,
      });

      expect(hash1).toBe(hash2);
    });

    it('produces different hash for different allocations', () => {
      const allocations1: TargetAllocation[] = [
        { instrument: 'A', portion: 60n },
        { instrument: 'B', portion: 40n },
      ];

      const allocations2: TargetAllocation[] = [
        { instrument: 'A', portion: 50n },
        { instrument: 'B', portion: 50n },
      ];

      const intent1 = createOpenPortfolioIntent(1_000_000n, allocations1, {
        nonce: 1n,
        deadline: 100n,
      });

      const intent2 = createOpenPortfolioIntent(1_000_000n, allocations2, {
        nonce: 1n,
        deadline: 100n,
      });

      const domain = getOpenPortfolioDomain(SEPOLIA_CONTRACTS.CHAIN_ID);
      const types = OpenPortfolioTypes;

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
      const amounts = [1_000_000n, 15_000_000n, 1_500_000n, 1_234_567n];

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
        { instrument: 'A', portion: 60n },
        { instrument: 'B', portion: 40n },
      ];

      expect(() => validateAllocations(validAllocations)).not.toThrow();
    });

    it('accepts single allocation', () => {
      const singleAllocation: TargetAllocation[] = [
        { instrument: 'USDN', portion: 100n },
      ];

      expect(() => validateAllocations(singleAllocation)).not.toThrow();
    });

    it('accepts different portion scales', () => {
      const allocations: TargetAllocation[] = [
        { instrument: 'A', portion: 6n },
        { instrument: 'B', portion: 4n },
      ];

      expect(() => validateAllocations(allocations)).not.toThrow();
    });

    it('rejects empty allocations', () => {
      expect(() => validateAllocations([])).toThrow(
        'At least one allocation is required',
      );
    });

    it('rejects zero portions', () => {
      const badAllocations: TargetAllocation[] = [
        { instrument: 'A', portion: 0n },
      ];

      expect(() => validateAllocations(badAllocations)).toThrow(
        'must be positive',
      );
    });

    it('rejects negative portions', () => {
      const badAllocations: TargetAllocation[] = [
        { instrument: 'A', portion: -10n },
      ];

      expect(() => validateAllocations(badAllocations)).toThrow(
        'must be positive',
      );
    });

    it('rejects non-integer portions', () => {
      const badAllocations: TargetAllocation[] = [
        // @ts-expect-error intentional type error
        { instrument: 'A', portion: 60.5 },
      ];

      expect(() => validateAllocations(badAllocations)).toThrow(
        'must be an integer',
      );
    });

    it('rejects duplicate instruments', () => {
      const badAllocations: TargetAllocation[] = [
        { instrument: 'A', portion: 50n },
        { instrument: 'A', portion: 50n },
      ];

      expect(() => validateAllocations(badAllocations)).toThrow(
        'Duplicate instruments',
      );
    });
  });

  describe('Three-instrument allocation examples', () => {
    it('handles 30:40:30 allocation', () => {
      const allocations: TargetAllocation[] = [
        { instrument: 'USDN', portion: 30n },
        { instrument: 'Aave_Ethereum', portion: 40n },
        { instrument: 'Compound_Arbitrum', portion: 30n },
      ];

      const intent = createOpenPortfolioIntent(1_000_000n, allocations, {
        nonce: 1n,
        deadline: 100n,
      });

      expect(intent.allocations).toEqual([
        { instrument: 'USDN', portion: 30n },
        { instrument: 'Aave_Ethereum', portion: 40n },
        { instrument: 'Compound_Arbitrum', portion: 30n },
      ]);

      // Verify total portions
      const total = intent.allocations.reduce((sum, a) => sum + a.portion, 0n);
      expect(total).toBe(100n);
    });

    it('handles 3:4:3 allocation (same ratio as 30:40:30)', () => {
      const allocations: TargetAllocation[] = [
        { instrument: 'USDN', portion: 3n },
        { instrument: 'Aave_Ethereum', portion: 4n },
        { instrument: 'Compound_Arbitrum', portion: 3n },
      ];

      validateAllocations(allocations); // Should not throw

      const intent = createOpenPortfolioIntent(1_000_000n, allocations, {
        nonce: 1n,
        deadline: 100n,
      });

      expect(intent.allocations).toEqual([
        { instrument: 'USDN', portion: 3n },
        { instrument: 'Aave_Ethereum', portion: 4n },
        { instrument: 'Compound_Arbitrum', portion: 3n },
      ]);

      const total = intent.allocations.reduce((sum, a) => sum + a.portion, 0n);
      expect(total).toBe(10n);

      // Verify ratios are equivalent
      expect(3 / 10).toBeCloseTo(30 / 100);
      expect(4 / 10).toBeCloseTo(40 / 100);
    });
  });
});
