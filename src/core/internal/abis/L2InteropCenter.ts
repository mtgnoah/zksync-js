// src/core/internal/abis/L2InteropCenter.ts

const L2InteropCenterABI = [
  {
    type: 'constructor',
    inputs: [{ name: '_l1InteropHandlerAddress', type: 'address', internalType: 'address' }],
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
    type: 'function',
    name: 'l1ShadowAccount',
    inputs: [{ name: '_l2CallerAddress', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'sendBundleToL1',
    inputs: [
      {
        name: 'shadowAccountOps',
        type: 'tuple[]',
        internalType: 'struct ShadowAccountOp[]',
        components: [
          { name: 'target', type: 'address', internalType: 'address' },
          { name: 'value', type: 'uint256', internalType: 'uint256' },
          { name: 'data', type: 'bytes', internalType: 'bytes' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'shadowAccountBytecodeHash',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'error',
    name: 'SendBundleToL1Failed',
    inputs: [],
  },
] as const;

export default L2InteropCenterABI;
export type L2InteropCenterABI = typeof L2InteropCenterABI;
