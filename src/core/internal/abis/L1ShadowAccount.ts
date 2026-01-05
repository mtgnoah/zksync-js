// src/core/internal/abis/L1ShadowAccount.ts

const L1ShadowAccountABI = [
  {
    type: 'constructor',
    inputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'executeFromIH',
    inputs: [
      { name: 'target', type: 'address', internalType: 'address' },
      { name: 'value', type: 'uint256', internalType: 'uint256' },
      { name: 'data', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'l1InteropHandlerAddress',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'receive',
    stateMutability: 'payable',
  },
  {
    type: 'error',
    name: 'CallFailed',
    inputs: [],
  },
] as const;

export default L1ShadowAccountABI;
export type L1ShadowAccountABI = typeof L1ShadowAccountABI;
