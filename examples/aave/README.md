# Aave L1 Interop Examples

This directory contains reference implementations showing how to use the ZKsync SDK's generic L1 interop interface to interact with Aave on Ethereum L1.

## Overview

These examples demonstrate the pattern for building protocol integrations using the generic `sdk.l1` API. The SDK doesn't include enshrined protocol integrations - instead, users build their own integrations using the declarative call interface.

## Files

- `constants.ts` - Aave contract addresses and ABIs
- `deposit.ts` - Deposit assets to Aave (supply collateral)
- `borrow.ts` - Borrow assets from Aave
- `withdraw.ts` - Withdraw assets from Aave
- `repay.ts` - Repay borrowed assets

## Basic Usage

```typescript
import { createViemClient, createViemSdk } from '@matterlabs/zksync-js/viem';
import { aaveDeposit } from './deposit';

// Create SDK
const client = createViemClient({ ... });
const sdk = createViemSdk(client);

// Deposit 1 ETH to Aave
const handle = await aaveDeposit(sdk, {
  asset: 'ETH',
  amount: parseEther('1'),
});

// Wait for completion
const result = await handle.wait();
console.log('Deposit complete:', result.l1TransactionHash);
```

## Pattern

Each operation follows the same pattern:

1. **Define the contract calls** using ABI + args (declarative)
2. **Build a bundle** with `sdk.l1.bundle()`
3. **Execute** with `.create()`
4. **Wait** for completion with `.wait()`

Example:

```typescript
const handle = await sdk.l1.bundle()
  // Approve Pool to spend tokens
  .call({
    target: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'approve',
    args: [AAVE_POOL, amount],
  })
  // Supply to Aave
  .call({
    target: AAVE_POOL,
    abi: aavePoolAbi,
    functionName: 'supply',
    args: [USDC_ADDRESS, amount, onBehalfOf, 0],
  })
  .create();
```

## ETH vs ERC20

The examples handle ETH and ERC20 tokens differently:

- **ETH**: Uses `WethGateway` contract (depositETH, withdrawETH, borrowETH, repayETH)
- **ERC20**: Uses `Pool` contract with approve step (supply, withdraw, borrow, repay)

## Addresses

See `constants.ts` for Aave contract addresses on Ethereum mainnet and Sepolia testnet.

## Note on Bridge-Back

To bridge borrowed/withdrawn assets back to L2, add additional calls to the bundle for bridging via the Bridgehub contract. See `borrow.ts` for an example.
