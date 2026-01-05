// src/adapters/viem/resources/l1-interop/plugins/aave/assets.ts

import type { Address } from '../../../../../../core/types/primitives';
import type { AaveAsset } from '../../../../../../core/types/flows/aave';

/**
 * Aave V3 asset addresses on Ethereum Mainnet
 * TODO: Update these with actual mainnet addresses
 */
export const AAVE_ASSETS = {
  // Native ETH (for deposits, will be wrapped automatically)
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Address,

  // Wrapped ETH
  WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address,

  // Stablecoins
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Address,
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as Address,

  // Wrapped Bitcoin
  WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' as Address,

  // GHO (Aave's stablecoin)
  GHO: '0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f' as Address,

  // DeFi tokens
  LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA' as Address,
  AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9' as Address,
  CRV: '0xD533a949740bb3306d119CC777fa900bA034cd52' as Address,
  LDO: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32' as Address,
} as const;

/**
 * Aave V3 Pool address on Ethereum Mainnet
 * TODO: Update with actual address
 */
export const AAVE_POOL_ADDRESS = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2' as Address;

/**
 * Aave V3 Wrapped Token Gateway (for ETH deposits)
 * TODO: Update with actual address
 */
export const AAVE_WETH_GATEWAY_ADDRESS = '0xD322A49006FC828F9B5B37Ab215F99B4E5caB19C' as Address;

/**
 * StataToken Factory address
 * TODO: Update with actual address
 */
export const STATA_TOKEN_FACTORY_ADDRESS = '0x' as Address; // Placeholder

/**
 * Resolve an Aave asset to its contract address
 */
export function resolveAaveAsset(asset: AaveAsset): Address {
  // If it's already an address, return it
  if (asset.startsWith('0x')) {
    return asset as Address;
  }

  // Otherwise, look it up in our known assets
  const knownAsset = AAVE_ASSETS[asset as keyof typeof AAVE_ASSETS];
  if (!knownAsset) {
    throw new Error(`Unknown Aave asset: ${asset}`);
  }

  return knownAsset;
}

/**
 * Check if an asset is a known Aave asset
 */
export function isKnownAaveAsset(asset: string): asset is keyof typeof AAVE_ASSETS {
  return asset in AAVE_ASSETS;
}

/**
 * Get the aToken address for a given asset
 * TODO: Implement proper lookup via Aave protocol data provider
 */
export async function getATokenAddress(asset: Address): Promise<Address> {
  // This should query the Aave Protocol Data Provider contract
  // For now, throw an error
  throw new Error('Not implemented: getATokenAddress');
}

/**
 * Get the debt token address for a given asset and rate mode
 * TODO: Implement proper lookup via Aave protocol data provider
 */
export async function getDebtTokenAddress(
  asset: Address,
  rateMode: 1 | 2
): Promise<Address> {
  // This should query the Aave Protocol Data Provider contract
  // rateMode 1 = stable debt token, 2 = variable debt token
  throw new Error('Not implemented: getDebtTokenAddress');
}

/**
 * Check if a token is a rebasing token (aToken)
 * Rebasing tokens need to be wrapped in StataTokens before bridging
 */
export function isRebasingToken(token: Address): boolean {
  // In production, this would check if the token is an aToken
  // aTokens are rebasing and need to be wrapped
  // For now, we'll use a simple heuristic
  const lowerToken = token.toLowerCase();

  // aTokens typically start with 'a' (but this is not reliable)
  // TODO: Implement proper aToken detection via Aave contracts
  return false; // Placeholder
}
