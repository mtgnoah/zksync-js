// examples/aave/repay.ts
// Example: Repay borrowed assets on Aave V3 using ZKsync L1 Interop

import type { Address } from 'viem';
import type { ViemSdk } from '@matterlabs/zksync-js/viem';
import type { L1Handle } from '../../src/adapters/viem/resources/l1/types';
import {
  getAaveAddresses,
  resolveAaveAsset,
  AAVE_ASSETS,
  AAVE_POOL_ABI,
  WETH_GATEWAY_ABI,
  ERC20_ABI,
  INTEREST_RATE_MODE,
  type AaveAssetSymbol,
  type InterestRateMode,
} from './constants';

export interface AaveRepayParams {
  /** Asset to repay (symbol or address) */
  asset: AaveAssetSymbol | Address;
  /** Amount to repay (use MaxUint256 for full repay) */
  amount: bigint;
  /** Interest rate mode of the debt (1 = stable, 2 = variable) */
  interestRateMode: InterestRateMode;
  /** L2 sender address (used to compute ShadowAccount) */
  sender: Address;
  /** Address of the borrower to repay for (defaults to sender's ShadowAccount) */
  onBehalfOf?: Address;
  /** L1 chain ID (defaults to Sepolia) */
  l1ChainId?: number;
}

/**
 * Repay borrowed assets on Aave V3 via L1 Interop
 *
 * For ETH: Uses WethGateway.repayETH (payable - sends ETH)
 * For ERC20: Uses approve + Pool.repay
 *
 * The repayment uses funds from the ShadowAccount to pay down the debt.
 *
 * @param sdk - ZKsync SDK instance
 * @param params - Repay parameters
 * @returns L1 handle for tracking the operation
 *
 * @example
 * ```typescript
 * // Repay 0.5 ETH (variable rate debt)
 * const handle = await aaveRepay(sdk, {
 *   asset: 'ETH',
 *   amount: parseEther('0.5'),
 *   interestRateMode: INTEREST_RATE_MODE.VARIABLE,
 *   sender: userAddress,
 * });
 *
 * // Repay all USDC debt (use MaxUint256)
 * const handle = await aaveRepay(sdk, {
 *   asset: 'USDC',
 *   amount: MaxUint256,
 *   interestRateMode: INTEREST_RATE_MODE.STABLE,
 *   sender: userAddress,
 * });
 * ```
 */
export async function aaveRepay(
  sdk: ViemSdk,
  params: AaveRepayParams
): Promise<L1Handle> {
  const { asset, amount, interestRateMode, sender, onBehalfOf, l1ChainId } = params;

  // Resolve asset address
  const assetAddress = resolveAaveAsset(asset);

  // Get Aave addresses
  const chainId = l1ChainId ?? 11155111; // Default to Sepolia
  const aaveAddresses = getAaveAddresses(chainId);

  // Get ShadowAccount address - this is who owes the debt
  const shadowAccount = await sdk.l1.getShadowAccount(sender);
  const borrower = onBehalfOf ?? shadowAccount;

  // Check if asset is ETH
  const isETH = asset === 'ETH' || assetAddress.toLowerCase() === AAVE_ASSETS.ETH.toLowerCase();

  if (isETH) {
    // ETH repay: Use WethGateway.repayETH (payable - sends ETH with call)
    return sdk.l1.bundle()
      .call({
        target: aaveAddresses.wethGateway,
        abi: WETH_GATEWAY_ABI,
        functionName: 'repayETH',
        args: [aaveAddresses.pool, amount, BigInt(interestRateMode), borrower],
        value: amount, // Send ETH with the call
      })
      .create();
  } else {
    // ERC20 repay: Approve + Pool.repay
    return sdk.l1.bundle()
      // Step 1: Approve Pool to spend tokens
      .call({
        target: assetAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [aaveAddresses.pool, amount],
      })
      // Step 2: Repay debt
      .call({
        target: aaveAddresses.pool,
        abi: AAVE_POOL_ABI,
        functionName: 'repay',
        args: [assetAddress, amount, BigInt(interestRateMode), borrower],
      })
      .create();
  }
}

/**
 * Get quote for Aave repay
 */
export async function aaveRepayQuote(
  sdk: ViemSdk,
  params: AaveRepayParams
) {
  const { asset, amount, interestRateMode, sender, onBehalfOf, l1ChainId } = params;

  const assetAddress = resolveAaveAsset(asset);
  const chainId = l1ChainId ?? 11155111;
  const aaveAddresses = getAaveAddresses(chainId);
  const shadowAccount = await sdk.l1.getShadowAccount(sender);
  const borrower = onBehalfOf ?? shadowAccount;

  const isETH = asset === 'ETH' || assetAddress.toLowerCase() === AAVE_ASSETS.ETH.toLowerCase();

  if (isETH) {
    return sdk.l1.bundle()
      .call({
        target: aaveAddresses.wethGateway,
        abi: WETH_GATEWAY_ABI,
        functionName: 'repayETH',
        args: [aaveAddresses.pool, amount, BigInt(interestRateMode), borrower],
        value: amount,
      })
      .quote();
  } else {
    return sdk.l1.bundle()
      .call({
        target: assetAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [aaveAddresses.pool, amount],
      })
      .call({
        target: aaveAddresses.pool,
        abi: AAVE_POOL_ABI,
        functionName: 'repay',
        args: [assetAddress, amount, BigInt(interestRateMode), borrower],
      })
      .quote();
  }
}

// Re-export interest rate mode for convenience
export { INTEREST_RATE_MODE };
