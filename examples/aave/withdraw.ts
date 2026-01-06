// examples/aave/withdraw.ts
// Example: Withdraw assets from Aave V3 using ZKsync L1 Interop

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
  type AaveAssetSymbol,
} from './constants';

export interface AaveWithdrawParams {
  /** Asset to withdraw (symbol or address) */
  asset: AaveAssetSymbol | Address;
  /** Amount to withdraw (use MaxUint256 for max) */
  amount: bigint;
  /** Recipient of withdrawn assets (defaults to ShadowAccount) */
  to?: Address;
  /** L1 chain ID (defaults to connected L1) */
  l1ChainId?: number;
}

/**
 * Withdraw assets from Aave V3 via L1 Interop
 *
 * For ETH: Approve aWETH to WethGateway + call withdrawETH
 * For ERC20: Use Pool.withdraw directly
 *
 * @param sdk - ZKsync SDK instance
 * @param params - Withdraw parameters
 * @returns L1 handle for tracking the operation
 *
 * @example
 * ```typescript
 * // Withdraw 1 ETH
 * const handle = await aaveWithdraw(sdk, {
 *   asset: 'ETH',
 *   amount: parseEther('1'),
 * });
 *
 * // Withdraw all USDC
 * const handle = await aaveWithdraw(sdk, {
 *   asset: 'USDC',
 *   amount: MaxUint256, // Withdraw max
 * });
 * ```
 */
export async function aaveWithdraw(
  sdk: ViemSdk,
  params: AaveWithdrawParams
): Promise<L1Handle> {
  const { asset, amount, to, l1ChainId } = params;

  // Resolve asset address
  const assetAddress = resolveAaveAsset(asset);

  // Get Aave addresses
  const chainId = l1ChainId ?? 11155111; // Default to Sepolia
  const aaveAddresses = getAaveAddresses(chainId);

  // Get ShadowAccount address for recipient
  const shadowAccount = await sdk.l1.getShadowAccount(
    '0x0000000000000000000000000000000000000000' as Address
  );
  const recipient = to ?? shadowAccount;

  // Check if asset is ETH
  const isETH = asset === 'ETH' || assetAddress.toLowerCase() === AAVE_ASSETS.ETH.toLowerCase();

  if (isETH) {
    // ETH withdraw: Approve aWETH to WethGateway + call withdrawETH
    return sdk.l1.bundle()
      // Step 1: Approve WethGateway to spend aWETH
      .call({
        target: aaveAddresses.aToken, // aWETH
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [aaveAddresses.wethGateway, amount],
      })
      // Step 2: Withdraw ETH
      .call({
        target: aaveAddresses.wethGateway,
        abi: WETH_GATEWAY_ABI,
        functionName: 'withdrawETH',
        args: [aaveAddresses.pool, amount, recipient],
      })
      .create();
  } else {
    // ERC20 withdraw: Use Pool.withdraw directly
    return sdk.l1.bundle()
      .call({
        target: aaveAddresses.pool,
        abi: AAVE_POOL_ABI,
        functionName: 'withdraw',
        args: [assetAddress, amount, recipient],
      })
      .create();
  }
}

/**
 * Get quote for Aave withdraw
 */
export async function aaveWithdrawQuote(
  sdk: ViemSdk,
  params: AaveWithdrawParams
) {
  const { asset, amount, to, l1ChainId } = params;

  const assetAddress = resolveAaveAsset(asset);
  const chainId = l1ChainId ?? 11155111;
  const aaveAddresses = getAaveAddresses(chainId);

  const shadowAccount = await sdk.l1.getShadowAccount(
    '0x0000000000000000000000000000000000000000' as Address
  );
  const recipient = to ?? shadowAccount;

  const isETH = asset === 'ETH' || assetAddress.toLowerCase() === AAVE_ASSETS.ETH.toLowerCase();

  if (isETH) {
    return sdk.l1.bundle()
      .call({
        target: aaveAddresses.aToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [aaveAddresses.wethGateway, amount],
      })
      .call({
        target: aaveAddresses.wethGateway,
        abi: WETH_GATEWAY_ABI,
        functionName: 'withdrawETH',
        args: [aaveAddresses.pool, amount, recipient],
      })
      .quote();
  } else {
    return sdk.l1.bundle()
      .call({
        target: aaveAddresses.pool,
        abi: AAVE_POOL_ABI,
        functionName: 'withdraw',
        args: [assetAddress, amount, recipient],
      })
      .quote();
  }
}
