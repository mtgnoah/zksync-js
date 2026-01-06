// src/adapters/viem/resources/l1/index.ts

import { encodeFunctionData } from 'viem';
import type { ViemClient } from '../../client';
import type { Address, Hex } from '../../../../core/types/primitives';
import type { L1InteropOperation, L1InteropParams } from '../../../../core/types/flows/l1-interop';
import type {
  L1Resource,
  L1CallResource,
  L1BundleBuilder,
  L1CallParams,
  L1Quote,
  L1PreparedTx,
  L1Handle,
  L1WaitOptions,
  L1Result,
  Result,
  EncodedL1Operation,
} from './types';
import { createL1Helpers } from './helpers';
import { getShadowAccountAddress, isShadowAccountDeployed } from '../l1-interop/shadow-account/utils';
import { createL1CoreResource } from '../l1-interop/core';

export type { L1Resource, L1CallResource, L1BundleBuilder, L1CallParams, L1Quote, L1Handle, L1Result };

/**
 * Minimal withdrawals resource interface for L1
 */
interface WithdrawalsResourceMin {
  create(params: { token: Address; amount: bigint; to: Address }): Promise<{ l2TxHash?: string }>;
}

/**
 * Encode a declarative L1CallParams to an L1InteropOperation
 */
function encodeCall(params: L1CallParams): EncodedL1Operation {
  const data = encodeFunctionData({
    abi: params.abi,
    functionName: params.functionName,
    args: params.args as unknown[],
  });

  return {
    target: params.target,
    value: params.value ?? 0n,
    data,
  };
}

/**
 * Convert encoded operations to L1InteropOperations
 */
function toL1InteropOperations(encoded: readonly EncodedL1Operation[]): L1InteropOperation[] {
  return encoded.map((op) => ({
    type: 'call' as const,
    target: op.target,
    value: op.value,
    data: op.data,
  }));
}

/**
 * Create the L1 resource with Stripe-style API
 */
