// src/adapters/viem/resources/l1-interop/plugins/aave/query.ts

import type { ViemClient } from '../../../../client';
import type { Address } from '../../../../../../core/types/primitives';
import type {
  AaveAsset,
  AavePositionInfo,
  AaveUserAccountData,
  AaveInterestRateMode,
} from '../../../../../../core/types/flows/aave';
import type { AaveQueryResource } from './index';
import { IPoolABI } from '../../../../../../core/internal/abi-registry';
import { getAaveAddresses } from '../../../../../../core/constants/aave-addresses';
import { getShadowAccountAddress } from '../../shadow-account/utils';

export function createAaveQueryResource(client: ViemClient): AaveQueryResource {
  return {
    async getPosition(user: Address): Promise<AavePositionInfo> {
      // Get shadow account for this user
      const shadowAccount = await getShadowAccountAddress(client, user);

      // Get Aave addresses for L1
      const l1ChainId = await client.l1.getChainId();
      const aaveAddresses = getAaveAddresses(Number(l1ChainId));

      // Query getUserAccountData from Aave Pool
      const accountData = await client.l1.readContract({
        address: aaveAddresses.pool,
        abi: IPoolABI,
        functionName: 'getUserAccountData',
        args: [shadowAccount],
      });

      if (!Array.isArray(accountData) || accountData.length < 6) {
        throw new Error('Invalid account data returned from Aave');
      }

      const [
        totalCollateralBase,
        totalDebtBase,
        availableBorrowsBase,
        currentLiquidationThreshold,
        ltv,
        healthFactor,
      ] = accountData as [bigint, bigint, bigint, bigint, bigint, bigint];

      return {
        totalCollateralBase,
        totalDebtBase,
        availableBorrowsBase,
        currentLiquidationThreshold,
        ltv,
        healthFactor,
      };
    },

    async getHealthFactor(user: Address): Promise<bigint> {
      const position = await this.getPosition(user);
      return position.healthFactor;
    },

    async getUserAccountData(user: Address): Promise<AaveUserAccountData> {
      const shadowAccount = await getShadowAccountAddress(client, user);
      const l1ChainId = await client.l1.getChainId();
      const aaveAddresses = getAaveAddresses(Number(l1ChainId));

      const accountData = await client.l1.readContract({
        address: aaveAddresses.pool,
        abi: IPoolABI,
        functionName: 'getUserAccountData',
        args: [shadowAccount],
      });

      if (!Array.isArray(accountData) || accountData.length < 6) {
        throw new Error('Invalid account data returned from Aave');
      }

      return {
        totalCollateralBase: accountData[0],
        totalDebtBase: accountData[1],
        availableBorrowsBase: accountData[2],
        currentLiquidationThreshold: accountData[3],
        ltv: accountData[4],
        healthFactor: accountData[5],
      };
    },

    async isAssetSupported(asset: AaveAsset): Promise<boolean> {
      // Simplified implementation - assume supported
      // TODO: Query Aave Protocol Data Provider for actual check
      return true;
    },

    async getSupplyAPY(asset: AaveAsset): Promise<bigint> {
      // TODO: Implement supply APY query by reading reserve data
      // For now, return 0
      return BigInt(0);
    },

    async getBorrowAPY(asset: AaveAsset, rateMode: AaveInterestRateMode): Promise<bigint> {
      // TODO: Implement borrow APY query by reading reserve data
      // For now, return 0
      return BigInt(0);
    },
  };
}
