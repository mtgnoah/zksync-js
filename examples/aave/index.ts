// examples/aave/index.ts
// Aave L1 Interop examples - reference implementations

export { aaveDeposit, aaveDepositQuote, type AaveDepositParams } from './deposit';
export { aaveBorrow, aaveBorrowQuote, type AaveBorrowParams, INTEREST_RATE_MODE } from './borrow';
export { aaveWithdraw, aaveWithdrawQuote, type AaveWithdrawParams } from './withdraw';
export { aaveRepay, aaveRepayQuote, type AaveRepayParams } from './repay';

export {
  getAaveAddresses,
  resolveAaveAsset,
  AAVE_ASSETS,
  AAVE_POOL_ABI,
  WETH_GATEWAY_ABI,
  ERC20_ABI,
  SEPOLIA_AAVE_ADDRESSES,
  MAINNET_AAVE_ADDRESSES,
  type AaveAddresses,
  type AaveAssetSymbol,
  type InterestRateMode,
} from './constants';
