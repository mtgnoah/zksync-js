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
  } as WriteContractParameters;
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
 * Estimate gas for L1 operations
 */
export async function estimateL1Gas(
  client: ViemClient,
  operations: readonly L1InteropOperation[]
): Promise<bigint> {
  // TODO: Implement gas estimation by simulating calls on L1
  // This should estimate gas for each operation and sum them up
  // For now, use a conservative estimate

  const baseGasPerOp = BigInt(200_000); // Base gas per operation
  const totalOps = operations.reduce((acc, op) => {
    if (op.type === 'multicall') {
      return acc + op.calls.length;
    }
    return acc + 1;
  }, 0);

  return baseGasPerOp * BigInt(totalOps);
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
