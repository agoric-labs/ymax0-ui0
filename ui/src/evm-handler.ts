import { Address } from 'abitype';
import {
  hashStruct,
  recoverTypedDataAddress,
  RecoverTypedDataAddressParameters,
  validateTypedData,
} from 'viem/utils';
import { type WithSignature, encodeType } from './evm/viem.ts';
import {
  type OperationTypeNames,
  type YmaxStandaloneOperationData,
  type YmaxPermitWitnessTransferFromData,
  type YmaxOperationType,
  splitWitnessFieldType,
  validateYmaxDomain,
  validateYmaxOperationTypeName,
  getYmaxOperationTypes,
} from './evm/ymax-eip712.ts';
import {
  extractWitnessFieldFromTypes,
  isPermit2MessageType,
  makeWitnessTypeStringExtractor,
} from './evm/permit2/signatureTransfer.ts';

type YmaxOperationDetails<T extends OperationTypeNames> = {
  [P in T]: {
    operation: P;
    data: YmaxOperationType<P>;
  };
}[T];

/**
 * Extract operation type name and data from a EIP-712 standalone Ymax typed data
 *
 * @param data - The EIP-712 typed data of a standalone message
 * @returns The operation type name and associated data
 */
export const extractOperationDetailsFromStandaloneData = <
  T extends OperationTypeNames,
>(
  data: YmaxStandaloneOperationData<T>,
): YmaxOperationDetails<T> => {
  // @ts-expect-error generic/union type compatibility
  const standaloneData: YmaxStandaloneOperationData = data;

  validateYmaxDomain(standaloneData.domain);
  validateYmaxOperationTypeName<T>(standaloneData.primaryType);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { nonce, deadline, ..._operationData } = standaloneData.message;
  const operationData = _operationData as YmaxOperationType<T>;
  const operation = standaloneData.primaryType;
  // @ts-expect-error inference issue
  validateTypedData({
    types: getYmaxOperationTypes(operation),
    message: operationData,
    primaryType: operation,
  });
  return { operation, data: operationData };
};

/**
 * Extract operation type name and data from a EIP-712 Permit2 witness typed data.
 *
 * @param data - The EIP-712 typed data of a Permit2 witness message
 * @returns The operation type name and associated data
 */
export const extractOperationDetailsFromPermit2WitnessData = <
  T extends OperationTypeNames,
>(
  data: YmaxPermitWitnessTransferFromData<T>,
): YmaxOperationDetails<T> => {
  // @ts-expect-error generic/union type compatibility
  const permitData: YmaxPermitWitnessTransferFromData = data;

  const witnessField = extractWitnessFieldFromTypes(permitData.types);
  const witnessData = permitData.message[
    witnessField.name
  ] as YmaxOperationType<T>;
  const operation = splitWitnessFieldType(witnessField.type).primaryType as T;
  // @ts-expect-error inference issue
  validateTypedData({
    types: getYmaxOperationTypes(operation),
    message: witnessData,
    primaryType: operation,
  });
  return { operation, data: witnessData };
};

export const extractPermitData = <T extends OperationTypeNames>(
  data: YmaxPermitWitnessTransferFromData<T>,
) => {
  const witnessTypeStringExtractor = makeWitnessTypeStringExtractor({
    encodeType,
  });
  // @ts-expect-error generic/union type compatibility
  const permitData: YmaxPermitWitnessTransferFromData = data;

  // Processing of the message that happens on chain & in the EVM service
  const witnessField = extractWitnessFieldFromTypes(permitData.types);
  const { [witnessField.name]: witnessData, ...permit } = permitData.message;
  const witness = hashStruct({
    primaryType: witnessField.type,
    types: permitData.types,
    data: witnessData,
  });
  const witnessTypeString = witnessTypeStringExtractor(permitData.types);

  const payload = {
    chainId: permitData.domain!.chainId!,
    permit,
    witness,
    witnessTypeString,
  };

  return payload;
};
export type PermitDataPayload = Awaited<ReturnType<typeof extractPermitData>>;

export type FullMessageDetails<
  T extends OperationTypeNames = OperationTypeNames,
> = YmaxOperationDetails<T> & {
  permit?: WithSignature<PermitDataPayload>;
  evmWalletAddress: Address;
  nonce: bigint;
  deadline: bigint;
};

export const extractOperationDetailsFromSignedData = async <
  T extends OperationTypeNames = OperationTypeNames,
>(
  signedData: WithSignature<
    YmaxPermitWitnessTransferFromData<T> | YmaxStandaloneOperationData<T>
  >,
): Promise<FullMessageDetails<T>> => {
  const tokenOwner = await recoverTypedDataAddress(
    signedData as RecoverTypedDataAddressParameters,
  );
  const { nonce, deadline } = (
    signedData as unknown as
      | YmaxPermitWitnessTransferFromData
      | YmaxStandaloneOperationData
  ).message;

  if (isPermit2MessageType(signedData.primaryType)) {
    const permit2Data =
      signedData as unknown as YmaxPermitWitnessTransferFromData<T>;

    const permitPayload = {
      ...extractPermitData(permit2Data),
      signature: signedData.signature,
    };
    const operationDetails =
      extractOperationDetailsFromPermit2WitnessData(permit2Data);

    return {
      ...operationDetails,
      permit: permitPayload,
      evmWalletAddress: tokenOwner,
      nonce,
      deadline,
    };
  } else {
    const standaloneData =
      signedData as unknown as YmaxStandaloneOperationData<T>;
    const operationDetails =
      extractOperationDetailsFromStandaloneData(standaloneData);

    return {
      ...operationDetails,
      evmWalletAddress: tokenOwner,
      nonce,
      deadline,
    };
  }
};
