// src/adapters/viem/resources/l1-interop/core/index.ts

import type { WriteContractParameters } from 'viem';
import { writeContract } from 'viem/actions';
import type { ViemClient } from '../../../client';
import type { Address, Hex } from '../../../../../core/types/primitives';
import type {
  L1InteropParams,
  L1InteropQuote,
  L1InteropHandle,
  L1InteropWaitable,
  L1InteropPlan,
  L1InteropStatus,
  L1InteropPhase,
} from '../../../../../core/types/flows/l1-interop';
import { getShadowAccountAddress, isShadowAccountDeployed } from '../shadow-account/utils';
import { estimateL1Gas, calculateTotalValue, buildSendBundleTransaction } from '../services/transaction-builder';
import { estimateBridgeBackGas } from '../services/gas-estimation';
import { ETH_ADDRESS } from '../../../../../core/constants';

/** Result type for try* methods */
export type Result<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** === L1 Core Resource Interface === */
export interface L1CoreResource {
  /** Get quote for generic L1 execution */
  quote(p: L1InteropParams): Promise<L1InteropQuote>;
  tryQuote(p: L1InteropParams): Promise<Result<L1InteropQuote>>;

  /** Prepare L1 execution plan */
  prepare(p: L1InteropParams): Promise<L1InteropPlan<WriteContractParameters>>;
  tryPrepare(p: L1InteropParams): Promise<Result<L1InteropPlan<WriteContractParameters>>>;

  /** Execute L1 operation */
  create(p: L1InteropParams): Promise<L1InteropHandle<WriteContractParameters>>;
  tryCreate(p: L1InteropParams): Promise<Result<L1InteropHandle<WriteContractParameters>>>;

  /** Check operation status */
  status(h: L1InteropWaitable | Hex): Promise<L1InteropStatus>;

  /** Wait for operation to reach specific phase */
  wait(
    h: L1InteropWaitable | Hex,
    opts: { for: L1InteropPhase; pollMs?: number; timeoutMs?: number }
  ): Promise<null>;
  tryWait(
    h: L1InteropWaitable | Hex,
    opts: { for: L1InteropPhase; pollMs?: number; timeoutMs?: number }
  ): Promise<Result<null>>;

  /** Manually retry failed bundle submission */
  retryBundle(h: L1InteropWaitable | Hex): Promise<L1InteropStatus>;

  /** Recover from failed state */
  recover(h: L1InteropWaitable | Hex): Promise<L1InteropHandle<WriteContractParameters>>;
}

/**
 * Internal withdrawals resource type (minimal interface)
 * Used to create withdrawals from L2 to ShadowAccount on L1
 */
interface WithdrawalsResourceMin {
  create(params: { token: Address; amount: bigint; to: Address }): Promise<{ l2TxHash?: string }>;
}

