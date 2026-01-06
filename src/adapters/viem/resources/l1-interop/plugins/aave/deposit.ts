// src/adapters/viem/resources/l1-interop/plugins/aave/deposit.ts

import { encodeFunctionData, type WriteContractParameters } from 'viem';
import type { ViemClient } from '../../../../client';
import type {
  L1InteropQuote,
  L1InteropHandle,
  L1InteropPlan,
  L1InteropParams,
  L1InteropOperation,
} from '../../../../../../core/types/flows/l1-interop';
import type { AaveDepositParams } from '../../../../../../core/types/flows/aave';
import type { AaveDepositResource, Result } from './index';
import { IWrappedTokenGatewayV3ABI, IPoolABI, IERC20ABI } from '../../../../../../core/internal/abi-registry';
import { getAaveAddresses } from '../../../../../../core/constants/aave-addresses';
import { getShadowAccountAddress } from '../../shadow-account/utils';
import { resolveAaveAsset, AAVE_ASSETS } from './assets';
import type { L1CoreResource } from '../../core';

export function createAaveDepositResource(client: ViemClient, core: L1CoreResource): AaveDepositResource {
  function toResult<T>(fn: () => Promise<T>): Promise<Result<T>> {
    return fn()
      .then((value) => ({ ok: true as const, value }))
      .catch((error) => ({ ok: false as const, error }));
  }

  return {
    async quote(p: AaveDepositParams): Promise<L1InteropQuote> {
      // TODO: Implement deposit quote logic
      // 1. Resolve asset to address
      // 2. Build Aave deposit operations
      // 3. Add bridge-back operations if requested
      // 4. Calculate gas estimates
      // 5. Return quote
      throw new Error('Not implemented: Aave deposit quote');
    },

    tryQuote(p: AaveDepositParams): Promise<Result<L1InteropQuote>> {
      return toResult(() => this.quote(p));
    },

    async prepare(p: AaveDepositParams): Promise<L1InteropPlan<WriteContractParameters>> {
      // TODO: Implement deposit prepare logic
      throw new Error('Not implemented: Aave deposit prepare');
    },

    tryPrepare(p: AaveDepositParams): Promise<Result<L1InteropPlan<WriteContractParameters>>> {
      return toResult(() => this.prepare(p));
    },

    async create(p: AaveDepositParams): Promise<L1InteropHandle<WriteContractParameters>> {
      // Get sender address (use provided sender or get from client)
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

      // Determine recipient for aTokens
      const onBehalfOf = p.onBehalfOf ?? shadowAccount;

      // Create the operations array
      const operations: L1InteropOperation[] = [];

      // Check if the asset is ETH
      const isETH = p.asset === 'ETH' || assetAddress.toLowerCase() === AAVE_ASSETS.ETH.toLowerCase();

      if (isETH) {
        // For ETH: use WethGateway.depositETH
        // IWrappedTokenGatewayV3.depositETH(pool, onBehalfOf, referralCode)
        const depositETHData = encodeFunctionData({
          abi: IWrappedTokenGatewayV3ABI,
          functionName: 'depositETH',
          args: [aaveAddresses.pool, onBehalfOf, 0], // referralCode = 0
        });

        operations.push({
          type: 'call',
          target: aaveAddresses.wethGateway,
          value: p.amount,
          data: depositETHData,
        });
      } else {
        // For ERC20 tokens: approve + Pool.supply

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

        // Step 2: Call Pool.supply(asset, amount, onBehalfOf, referralCode)
        const supplyData = encodeFunctionData({
          abi: IPoolABI,
          functionName: 'supply',
          args: [assetAddress, p.amount, onBehalfOf, 0], // referralCode = 0
        });

        operations.push({
          type: 'call',
          target: aaveAddresses.pool,
          value: 0n,
          data: supplyData,
        });
      }

      // TODO: Add bridge-back operations if p.bridgeBack is specified
      // This would require:
      // 1. Get aToken balance after deposit
      // 2. Build bridge transaction for aToken back to L2
      // 3. Add to operations array

      // Build L1InteropParams
      const l1InteropParams: L1InteropParams = {
        sender,
        operations,
      };

      // Use the core L1Interop resource to execute the operation
      return await core.create(l1InteropParams);
    },

    tryCreate(p: AaveDepositParams): Promise<Result<L1InteropHandle<WriteContractParameters>>> {
      return toResult(() => this.create(p));
    },
  };
}
