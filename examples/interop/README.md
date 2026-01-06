# L1 Interop

L1 Interop allows ZKsync L2 users to execute arbitrary transactions on Ethereum L1 without manually bridging funds. This enables seamless interaction with L1 DeFi protocols (Aave, Uniswap, Compound, etc.) directly from L2.

## Overview

### The Problem

Traditionally, to interact with L1 protocols from L2, you would need to:
1. Manually withdraw funds from L2 to L1 (~15 min wait)
2. Execute your L1 transactions
3. Bridge funds back to L2 if needed

This is slow, expensive, and requires multiple manual steps.

### The Solution: L1 Interop

With L1 Interop, you simply describe what you want to do on L1, and the SDK handles everything:

```typescript
// Execute any L1 contract call from L2
const handle = await sdk.l1.bundle()
  .call({
    target: UNISWAP_ROUTER,
    abi: uniswapRouterAbi,
    functionName: 'swapExactTokensForTokens',
    args: [amountIn, amountOutMin, path, recipient, deadline],
  })
  .create();

// Wait for L1 execution (~15 min)
const result = await handle.wait();
```

## Key Concepts

### Shadow Accounts

A **Shadow Account** is a smart contract wallet on L1 that is controlled by your L2 address:

- **Deterministic**: Each L2 address maps to exactly one Shadow Account address on L1
- **Auto-deployed**: Created automatically on your first L1 operation
- **Persistent**: Assets deposited to your Shadow Account remain there for future operations
- **Secure**: Only your L2 address can control it

```typescript
// Get your Shadow Account address
const shadowAccount = await sdk.l1.getShadowAccount(myL2Address);
```

### Bundles

A **Bundle** is a set of L1 operations that execute atomically:

```typescript
// Multiple operations in one atomic transaction
const handle = await sdk.l1.bundle()
  .call({ target: TOKEN, abi: erc20Abi, functionName: 'approve', args: [POOL, amount] })
  .call({ target: POOL, abi: poolAbi, functionName: 'deposit', args: [TOKEN, amount, recipient, 0] })
  .create();
```

If any operation fails, the entire bundle reverts. This is critical for DeFi operations that require multiple steps (e.g., approve + swap).

### Two-Transaction Flow

When you call `.create()`, the SDK executes two L2 transactions:

1. **Withdrawal Transaction**: Sends ETH from L2 to your Shadow Account on L1 (for gas + any ETH value needed)
2. **Bundle Submission**: Submits your operations to the L2 Interop Center contract

After L2 finalization (~15 minutes), an operator proves and executes your bundle on L1.

```
L2: Sign & Submit
       │
       ├─→ Tx 1: Withdraw ETH to Shadow Account
       │
       └─→ Tx 2: Submit bundle to L2InteropCenter
              │
              ▼
         ~15 min wait (L2 finalization)
              │
              ▼
L1: Operator executes bundle via Shadow Account
```

## API Reference

### `sdk.l1.bundle()`

Create a bundle of L1 operations:

```typescript
const builder = sdk.l1.bundle();

// Chain multiple calls
builder
  .call({ target, abi, functionName, args, value? })
  .call({ target, abi, functionName, args, value? });

// Get a quote (estimated costs)
const quote = await builder.quote();

// Prepare (returns encoded operations)
const prepared = await builder.prepare();

// Create and submit
const handle = await builder.create();
```

### `sdk.l1.call`

For single operations:

```typescript
// Quote
const quote = await sdk.l1.call.quote({ target, abi, functionName, args });

// Prepare
const prepared = await sdk.l1.call.prepare({ target, abi, functionName, args });

// Create
const handle = await sdk.l1.call.create({ target, abi, functionName, args });
```

### Quote Response

```typescript
interface L1Quote {
  requiredFunds: bigint;    // Total funds needed on L1
  currentBalance: bigint;   // Current Shadow Account balance
  bridgeAmount: bigint;     // Amount to bridge from L2
  estimatedGas: bigint;     // Estimated L1 gas
  gasPrice: bigint;         // Current L1 gas price
  totalCost: bigint;        // Total cost (gas + value)
  shadowAccount: Address;   // Your Shadow Account address
  needsDeployment: boolean; // Whether Shadow Account needs deployment
}
```

