// src/core/types/flows/aave.ts

import type { Address } from '../primitives';

/** Aave asset types - either a symbol or custom address */
export type AaveAsset =
  | 'ETH'
  | 'WETH'
  | 'USDC'
  | 'USDT'
  | 'DAI'
  | 'WBTC'
  | 'GHO'
  | 'LINK'
  | 'AAVE'
  | 'CRV'
  | 'LDO'
  | Address; // Custom token address

/** Aave interest rate modes */
export type AaveInterestRateMode = 1 | 2; // 1 = Stable, 2 = Variable

/** === Deposit === */
export interface AaveDepositParams {
  /** Asset to deposit (symbol or address) */
  asset: AaveAsset;

  /** Amount to deposit (in asset units) */
  amount: bigint;

  /** Optional sender address (defaults to connected wallet) */
  sender?: Address;

  /** Account to receive aTokens (defaults to ShadowAccount) */
  onBehalfOf?: Address;

  /** Bridge aTokens back to L2? */
  bridgeBack?: {
    /** Whether to wrap in StataToken (required for rebasing tokens) */
    useStataToken?: boolean;
    /** L2 recipient (defaults to sender) */
    recipient?: Address;
  };
}

/** === Borrow === */
export interface AaveBorrowParams {
  /** Asset to borrow */
  asset: AaveAsset;

  /** Amount to borrow */
  amount: bigint;

  /** Optional sender address (defaults to connected wallet) */
  sender?: Address;

  /** Interest rate mode (1=stable, 2=variable) */
  interestRateMode: AaveInterestRateMode;

  /** Bridge borrowed tokens to L2? (default: true) */
  bridgeBack?: boolean | {
    /** L2 recipient (defaults to sender) */
    recipient?: Address;
  };
}

/** === Withdraw === */
export interface AaveWithdrawParams {
  /** Asset to withdraw */
  asset: AaveAsset;

  /** Amount to withdraw (use MaxUint256 for full balance) */
  amount: bigint;

  /** Optional sender address (defaults to connected wallet) */
  sender?: Address;

  /** Where to send withdrawn assets */
  to?: {
    /** Keep on L1 ShadowAccount or bridge to L2? */
    destination: 'l1' | 'l2';
    /** If L2, recipient address (defaults to sender) */
    recipient?: Address;
  };
}

/** === Repay === */
export interface AaveRepayParams {
  /** Asset to repay */
  asset: AaveAsset;

  /** Amount to repay (use MaxUint256 for full debt) */
  amount: bigint;

  /** Optional sender address (defaults to connected wallet) */
  sender?: Address;

  /** Interest rate mode being repaid */
  interestRateMode: AaveInterestRateMode;

  /** Account whose debt is being repaid (defaults to ShadowAccount) */
  onBehalfOf?: Address;
}

/** === Position Info === */
export interface AavePositionInfo {
  /** Total collateral in base currency (ETH) */
  totalCollateralBase: bigint;

  /** Total debt in base currency */
  totalDebtBase: bigint;

  /** Available borrow capacity in base currency */
  availableBorrowsBase: bigint;

  /** Current liquidation threshold */
  currentLiquidationThreshold: bigint;

  /** Loan to value ratio */
  ltv: bigint;

  /** Health factor (use 18 decimals) */
  healthFactor: bigint;
}

/** === User Account Data === */
export interface AaveUserAccountData {
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  availableBorrowsBase: bigint;
  currentLiquidationThreshold: bigint;
  ltv: bigint;
  healthFactor: bigint;
}
