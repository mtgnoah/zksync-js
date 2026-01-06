// examples/aave/borrow.ts
// Example: Borrow assets from Aave V3 using ZKsync L1 Interop

import type { Address } from 'viem';
import type { ViemSdk } from '@matterlabs/zksync-js/viem';
import type { L1Handle } from '../../src/adapters/viem/resources/l1/types';
import {
  getAaveAddresses,
  resolveAaveAsset,
  AAVE_ASSETS,
  AAVE_POOL_ABI,
  WETH_GATEWAY_ABI,
  INTEREST_RATE_MODE,
  type AaveAssetSymbol,
  type InterestRateMode,
} from './constants';

export interface AaveBorrowParams {
  /** Asset to borrow (symbol or address) */
  asset: AaveAssetSymbol | Address;
  /** Amount to borrow */
  amount: bigint;
  /** Interest rate mode (1 = stable, 2 = variable) */
  interestRateMode: InterestRateMode;
  /** L2 sender address (used to compute ShadowAccount) */
  sender: Address;
  /** L1 chain ID (defaults to Sepolia) */
  l1ChainId?: number;
}

/**
 * Borrow assets from Aave V3 via L1 Interop
 *
 * For ETH: Uses WethGateway.borrowETH
 * For ERC20: Uses Pool.borrow
 *
 * Note: Borrower must have sufficient collateral deposited in Aave.
 * The borrowed assets end up in the ShadowAccount on L1.
 *
 * @param sdk - ZKsync SDK instance
 * @param params - Borrow parameters
 * @returns L1 handle for tracking the operation
 *
 * @example
 * ```typescript
 * // Borrow 0.5 ETH with variable rate
 * const handle = await aaveBorrow(sdk, {
 *   asset: 'ETH',
 *   amount: parseEther('0.5'),
 *   interestRateMode: INTEREST_RATE_MODE.VARIABLE,
 *   sender: userAddress,
 * });
 *
 * // Borrow 1000 USDC with stable rate
 * const handle = await aaveBorrow(sdk, {
 *   asset: 'USDC',
 *   amount: parseUnits('1000', 6),
 *   interestRateMode: INTEREST_RATE_MODE.STABLE,
 *   sender: userAddress,
 * });
 * ```
 */
export async function aaveBorrow(
  sdk: ViemSdk,
  params: AaveBorrowParams
): Promise<L1Handle> {
  const { asset, amount, interestRateMode, sender, l1ChainId } = params;

  // Resolve asset address
  const assetAddress = resolveAaveAsset(asset);

  // Get Aave addresses
  const chainId = l1ChainId ?? 11155111; // Default to Sepolia
  const aaveAddresses = getAaveAddresses(chainId);

  // Get ShadowAccount address - borrowed funds go here
  const shadowAccount = await sdk.l1.getShadowAccount(sender);

  // Check if asset is ETH
  const isETH = asset === 'ETH' || assetAddress.toLowerCase() === AAVE_ASSETS.ETH.toLowerCase();

  if (isETH) {
    // ETH borrow: Use WethGateway.borrowETH
    return sdk.l1.bundle()
      .call({
        target: aaveAddresses.wethGateway,
        abi: WETH_GATEWAY_ABI,
        functionName: 'borrowETH',
        args: [aaveAddresses.pool, amount, BigInt(interestRateMode), 0], // referralCode = 0
      })
      .create();
  } else {
    // ERC20 borrow: Use Pool.borrow
    // onBehalfOf is the ShadowAccount (who has the collateral and will owe the debt)
    return sdk.l1.bundle()
      .call({
        target: aaveAddresses.pool,
        abi: AAVE_POOL_ABI,
        functionName: 'borrow',
        args: [assetAddress, amount, BigInt(interestRateMode), 0, shadowAccount], // referralCode = 0
      })
      .create();
  }
}

/**
 * Get quote for Aave borrow
 */
export async function aaveBorrowQuote(
  sdk: ViemSdk,
  params: AaveBorrowParams
) {
  const { asset, amount, interestRateMode, sender, l1ChainId } = params;

  const assetAddress = resolveAaveAsset(asset);
  const chainId = l1ChainId ?? 11155111;
  const aaveAddresses = getAaveAddresses(chainId);
  const shadowAccount = await sdk.l1.getShadowAccount(sender);

  const isETH = asset === 'ETH' || assetAddress.toLowerCase() === AAVE_ASSETS.ETH.toLowerCase();

  if (isETH) {
    return sdk.l1.bundle()
      .call({
        target: aaveAddresses.wethGateway,
        abi: WETH_GATEWAY_ABI,
        functionName: 'borrowETH',
        args: [aaveAddresses.pool, amount, BigInt(interestRateMode), 0],
      })
      .quote();
  } else {
    return sdk.l1.bundle()
      .call({
        target: aaveAddresses.pool,
        abi: AAVE_POOL_ABI,
        functionName: 'borrow',
        args: [assetAddress, amount, BigInt(interestRateMode), 0, shadowAccount],
      })
      .quote();
  }
}

// Re-export interest rate mode for convenience
export { INTEREST_RATE_MODE };
