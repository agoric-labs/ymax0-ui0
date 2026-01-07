import type {
  TypedDataDomain,
  TypedData,
  Address,
  TypedDataDefinition,
} from 'viem';
import type { TypedDataToPrimitiveTypes } from 'abitype';
import type { TypedDataParameter } from '../abitype.ts';

const PERMIT2_DOMAIN_NAME = 'Permit2';

// TODO: disallow witness type field being another Permit field name
interface WitnessDefinition<
  T extends TypedData = TypedData,
  TD extends TypedDataParameter<string, Extract<keyof T, string>> =
    TypedDataParameter<'witness', Extract<keyof T, string>>,
> {
  witnessField: TD;
  witnessTypes: T;
}

export interface Witness<
  T extends TypedData = TypedData,
  TD extends TypedDataParameter<string, Extract<keyof T, string>> =
    TypedDataParameter<'witness', Extract<keyof T, string>>,
> extends WitnessDefinition<T, TD> {
  witness: TypedDataToPrimitiveTypes<T>[TD['type']];
}

export function makeWitness<
  T extends TypedData,
  TD extends TypedDataParameter<string, Extract<keyof T, string>>,
>(
  data: NoInfer<TypedDataToPrimitiveTypes<T>[TD['type']]>,
  types: T,
  typeParam: TD,
): Witness<T, TD> {
  return {
    witness: data,
    witnessTypes: types,
    witnessField: typeParam,
  };
}

export type TokenPermissions = {
  token: Address;
  amount: bigint;
};

export type PermitTransferFrom = {
  permitted: TokenPermissions;
  spender: Address;
  nonce: bigint;
  deadline: bigint;
};

export type PermitBatchTransferFrom = {
  permitted: readonly TokenPermissions[];
  spender: Address;
  nonce: bigint;
  deadline: bigint;
};

