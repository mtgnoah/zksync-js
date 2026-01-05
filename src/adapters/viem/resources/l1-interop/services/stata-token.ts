// src/adapters/viem/resources/l1-interop/services/stata-token.ts

import type { ViemClient } from '../../../client';
import type { Address, Hex } from '../../../../../core/types/primitives';
import type { L1InteropOperation } from '../../../../../core/types/flows/l1-interop';
import { encodeFunctionData } from 'viem';
import { IERC20ABI } from '../../../../../core/internal/abi-registry';

/**
 * StataToken Factory contract interface (simplified)
 * Used to wrap rebasing aTokens into non-rebasing StataTokens for bridging
 */
const StataTokenFactoryABI = [
  {
    type: 'function',
    name: 'getStataToken',
    inputs: [{ name: 'underlying', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'createStataToken',
    inputs: [{ name: 'underlying', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'nonpayable',
  },
] as const;

/**
 * StataToken contract interface (simplified)
 */
const StataTokenABI = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'redeem',
    inputs: [
      { name: 'shares', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;

/**
 * StataToken Factory address on Ethereum Sepolia
 * TODO: Update with actual deployed address
 */
const STATA_TOKEN_FACTORY_ADDRESS: Address = '0x0000000000000000000000000000000000000000' as Address;

/**
 * Check if a token is a rebasing aToken
 * Rebasing aTokens continuously accrue interest, making their balance change over time
 * This makes them incompatible with standard bridges
 */
export async function isRebasingToken(client: ViemClient, token: Address): Promise<boolean> {
  // Simplified check: assume all aTokens are rebasing except StataTokens
  // In a real implementation, query Aave ProtocolDataProvider
  // to check if the token is an aToken
  
  // TODO: Implement actual check
  // const dataProvider = getAaveDataProvider();
  // const tokenData = await client.l1.readContract({
  //   address: dataProvider,
  //   abi: ProtocolDataProviderABI,
  //   functionName: 'getReserveTokensAddresses',
  //   args: [underlyingAsset],
  // });
  // return tokenData.aTokenAddress === token;

  return false; // For now, assume no rebasing
}

/**
 * Get the StataToken address for a given aToken
 * If no StataToken exists, returns null
 */
export async function getStataTokenAddress(
  client: ViemClient,
  aToken: Address
): Promise<Address | null> {
  try {
    const stataToken = await client.l1.readContract({
      address: STATA_TOKEN_FACTORY_ADDRESS,
      abi: StataTokenFactoryABI,
      functionName: 'getStataToken',
      args: [aToken],
    });

    const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;
    return stataToken === zeroAddress ? null : (stataToken as Address);
  } catch (error) {
    return null;
  }
}

/**
 * Build operations to wrap aTokens into StataTokens
 * Returns array of operations: approve + deposit
 */
export async function buildWrapOperations(
  client: ViemClient,
  aToken: Address,
  amount: bigint,
  receiver: Address
): Promise<L1InteropOperation[]> {
  // Get StataToken address (or create if doesn't exist)
  let stataToken = await getStataTokenAddress(client, aToken);

  if (!stataToken) {
    // In real implementation, would need to create StataToken first
    // For now, assume it exists
    throw new Error(`No StataToken found for aToken ${aToken}`);
  }

  const operations: L1InteropOperation[] = [];

  // 1. Approve StataToken to spend aTokens
  const approveData = encodeFunctionData({
    abi: IERC20ABI,
    functionName: 'approve',
    args: [stataToken, amount],
  });

  operations.push({
    type: 'call',
    target: aToken,
    value: BigInt(0),
    data: approveData,
  });

  // 2. Deposit aTokens to get StataTokens
  const depositData = encodeFunctionData({
    abi: StataTokenABI,
    functionName: 'deposit',
    args: [amount, receiver],
  });

  operations.push({
    type: 'call',
    target: stataToken,
    value: BigInt(0),
    data: depositData,
  });

  return operations;
}

/**
 * Build operations to unwrap StataTokens back to aTokens
 * Returns array of operations: redeem
 */
export async function buildUnwrapOperations(
  client: ViemClient,
  stataToken: Address,
  amount: bigint,
  receiver: Address,
  owner: Address
): Promise<L1InteropOperation[]> {
  const redeemData = encodeFunctionData({
    abi: StataTokenABI,
    functionName: 'redeem',
    args: [amount, receiver, owner],
  });

  return [
    {
      type: 'call',
      target: stataToken,
      value: BigInt(0),
      data: redeemData,
    },
  ];
}