/** === Resource Factory === */
export function createL1CoreResource(
  client: ViemClient,
  withdrawals?: WithdrawalsResourceMin
): L1CoreResource {
  // Helper to wrap functions with try/catch for try* variants
  function toResult<T>(fn: () => Promise<T>): Promise<Result<T>> {
    return fn()
      .then((value) => ({ ok: true as const, value }))
      .catch((error: unknown) => ({ ok: false as const, error }));
  }

  return {
    async quote(p: L1InteropParams): Promise<L1InteropQuote> {
      // 1. Get sender address
      const sender = p.sender ?? client.account.address;
      if (!sender) {
        throw new Error('No sender address available');
      }

      // 2. Get ShadowAccount address
      const shadowAccount = await getShadowAccountAddress(client, sender);

      // 3. Estimate L1 gas for operations (with simulation if possible)
      const l1GasEstimate = await estimateL1Gas(client, p.operations, shadowAccount);

      // 4. Calculate bridge-back gas if needed
      let bridgeBackGas: bigint | undefined;
      if (p.bridgeBack) {
        // Get bridgehub address for dynamic gas calculation
        const addresses = await client.ensureAddresses();
        const l2ChainId = await client.l2.getChainId();

        // Calculate dynamic gas cost using Bridgehub
        bridgeBackGas = await estimateBridgeBackGas(client, {
          chainId: BigInt(l2ChainId),
          bridgehubAddress: addresses.bridgehub,
          l2GasLimit: p.bridgeBack.l2GasLimit,
        });
      }

      // 5. Get L1 gas price
      const l1GasPrice = await client.l1.getGasPrice();

      // 6. Calculate total ETH value needed for operations
      const l1ExecutionValue = calculateTotalValue(p.operations);

      // 7. Calculate total cost (gas + value)
      const l1GasCost = l1GasEstimate * l1GasPrice;
      const bridgeBackCost = bridgeBackGas ? bridgeBackGas * l1GasPrice : BigInt(0);
      const totalCostEstimate = l1GasCost + bridgeBackCost + l1ExecutionValue;

      // 8. Check if ShadowAccount needs deployment
      const needsDeployment = !(await isShadowAccountDeployed(client, sender));

      return {
        l1ExecutionValue,
        l1GasEstimate,
        l1GasPrice,
        bridgeBackGas,
        totalCostEstimate,
        approvalsNeeded: [], // TODO: Analyze operations for required approvals
        shadowAccount,
        needsDeployment,
      };
    },

    tryQuote(p: L1InteropParams): Promise<Result<L1InteropQuote>> {
      return toResult(() => this.quote(p));
    },

    async prepare(p: L1InteropParams): Promise<L1InteropPlan<WriteContractParameters>> {
      // 1. Get quote
      const quote = await this.quote(p);

      // 2. Build bundle submission transaction
      const bundleTx = await buildSendBundleTransaction(client, p.operations);

      return {
        route: 'l1-direct',
        summary: quote,
        steps: [
          {
            key: 'submit-bundle',
            kind: 'l1-submit',
            description: `Submit ${p.operations.length} operation(s) to L1`,
            tx: bundleTx,
          },
        ],
      };
    },

    tryPrepare(p: L1InteropParams): Promise<Result<L1InteropPlan<WriteContractParameters>>> {
      return toResult(() => this.prepare(p));
    },

    async create(p: L1InteropParams): Promise<L1InteropHandle<WriteContractParameters>> {
      // 1. Prepare plan
      const plan = await this.prepare(p);

      // 2. Execute withdrawal transaction to send ETH to ShadowAccount
      let l2WithdrawalTxHash: Hex = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;

      if (withdrawals && plan.summary.totalCostEstimate > BigInt(0)) {
        try {
          const withdrawalResult = await withdrawals.create({
            token: ETH_ADDRESS,
            amount: plan.summary.totalCostEstimate,
            to: plan.summary.shadowAccount,
          });

          if (withdrawalResult.l2TxHash) {
            l2WithdrawalTxHash = withdrawalResult.l2TxHash as Hex;
          }
        } catch (error) {
          console.warn('Withdrawal transaction failed, continuing with bundle submission:', error);
          // Continue anyway - the bundle submission might still work if ShadowAccount has funds
        }
      }

      // 3. Execute bundle submission transaction
      const bundleTx = plan.steps.find((s) => s.key === 'submit-bundle')?.tx;
      if (!bundleTx) {
        throw new Error('Bundle transaction not found in plan');
      }

      // Execute the bundle submission via client
      const l2BundleTxHash = await writeContract(client.l2, bundleTx);

      // 4. Store bundle data for recovery (if in browser environment)
      if (typeof localStorage !== 'undefined') {
        try {
          const bundleData = {
            operations: Array.from(p.operations),
            timestamp: Date.now(),
            attempts: 1,
            l2WithdrawalTxHash,
            l2BundleTxHash,
          };
          localStorage.setItem(`l1-interop-bundle-${l2BundleTxHash}`, JSON.stringify(bundleData));
        } catch (error) {
          console.warn('Failed to store bundle for recovery:', error);
        }
      }

      // 5. Return handle
      return {
        kind: 'l1-interop',
        plan,
        stepHashes: {
          withdrawal: l2WithdrawalTxHash,
          bundle: l2BundleTxHash,
        },
        l2WithdrawalTxHash,
        l2BundleTxHash,
        shadowAccount: plan.summary.shadowAccount,
        operations: p.operations,
      };
    },

    tryCreate(p: L1InteropParams): Promise<Result<L1InteropHandle<WriteContractParameters>>> {
      return toResult(() => this.create(p));
    },

    async status(h: L1InteropWaitable | Hex): Promise<L1InteropStatus> {
      // 1. Extract transaction hashes from handle
      let l2WithdrawalTxHash: Hex;
      let l2BundleTxHash: Hex | undefined;

      if (typeof h === 'string') {
        // Just a transaction hash - use it as bundle hash
        l2BundleTxHash = h;
        l2WithdrawalTxHash = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;
      } else {
        l2WithdrawalTxHash = h.l2WithdrawalTxHash ?? '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex;
        l2BundleTxHash = h.l2BundleTxHash;
      }

      let phase: L1InteropPhase = 'L2_PENDING';
      let l1FinalizationTxHash: Hex | undefined;
      let error: string | undefined;

      // 2. Check L2 bundle status
      if (l2BundleTxHash) {
        try {
          const receipt = await client.l2.getTransactionReceipt({ hash: l2BundleTxHash });

          if (receipt.status === 'success') {
            phase = 'L2_CONFIRMED';
          } else if (receipt.status === 'reverted') {
            phase = 'FAILED';
            error = 'Bundle transaction reverted on L2';
          }
        } catch {
          // Transaction not found or not confirmed yet
          phase = 'L2_PENDING';
        }
      }

      // 3. Determine if ready to finalize (simplified logic)
      // TODO: Check actual finalization window time
      if (phase === 'L2_CONFIRMED') {
        // Assume ready after confirmation (in real implementation, check timestamp)
        phase = 'READY_TO_FINALIZE';
      }

      return {
        phase,
        l2WithdrawalTxHash,
        l2BundleTxHash,
        l1FinalizationTxHash,
        error,
      };
    },

    async wait(
      h: L1InteropWaitable | Hex,
      opts: { for: L1InteropPhase; pollMs?: number; timeoutMs?: number }
    ): Promise<null> {
      // TODO: Implement wait logic
      // Poll status until desired phase is reached or timeout
      const pollMs = opts.pollMs ?? 5000;
      const timeoutMs = opts.timeoutMs;
      const startTime = Date.now();

      while (true) {
        const currentStatus = await this.status(h);

        if (currentStatus.phase === opts.for || currentStatus.phase === 'COMPLETED') {
          return null;
        }

        if (currentStatus.phase === 'FAILED') {
          throw new Error(`Operation failed: ${currentStatus.error}`);
        }

        if (timeoutMs && Date.now() - startTime > timeoutMs) {
          throw new Error(`Timeout waiting for phase ${opts.for}`);
        }

        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
    },

    tryWait(
      h: L1InteropWaitable | Hex,
      opts: { for: L1InteropPhase; pollMs?: number; timeoutMs?: number }
    ): Promise<Result<null>> {
      return toResult(() => this.wait(h, opts));
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    retryBundle(handle: L1InteropWaitable | Hex): Promise<L1InteropStatus> {
      // TODO: Implement retry logic
      // 1. Retrieve stored bundle data
      // 2. Resubmit bundle transaction
      // 3. Update tracking
      // 4. Return new status

      throw new Error('Not implemented: retryBundle');
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    recover(handle: L1InteropWaitable | Hex): Promise<L1InteropHandle<WriteContractParameters>> {
      // TODO: Implement recovery logic
      // 1. Get current status
      // 2. Determine recovery action
      // 3. Execute recovery
      // 4. Return new handle

      throw new Error('Not implemented: recover');
    },
  };
}
