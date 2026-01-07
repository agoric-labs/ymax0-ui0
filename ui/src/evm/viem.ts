// Copied from https://github.com/wevm/viem/blob/main/src/utils/signature/hashTypedData.ts

import {
  ByteArray,
  Hex,
  Signature,
  TypedData,
  TypedDataDefinition,
} from 'viem';

type MessageTypeProperty = {
  name: string;
  type: string;
};

export type WithSignature<T> = T & {
  signature: Hex | ByteArray | Signature;
};

export type SignedTypedDataDefinition<
  typedData extends TypedData | Record<string, unknown> = TypedData,
  primaryType extends keyof typedData | 'EIP712Domain' = keyof typedData,
  ///
  primaryTypes = typedData extends TypedData ? keyof typedData : string,
> = WithSignature<TypedDataDefinition<typedData, primaryType, primaryTypes>>;

export function encodeType({
  primaryType,
  types,
}: {
  primaryType: string;
  types: Record<string, readonly MessageTypeProperty[]>;
}) {
  let result = '';
  const unsortedDeps = findTypeDependencies({ primaryType, types });
  unsortedDeps.delete(primaryType);

  const deps = [primaryType, ...Array.from(unsortedDeps).sort()];
  for (const type of deps) {
    result += `${type}(${types[type]
      .map(({ name, type: t }) => `${t} ${name}`)
      .join(',')})`;
  }

  return result;
}

function findTypeDependencies(
  {
    primaryType: primaryType_,
    types,
  }: {
    primaryType: string;
    types: Record<string, readonly MessageTypeProperty[]>;
  },
  results: Set<string> = new Set(),
): Set<string> {
  const match = primaryType_.match(/^\w*/u);
  const primaryType = match?.[0] as string;
  if (results.has(primaryType) || types[primaryType] === undefined) {
    return results;
  }

  results.add(primaryType);

  for (const field of types[primaryType]) {
    findTypeDependencies({ primaryType: field.type, types }, results);
  }
  return results;
}
