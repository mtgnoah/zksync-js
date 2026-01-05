// src/adapters/viem/resources/l1-interop/plugins/aave/index.ts

import type { WriteContractParameters } from 'viem';
import type { ViemClient } from '../../../../client';
import type { Address, Hex } from '../../../../../../core/types/primitives';
import type {
  L1InteropQuote,
  L1InteropHandle,
  L1InteropPlan,
} from '../../../../../../core/types/flows/l1-interop';
import type {
  AaveAsset,
  AaveDepositParams,
  AaveBorrowParams,
  AaveWithdrawParams,
  AaveRepayParams,
  AavePositionInfo,
  AaveUserAccountData,
  AaveInterestRateMode,
} from '../../../../../../core/types/flows/aave';

import { AAVE_ASSETS, resolveAaveAsset } from './assets';
import { createAaveDepositResource } from './deposit';
import { createAaveBorrowResource } from './borrow';
import { createAaveWithdrawResource } from './withdraw';
import { createAaveRepayResource } from './repay';
import { createAaveQueryResource } from './query';
import type { L1CoreResource } from '../../core';

/** Result type for try* methods */
export type Result<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** === Aave Operation Resources === */

export interface AaveDepositResource {
  quote(p: AaveDepositParams): Promise<L1InteropQuote>;
  tryQuote(p: AaveDepositParams): Promise<Result<L1InteropQuote>>;

  prepare(p: AaveDepositParams): Promise<L1InteropPlan<WriteContractParameters>>;
  tryPrepare(p: AaveDepositParams): Promise<Result<L1InteropPlan<WriteContractParameters>>>;

  create(p: AaveDepositParams): Promise<L1InteropHandle<WriteContractParameters>>;
  tryCreate(p: AaveDepositParams): Promise<Result<L1InteropHandle<WriteContractParameters>>>;
}

export interface AaveBorrowResource {
  quote(p: AaveBorrowParams): Promise<L1InteropQuote>;
  tryQuote(p: AaveBorrowParams): Promise<Result<L1InteropQuote>>;

  prepare(p: AaveBorrowParams): Promise<L1InteropPlan<WriteContractParameters>>;
  tryPrepare(p: AaveBorrowParams): Promise<Result<L1InteropPlan<WriteContractParameters>>>;

  create(p: AaveBorrowParams): Promise<L1InteropHandle<WriteContractParameters>>;
  tryCreate(p: AaveBorrowParams): Promise<Result<L1InteropHandle<WriteContractParameters>>>;
}

export interface AaveWithdrawResource {
  quote(p: AaveWithdrawParams): Promise<L1InteropQuote>;
  tryQuote(p: AaveWithdrawParams): Promise<Result<L1InteropQuote>>;

  prepare(p: AaveWithdrawParams): Promise<L1InteropPlan<WriteContractParameters>>;
  tryPrepare(p: AaveWithdrawParams): Promise<Result<L1InteropPlan<WriteContractParameters>>>;

  create(p: AaveWithdrawParams): Promise<L1InteropHandle<WriteContractParameters>>;
  tryCreate(p: AaveWithdrawParams): Promise<Result<L1InteropHandle<WriteContractParameters>>>;
}

export interface AaveRepayResource {
  quote(p: AaveRepayParams): Promise<L1InteropQuote>;
  tryQuote(p: AaveRepayParams): Promise<Result<L1InteropQuote>>;

  prepare(p: AaveRepayParams): Promise<L1InteropPlan<WriteContractParameters>>;
  tryPrepare(p: AaveRepayParams): Promise<Result<L1InteropPlan<WriteContractParameters>>>;

  create(p: AaveRepayParams): Promise<L1InteropHandle<WriteContractParameters>>;
  tryCreate(p: AaveRepayParams): Promise<Result<L1InteropHandle<WriteContractParameters>>>;
}

export interface AaveQueryResource {
  /** Get user's Aave position on L1 */
  getPosition(user: Address): Promise<AavePositionInfo>;

  /** Get health factor */
  getHealthFactor(user: Address): Promise<bigint>;

  /** Get user account data */
  getUserAccountData(user: Address): Promise<AaveUserAccountData>;

  /** Check if asset is supported */
  isAssetSupported(asset: AaveAsset): Promise<boolean>;

  /** Get current supply APY */
  getSupplyAPY(asset: AaveAsset): Promise<bigint>;

  /** Get current borrow APY */
  getBorrowAPY(asset: AaveAsset, rateMode: AaveInterestRateMode): Promise<bigint>;
}

/** === Main Aave Resource Interface === */
export interface AaveResource {
  /** Deposit operations */
  deposit: AaveDepositResource;

  /** Borrow operations */
  borrow: AaveBorrowResource;

  /** Withdraw operations */
  withdraw: AaveWithdrawResource;

  /** Repay operations */
  repay: AaveRepayResource;

  /** Query utilities */
  query: AaveQueryResource;

  /** Asset configuration */
  assets: typeof AAVE_ASSETS & {
    /** Resolve asset to address */
    resolve(asset: AaveAsset): Address;
  };
}

/** === Resource Factory === */
export function createAaveResource(client: ViemClient, core: L1CoreResource): AaveResource {
  return {
    deposit: createAaveDepositResource(client, core),
    borrow: createAaveBorrowResource(client, core),
    withdraw: createAaveWithdrawResource(client, core),
    repay: createAaveRepayResource(client, core),
    query: createAaveQueryResource(client),

    assets: {
      ...AAVE_ASSETS,
      resolve: resolveAaveAsset,
    },
  };
}
