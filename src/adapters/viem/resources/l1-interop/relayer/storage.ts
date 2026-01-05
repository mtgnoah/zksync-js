// src/adapters/viem/resources/l1-interop/relayer/storage.ts

import type { Hex } from '../../../../../core/types/primitives';
import type { L1InteropOperation } from '../../../../../core/types/flows/l1-interop';

/**
 * Stored bundle data for recovery
 */
export interface StoredBundle {
  /** Bundle operations */
  operations: L1InteropOperation[];
  /** Timestamp when bundle was created */
  timestamp: number;
  /** Number of retry attempts */
  attempts: number;
  /** L2 withdrawal transaction hash */
  l2WithdrawalTxHash: Hex;
  /** L2 bundle transaction hash */
  l2BundleTxHash?: Hex;
  /** Relayer tracking ID */
  relayerTrackingId?: string;
}

/**
 * Store bundle data for recovery
 */
export function storeBundle(hash: Hex, bundle: StoredBundle): void {
  if (typeof localStorage === 'undefined') {
    // Not in browser environment
    return;
  }

  try {
    const key = `l1-interop-bundle-${hash}`;
    localStorage.setItem(key, JSON.stringify(bundle));
  } catch (error) {
    console.warn('Failed to store bundle:', error);
  }
}

/**
 * Retrieve stored bundle data
 */
export function retrieveBundle(hash: Hex): StoredBundle | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const key = `l1-interop-bundle-${hash}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Failed to retrieve bundle:', error);
    return null;
  }
}

/**
 * Remove stored bundle data
 */
export function removeBundle(hash: Hex): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    const key = `l1-interop-bundle-${hash}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to remove bundle:', error);
  }
}

/**
 * List all stored bundles
 */
export function listStoredBundles(): Array<{ hash: Hex; bundle: StoredBundle }> {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  const bundles: Array<{ hash: Hex; bundle: StoredBundle }> = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('l1-interop-bundle-')) {
        const hash = key.replace('l1-interop-bundle-', '') as Hex;
        const stored = localStorage.getItem(key);
        if (stored) {
          bundles.push({ hash, bundle: JSON.parse(stored) });
        }
      }
    }
  } catch (error) {
    console.warn('Failed to list bundles:', error);
  }

  return bundles;
}