export function createL1Resource(
  client: ViemClient,
  withdrawals?: WithdrawalsResourceMin
): L1Resource {
  // Create the underlying core resource
  const core = createL1CoreResource(client, withdrawals);

  // Helper to wrap functions with try/catch for try* variants
  function toResult<T>(fn: () => Promise<T>): Promise<Result<T>> {
    return fn()
      .then((value) => ({ ok: true as const, value }))
      .catch((error: unknown) => ({ ok: false as const, error }));
  }

  /**
   * Internal function to get quote for a set of calls
   */
  async function getQuote(calls: readonly L1CallParams[]): Promise<L1Quote> {
    // Get sender address
    const sender = client.account?.address;
    if (!sender) {
      throw new Error('No sender address available');
    }

    // Encode all calls
    const encodedOps = calls.map(encodeCall);
    const l1InteropOps = toL1InteropOperations(encodedOps);

    // Get quote from core
    const coreParams: L1InteropParams = {
      sender,
      operations: l1InteropOps,
    };

    const coreQuote = await core.quote(coreParams);

    // Get ShadowAccount balance
    const shadowAccount = coreQuote.shadowAccount;
    let currentBalance = 0n;
    try {
      currentBalance = await client.l1.getBalance({ address: shadowAccount });
    } catch {
      // Ignore errors fetching balance
    }

    // Calculate bridge amount needed
    const bridgeAmount = coreQuote.totalCostEstimate > currentBalance
      ? coreQuote.totalCostEstimate - currentBalance
      : 0n;

    return {
      requiredFunds: coreQuote.totalCostEstimate,
      currentBalance,
      bridgeAmount,
      estimatedGas: coreQuote.l1GasEstimate,
      gasPrice: coreQuote.l1GasPrice,
      totalCost: coreQuote.totalCostEstimate,
      calls,
      shadowAccount,
      needsDeployment: coreQuote.needsDeployment,
    };
  }

  /**
   * Internal function to prepare a set of calls
   */
  async function getPrepared(calls: readonly L1CallParams[]): Promise<L1PreparedTx> {
    const quote = await getQuote(calls);
    const encodedOperations = calls.map(encodeCall);

    return {
      quote,
      encodedOperations,
    };
  }

  /**
   * Internal function to create and submit a bundle
   */
  async function createBundle(calls: readonly L1CallParams[]): Promise<L1Handle> {
    // Get sender address
    const sender = client.account?.address;
    if (!sender) {
      throw new Error('No sender address available');
    }

    // Encode all calls
    const encodedOps = calls.map(encodeCall);
    const l1InteropOps = toL1InteropOperations(encodedOps);

    // Create via core
    const coreParams: L1InteropParams = {
      sender,
      operations: l1InteropOps,
    };

    const handle = await core.create(coreParams);

    // Return L1Handle
    return {
      hash: handle.l2WithdrawalTxHash,
      bundleHash: handle.l2BundleTxHash ?? ('0x' as Hex),
      shadowAccount: handle.shadowAccount,
      async wait(options?: L1WaitOptions): Promise<L1Result> {
        const timeout = options?.timeout ?? 600_000;
        const pollInterval = options?.pollInterval ?? 15_000;

        try {
          await core.wait(handle, {
            for: 'COMPLETED',
            pollMs: pollInterval,
            timeoutMs: timeout,
          });

          const status = await core.status(handle);

          return {
            status: 'success',
            l1TransactionHash: status.l1FinalizationTxHash,
          };
        } catch {
          const status = await core.status(handle);

          if (status.phase === 'FAILED') {
            return {
              status: 'failed',
              error: {
                code: 'EXECUTION_FAILED',
                message: status.error ?? 'Unknown error',
              },
            };
          }

          return {
            status: 'timeout',
            error: {
              code: 'TIMEOUT',
              message: `Operation timed out after ${timeout}ms`,
            },
          };
        }
      },
    };
  }

  // Create the call resource
  const callResource: L1CallResource = {
    async quote(params: L1CallParams): Promise<L1Quote> {
      return getQuote([params]);
    },

    tryQuote(params: L1CallParams): Promise<Result<L1Quote>> {
      return toResult(() => this.quote(params));
    },

    async prepare(params: L1CallParams): Promise<L1PreparedTx> {
      return getPrepared([params]);
    },

    tryPrepare(params: L1CallParams): Promise<Result<L1PreparedTx>> {
      return toResult(() => this.prepare(params));
    },

    async create(params: L1CallParams): Promise<L1Handle> {
      return createBundle([params]);
    },

    tryCreate(params: L1CallParams): Promise<Result<L1Handle>> {
      return toResult(() => this.create(params));
    },
  };

  // Bundle builder factory
  function bundle(): L1BundleBuilder {
    const calls: L1CallParams[] = [];

    const builder: L1BundleBuilder = {
      call(params: L1CallParams): L1BundleBuilder {
        calls.push(params);
        return builder;
      },

      async quote(): Promise<L1Quote> {
        if (calls.length === 0) {
          throw new Error('Bundle is empty. Add at least one call.');
        }
        return getQuote(calls);
      },

      async prepare(): Promise<L1PreparedTx> {
        if (calls.length === 0) {
          throw new Error('Bundle is empty. Add at least one call.');
        }
        return getPrepared(calls);
      },

      async create(): Promise<L1Handle> {
        if (calls.length === 0) {
          throw new Error('Bundle is empty. Add at least one call.');
        }
        return createBundle(calls);
      },
    };

    return builder;
  }

  // Return the L1 resource
  return {
    call: callResource,
    bundle,

    async getShadowAccount(owner: Address): Promise<Address> {
      return getShadowAccountAddress(client, owner);
    },

    async deployShadowAccount(owner: Address): Promise<Hex> {
      // Check if already deployed
      const isDeployed = await isShadowAccountDeployed(client, owner);
      if (isDeployed) {
        const address = await getShadowAccountAddress(client, owner);
        return address; // Return existing address as hex
      }

      // ShadowAccounts are deployed automatically when bundles are executed on L1.
      // The address is deterministic based on the L2 owner address.
      // To deploy manually, you can either:
      // 1. Send an empty bundle via sdk.l1.bundle().call({...}).create()
      // 2. Call L1InteropHandler.deployShadowAccount(owner) directly on L1
      //
      // For most use cases, the automatic deployment during bundle execution
      // is sufficient and doesn't require manual deployment.
      const shadowAddress = await getShadowAccountAddress(client, owner);
      throw new Error(
        `ShadowAccount not deployed for ${owner}. ` +
        `Address will be: ${shadowAddress}. ` +
        `ShadowAccounts are deployed automatically when executing your first L1 bundle. ` +
        `To deploy manually, call L1InteropHandler.deployShadowAccount() on L1.`
      );
    },

    helpers: createL1Helpers(),
  };
}
