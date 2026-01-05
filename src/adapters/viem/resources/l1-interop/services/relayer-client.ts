// src/adapters/viem/resources/l1-interop/services/relayer-client.ts
// Simple stub that references the external relayer client package

import type { Address, Hex } from '../../../../../core/types/primitives';
import type { L1InteropOperation } from '../../../../../core/types/flows/l1-interop';

/**
 * Relayer registration parameters
 */
export interface RelayerRegistrationParams {
  l2WithdrawalTxHash: Hex;
  l2BundleTxHash: Hex;
  shadowAccount: Address;
  operations: readonly L1InteropOperation[];
}

/**
 * Relayer registration response
 */
export interface RelayerRegistrationResponse {
  trackingId: string;
  success: boolean;
  error?: string;
}

/**
 * Simple relayer client
 * TODO: Replace with @zksync/l1-interop-relayer-client package
 */
export class RelayerClient {
  constructor(private relayerUrl: string) {}

  async registerOperation(params: RelayerRegistrationParams): Promise<RelayerRegistrationResponse> {
    try {
      const response = await fetch(`${this.relayerUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          trackingId: '',
          success: false,
          error: `Registration failed: ${error}`,
        };
      }

      const data = await response.json();
      return {
        trackingId: data.trackingId,
        success: true,
      };
    } catch (error) {
      return {
        trackingId: '',
        success: false,
        error: `Failed to connect to relayer: ${error}`,
      };
    }
  }
}
