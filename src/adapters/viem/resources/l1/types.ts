// src/adapters/viem/resources/l1/types.ts

import type { Abi } from 'viem';
import type { Address, Hex } from '../../../../core/types/primitives';

/** === L1 Call Parameters (Declarative) === */
export interface L1CallParams {
  /** Target contract address */
  target: Address;
  /** Contract ABI */
  abi: Abi;
  /** Function name to call */
  functionName: string;
  /** Function arguments */
  args: readonly unknown[];
  /** ETH value to send with the call */
  value?: bigint;
}

/** === L1 Quote === */
export interface L1Quote {
  /** Total funds needed on L1 for execution */
  requiredFunds: bigint;
  /** Current balance in ShadowAccount */
  currentBalance: bigint;
  /** Amount that will be bridged from L2 */
  bridgeAmount: bigint;
  /** Estimated gas for L1 execution */
  estimatedGas: bigint;
  /** Current L1 gas price */
  gasPrice: bigint;
  /** Total cost (gas * gasPrice + value) */
  totalCost: bigint;
  /** The calls being quoted */
  calls: readonly L1CallParams[];
  /** ShadowAccount address */
  shadowAccount: Address;
  /** Whether ShadowAccount needs deployment */
  needsDeployment: boolean;
}

/** === L1 Prepared Transaction === */
export interface L1PreparedTx {
  /** Quote for this transaction */
  quote: L1Quote;
  /** Encoded operations ready for submission */
  encodedOperations: readonly EncodedL1Operation[];
}

/** === Encoded L1 Operation === */
export interface EncodedL1Operation {
  target: Address;
  value: bigint;
  data: Hex;
}

/** === Wait Options === */
export interface L1WaitOptions {
  /** Timeout in milliseconds (default: 600_000 = 10 min) */
  timeout?: number;
  /** Poll interval in milliseconds (default: 15_000 = 15 sec) */
  pollInterval?: number;
}

/** === L1 Result === */
export interface L1Result {
  /** Execution status */
  status: 'success' | 'failed' | 'timeout';
  /** L1 execution transaction hash */
  l1TransactionHash?: Hex;
  /** L1 block number */
  l1BlockNumber?: bigint;
  /** Error details (if failed) */
  error?: {
    code: string;
    message: string;
    revertReason?: string;
  };
}

/** === L1 Handle === */
export interface L1Handle {
  /** L2 submission transaction hash */
  hash: Hex;
  /** Bundle identifier */
  bundleHash: Hex;
  /** ShadowAccount address */
  shadowAccount: Address;
  /** Wait for completion */
  wait(options?: L1WaitOptions): Promise<L1Result>;
}

/** === Result Type (for try* methods) === */
export type Result<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** === L1 Call Resource Interface === */
export interface L1CallResource {
  quote(params: L1CallParams): Promise<L1Quote>;
  tryQuote(params: L1CallParams): Promise<Result<L1Quote>>;
  prepare(params: L1CallParams): Promise<L1PreparedTx>;
  tryPrepare(params: L1CallParams): Promise<Result<L1PreparedTx>>;
  create(params: L1CallParams): Promise<L1Handle>;
  tryCreate(params: L1CallParams): Promise<Result<L1Handle>>;
}

/** === L1 Bundle Builder Interface === */
export interface L1BundleBuilder {
  /** Add a call to the bundle */
  call(params: L1CallParams): L1BundleBuilder;
  /** Get quote for the bundle */
  quote(): Promise<L1Quote>;
  /** Prepare the bundle */
  prepare(): Promise<L1PreparedTx>;
  /** Create and submit the bundle */
  create(): Promise<L1Handle>;
}

/** === Main L1 Resource Interface === */
export interface L1Resource {
  /** Single call operations */
  call: L1CallResource;
  /** Bundle builder */
  bundle(): L1BundleBuilder;
  /** Get ShadowAccount address for an owner */
  getShadowAccount(owner: Address): Promise<Address>;
  /** Deploy ShadowAccount if not exists */
  deployShadowAccount(owner: Address): Promise<Hex>;
  /** ERC20 helpers */
  helpers: L1Helpers;
}

/** === L1 Helpers === */
export interface L1Helpers {
  erc20: {
    approve(token: Address, spender: Address, amount: bigint): L1CallParams;
    transfer(token: Address, to: Address, amount: bigint): L1CallParams;
    transferFrom(token: Address, from: Address, to: Address, amount: bigint): L1CallParams;
  };
}
