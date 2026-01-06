// src/adapters/viem/resources/l1-interop/plugins/aave/borrow.ts

import { encodeFunctionData, type WriteContractParameters } from 'viem';
import { sepolia } from 'viem/chains';
import type { ViemClient } from '../../../../client';
import type {
  L1InteropQuote,
  L1InteropHandle,
  L1InteropPlan,
  L1InteropParams,
  L1InteropOperation,
} from '../../../../../../core/types/flows/l1-interop';
import type { AaveBorrowParams } from '../../../../../../core/types/flows/aave';
import type { AaveBorrowResource, Result } from './index';
import { IPoolABI, IERC20ABI, IBridgehubABI, IWrappedTokenGatewayV3ABI } from '../../../../../../core/internal/abi-registry';
import { getAaveAddresses } from '../../../../../../core/constants/aave-addresses';
import { getShadowAccountAddress } from '../../shadow-account/utils';
import { resolveAaveAsset, AAVE_ASSETS } from './assets';
import { DataEncoding } from '../../services/data-encoding';
import { calculateBridgeBackGas } from '../../services/gas-estimation';
import type { L1CoreResource } from '../../core';

export function createAaveBorrowResource(client: ViemClient, core: L1CoreResource): AaveBorrowResource {
  function toResult<T>(fn: () => Promise<T>): Promise<Result<T>> {
    return fn()
      .then((value) => ({ ok: true as const, value }))
      .catch((error) => ({ ok: false as const, error }));
  }

  return {
    async quote(p: AaveBorrowParams): Promise<L1InteropQuote> {
      // TODO: Implement borrow quote logic
      throw new Error('Not implemented: Aave borrow quote');
    },

    tryQuote(p: AaveBorrowParams): Promise<Result<L1InteropQuote>> {
      return toResult(() => this.quote(p));
    },

    async prepare(p: AaveBorrowParams): Promise<L1InteropPlan<WriteContractParameters>> {
      // TODO: Implement borrow prepare logic
      throw new Error('Not implemented: Aave borrow prepare');
    },

    tryPrepare(p: AaveBorrowParams): Promise<Result<L1InteropPlan<WriteContractParameters>>> {
      return toResult(() => this.prepare(p));
    },

    async create(p: AaveBorrowParams): Promise<L1InteropHandle<WriteContractParameters>> {
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

      // Create the operations array
      const operations: L1InteropOperation[] = [];

      // Check if the asset is ETH
      const isETH = p.asset === 'ETH' || assetAddress.toLowerCase() === AAVE_ASSETS.ETH.toLowerCase();

      if (isETH) {
        // For ETH: use WethGateway.borrowETH
        // IWrappedTokenGatewayV3.borrowETH(pool, amount, interestRateMode, referralCode)
        const borrowETHData = encodeFunctionData({
          abi: IWrappedTokenGatewayV3ABI,
          functionName: 'borrowETH',
          args: [aaveAddresses.pool, p.amount, BigInt(p.interestRateMode), 0],
        });

        operations.push({
          type: 'call',
          target: aaveAddresses.wethGateway,
          value: 0n,
          data: borrowETHData,
        });
      } else {
        // For ERC20 tokens: use Pool.borrow
        // IPool.borrow(asset, amount, interestRateMode, referralCode, onBehalfOf)
        const borrowData = encodeFunctionData({
          abi: IPoolABI,
          functionName: 'borrow',
          args: [assetAddress, p.amount, BigInt(p.interestRateMode), 0, shadowAccount],
        });

        operations.push({
          type: 'call',
          target: aaveAddresses.pool,
          value: 0n,
          data: borrowData,
        });
      }

      // If bridgeBack is true (default), add bridge operations
      if (p.bridgeBack !== false) {
        const recipient = typeof p.bridgeBack === 'object' ? p.bridgeBack.recipient ?? sender : sender;

        // Build IERC20.approve calldata for bridging
        const approveData = encodeFunctionData({
          abi: IERC20ABI,
          functionName: 'approve',
          args: [aaveAddresses.l1NativeTokenVault, p.amount],
        });

        // Get L2 chain ID
        const l2ChainId = await client.l2.getChainId();

        // Bridge parameters
        const l2GasLimit = BigInt(5_000_000);
        const l2GasPerPubdataByteLimit = BigInt(800);

        // Calculate mintValue for L2 gas dynamically using Bridgehub
        const mintValue = await calculateBridgeBackGas(client, {
          chainId: BigInt(l2ChainId),
          bridgehubAddress: aaveAddresses.bridgehub,
          l2GasLimit,
          l2GasPerPubdataByteLimit,
        });

        // Encode bridge data
        const ghoTokenAssetId = DataEncoding.encodeNTVAssetId(
          BigInt(sepolia.id),
          aaveAddresses.ghoToken
        );

        const inner = DataEncoding.encodeBridgeBurnData(p.amount, recipient, aaveAddresses.ghoToken);

        const secondBridgeCalldata = DataEncoding.encodeAssetRouterBridgehubDepositData(
          ghoTokenAssetId,
          inner
        );

        // Build Bridgehub.requestL2TransactionTwoBridges calldata
        const bridgeData = encodeFunctionData({
          abi: IBridgehubABI,
          functionName: 'requestL2TransactionTwoBridges',
          args: [
            {
              chainId: BigInt(l2ChainId),
              mintValue,
              l2Value: BigInt(0),
              l2GasLimit,
              l2GasPerPubdataByteLimit,
              refundRecipient: sender,
              secondBridgeAddress: aaveAddresses.l1AssetRouter,
              secondBridgeValue: BigInt(0),
              secondBridgeCalldata,
            },
          ],
        });

        // Add approve and bridge operations
        operations.push(
          {
            type: 'call',
            target: aaveAddresses.ghoToken,
            value: BigInt(0),
            data: approveData,
          },
          {
            type: 'call',
            target: aaveAddresses.bridgehub,
            value: mintValue,
            data: bridgeData,
          }
        );
      }

      // Build L1InteropParams
      const l1InteropParams: L1InteropParams = {
        sender,
        operations,
      };

      // Use the core L1Interop resource to execute the operation
      return await core.create(l1InteropParams);
    },

    tryCreate(p: AaveBorrowParams): Promise<Result<L1InteropHandle<WriteContractParameters>>> {
      return toResult(() => this.create(p));
    },
  };
}
