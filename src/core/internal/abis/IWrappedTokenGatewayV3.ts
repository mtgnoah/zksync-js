// src/core/internal/abis/IWrappedTokenGatewayV3.ts
// Aave V3 Wrapped Token Gateway interface ABI

/**
 * Aave V3 IWrappedTokenGatewayV3 contract ABI
 * Handles ETH deposits/withdrawals by wrapping to WETH
 */
const IWrappedTokenGatewayV3ABI = [
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

export default IWrappedTokenGatewayV3ABI;
