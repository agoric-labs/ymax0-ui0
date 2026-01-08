/**
 * EVM handler utilities for processing EIP-712 portfolio messages.
 *
 * This module re-exports utilities from @agoric/portfolio-api with viem powers
 * pre-configured for browser usage.
 */

import {
  hashStruct,
  recoverTypedDataAddress,
  validateTypedData,
} from 'viem/utils';
import { encodeType } from '@agoric/orchestration/src/utils/viem.ts';
import {
  makeEVMHandlerUtils,
  type FullMessageDetails,
  type PermitDataPayload,
  type YmaxOperationDetails,
} from '@agoric/portfolio-api/src/evm-wallet/message-handler-helpers.ts';

// Re-export types
export type { FullMessageDetails, PermitDataPayload, YmaxOperationDetails };

// Create the handler utilities with viem powers
const evmHandlerUtils = makeEVMHandlerUtils({
  hashStruct,
  recoverTypedDataAddress,
  validateTypedData,
  encodeType,
});

// Export the functions
export const {
  extractOperationDetailsFromStandaloneData,
  extractOperationDetailsFromPermit2WitnessData,
  extractPermitData,
  extractOperationDetailsFromSignedData,
} = evmHandlerUtils;
