// src/core/errors/l1-interop-errors.ts

import type { Address, Hex } from '../types/primitives';

/**
 * Base error class for L1 Interop operations
 */
export class L1InteropError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'L1InteropError';
    Object.setPrototypeOf(this, L1InteropError.prototype);
  }
}

/**
 * ShadowAccount not deployed error
 */
export class ShadowAccountNotDeployedError extends L1InteropError {
  constructor(l2Owner: Address) {
    super(
      `ShadowAccount not deployed for ${l2Owner}. Call sdk.l1Interop.utils.deployShadowAccount() first.`,
      'SHADOW_ACCOUNT_NOT_DEPLOYED',
      { l2Owner }
    );
    this.name = 'ShadowAccountNotDeployedError';
    Object.setPrototypeOf(this, ShadowAccountNotDeployedError.prototype);
  }
}

/**
 * Bundle submission failed error
 */
export class BundleSubmissionFailedError extends L1InteropError {
  constructor(reason: string, details?: unknown) {
    const message = `Failed to submit bundle to L2InteropCenter: ${reason}\n\nRecovery: Call sdk.l1Interop.core.retryBundle(hash) to retry submission.`;
    super(message, 'BUNDLE_SUBMISSION_FAILED', details);
    this.name = 'BundleSubmissionFailedError';
    Object.setPrototypeOf(this, BundleSubmissionFailedError.prototype);
  }
}

/**
 * L1 execution failed error
 */
export class L1ExecutionFailedError extends L1InteropError {
  constructor(reason: string, details?: unknown) {
    const message = `L1 execution failed: ${reason}\n\nFunds remain in ShadowAccount. Use sdk.l1Interop.core.recover(hash) to attempt recovery.`;
    super(message, 'L1_EXECUTION_FAILED', details);
    this.name = 'L1ExecutionFailedError';
    Object.setPrototypeOf(this, L1ExecutionFailedError.prototype);
  }
}

/**
 * Aave insufficient collateral error
 */
export class AaveInsufficientCollateralError extends L1InteropError {
  constructor(required: bigint, available: bigint) {
    super(
      `Insufficient collateral for borrow. Required: ${required}, Available: ${available}`,
      'AAVE_INSUFFICIENT_COLLATERAL',
      { required, available }
    );
    this.name = 'AaveInsufficientCollateralError';
    Object.setPrototypeOf(this, AaveInsufficientCollateralError.prototype);
  }
}

/**
 * Aave market frozen error
 */
export class AaveMarketFrozenError extends L1InteropError {
  constructor(asset: Address) {
    super(`Aave market for asset ${asset} is frozen`, 'AAVE_MARKET_FROZEN', { asset });
    this.name = 'AaveMarketFrozenError';
    Object.setPrototypeOf(this, AaveMarketFrozenError.prototype);
  }
}

/**
 * Insufficient gas error
 */
export class InsufficientGasError extends L1InteropError {
  constructor(required: bigint, provided: bigint) {
    const message = `Insufficient gas for operation. Required: ${required}, Provided: ${provided}\n\nIncrease the gas limit or wait for lower gas prices.`;
    super(message, 'INSUFFICIENT_GAS', { required, provided });
    this.name = 'InsufficientGasError';
    Object.setPrototypeOf(this, InsufficientGasError.prototype);
  }
}

/**
 * Bundle size limit exceeded error
 */
export class BundleSizeLimitExceededError extends L1InteropError {
  constructor(size: number, limit: number) {
    const message = `Bundle size (${size} operations) exceeds limit (${limit})\n\nSplit operations into multiple transactions.`;
    super(message, 'BUNDLE_SIZE_EXCEEDED', { size, limit });
    this.name = 'BundleSizeLimitExceededError';
    Object.setPrototypeOf(this, BundleSizeLimitExceededError.prototype);
  }
}

/**
 * Rebasing token error
 */
export class RebasingTokenError extends L1InteropError {
  constructor(token: Address) {
    super(
      `Cannot bridge rebasing token ${token} without wrapping. Use bridgeBack.useStataToken=true`,
      'REBASING_TOKEN_NOT_WRAPPED',
      { token }
    );
    this.name = 'RebasingTokenError';
    Object.setPrototypeOf(this, RebasingTokenError.prototype);
  }
}

/**
 * Unknown asset error
 */
export class UnknownAssetError extends L1InteropError {
  constructor(asset: string) {
    super(`Unknown Aave asset: ${asset}`, 'UNKNOWN_ASSET', { asset });
    this.name = 'UnknownAssetError';
    Object.setPrototypeOf(this, UnknownAssetError.prototype);
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends L1InteropError {
  constructor(operation: string, timeoutMs: number) {
    super(
      `Operation timed out after ${timeoutMs}ms: ${operation}`,
      'TIMEOUT',
      { operation, timeoutMs }
    );
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}