const Permit2DomainTypeParams = [
  { name: 'name', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
] as const satisfies TypedDataParameter[];

const PermitTransferFromTypeParams = [
  { name: 'permitted', type: 'TokenPermissions' },
  { name: 'spender', type: 'address' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
] as const satisfies TypedDataParameter[];

const PermitBatchTransferFromTypeParams = [
  { name: 'permitted', type: 'TokenPermissions[]' },
  { name: 'spender', type: 'address' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
] as const satisfies TypedDataParameter[];

const TokenPermissionTypeParams = [
  { name: 'token', type: 'address' },
  { name: 'amount', type: 'uint256' },
] as const satisfies TypedDataParameter[];

export const PermitTransferFromTypes = {
  EIP712Domain: Permit2DomainTypeParams,
  PermitTransferFrom: PermitTransferFromTypeParams,
  TokenPermissions: TokenPermissionTypeParams,
} as const satisfies TypedData;

export const PermitBatchTransferFromTypes = {
  EIP712Domain: Permit2DomainTypeParams,
  PermitBatchTransferFrom: PermitBatchTransferFromTypeParams,
  TokenPermissions: TokenPermissionTypeParams,
} as const satisfies TypedData;

export function permitWitnessTransferFromTypes<
  T extends TypedData,
  TD extends TypedDataParameter<string, Extract<keyof T, string>> =
    TypedDataParameter<'witness', Extract<keyof T, string>>,
>(witness: WitnessDefinition<T, TD>) {
  return {
    EIP712Domain: Permit2DomainTypeParams,
    PermitWitnessTransferFrom: [
      ...PermitTransferFromTypeParams,
      // Enable runtime type to accept undefined field for base type extraction
      ...((witness ? [witness.witnessField] : []) as [TD]),
    ],
    TokenPermissions: TokenPermissionTypeParams,
    ...witness?.witnessTypes,
  } as const satisfies TypedData;
}

export function permitBatchWitnessTransferFromTypes<
  T extends TypedData,
  TD extends TypedDataParameter<string, Extract<keyof T, string>> =
    TypedDataParameter<'witness', Extract<keyof T, string>>,
>(witness: WitnessDefinition<T, TD>) {
  return {
    EIP712Domain: Permit2DomainTypeParams,
    PermitBatchWitnessTransferFrom: [
      ...PermitBatchTransferFromTypeParams,
      // Enable runtime type to accept undefined field for base type extraction
      ...((witness ? [witness.witnessField] : []) as [TD]),
    ],
    TokenPermissions: TokenPermissionTypeParams,
    ...witness?.witnessTypes,
  } as const satisfies TypedData;
}

export type PermitWitnessTransferFrom<
  T extends Record<string, unknown>,
  TN extends string = 'witness',
> = PermitTransferFrom & { [key in TN]: T };

export type PermitBatchWitnessTransferFrom<
  T extends Record<string, unknown>,
  TN extends string = 'witness',
> = PermitBatchTransferFrom & { [key in TN]: T };

export function permit2Domain(
  permit2Address: Address,
  chainId: number | bigint,
) {
  return {
    name: PERMIT2_DOMAIN_NAME,
    chainId,
    verifyingContract: permit2Address,
  } as const satisfies TypedDataDomain;
}

// TODO: allow permit to be either PermitTransferFrom or PermitBatchTransferFrom
// and remove duplication between the two functions below
export function getPermitWitnessTransferFromData<
  T extends TypedData,
  TD extends TypedDataParameter<string, Extract<keyof T, string>> =
    TypedDataParameter<'witness', Extract<keyof T, string>>,
>(
  permit: PermitTransferFrom,
  permit2Address: Address,
  chainId: number | bigint,
  witness: Witness<T, TD>,
): TypedDataDefinition<
  ReturnType<typeof permitWitnessTransferFromTypes<T, TD>>,
  'PermitWitnessTransferFrom',
  'PermitWitnessTransferFrom'
> {
  // type MessageType = TypedDataToPrimitiveTypes<
  //   ReturnType<typeof permitWitnessTransferFromTypes<T, TD>>
  // >['PermitWitnessTransferFrom'];

  const domain = permit2Domain(permit2Address, chainId);

  const types = permitWitnessTransferFromTypes(witness);

  return {
    // @ts-expect-error some generic type inference issue
    domain,
    types,
    primaryType: 'PermitWitnessTransferFrom',
    // @ts-expect-error some generic type inference issue
    message: {
      ...permit,
      [witness.witnessField.name]: witness.witness,
    },
  };
}

export function getPermitBatchWitnessTransferFromData<
  T extends TypedData,
  TD extends TypedDataParameter<string, Extract<keyof T, string>> =
    TypedDataParameter<'witness', Extract<keyof T, string>>,
>(
  permit: PermitBatchTransferFrom,
  permit2Address: Address,
  chainId: number | bigint,
  witness: Witness<T, TD>,
): TypedDataDefinition<
  ReturnType<typeof permitBatchWitnessTransferFromTypes<T, TD>>,
  'PermitBatchWitnessTransferFrom',
  'PermitBatchWitnessTransferFrom'
> {
  // type MessageType = TypedDataToPrimitiveTypes<
  //   ReturnType<typeof permitBatchWitnessTransferFromTypes<T, TD>>
  // >['PermitBatchWitnessTransferFrom'];

  const domain = permit2Domain(permit2Address, chainId);

  const types = permitBatchWitnessTransferFromTypes(witness);

  return {
    // @ts-expect-error some generic type inference issue
    domain,
    types,
    primaryType: 'PermitBatchWitnessTransferFrom',
    // @ts-expect-error some generic type inference issue
    message: {
      ...permit,
      [witness.witnessField.name]: witness.witness,
    },
  };
}

export const makeWitnessTypeStringExtractor = ({
  encodeType,
}: {
  encodeType: ({
    primaryType,
    types,
  }: {
    primaryType: string;
    types: TypedData;
  }) => string;
}) => {
  const baseTypeStrings = Object.fromEntries(
    Object.entries({
      PermitBatchWitnessTransferFrom: permitBatchWitnessTransferFromTypes,
      PermitWitnessTransferFrom: permitWitnessTransferFromTypes,
    }).map(([typeName, typeFunc]) => {
      const encoded = encodeType({
        primaryType: typeName,
        // @ts-expect-error undefined is not allowed in types but supported in implementation
        types: typeFunc(undefined),
      });

      const prefix = encoded.substring(0, encoded.indexOf(')'));
      return [typeName, `${prefix},`];
    }),
  );

  return function getWitnessTypeString(types: TypedData) {
    const matchingTypes = Object.keys(types).filter(
      type => type in baseTypeStrings,
    );

    if (matchingTypes.length !== 1) {
      throw new Error(
        `TypedData must have exactly one of the following types: ${Object.keys(baseTypeStrings).join(', ')}`,
      );
    }

    const primaryType = matchingTypes[0];
    const encodedType = encodeType({
      primaryType,
      types,
    });

    const baseTypeString = baseTypeStrings[primaryType];
    if (!encodedType.startsWith(baseTypeString)) {
      throw new Error(
        `TypedData has an invalid type string for ${primaryType}`,
      );
    }

    return encodedType.substring(baseTypeString.length);
  };
};

type MapUnion<U> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [K in U extends any ? keyof U : never]: U extends any
    ? K extends keyof U
      ? U[K]
      : never
    : never;
};

export const extractWitnessFieldFromTypes = <
  T extends Readonly<TypedDataParameter>,
>(
  types:
    | {
        PermitBatchWitnessTransferFrom: readonly [
          ...typeof PermitBatchTransferFromTypeParams,
          T,
        ];
      }
    | {
        PermitWitnessTransferFrom: readonly [
          ...typeof PermitTransferFromTypeParams,
          T,
        ];
      },
): T => {
  const baseTypes = {
    PermitBatchWitnessTransferFrom: PermitBatchTransferFromTypeParams,
    PermitWitnessTransferFrom: PermitTransferFromTypeParams,
  };

  const matchingTypes = Object.keys(types).filter(
    type => type in baseTypes,
  ) as (keyof typeof baseTypes)[];

  if (matchingTypes.length !== 1) {
    throw new Error(
      `TypedData must have exactly one of the following types: ${Object.keys(baseTypes).join(', ')}`,
    );
  }

  const primaryType = matchingTypes[0];
  const candidateType = (types as MapUnion<typeof types>)[primaryType];
  const referenceType = baseTypes[primaryType];
  if (candidateType.length !== referenceType.length + 1) {
    throw new Error(
      `TypedData has an invalid number of fields for ${primaryType}`,
    );
  }

  for (const [i, field] of referenceType.entries()) {
    if (
      candidateType[i].name !== field.name ||
      candidateType[i].type !== field.type
    ) {
      throw new Error(
        `TypedData has an invalid field at index ${i} for ${primaryType}`,
      );
    }
  }

  return candidateType[candidateType.length - 1] as T;
};

export const isPermit2MessageType = (type: string) => {
  return (
    type === 'PermitBatchWitnessTransferFrom' ||
    type === 'PermitWitnessTransferFrom'
  );
};