### Handle & Waiting

```typescript
const handle = await sdk.l1.bundle().call(...).create();

// handle.hash - L2 transaction hash
// handle.bundleHash - Bundle identifier
// handle.shadowAccount - Shadow Account address

// Wait for L1 execution
const result = await handle.wait({
  timeout: 600_000,      // 10 min default
  pollInterval: 15_000,  // 15 sec default
});

// result.status: 'success' | 'failed' | 'timeout'
// result.l1TransactionHash - L1 execution tx hash
// result.error - Error details if failed
```

### Helpers

Common operations have helper methods:

```typescript
// ERC20 operations
const approveCall = sdk.l1.helpers.erc20.approve(token, spender, amount);
const transferCall = sdk.l1.helpers.erc20.transfer(token, to, amount);

// Use in bundles
await sdk.l1.bundle()
  .call(approveCall)
  .call(myCustomCall)
  .create();
```

## Examples

### Simple Token Approval

```typescript
const handle = await sdk.l1.call.create({
  target: USDC_ADDRESS,
  abi: erc20Abi,
  functionName: 'approve',
  args: [SPENDER, parseUnits('1000', 6)],
});

await handle.wait();
```

### DeFi Deposit (Approve + Supply)

```typescript
const amount = parseUnits('1000', 6); // 1000 USDC

const handle = await sdk.l1.bundle()
  // Step 1: Approve
  .call({
    target: USDC,
    abi: erc20Abi,
    functionName: 'approve',
    args: [AAVE_POOL, amount],
  })
  // Step 2: Supply
  .call({
    target: AAVE_POOL,
    abi: aavePoolAbi,
    functionName: 'supply',
    args: [USDC, amount, shadowAccount, 0],
  })
  .create();

const result = await handle.wait();
console.log('Deposited to Aave:', result.l1TransactionHash);
```

### Sending ETH with a Call

```typescript
// Payable functions: pass value to send ETH
const handle = await sdk.l1.call.create({
  target: WETH_GATEWAY,
  abi: wethGatewayAbi,
  functionName: 'depositETH',
  args: [POOL, recipient, 0],
  value: parseEther('1'), // Send 1 ETH
});
```

### Getting a Quote First

```typescript
const quote = await sdk.l1.bundle()
  .call({ ... })
  .call({ ... })
  .quote();

console.log('Total cost:', formatEther(quote.totalCost), 'ETH');
console.log('Need to bridge:', formatEther(quote.bridgeAmount), 'ETH');
console.log('Shadow Account:', quote.shadowAccount);

// If user approves, execute
const handle = await sdk.l1.bundle()
  .call({ ... })
  .call({ ... })
  .create();
```

## Protocol Integration Examples

See the `examples/aave/` directory for complete Aave V3 integration examples:
- `deposit.ts` - Supply collateral (ETH and ERC20)
- `borrow.ts` - Borrow assets
- `withdraw.ts` - Withdraw collateral
- `repay.ts` - Repay borrowed assets

## Important Notes

1. **Finalization Time**: L1 execution occurs ~15 minutes after bundle submission (L2 finalization window)

2. **Gas Estimation**: The SDK simulates operations on L1 to estimate gas, adding a 20% buffer for safety

3. **Atomic Execution**: All operations in a bundle execute atomically. If one fails, they all revert

4. **Shadow Account Funds**: Remaining funds stay in your Shadow Account for future operations

5. **No Manual Bridging**: The SDK handles all fund bridging automatically based on the quote

## Error Handling

```typescript
// Use try* variants for explicit error handling
const result = await sdk.l1.call.tryCreate({ ... });

if (result.ok) {
  const handle = result.value;
  await handle.wait();
} else {
  console.error('Failed:', result.error);
}
```
