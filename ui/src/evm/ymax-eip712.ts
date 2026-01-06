import type {
  TypedData,
  TypedDataDomain,
  TypedDataToPrimitiveTypes,
} from 'abitype';
import type { TypedDataDefinition } from 'viem';
import { type TypedDataParameter } from './abitype.ts';
import {
  type Witness,
  type getPermitWitnessTransferFromData,
  type getPermitBatchWitnessTransferFromData,
  makeWitness,
} from './permit2/signatureTransfer.ts';

const YMAX_DOMAIN_NAME = 'Ymax';
const YMAX_DOMAIN_VERSION = '1';

const YMAX_WITNESS_FIELD_NAME_PREFIX = 'ymax';

const YmaxStandaloneDomainTypeParams = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
] as const satisfies TypedDataParameter[];

const YmaxStandaloneDomain = {
  name: YMAX_DOMAIN_NAME,
  version: YMAX_DOMAIN_VERSION,
} as const satisfies TypedDataDomain;

// A param to designate the portfolio in operations by its `portfolioId`
const PortfolioIdParam = {
  name: 'portfolio',
  type: 'uint256',
} as const satisfies TypedDataParameter;

// TODO: Remove
const SharedYmaxTypeParams = [] as const satisfies TypedDataParameter[];

// Fields included in Permit data that we don't want duplicated in witness data,
// so only included in standalone typed data.
const YmaxStandaloneTypeParams = [
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
] as const satisfies TypedDataParameter[];

/**
 * The set of portfolio operations supported by EVM Wallets, and their associated params
 */
const OperationTypes = {
  OpenPortfolio: [{ name: 'allocations', type: 'Allocation[]' }],
  Rebalance: [{ name: 'allocations', type: 'Allocation[]' }, PortfolioIdParam],
  Deposit: [PortfolioIdParam],
} as const satisfies TypedData;
type OperationTypes = typeof OperationTypes;

const OperationSubTypes = {
  Allocation: [
    { name: 'instrument', type: 'string' },
    { name: 'portion', type: 'uint256' },
  ],
} as const satisfies TypedData;

/**
 * Target allocation for portfolio positions.
 * Uses 'portion' (not 'basisPoints') to allow flexible ratios.
 * The denominator is implicitly the sum of all portions.
 *
 * Examples:
 * - [{instrument: 'A', portion: 60}, {instrument: 'B', portion: 40}] => 60:40 ratio
 * - [{instrument: 'A', portion: 6}, {instrument: 'B', portion: 4}] => 6:4 ratio (same as 60:40)
 */
export type TargetAllocation = TypedDataToPrimitiveTypes<
  typeof OperationSubTypes
>['Allocation'];

const getYmaxWitnessTypeName = <T extends keyof OperationTypes>(operation: T) =>
  `${YMAX_DOMAIN_NAME}V${YMAX_DOMAIN_VERSION}${operation}` as const;
type YmaxWitnessTypeNames<T extends keyof OperationTypes> = ReturnType<
  typeof getYmaxWitnessTypeName<T>
>;

const getYmaxWitnessTypeParam = <T extends keyof OperationTypes>(
  operation: T,
) =>
  ({
    name: `${YMAX_WITNESS_FIELD_NAME_PREFIX}${operation}`,
    type: getYmaxWitnessTypeName(operation),
  }) as const satisfies TypedDataParameter;

// TODO: Filter operation types to only those needed for witness/standalone
type YmaxWitnessOperationTypes = {
  [K in keyof OperationTypes as YmaxWitnessTypeNames<K>]: [
    ...OperationTypes[K],
    ...typeof SharedYmaxTypeParams,
  ];
};
type YmaxStandaloneOperationTypes = {
  [K in keyof OperationTypes]: [
    ...OperationTypes[K],
    ...typeof SharedYmaxTypeParams,
    ...typeof YmaxStandaloneTypeParams,
  ];
};

const getYmaxWitnessOperationTypes = <T extends keyof OperationTypes>(
  operation: T,
) =>
  ({
    [getYmaxWitnessTypeName(operation)]: [
      ...OperationTypes[operation],
      ...SharedYmaxTypeParams,
    ],
    ...OperationSubTypes,
  }) as {
    [K in T as YmaxWitnessTypeNames<K>]: YmaxWitnessOperationTypes[YmaxWitnessTypeNames<T>];
  } & typeof OperationSubTypes satisfies TypedData;

const getYmaxStandaloneOperationTypes = <T extends keyof OperationTypes>(
  operation: T,
) =>
  ({
    EIP712Domain: YmaxStandaloneDomainTypeParams,
    [operation]: [
      ...OperationTypes[operation],
      ...SharedYmaxTypeParams,
      ...YmaxStandaloneTypeParams,
    ],
    ...OperationSubTypes,
  }) as {
    [K in T]: YmaxStandaloneOperationTypes[K];
  } & typeof OperationSubTypes & {
      EIP712Domain: typeof YmaxStandaloneDomainTypeParams;
    } satisfies TypedData;

export const getYmaxWitness = <T extends keyof OperationTypes>(
  operation: T,
  data: NoInfer<
    TypedDataToPrimitiveTypes<
      YmaxWitnessOperationTypes & typeof OperationSubTypes
    >[YmaxWitnessTypeNames<T>]
  >,
): Witness<
  ReturnType<typeof getYmaxWitnessOperationTypes<T>>,
  // @ts-expect-error some generic inference issue I suppose?
  ReturnType<typeof getYmaxWitnessTypeParam<T>>
> =>
  // @ts-expect-error some generic inference issue I suppose?
  makeWitness(
    // @ts-expect-error some generic inference issue I suppose?
    data,
    getYmaxWitnessOperationTypes(operation),
    getYmaxWitnessTypeParam(operation),
  );

export const getYmaxStandaloneOperationData = <T extends keyof OperationTypes>(
  data: NoInfer<
    TypedDataToPrimitiveTypes<
      YmaxStandaloneOperationTypes & typeof OperationSubTypes
    >[T]
  >,
  operation: T,
): TypedDataDefinition<
  ReturnType<typeof getYmaxStandaloneOperationTypes<T>>,
  T,
  T
> & { domain: typeof YmaxStandaloneDomain } => {
  const types = getYmaxStandaloneOperationTypes(operation);

  // @ts-expect-error some generic inference issue I suppose?
  return {
    domain: YmaxStandaloneDomain,
    types,
    primaryType: operation,
    message: data,
  };
};

export type YmaxStandaloneOperationData<T extends keyof OperationTypes> =
  ReturnType<typeof getYmaxStandaloneOperationData<T>>;

export type YmaxPermitWitnessTransferFromData<T extends keyof OperationTypes> =
  ReturnType<
    typeof getPermitWitnessTransferFromData<
      // force acceptance by weakening the type
      ReturnType<typeof getYmaxWitnessOperationTypes<T>> & TypedData,
      ReturnType<typeof getYmaxWitnessTypeParam<T>>
    >
  >;

export type YmaxPermitBatchWitnessTransferFromData<
  T extends keyof OperationTypes,
> = ReturnType<
  typeof getPermitBatchWitnessTransferFromData<
    // force acceptance by weakening the type
    ReturnType<typeof getYmaxWitnessOperationTypes<T>> & TypedData,
    ReturnType<typeof getYmaxWitnessTypeParam<T>>
  >
>;
