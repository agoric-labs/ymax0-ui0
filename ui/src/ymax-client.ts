import { AmountMath } from '@agoric/ertp';
import { Fail } from '@endo/errors';
import { objectMap } from '@endo/patterns';
type NatAmount = { brand: Brand<'nat'>; value: bigint }; // XXX from ERTP

export type YieldProtocol = 'USDN' | 'Aave' | 'Compound';
export type EVMChain = 'Avalanche' | 'Arbitrum' | 'Ethereum' | 'Base'; // XXX etc.

const { entries, values } = Object;
const { add, make } = AmountMath;
const amountSum = <A extends Amount>(amounts: A[]) =>
  amounts.reduce((acc, v) => add(acc, v));

const NonNullish = <T>(x: T | null | undefined, msg = 'expected truthy'): T => {
  if (!x) throw Error(msg);
  return x;
};

// XXX src/desc are more constrained than string
export type MovementDesc = {
  src: string;
  dest: string;
  amount: NatAmount;
  fee?: NatAmount;
  detail?: Record<string, bigint>;
};

export const makePortfolioSteps = <
  G extends Partial<Record<YieldProtocol, NatAmount>>,
>(
  goal: G,
  opts: {
    /** XXX assume same chain for Aave and Compound */
    evm?: EVMChain;
    feeBrand?: Brand<'nat'>;
    feeBasisPoints?: bigint; // Add custom fee amount parameter
    fees?: Record<keyof G, { Account: NatAmount; Call: NatAmount }>;
    detail?: { usdnOut: NatValue };
  } = {},
) => {
  values(goal).length > 0 || Fail`empty goal`;
  const { USDN: _1, ...evmGoal } = goal;
  const {
    evm = 'Avalanche',
    feeBrand,
    feeBasisPoints = 2_000_000n, // Default to 2 BLD (2,000,000 micro-BLD)
    fees = objectMap(evmGoal, _ => ({
      Account: make(NonNullish(feeBrand), feeBasisPoints),
      Call: make(NonNullish(feeBrand), feeBasisPoints),
    })),
    detail = 'USDN' in goal
      ? { usdnOut: ((goal.USDN?.value || 0n) * 99n) / 100n }
      : undefined,
  } = opts;
  const steps: MovementDesc[] = [];

  const Deposit = amountSum(values(goal));
  const GmpFee =
    values(fees).length > 0
      ? amountSum(
          values(fees)
            .map(f => [f.Account, f.Call])
            .flat(),
        )
      : undefined;
  const give = { Deposit, ...(GmpFee ? { GmpFee } : {}) };
  steps.push({ src: '<Deposit>', dest: '@agoric', amount: Deposit });
  steps.push({ src: '@agoric', dest: '@noble', amount: Deposit });
  for (const [p, amount] of entries(goal)) {
    switch (p) {
      case 'USDN':
        steps.push({ src: '@noble', dest: 'USDNVault', amount, detail });
        break;
      case 'Aave':
      case 'Compound':
        // XXX optimize: combine noble->evm steps
        steps.push({
          src: '@noble',
          dest: `@${evm}`,
          amount,
          fee: fees[p].Account,
        });
        steps.push({
          src: `@${evm}`,
          dest: `${p}_${evm}`,
          amount,
          fee: fees[p].Call,
        });
        break;
      default:
        throw Error('unreachable');
    }
  }

  return harden({ give, steps });
};
