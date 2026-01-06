// src/adapters/viem/resources/l1-interop/shadow-account/utils.ts

import type { ViemClient } from '../../../client';
import type { Address } from '../../../../../core/types/primitives';
import { L2InteropCenterABI } from '../../../../../core/internal/abi-registry';
import { getL1InteropAddresses } from '../../../../../core/constants/l1-interop-addresses';

// Cache for shadow account addresses
const shadowAccountCache = new Map<string, Address>();

/**
 * Get the L2InteropCenter contract address for the current chain
 */
async function getL2InteropCenterAddress(client: ViemClient): Promise<Address> {
  const chainId = await client.l2.getChainId();
  const addresses = getL1InteropAddresses(chainId);
  return addresses.l2InteropCenter;
}

/**
 * Get the ShadowAccount address for a given L2 user
 * This reads from the L2InteropCenter contract
 */
export async function getShadowAccountAddress(
  client: ViemClient,
  l2Owner: Address
): Promise<Address> {
  // Check cache first
  const cacheKey = `${await client.l2.getChainId()}-${l2Owner}`;
  const cached = shadowAccountCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Read from L2InteropCenter contract
  const l2InteropCenterAddress = await getL2InteropCenterAddress(client);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const shadowAccount = (await client.l2.readContract({
    address: l2InteropCenterAddress,
    abi: L2InteropCenterABI,
    functionName: 'l1ShadowAccount',
    args: [l2Owner],
  })) as Address;

  // Cache the result
  shadowAccountCache.set(cacheKey, shadowAccount);

  return shadowAccount;
}

/**
 * Check if a ShadowAccount is deployed on L1
 */
export async function isShadowAccountDeployed(
  client: ViemClient,
  l2Owner: Address
): Promise<boolean> {
  const shadowAccount = await getShadowAccountAddress(client, l2Owner);

  // Check if contract is deployed at the address
  const code = await client.l1.getBytecode({ address: shadowAccount });

  return code !== undefined && code !== '0x';
}

/**
 * Clear the shadow account cache
 */
export function clearShadowAccountCache(): void {
  shadowAccountCache.clear();
}

/**
 * Cache a shadow account address
 */
export function cacheShadowAccount(chainId: bigint, l2Owner: Address, shadowAccount: Address): void {
  const cacheKey = `${chainId}-${l2Owner}`;
  shadowAccountCache.set(cacheKey, shadowAccount);
}
