// src/core/constants/aave-addresses.ts

import type { Address } from '../types/primitives';

/**
 * Aave V3 contract addresses + ZKsync bridge addresses
 */
export interface AaveAddresses {
  /** Aave V3 Pool contract */
  pool: Address;
  /** Wrapped Token Gateway V3 (for ETH deposits/withdrawals) */
  wethGateway: Address;
  /** WETH token address */
  wethToken: Address;
  /** aWETH token address (Aave interest-bearing ETH) */
  aToken: Address;
  /** Aave Price Oracle */
  oracle: Address;
  /** GHO stablecoin address (L1) */
  ghoToken: Address;
  /** GHO token on L2 (for reference) */
  l2GhoToken: Address;
  /** L1 Native Token Vault address */
  l1NativeTokenVault: Address;
  /** Bridgehub contract address */
  bridgehub: Address;
  /** L1 Asset Router address */
  l1AssetRouter: Address;
}

/**
 * Aave V3 addresses on Ethereum Sepolia testnet
 * Source: aave-interop-demo/utils/constants.ts
 */
export const SEPOLIA_AAVE_ADDRESSES: AaveAddresses = {
  pool: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951' as Address,
  wethGateway: '0x387d311e47e80b498169e6fb51d3193167d89F7D' as Address,
  wethToken: '0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c' as Address,
  aToken: '0x5b071b590a59395fE4025A0Ccc1FcC931AAc1830' as Address,
  oracle: '0x2da88497588bf89281816106C7259e31AF45a663' as Address,
  ghoToken: '0xc4bF5CbDaBE595361438F8c6a187bDc330539c60' as Address,
  l2GhoToken: '0xcA9EBBd747D02f57d523eCaA8f9dFC4E7e4C428D' as Address,
  l1NativeTokenVault: '0xF8d4A5195737043f45F998539D5C62Eee02E3426' as Address,
  bridgehub: '0xc4FD2580C3487bba18D63f50301020132342fdbD' as Address,
  l1AssetRouter: '0xB5d9C3F41E434b91295BD7962db5c873cEcCE2be' as Address,
};

/**
 * Aave V3 addresses on Ethereum mainnet
 * TODO: Replace with actual mainnet addresses when deploying
 */
export const MAINNET_AAVE_ADDRESSES: AaveAddresses = {
  pool: '0x0000000000000000000000000000000000000000' as Address, // TODO
  wethGateway: '0x0000000000000000000000000000000000000000' as Address, // TODO
  wethToken: '0x0000000000000000000000000000000000000000' as Address, // TODO
  aToken: '0x0000000000000000000000000000000000000000' as Address, // TODO
  oracle: '0x0000000000000000000000000000000000000000' as Address, // TODO
  ghoToken: '0x0000000000000000000000000000000000000000' as Address, // TODO
  l2GhoToken: '0x0000000000000000000000000000000000000000' as Address, // TODO
  l1NativeTokenVault: '0x0000000000000000000000000000000000000000' as Address, // TODO
  bridgehub: '0x0000000000000000000000000000000000000000' as Address, // TODO
  l1AssetRouter: '0x0000000000000000000000000000000000000000' as Address, // TODO
};

/**
 * Get Aave addresses for a given L1 chain ID
 * Note: This uses L1 chain ID (e.g., 1 for mainnet, 11155111 for Sepolia)
 */
export function getAaveAddresses(l1ChainId: number): AaveAddresses {
  // Ethereum Mainnet
  if (l1ChainId === 1) {
    return MAINNET_AAVE_ADDRESSES;
  }

  // Ethereum Sepolia
  if (l1ChainId === 11155111) {
    return SEPOLIA_AAVE_ADDRESSES;
  }

  // Default to Sepolia for unknown chains
  console.warn(`Unknown L1 chain ID ${l1ChainId}, using Sepolia Aave addresses`);
  return SEPOLIA_AAVE_ADDRESSES;
}
