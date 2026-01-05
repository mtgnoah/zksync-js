// src/core/constants/l1-interop-addresses.ts

import type { Address } from '../types/primitives';

/**
 * L1 Interop contract addresses
 * These should be configured based on the network (mainnet/testnet)
 */
export interface L1InteropAddresses {
  l2InteropCenter: Address;
  l1InteropHandler: Address;
}

/**
 * Default addresses for ZKsync Era Testnet
 * TODO: Replace with actual deployed addresses
 */
export const ZKSYNC_TESTNET_L1_INTEROP_ADDRESSES: L1InteropAddresses = {
  l2InteropCenter: '0x0000000000000000000000000000000000000000' as Address, // TODO: Set actual address
  l1InteropHandler: '0x0000000000000000000000000000000000000000' as Address, // TODO: Set actual address
};

/**
 * Default addresses for ZKsync Era Mainnet
 * TODO: Replace with actual deployed addresses
 */
export const ZKSYNC_MAINNET_L1_INTEROP_ADDRESSES: L1InteropAddresses = {
  l2InteropCenter: '0x0000000000000000000000000000000000000000' as Address, // TODO: Set actual address
  l1InteropHandler: '0x0000000000000000000000000000000000000000' as Address, // TODO: Set actual address
};

/**
 * Get L1 Interop addresses for a given chain ID
 */
export function getL1InteropAddresses(chainId: number): L1InteropAddresses {
  // ZKsync Era Mainnet
  if (chainId === 324) {
    return ZKSYNC_MAINNET_L1_INTEROP_ADDRESSES;
  }

  // ZKsync Era Testnet (Sepolia)
  if (chainId === 300) {
    return ZKSYNC_TESTNET_L1_INTEROP_ADDRESSES;
  }

  // Default to testnet for unknown chains
  console.warn(`Unknown chain ID ${chainId}, using testnet addresses`);
  return ZKSYNC_TESTNET_L1_INTEROP_ADDRESSES;
}
