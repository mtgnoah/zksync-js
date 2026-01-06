// src/adapters/viem/resources/l1-interop/index.ts

import type { ViemClient } from '../../client';
import type { Address, Hex } from '../../../../core/types/primitives';
import type { L1InteropParams } from '../../../../core/types/flows/l1-interop';

import { createL1CoreResource, type L1CoreResource } from './core';
import { getShadowAccountAddress, isShadowAccountDeployed } from './shadow-account/utils';

/**
 * Minimal withdrawals resource interface for L1 Interop
 * The full withdrawals resource is passed from the SDK
 */
export interface WithdrawalsResourceForInterop {
  create(params: { token: Address; amount: bigint; to: Address }): Promise<{ l2TxHash?: string }>;
}

/** === Main L1 Interop Resource Interface === */
export interface L1InteropResource {
  /** Core generic L1 execution */
  core: L1CoreResource;

  /** Shared utilities */
  utils: {
    /** Get ShadowAccount address for a user */
    getShadowAccount(user: Address): Promise<Address>;

    /** Check if ShadowAccount is deployed */
    isShadowAccountDeployed(user: Address): Promise<boolean>;

    /** Deploy ShadowAccount explicitly */
    deployShadowAccount(params: { recoveryAddress?: Address }): Promise<Hex>;

    /** Estimate total gas cost for an operation */
    estimateGas(params: L1InteropParams): Promise<bigint>;
  };
}

/** === Core Resource (Generic L1 Execution) === */
export type { L1CoreResource } from './core';

/** === Result Type === */
export type Result<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** === Resource Factory === */
export function createL1InteropResource(
  client: ViemClient,
  withdrawals?: WithdrawalsResourceForInterop
): L1InteropResource {
  const core = createL1CoreResource(client, withdrawals);

  return {
    core,

    utils: {
      async getShadowAccount(user: Address): Promise<Address> {
        return getShadowAccountAddress(client, user);
      },

      async isShadowAccountDeployed(user: Address): Promise<boolean> {
        return isShadowAccountDeployed(client, user);
      },

      // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
      async deployShadowAccount(params: { recoveryAddress?: Address }): Promise<Hex> {
        // TODO: Implement deploy logic
        throw new Error('Not implemented: deployShadowAccount');
      },

      // eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
      async estimateGas(params: L1InteropParams): Promise<bigint> {
        // TODO: Implement gas estimation
        throw new Error('Not implemented: estimateGas');
      },
    },
  };
}
