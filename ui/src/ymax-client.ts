import { AmountMath } from '@agoric/ertp';
import { Fail } from '@endo/errors';
import { objectMap } from '@endo/patterns';
type NatAmount = { brand: Brand<'nat'>; value: bigint }; // XXX from ERTP

export type YieldProtocol =
  | 'USDN'
  | 'Aave'
  | 'Compound'
  | 'Beefy'
  | 'Beefy_re7'
  | 'Beefy_compoundUsdc_Arbitrum'
  | 'Beefy_compoundUsdc_Optimism'
  | 'Beefy_morphoGauntletUsdc'
  | 'Beefy_morphoSmokehouseUsdc'
  | 'Beefy_morphoSeamlessUsdc';

export type EVMChain = 'Avalanche' | 'Arbitrum' | 'Ethereum' | 'Base' | 'Optimism'; // XXX etc.

// Beefy vault names are specific to each chain and vault type
const beefyVaultNames: Record<EVMChain, string> = {
  Avalanche: 'Beefy_re7_Avalanche',
  Arbitrum: 'Beefy_compoundUsdc_Arbitrum',
  Ethereum: 'Beefy_morphoGauntletUsdc_Ethereum', // Default to morphoGauntlet, could also be morphoSmokehouse
  Base: 'Beefy_morphoSeamlessUsdc_Base',
  Optimism: 'Beefy_compoundUsdc_Optimism',
};

// Map from Beefy protocol to full vault name
export const beefyProtocolToVault: Record<string, string> = {
  'Beefy_re7': 'Beefy_re7_Avalanche',
  'Beefy_compoundUsdc_Arbitrum': 'Beefy_compoundUsdc_Arbitrum',
  'Beefy_compoundUsdc_Optimism': 'Beefy_compoundUsdc_Optimism',
  'Beefy_morphoGauntletUsdc': 'Beefy_morphoGauntletUsdc_Ethereum',
  'Beefy_morphoSmokehouseUsdc': 'Beefy_morphoSmokehouseUsdc_Ethereum',
  'Beefy_morphoSeamlessUsdc': 'Beefy_morphoSeamlessUsdc_Base',
};

// Map from Beefy protocol to chain
export const beefyProtocolToChain: Record<string, EVMChain> = {
  'Beefy_re7': 'Avalanche',
  'Beefy_compoundUsdc_Arbitrum': 'Arbitrum',
  'Beefy_compoundUsdc_Optimism': 'Optimism',
  'Beefy_morphoGauntletUsdc': 'Ethereum',
  'Beefy_morphoSmokehouseUsdc': 'Ethereum',
  'Beefy_morphoSeamlessUsdc': 'Base',
};

// Get the full vault name from protocol
export const getBeefyVaultName = (protocol: YieldProtocol): string => {
  if (protocol.startsWith('Beefy_')) {
    return beefyProtocolToVault[protocol] || protocol;
  }
  return protocol;
};

// Check if protocol is a Beefy vault
export const isBeefyProtocol = (protocol: YieldProtocol): boolean => {
  return protocol.startsWith('Beefy_');
};

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
          detail: { evmGas: 200_000_000_000_000n },
        });
        steps.push({
          src: `@${evm}`,
          dest: `${p}_${evm}`,
          amount,
          fee: fees[p].Call,
          detail: { evmGas: 200_000_000_000_000n },
        });
        break;
      case 'Beefy':
        // Beefy uses specific vault names per chain
        steps.push({
          src: '@noble',
          dest: `@${evm}`,
          amount,
          fee: fees[p].Account,
          detail: { evmGas: 200_000_000_000_000n },
        });
        steps.push({
          src: `@${evm}`,
          dest: beefyVaultNames[evm],
          amount,
          fee: fees[p].Call,
          detail: { evmGas: 200_000_000_000_000n },
        });
        break;
      default:
        throw Error('unreachable');
    }
  }

  return harden({ give, steps });
};
