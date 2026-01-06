// src/adapters/viem/resources/l1-interop/plugins/aave/repay.ts

import { encodeFunctionData, type WriteContractParameters } from 'viem';
import type { ViemClient } from '../../../../client';
import type {
  L1InteropQuote,
  L1InteropHandle,
  L1InteropPlan,
  L1InteropParams,
  L1InteropOperation,
} from '../../../../../../core/types/flows/l1-interop';
import type { AaveRepayParams } from '../../../../../../core/types/flows/aave';
import type { AaveRepayResource, Result } from './index';
import type { L1CoreResource } from '../../core';
import { IPoolABI, IWrappedTokenGatewayV3ABI, IERC20ABI } from '../../../../../../core/internal/abi-registry';
import { getAaveAddresses } from '../../../../../../core/constants/aave-addresses';
import { getShadowAccountAddress } from '../../shadow-account/utils';
import { resolveAaveAsset, AAVE_ASSETS } from './assets';

export function createAaveRepayResource(client: ViemClient, core: L1CoreResource): AaveRepayResource {
  function toResult<T>(fn: () => Promise<T>): Promise<Result<T>> {
    return fn()
      .then((value) => ({ ok: true as const, value }))
      .catch((error) => ({ ok: false as const, error }));
  }

  return {
    async quote(p: AaveRepayParams): Promise<L1InteropQuote> {
      // TODO: Implement repay quote logic
      throw new Error('Not implemented: Aave repay quote');
    },

    tryQuote(p: AaveRepayParams): Promise<Result<L1InteropQuote>> {
      return toResult(() => this.quote(p));
    },

    async prepare(p: AaveRepayParams): Promise<L1InteropPlan<WriteContractParameters>> {
      // TODO: Implement repay prepare logic
      throw new Error('Not implemented: Aave repay prepare');
    },

    tryPrepare(p: AaveRepayParams): Promise<Result<L1InteropPlan<WriteContractParameters>>> {
      return toResult(() => this.prepare(p));
    },

    async create(p: AaveRepayParams): Promise<L1InteropHandle<WriteContractParameters>> {
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

      // Determine on behalf of whom to repay
      const onBehalfOf = p.onBehalfOf ?? shadowAccount;

      // Create the operations array
      const operations: L1InteropOperation[] = [];

      // Check if the asset is ETH
      const isETH = p.asset === 'ETH' || assetAddress.toLowerCase() === AAVE_ASSETS.ETH.toLowerCase();

      if (isETH) {
        // For ETH: use WethGateway.repayETH (payable - sends ETH)
        // IWrappedTokenGatewayV3.repayETH(pool, amount, rateMode, onBehalfOf)
        const repayETHData = encodeFunctionData({
          abi: IWrappedTokenGatewayV3ABI,
          functionName: 'repayETH',
          args: [aaveAddresses.pool, p.amount, BigInt(p.interestRateMode), onBehalfOf],
        });

        operations.push({
          type: 'call',
          target: aaveAddresses.wethGateway,
          value: p.amount, // Send ETH with the call
          data: repayETHData,
        });
      } else {
        // For ERC20 tokens: approve + Pool.repay

        // Step 1: Approve the Pool contract to spend the tokens
        const approveData = encodeFunctionData({
          abi: IERC20ABI,
          functionName: 'approve',
          args: [aaveAddresses.pool, p.amount],
        });

        operations.push({
          type: 'call',
          target: assetAddress,
          value: 0n,
          data: approveData,
        });

        // Step 2: Call Pool.repay(asset, amount, rateMode, onBehalfOf)
        const repayData = encodeFunctionData({
          abi: IPoolABI,
          functionName: 'repay',
          args: [assetAddress, p.amount, BigInt(p.interestRateMode), onBehalfOf],
        });

        operations.push({
          type: 'call',
          target: aaveAddresses.pool,
          value: 0n,
          data: repayData,
        });
      }

      // Build L1InteropParams
      const l1InteropParams: L1InteropParams = {
        sender,
        operations,
        relayer: p.relayer,
      };

      // Use the core L1Interop resource to execute the operation
      return await core.create(l1InteropParams);
    },

    tryCreate(p: AaveRepayParams): Promise<Result<L1InteropHandle<WriteContractParameters>>> {
      return toResult(() => this.create(p));
    },
  };
}
