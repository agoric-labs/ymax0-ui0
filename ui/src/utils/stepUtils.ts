import { StepInfo } from '../components/StepSelector';
import { MovementDesc, YieldProtocol, EVMChain } from '../ymax-client';

export const generateOpenPositionSteps = (
  yieldProtocol: YieldProtocol,
  evmChain: EVMChain,
  usdcAmount: bigint,
): StepInfo[] => {
  const steps: StepInfo[] = [];

  // Common initial steps
  steps.push({
    id: 'access-token',
    name: 'Provide Access Token',
    description: 'Supply PoC26 access token to open portfolio',
  });

  steps.push({
    id: 'deposit-to-agoric',
    name: 'Deposit to Agoric',
    description: 'Transfer USDC to Agoric chain',
    movement: {
      src: '<Deposit>',
      dest: '@agoric',
      amount: { brand: {} as Brand<'nat'>, value: usdcAmount },
    },
  });

  steps.push({
    id: 'agoric-to-noble',
    name: 'Bridge to Noble',
    description: 'Transfer funds from Agoric to Noble chain',
    movement: {
      src: '@agoric',
      dest: '@noble',
      amount: { brand: {} as Brand<'nat'>, value: usdcAmount },
    },
  });

  // Protocol-specific steps
  switch (yieldProtocol) {
    case 'USDN':
      steps.push({
        id: 'noble-to-usdn',
        name: 'Deposit to USDN Vault',
        description: 'Deposit funds into USDN yield protocol',
        movement: {
          src: '@noble',
          dest: 'USDNVault',
          amount: { brand: {} as Brand<'nat'>, value: usdcAmount },
          detail: { usdnOut: (usdcAmount * 99n) / 100n },
        },
      });
      break;

    case 'Aave':
    case 'Compound':
      steps.push({
        id: 'noble-to-evm',
        name: `Bridge to ${evmChain}`,
        description: `Transfer funds from Noble to ${evmChain} chain`,
        movement: {
          src: '@noble',
          dest: `@${evmChain}`,
          amount: { brand: {} as Brand<'nat'>, value: usdcAmount },
          fee: { brand: {} as Brand<'nat'>, value: 2_000_000n },
        },
      });

      steps.push({
        id: `evm-to-${yieldProtocol.toLowerCase()}`,
        name: `Deposit to ${yieldProtocol}`,
        description: `Deposit funds into ${yieldProtocol} on ${evmChain}`,
        movement: {
          src: `@${evmChain}`,
          dest: `${yieldProtocol}_${evmChain}`,
          amount: { brand: {} as Brand<'nat'>, value: usdcAmount },
          fee: { brand: {} as Brand<'nat'>, value: 2_000_000n },
        },
      });
      break;
  }

  return steps;
};

export const generateWithdrawSteps = (
  fromProtocol: YieldProtocol,
  evmChain: EVMChain,
  withdrawAmount: bigint,
): StepInfo[] => {
  const steps: StepInfo[] = [];

  switch (fromProtocol) {
    case 'USDN':
      steps.push({
        id: 'usdn-to-noble',
        name: 'Withdraw from USDN',
        description: 'Withdraw funds from USDN vault to Noble chain',
        movement: {
          src: 'USDNVault',
          dest: '@noble',
          amount: { brand: {} as Brand<'nat'>, value: withdrawAmount },
        },
      });
      break;

    case 'Aave':
    case 'Compound':
      steps.push({
        id: `${fromProtocol.toLowerCase()}-to-evm`,
        name: `Withdraw from ${fromProtocol}`,
        description: `Withdraw funds from ${fromProtocol} on ${evmChain}`,
        movement: {
          src: `${fromProtocol}_${evmChain}`,
          dest: `@${evmChain}`,
          amount: { brand: {} as Brand<'nat'>, value: withdrawAmount },
          fee: { brand: {} as Brand<'nat'>, value: 15_000_000n },
        },
      });

      steps.push({
        id: 'evm-to-noble',
        name: `Bridge from ${evmChain}`,
        description: `Transfer funds from ${evmChain} to Noble chain`,
        movement: {
          src: `@${evmChain}`,
          dest: '@noble',
          amount: { brand: {} as Brand<'nat'>, value: withdrawAmount },
          fee: { brand: {} as Brand<'nat'>, value: 15_000_000n },
        },
      });
      break;
  }

  // Common final steps
  steps.push({
    id: 'noble-to-agoric',
    name: 'Bridge to Agoric',
    description: 'Transfer funds from Noble back to Agoric chain',
    movement: {
      src: '@noble',
      dest: '@agoric',
      amount: { brand: {} as Brand<'nat'>, value: withdrawAmount },
    },
  });

  steps.push({
    id: 'receive-cash',
    name: 'Receive USDC',
    description: 'Receive USDC in your wallet',
    movement: {
      src: '@agoric',
      dest: '<Cash>',
      amount: { brand: {} as Brand<'nat'>, value: withdrawAmount },
    },
  });

  return steps;
};

export const filterMovementsBySelectedSteps = (
  originalMovements: MovementDesc[],
  selectedStepIds: string[],
  allSteps: StepInfo[],
): MovementDesc[] => {
  return originalMovements.filter((movement) => {
    const correspondingStep = allSteps.find(
      (step) =>
        step.movement &&
        step.movement.src === movement.src &&
        step.movement.dest === movement.dest,
    );
    return (
      !correspondingStep || selectedStepIds.includes(correspondingStep.id)
    );
  });
};