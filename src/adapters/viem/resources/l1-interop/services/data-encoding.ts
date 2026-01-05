// src/adapters/viem/resources/l1-interop/services/data-encoding.ts

import { concatHex, encodeAbiParameters, keccak256, type Hex } from 'viem';
import type { Address } from '../../../../../core/types/primitives';

/**
 * L2 Native Token Vault address (system contract)
 */
const L2_NATIVE_TOKEN_VAULT_ADDR: Address = '0x0000000000000000000000000000000000010004';

/**
 * Encoding version for AssetRouter bridge data
 */
const ENCODING_VERSION = '0x01' as const;

/**
 * Encode asset ID for Native Token Vault
 * Used to identify tokens when bridging through the NTV
 */
export function encodeNTVAssetId(chainId: bigint, tokenAddress: Address): Hex {
  const encoded = encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }],
    [chainId, L2_NATIVE_TOKEN_VAULT_ADDR, tokenAddress]
  );

  return keccak256(encoded);
}

/**
 * Encode bridge burn data for token transfers
 * Used in the bridge calldata to specify amount, recipient, and token
 */
export function encodeBridgeBurnData(
  amount: bigint,
  remoteReceiver: Address,
  tokenAddress: Address
): Hex {
  return encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }],
    [amount, remoteReceiver, tokenAddress]
  );
}

/**
 * Encode AssetRouter bridgehub deposit data
 * Wraps asset ID and transfer data with version prefix
 */
export function encodeAssetRouterBridgehubDepositData(assetId: Hex, transferData: Hex): Hex {
  const encodedInner = encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'bytes' }],
    [assetId, transferData]
  );

  return concatHex([ENCODING_VERSION, encodedInner]);
}

/**
 * Exported data encoding utilities
 */
export const DataEncoding = {
  encodeNTVAssetId,
  encodeBridgeBurnData,
  encodeAssetRouterBridgehubDepositData,
};
