// src/adapters/viem/resources/l1-interop/plugins/aave/withdraw.ts

import { encodeFunctionData, type WriteContractParameters } from 'viem';
import type { ViemClient } from '../../../../client';
import type {
  L1InteropQuote,
  L1InteropHandle,
  L1InteropPlan,
  L1InteropParams,
  L1InteropOperation,
} from '../../../../../../core/types/flows/l1-interop';
import type { AaveWithdrawParams } from '../../../../../../core/types/flows/aave';
import type { AaveWithdrawResource, Result } from './index';
import type { L1CoreResource } from '../../core';
import { IPoolABI, IWrappedTokenGatewayV3ABI, IERC20ABI } from '../../../../../../core/internal/abi-registry';
import { getAaveAddresses } from '../../../../../../core/constants/aave-addresses';
import { getShadowAccountAddress } from '../../shadow-account/utils';
import { resolveAaveAsset, AAVE_ASSETS } from './assets';

export function createAaveWithdrawResource(client: ViemClient, core: L1CoreResource): AaveWithdrawResource {
  function toResult<T>(fn: () => Promise<T>): Promise<Result<T>> {
    return fn()
      .then((value) => ({ ok: true as const, value }))
      .catch((error) => ({ ok: false as const, error }));
  }

  return {
    async quote(p: AaveWithdrawParams): Promise<L1InteropQuote> {
      // TODO: Implement withdraw quote logic
      throw new Error('Not implemented: Aave withdraw quote');
    },

    tryQuote(p: AaveWithdrawParams): Promise<Result<L1InteropQuote>> {
      return toResult(() => this.quote(p));
    },

    async prepare(p: AaveWithdrawParams): Promise<L1InteropPlan<WriteContractParameters>> {
      // TODO: Implement withdraw prepare logic
      throw new Error('Not implemented: Aave withdraw prepare');
    },

    tryPrepare(p: AaveWithdrawParams): Promise<Result<L1InteropPlan<WriteContractParameters>>> {
      return toResult(() => this.prepare(p));
    },

    async create(p: AaveWithdrawParams): Promise<L1InteropHandle<WriteContractParameters>> {
      // Get sender address
      const sender = p.sender ?? client.account.address;
      if (!sender) {
        throw new Error('No sender address available');
      }

      // Get shadow account address
      const shadowAccount = await getShadowAccountAddress(client, sender);

      // Get Aave addresses for the L1 network
      const l1ChainId = await client.l1.getChainId();
      const aaveAddresses = getAaveAddresses(Number(l1ChainId));

      // Resolve asset address
      const assetAddress = resolveAaveAsset(p.asset);

      // Determine withdrawal recipient
      // Default: keep in ShadowAccount on L1
      const withdrawTo = shadowAccount;

      // Create the operations array
      const operations: L1InteropOperation[] = [];

      // Check if the asset is ETH
      const isETH = p.asset === 'ETH' || assetAddress.toLowerCase() === AAVE_ASSETS.ETH.toLowerCase();

      if (isETH) {
        // For ETH: approve aWETH to WethGateway + call withdrawETH

        // Step 1: Approve WethGateway to spend aWETH (aToken)
        const approveData = encodeFunctionData({
          abi: IERC20ABI,
          functionName: 'approve',
          args: [aaveAddresses.wethGateway, p.amount],
        });

        operations.push({
          type: 'call',
          target: aaveAddresses.aToken, // aWETH token
          value: 0n,
          data: approveData,
        });

        // Step 2: Call WethGateway.withdrawETH(pool, amount, to)
        const withdrawETHData = encodeFunctionData({
          abi: IWrappedTokenGatewayV3ABI,
          functionName: 'withdrawETH',
          args: [aaveAddresses.pool, p.amount, withdrawTo],
        });

        operations.push({
          type: 'call',
          target: aaveAddresses.wethGateway,
          value: 0n,
          data: withdrawETHData,
        });
      } else {
        // For ERC20 tokens: use Pool.withdraw directly
        // IPool.withdraw(asset, amount, to)
        const withdrawData = encodeFunctionData({
          abi: IPoolABI,
          functionName: 'withdraw',
          args: [assetAddress, p.amount, withdrawTo],
        });

        operations.push({
          type: 'call',
          target: aaveAddresses.pool,
          value: 0n,
          data: withdrawData,
        });
      }

      // TODO: Add bridge-back operations if p.to?.destination === 'l2'
      // This would require bridging the withdrawn assets back to L2

      // Build L1InteropParams
      const l1InteropParams: L1InteropParams = {
        sender,
        operations,
      };

      // Use the core L1Interop resource to execute the operation
      return await core.create(l1InteropParams);
    },

    tryCreate(p: AaveWithdrawParams): Promise<Result<L1InteropHandle<WriteContractParameters>>> {
      return toResult(() => this.create(p));
    },
  };
}
