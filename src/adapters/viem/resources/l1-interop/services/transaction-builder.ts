// src/adapters/viem/resources/l1-interop/services/transaction-builder.ts

import type { WriteContractParameters } from 'viem';
import type { ViemClient } from '../../../client';
import type { Address } from '../../../../../core/types/primitives';
import type { L1InteropOperation } from '../../../../../core/types/flows/l1-interop';
import { L2InteropCenterABI } from '../../../../../core/internal/abi-registry';
import { getL1InteropAddresses } from '../../../../../core/constants/l1-interop-addresses';
import { ETH_ADDRESS } from '../../../../../core/constants';

/**
 * Shadow Account Operation for contract calls
 */
export interface ShadowAccountOp {
  target: Address;
  value: bigint;
  data: `0x${string}`;
}

/**
 * Convert L1InteropOperation to ShadowAccountOp
 */
export function convertToShadowAccountOps(operations: readonly L1InteropOperation[]): ShadowAccountOp[] {
  const ops: ShadowAccountOp[] = [];

  for (const op of operations) {
    if (op.type === 'call') {
      ops.push({
        target: op.target,
        value: op.value,
        data: op.data,
      });
    } else if (op.type === 'multicall') {
      // Flatten multicall into individual operations
      for (const call of op.calls) {
        ops.push({
          target: call.target,
          value: call.value,
          data: call.data,
        });
      }
    }
  }

  return ops;
}

/**
 * Build sendBundleToL1 transaction
 */
export async function buildSendBundleTransaction(
  client: ViemClient,
  operations: readonly L1InteropOperation[]
): Promise<WriteContractParameters> {
  const chainId = await client.l2.getChainId();
  const addresses = getL1InteropAddresses(chainId);

  const shadowAccountOps = convertToShadowAccountOps(operations);

  return {
    address: addresses.l2InteropCenter,
    abi: L2InteropCenterABI,
    functionName: 'sendBundleToL1',
    args: [shadowAccountOps],
    chain: client.l2.chain,
    account: undefined,
  } as unknown as WriteContractParameters;
}

/**
 * Build withdrawal transaction params
 * This withdraws funds from L2 to the ShadowAccount on L1
 */
export interface WithdrawalParams {
  token: Address;
  amount: bigint;
  to: Address; // ShadowAccount address
}

/**
 * Build withdrawal transaction using ZKsync SDK
 * This should integrate with the existing withdrawals resource
 */
export async function buildWithdrawalTransaction(
  client: ViemClient,
  params: WithdrawalParams
): Promise<WriteContractParameters> {
  // TODO: This should use the existing sdk.withdrawals.prepare() method
  // For now, this is a placeholder
  // The actual implementation should be:
  // const withdrawalPlan = await sdk.withdrawals.prepare({
  //   token: params.token,
  //   amount: params.amount,
  //   to: params.to,
  // });
  // return withdrawalPlan.steps[0].tx;

  throw new Error('Not implemented: buildWithdrawalTransaction - use sdk.withdrawals.prepare()');
}

/**
 * Estimate gas for L1 operations via eth_call simulation
 */
export async function estimateL1Gas(
  client: ViemClient,
  operations: readonly L1InteropOperation[],
  shadowAccount?: Address
): Promise<bigint> {
  // If no operations, return minimal gas
  if (operations.length === 0) {
    return BigInt(21_000);
  }

  // Base gas per operation (fallback)
  const baseGasPerOp = BigInt(200_000);
  const totalOps = operations.reduce((acc, op) => {
    if (op.type === 'multicall') {
      return acc + op.calls.length;
    }
    return acc + 1;
  }, 0);

  // Fallback estimate
  const fallbackEstimate = baseGasPerOp * BigInt(totalOps);

  // If no shadow account provided, use fallback
  if (!shadowAccount) {
    return fallbackEstimate;
  }

  // Try to simulate each operation via eth_call on L1
  let totalGas = BigInt(0);
  const ops = convertToShadowAccountOps(operations);

  for (const op of ops) {
    try {
      // Simulate the call from the shadow account
      const gasEstimate = await client.l1.estimateGas({
        account: shadowAccount,
        to: op.target,
        value: op.value,
        data: op.data,
      });

      // Add 20% buffer for safety
      totalGas += (gasEstimate * BigInt(120)) / BigInt(100);
    } catch {
      // If simulation fails, use fallback for this operation
      totalGas += baseGasPerOp;
    }
  }

  // Use the higher of simulation or fallback (safety)
  return totalGas > fallbackEstimate ? totalGas : fallbackEstimate;
}

/**
 * Calculate total ETH value needed for operations
 */
export function calculateTotalValue(operations: readonly L1InteropOperation[]): bigint {
  let total = BigInt(0);

  for (const op of operations) {
    if (op.type === 'call') {
      total += op.value;
    } else if (op.type === 'multicall') {
      for (const call of op.calls) {
        total += call.value;
      }
    }
  }

  return total;
}
