// src/core/internal/abis/L1InteropHandler.ts

const L1InteropHandlerABI = [
  {
    type: 'constructor',
    inputs: [{ name: '_bridgehubAddress', type: 'address', internalType: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'BRIDGE_HUB',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract IBridgehubBase' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'deployShadowAccount',
    inputs: [{ name: '_l2CallerAddress', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'l1NativeTokenVault',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract IL1NativeTokenVault' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'l2InteropCenterAddress',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'receiveInteropFromL2',
    inputs: [
      {
        name: '_bundleWithdrawalParams',
        type: 'tuple',
        internalType: 'struct FinalizeL1DepositParams',
        components: [
          { name: 'chainId', type: 'uint256', internalType: 'uint256' },
          { name: 'l2BatchNumber', type: 'uint256', internalType: 'uint256' },
          { name: 'l2MessageIndex', type: 'uint256', internalType: 'uint256' },
          { name: 'l2Sender', type: 'address', internalType: 'address' },
          { name: 'l2TxNumberInBatch', type: 'uint16', internalType: 'uint16' },
          { name: 'message', type: 'bytes', internalType: 'bytes' },
          { name: 'merkleProof', type: 'bytes32[]', internalType: 'bytes32[]' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'error',
    name: 'InvalidProof',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LegacyBridgeMessageNotSupported',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ShadowAccountDeploymentFailed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'WrongL2Sender',
    inputs: [{ name: 'l2Sender', type: 'address', internalType: 'address' }],
  },
] as const;

export default L1InteropHandlerABI;
export type L1InteropHandlerABI = typeof L1InteropHandlerABI;
