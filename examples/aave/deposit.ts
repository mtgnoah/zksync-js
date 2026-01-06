// examples/aave/deposit.ts
// Example: Deposit assets to Aave V3 using ZKsync L1 Interop

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

export interface AaveDepositParams {
  /** Asset to deposit (symbol or address) */
  asset: AaveAssetSymbol | Address;
  /** Amount to deposit */
  amount: bigint;
  /** L2 sender address (used to compute ShadowAccount) */
  sender: Address;
  /** Recipient of aTokens (defaults to sender's ShadowAccount) */
  onBehalfOf?: Address;
  /** L1 chain ID (defaults to Sepolia) */
  l1ChainId?: number;
}

/**
 * Deposit assets to Aave V3 via L1 Interop
 *
 * For ETH: Uses WethGateway.depositETH (payable)
 * For ERC20: Uses approve + Pool.supply
 *
 * @param sdk - ZKsync SDK instance
 * @param params - Deposit parameters
 * @returns L1 handle for tracking the operation
 *
 * @example
 * ```typescript
 * // Deposit 1 ETH
 * const handle = await aaveDeposit(sdk, {
 *   asset: 'ETH',
 *   amount: parseEther('1'),
 *   sender: userAddress, // Your L2 wallet address
 * });
 *
 * // Deposit 1000 USDC
 * const handle = await aaveDeposit(sdk, {
 *   asset: 'USDC',
 *   amount: parseUnits('1000', 6),
 *   sender: userAddress,
 * });
 *
 * // Wait for completion
 * const result = await handle.wait();
 * ```
 */
export async function aaveDeposit(
  sdk: ViemSdk,
  params: AaveDepositParams
): Promise<L1Handle> {
  const { asset, amount, sender, onBehalfOf, l1ChainId } = params;

  // Resolve asset address
  const assetAddress = resolveAaveAsset(asset);

  // Get Aave addresses
  const chainId = l1ChainId ?? 11155111; // Default to Sepolia
  const aaveAddresses = getAaveAddresses(chainId);

  // Get ShadowAccount address - this is where aTokens will be credited
  const shadowAccount = await sdk.l1.getShadowAccount(sender);
  const recipient = onBehalfOf ?? shadowAccount;

  // Check if asset is ETH
  const isETH = asset === 'ETH' || assetAddress.toLowerCase() === AAVE_ASSETS.ETH.toLowerCase();

  if (isETH) {
    // ETH deposit: Use WethGateway.depositETH (payable)
    return sdk.l1.bundle()
      .call({
        target: aaveAddresses.wethGateway,
        abi: WETH_GATEWAY_ABI,
        functionName: 'depositETH',
        args: [aaveAddresses.pool, recipient, 0], // referralCode = 0
        value: amount, // Send ETH with the call
      })
      .create();
  } else {
    // ERC20 deposit: Approve + Pool.supply
    return sdk.l1.bundle()
      // Step 1: Approve Pool to spend tokens
      .call({
        target: assetAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [aaveAddresses.pool, amount],
      })
      // Step 2: Supply to Aave
      .call({
        target: aaveAddresses.pool,
        abi: AAVE_POOL_ABI,
        functionName: 'supply',
        args: [assetAddress, amount, recipient, 0], // referralCode = 0
      })
      .create();
  }
}

/**
 * Get quote for Aave deposit
 */
export async function aaveDepositQuote(
  sdk: ViemSdk,
  params: AaveDepositParams
) {
  const { asset, amount, sender, onBehalfOf, l1ChainId } = params;

  // Resolve asset address
  const assetAddress = resolveAaveAsset(asset);

  // Get Aave addresses
  const chainId = l1ChainId ?? 11155111;
  const aaveAddresses = getAaveAddresses(chainId);

  // Get ShadowAccount address
  const shadowAccount = await sdk.l1.getShadowAccount(sender);
  const recipient = onBehalfOf ?? shadowAccount;

  // Check if asset is ETH
  const isETH = asset === 'ETH' || assetAddress.toLowerCase() === AAVE_ASSETS.ETH.toLowerCase();

  if (isETH) {
    return sdk.l1.bundle()
      .call({
        target: aaveAddresses.wethGateway,
        abi: WETH_GATEWAY_ABI,
        functionName: 'depositETH',
        args: [aaveAddresses.pool, recipient, 0],
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
        functionName: 'supply',
        args: [assetAddress, amount, recipient, 0],
      })
      .quote();
  }
}
