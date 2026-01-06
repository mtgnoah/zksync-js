// examples/aave/constants.ts
// Aave contract addresses and ABIs for L1 interop examples

import type { Address } from 'viem';

// =============================================================================
// Aave V3 Addresses
// =============================================================================

export interface AaveAddresses {
  pool: Address;
  wethGateway: Address;
  aToken: Address; // aWETH
  ghoToken: Address;
  l1AssetRouter: Address;
  l1NativeTokenVault: Address;
  bridgehub: Address;
}

// Sepolia Testnet
export const SEPOLIA_AAVE_ADDRESSES: AaveAddresses = {
  pool: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951' as Address,
  wethGateway: '0x387d311e47e80b498169e6fb51d3193167d89F7D' as Address,
  aToken: '0x5b071b590a59395fE4025A0Ccc1FcC931AAc1830' as Address, // aWETH Sepolia
  ghoToken: '0xc4bF5CbDaBE595361438F8c6a187bDc330539c60' as Address,
  l1AssetRouter: '0x0000000000000000000000000000000000000000' as Address, // TODO: Add actual address
  l1NativeTokenVault: '0x0000000000000000000000000000000000000000' as Address, // TODO: Add actual address
  bridgehub: '0x0000000000000000000000000000000000000000' as Address, // TODO: Add actual address
};

// Ethereum Mainnet
export const MAINNET_AAVE_ADDRESSES: AaveAddresses = {
  pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2' as Address,
  wethGateway: '0xD322A49006FC828F9B5B37Ab215F99B4E5caB19C' as Address,
  aToken: '0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8' as Address, // aWETH Mainnet
  ghoToken: '0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f' as Address,
  l1AssetRouter: '0x0000000000000000000000000000000000000000' as Address, // TODO: Add actual address
  l1NativeTokenVault: '0x0000000000000000000000000000000000000000' as Address, // TODO: Add actual address
  bridgehub: '0x0000000000000000000000000000000000000000' as Address, // TODO: Add actual address
};

/**
 * Get Aave addresses for a chain
 */
export function getAaveAddresses(chainId: number): AaveAddresses {
  switch (chainId) {
    case 1:
      return MAINNET_AAVE_ADDRESSES;
    case 11155111:
      return SEPOLIA_AAVE_ADDRESSES;
    default:
      throw new Error(`Unsupported chain ID for Aave: ${chainId}`);
  }
}

// =============================================================================
// Known Asset Addresses (Sepolia)
// =============================================================================

export const AAVE_ASSETS = {
  ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Address,
  WETH: '0xC558DBdd856501FCd9aaF1E62eae57A9F0629a3c' as Address, // Sepolia WETH
  USDC: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8' as Address, // Sepolia USDC
  DAI: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357' as Address, // Sepolia DAI
  GHO: '0xc4bF5CbDaBE595361438F8c6a187bDc330539c60' as Address, // Sepolia GHO
} as const;

export type AaveAssetSymbol = keyof typeof AAVE_ASSETS;

/**
 * Resolve asset symbol to address
 */
export function resolveAaveAsset(asset: AaveAssetSymbol | Address): Address {
  if (asset.startsWith('0x')) {
    return asset as Address;
  }
  const address = AAVE_ASSETS[asset as AaveAssetSymbol];
  if (!address) {
    throw new Error(`Unknown Aave asset: ${asset}`);
  }
  return address;
}

// =============================================================================
// Aave Interest Rate Modes
// =============================================================================

export const INTEREST_RATE_MODE = {
  NONE: 0,
  STABLE: 1,
  VARIABLE: 2,
} as const;

export type InterestRateMode = (typeof INTEREST_RATE_MODE)[keyof typeof INTEREST_RATE_MODE];

// =============================================================================
// ABIs (minimal for examples)
// =============================================================================

export const AAVE_POOL_ABI = [
  {
    type: 'function',
    name: 'supply',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'borrow',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'referralCode', type: 'uint16' },
      { name: 'onBehalfOf', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'repay',
    inputs: [
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;

export const WETH_GATEWAY_ABI = [
  {
    type: 'function',
    name: 'depositETH',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'onBehalfOf', type: 'address' },
      { name: 'referralCode', type: 'uint16' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'withdrawETH',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'borrowETH',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'interestRateMode', type: 'uint256' },
      { name: 'referralCode', type: 'uint16' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'repayETH',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'rateMode', type: 'uint256' },
      { name: 'onBehalfOf', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const;

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;
