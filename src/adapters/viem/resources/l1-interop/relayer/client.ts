// src/adapters/viem/resources/l1-interop/relayer/client.ts

import type { Address, Hex } from '../../../../../core/types/primitives';
import type { L1InteropOperation, L1InteropPhase } from '../../../../../core/types/flows/l1-interop';

/**
 * Relayer registration parameters
 */
export interface RelayerRegistrationParams {
  /** L2 withdrawal transaction hash */
  l2WithdrawalTxHash: Hex;
  /** L2 bundle submission transaction hash */
  l2BundleTxHash: Hex;
  /** ShadowAccount address on L1 */
  shadowAccount: Address;
  /** Bundle operations */
  operations: readonly L1InteropOperation[];
}

/**
 * Relayer status response
 */
export interface RelayerStatusResponse {
  /** Current phase of the operation */
  phase: L1InteropPhase;
  /** L1 finalization transaction hash (if finalized) */
  l1FinalizationTxHash?: Hex;
  /** Estimated finalization time */
  estimatedFinalizationTime?: Date;
  /** Error message if failed */
  error?: string;
}

/**
 * Relayer registration response
 */
export interface RelayerRegistrationResponse {
  /** Tracking ID for this operation */
  trackingId: string;
  /** Whether registration was successful */
  success: boolean;
  /** Error message if registration failed */
  error?: string;
}

/**
 * Relayer health status
 */
export interface RelayerHealthResponse {
  status: 'healthy' | 'unhealthy';
  message?: string;
}

/**
 * Simple relayer client for L1 finalization tracking
 */
export class RelayerClient {
  constructor(private relayerUrl: string) {}

  /**
   * Register an operation with the relayer for automatic finalization
   */
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

  /**
   * Get the current status of an operation
   */
  async getStatus(trackingId: string): Promise<RelayerStatusResponse | null> {
    try {
      const response = await fetch(`${this.relayerUrl}/status/${trackingId}`);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        phase: data.phase,
        l1FinalizationTxHash: data.l1FinalizationTxHash,
        estimatedFinalizationTime: data.estimatedFinalizationTime
          ? new Date(data.estimatedFinalizationTime)
          : undefined,
        error: data.error,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check relayer health
   */
  async health(): Promise<RelayerHealthResponse> {
    try {
      const response = await fetch(`${this.relayerUrl}/health`);

      if (!response.ok) {
        return { status: 'unhealthy', message: 'Relayer returned error' };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Failed to connect: ${error}`,
      };
    }
  }
}
