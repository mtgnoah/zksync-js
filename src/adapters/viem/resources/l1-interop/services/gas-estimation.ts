// src/adapters/viem/resources/l1-interop/services/gas-estimation.ts

import type { ViemClient } from '../../../client';
import type { Address } from '../../../../../core/types/primitives';
import { IBridgehubABI } from '../../../../../core/internal/abi-registry';

/**
 * Parameters for calculating bridge-back gas cost
 */
export interface BridgeBackGasParams {
  /** L2 chain ID to bridge to */
  chainId: bigint;
  /** Bridgehub contract address */
  bridgehubAddress: Address;
  /** L2 gas limit for the bridge transaction (default: 5_000_000) */
  l2GasLimit?: bigint;
  /** L2 gas per pubdata byte limit (default: 800) */
  l2GasPerPubdataByteLimit?: bigint;
  /** Safety margin percentage (default: 20%) */
  safetyMarginPercent?: number;
}

/**
 * Calculate the dynamic gas cost for bridging back tokens to L2
 *
 * Uses Bridgehub.l2TransactionBaseCost() to get accurate gas pricing
 * instead of hardcoded values.
 *
 * @param client - The Viem client
 * @param params - Bridge-back gas calculation parameters
 * @returns The estimated gas cost in wei (mintValue)
 */
export async function calculateBridgeBackGas(
  client: ViemClient,
  params: BridgeBackGasParams
): Promise<bigint> {
  const {
    chainId,
    bridgehubAddress,
    l2GasLimit = BigInt(5_000_000),
    l2GasPerPubdataByteLimit = BigInt(800),
    safetyMarginPercent = 20,
  } = params;

  // Get current L1 gas price
  const gasPrice = await client.l1.getGasPrice();

  // Call Bridgehub.l2TransactionBaseCost to get the base cost
  const baseCost = await client.l1.readContract({
    address: bridgehubAddress,
    abi: IBridgehubABI,
    functionName: 'l2TransactionBaseCost',
    args: [chainId, gasPrice, l2GasLimit, l2GasPerPubdataByteLimit],
  });

  // Add safety margin (default 20%)
  const safetyMultiplier = BigInt(100 + safetyMarginPercent);
  const mintValue = (baseCost * safetyMultiplier) / BigInt(100);

  return mintValue;
}

/**
 * Estimate total gas cost for bridge-back including L1 execution
 *
 * This is used in the quote() phase to estimate total costs
 *
 * @param client - The Viem client
 * @param params - Bridge-back gas calculation parameters
 * @returns The total estimated gas cost in wei
 */
export async function estimateBridgeBackGas(
  client: ViemClient,
  params: BridgeBackGasParams
): Promise<bigint> {
  // For now, just return the base bridge-back gas
  // In the future, this could include additional costs for:
  // - Token approval gas
  // - L1 execution gas for the bridge transaction
  return calculateBridgeBackGas(client, params);
}
