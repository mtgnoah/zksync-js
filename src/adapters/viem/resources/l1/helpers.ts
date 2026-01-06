// src/adapters/viem/resources/l1/helpers.ts

import type { Address } from '../../../../core/types/primitives';
import type { L1CallParams, L1Helpers } from './types';
import { IERC20ABI } from '../../../../core/internal/abi-registry';

/**
 * Create L1 helpers for common operations
 */
export function createL1Helpers(): L1Helpers {
  return {
    erc20: {
      approve(token: Address, spender: Address, amount: bigint): L1CallParams {
        return {
          target: token,
          abi: IERC20ABI,
          functionName: 'approve',
          args: [spender, amount],
        };
      },

      transfer(token: Address, to: Address, amount: bigint): L1CallParams {
        return {
          target: token,
          abi: IERC20ABI,
          functionName: 'transfer',
          args: [to, amount],
        };
      },

      transferFrom(token: Address, from: Address, to: Address, amount: bigint): L1CallParams {
        return {
          target: token,
          abi: IERC20ABI,
          functionName: 'transferFrom',
          args: [from, to, amount],
        };
      },
    },
  };
}
