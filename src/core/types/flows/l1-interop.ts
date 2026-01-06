// src/core/types/flows/l1-interop.ts

import type { Address, Hex } from '../primitives';
import type { ApprovalNeed, Plan, Handle } from './base';

/** === L1 Operation Types === */

export type L1InteropOperation =
  | { type: 'call'; target: Address; value: bigint; data: Hex }
  | { type: 'multicall'; calls: Array<{ target: Address; value: bigint; data: Hex }> };

export interface L1InteropParams {
  /** Optional; defaults to connected wallet */
  sender?: Address;

  /** The L1 operations to execute */
  operations: readonly L1InteropOperation[];

  /** Gas parameters for bridge-back operations */
  bridgeBack?: {
    /** Token to bridge back (if any) */
    token: Address;
    /** Amount to bridge back */
    amount: bigint;
    /** Recipient on L2 (defaults to sender) */
    recipient?: Address;
    /** Gas limit for L2 transaction */
    l2GasLimit?: bigint;
  };

  /** Optional recovery address on L1 (for emergency access) */
  recoveryAddress?: Address;
}

/** === Quote === */
export interface L1InteropQuote {
  /** Total ETH needed for L1 operations */
  l1ExecutionValue: bigint;

  /** Gas estimate for L1 execution */
  l1GasEstimate: bigint;

  /** L1 gas price at quote time */
  l1GasPrice: bigint;

  /** Bridge-back gas cost (if applicable) */
  bridgeBackGas?: bigint;

  /** Total cost estimate in ETH */
  totalCostEstimate: bigint;

  /** ERC20 approvals needed on L2 */
  approvalsNeeded: readonly ApprovalNeed[];

  /** ShadowAccount address */
  shadowAccount: Address;

  /** Whether ShadowAccount needs deployment */
  needsDeployment: boolean;
}

/** === Plan === */
export type L1InteropPlan<Tx> = Plan<Tx, 'l1-direct', L1InteropQuote>;

/** === Handle === */
export interface L1InteropHandle<Tx> extends Handle<Record<string, Hex>, 'l1-direct', L1InteropPlan<Tx>> {
  kind: 'l1-interop';

  /** L2 withdrawal transaction hash */
  l2WithdrawalTxHash: Hex;

  /** L2 bundle submission transaction hash */
  l2BundleTxHash?: Hex;

  /** L1 finalization transaction hash (once finalized) */
  l1FinalizationTxHash?: Hex;

  /** ShadowAccount address on L1 */
  shadowAccount: Address;

  /** Bundle operations */
  operations: readonly L1InteropOperation[];
}

/** === Status & Phases === */
export type L1InteropPhase =
  | 'L2_PENDING'          // L2 withdrawal tx pending
  | 'L2_CONFIRMED'        // L2 withdrawal confirmed, waiting for finalization window
  | 'READY_TO_FINALIZE'   // Finalization window passed, ready for L1 execution
  | 'L1_PENDING'          // L1 execution transaction submitted
  | 'L1_EXECUTED'         // L1 execution successful
  | 'BRIDGE_BACK_PENDING' // Bridge-back transaction pending (if applicable)
  | 'COMPLETED'           // Fully complete (including bridge-back if requested)
  | 'FAILED'              // Operation failed
  | 'UNKNOWN';

export interface L1InteropStatus {
  phase: L1InteropPhase;
  l2WithdrawalTxHash?: Hex;
  l2BundleTxHash?: Hex;
  l1FinalizationTxHash?: Hex;
  shadowAccount?: Address;
  error?: string;
  estimatedFinalizationTime?: Date;
}

/** === Waitable === */
export type L1InteropWaitable =
  | Hex
  | { l2WithdrawalTxHash?: Hex; l2BundleTxHash?: Hex }
  | L1InteropHandle<unknown>;
