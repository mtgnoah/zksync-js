# ZKsync Interop

The ZKsync SDK provides two interop capabilities:

1. **L2→L2 Interop**: Send tokens and execute calls between ZKsync L2 chains
2. **L1 Interop**: Execute arbitrary transactions on Ethereum L1 from L2

Both follow the same Stripe-style API pattern: `quote()` → `prepare()` → `create()` → `wait()`

---

## L2→L2 Interop

Send tokens and execute remote calls between ZKsync L2 chains without manual bridging.

### Quick Start

```typescript
import { createEthersSdk } from '@matterlabs/zksync-js/ethers';

const sdk = createEthersSdk(client);

// Send tokens to another L2 chain
const handle = await sdk.interop.create({
  dst: 324n, // Destination chain ID
  actions: [
    { type: 'sendNative', to: recipientAddress, amount: parseEther('1') },
  ],
});

// Wait for execution on destination
await sdk.interop.wait(handle, { for: 'executed' });
```

### Action Types

L2→L2 interop supports three action types:

```typescript
// Send native token (ETH or base token)
{ type: 'sendNative', to: Address, amount: bigint }

// Send ERC20 tokens
{ type: 'sendErc20', token: Address, to: Address, amount: bigint }

// Execute arbitrary call on destination
{ type: 'call', to: Address, data: Hex, value?: bigint }
```

### Examples

#### Send Native Token

```typescript
const handle = await sdk.interop.create({
  dst: 324n, // ZKsync Era chain ID
  actions: [
    { type: 'sendNative', to: '0x...recipient', amount: parseEther('0.5') },
  ],
});
```

#### Send ERC20 Tokens

```typescript
const handle = await sdk.interop.create({
  dst: 324n,
  actions: [
    {
      type: 'sendErc20',
      token: USDC_ADDRESS,
      to: recipientAddress,
      amount: parseUnits('100', 6)
    },
  ],
});
```

#### Remote Contract Call

```typescript
const handle = await sdk.interop.create({
  dst: 324n,
  actions: [
    {
      type: 'call',
      to: CONTRACT_ADDRESS,
      data: encodeFunctionData({
        abi: contractAbi,
        functionName: 'myFunction',
        args: [arg1, arg2],
      }),
      value: parseEther('0.1'), // Optional ETH to send
    },
  ],
});
```

#### Multiple Actions (Bundle)

```typescript
const handle = await sdk.interop.create({
  dst: 324n,
  actions: [
    { type: 'sendNative', to: recipient1, amount: parseEther('1') },
    { type: 'sendErc20', token: USDC, to: recipient2, amount: parseUnits('500', 6) },
    { type: 'call', to: contract, data: calldata },
  ],
});
```

### API Reference

```typescript
// Get quote (estimated costs, approvals needed)
const quote = await sdk.interop.quote({
  dst: chainId,
  actions: [...],
});

// quote.route: 'direct' | 'indirect'
// quote.approvalsNeeded: ApprovalNeed[]
// quote.totalActionValue: bigint
// quote.bridgedTokenTotal: bigint

// Prepare (build transactions without executing)
const plan = await sdk.interop.prepare({ dst, actions });

// Create (execute source chain transactions)
const handle = await sdk.interop.create({ dst, actions });

// Check status
const status = await sdk.interop.status(handle);
// status.phase: 'SENT' | 'VERIFIED' | 'EXECUTED' | 'UNBUNDLED' | 'FAILED' | 'UNKNOWN'

// Wait for verification or execution
await sdk.interop.wait(handle, { for: 'verified' });
await sdk.interop.wait(handle, { for: 'executed' });

// Finalize (execute bundle on destination - usually done by relayer)
const result = await sdk.interop.finalize(handle);
```

### Routing

The SDK automatically selects the optimal route:

- **Direct**: Used when source and destination chains share the same base token. Most efficient.
- **Indirect**: Used for ERC20 transfers or when base tokens differ. Routes through the asset router.

---

## L1 Interop

Execute arbitrary transactions on Ethereum L1 from ZKsync L2 without manual bridging.

### Quick Start

```typescript
import { createViemSdk } from '@matterlabs/zksync-js/viem';

const sdk = createViemSdk(client);

// Execute any L1 contract call
const handle = await sdk.l1.bundle()
  .call({
    target: CONTRACT_ADDRESS,
    abi: contractAbi,
    functionName: 'myFunction',
    args: [arg1, arg2],
  })
  .create();

// Wait for L1 execution (~15 min)
const result = await handle.wait();
```

### Key Concepts

#### Shadow Accounts

A **Shadow Account** is a smart contract wallet on L1 controlled by your L2 address:

- **Deterministic**: Each L2 address maps to exactly one Shadow Account on L1
- **Auto-deployed**: Created automatically on your first L1 operation
- **Persistent**: Assets remain in your Shadow Account for future operations

```typescript
const shadowAccount = await sdk.l1.getShadowAccount(myL2Address);
```

#### Bundles

Multiple L1 operations execute atomically:

```typescript
const handle = await sdk.l1.bundle()
  .call({ target: TOKEN, abi: erc20Abi, functionName: 'approve', args: [POOL, amount] })
  .call({ target: POOL, abi: poolAbi, functionName: 'deposit', args: [...] })
  .create();
```

If any operation fails, the entire bundle reverts.

#### Two-Transaction Flow

When you call `.create()`, the SDK executes two L2 transactions:

1. **Withdrawal**: Sends ETH from L2 to your Shadow Account on L1
2. **Bundle Submission**: Submits operations to the L2 Interop Center

After L2 finalization (~15 minutes), an operator executes your bundle on L1.

### Examples

#### Simple Contract Call

```typescript
const handle = await sdk.l1.call.create({
  target: CONTRACT_ADDRESS,
  abi: contractAbi,
  functionName: 'myFunction',
  args: [arg1, arg2],
});

await handle.wait();
```

#### DeFi Deposit (Approve + Supply)

```typescript
const amount = parseUnits('1000', 6); // 1000 USDC

const handle = await sdk.l1.bundle()
  .call({
    target: USDC,
    abi: erc20Abi,
    functionName: 'approve',
    args: [AAVE_POOL, amount],
  })
  .call({
    target: AAVE_POOL,
    abi: aavePoolAbi,
    functionName: 'supply',
    args: [USDC, amount, shadowAccount, 0],
  })
  .create();
```

#### Sending ETH with a Call

```typescript
const handle = await sdk.l1.call.create({
  target: WETH_GATEWAY,
  abi: wethGatewayAbi,
  functionName: 'depositETH',
  args: [POOL, recipient, 0],
  value: parseEther('1'), // Send 1 ETH
});
```

### API Reference

```typescript
// Single call
sdk.l1.call.quote({ target, abi, functionName, args, value? })
sdk.l1.call.prepare({ target, abi, functionName, args, value? })
sdk.l1.call.create({ target, abi, functionName, args, value? })

// Bundle builder
sdk.l1.bundle()
  .call({ target, abi, functionName, args, value? })
  .call({ ... })
  .quote()    // Get estimated costs
  .prepare()  // Build without executing
  .create()   // Execute

// Quote response
interface L1Quote {
  requiredFunds: bigint;    // Total funds needed on L1
  currentBalance: bigint;   // Current Shadow Account balance
  bridgeAmount: bigint;     // Amount to bridge from L2
  estimatedGas: bigint;     // Estimated L1 gas
  gasPrice: bigint;         // Current L1 gas price
  totalCost: bigint;        // Total cost
  shadowAccount: Address;   // Your Shadow Account
  needsDeployment: boolean; // Whether Shadow Account needs deployment
}

// Handle
const handle = await sdk.l1.bundle().call(...).create();
// handle.hash - L2 transaction hash
// handle.bundleHash - Bundle identifier
// handle.shadowAccount - Shadow Account address

// Wait for completion
const result = await handle.wait({ timeout: 600_000, pollInterval: 15_000 });
// result.status: 'success' | 'failed' | 'timeout'
// result.l1TransactionHash - L1 execution tx hash

// Helpers
sdk.l1.helpers.erc20.approve(token, spender, amount)
sdk.l1.helpers.erc20.transfer(token, to, amount)
```

---

## Comparison: L2→L2 vs L1 Interop

| Feature | L2→L2 Interop | L1 Interop |
|---------|---------------|------------|
| SDK Path | `sdk.interop` | `sdk.l1` |
| Destination | Other ZKsync L2 chains | Ethereum L1 |
| Execution Time | Near-instant | ~15 minutes |
| Account Type | AliasedAccount | ShadowAccount |
| Action Types | sendNative, sendErc20, call | Generic call (any contract) |
| Bundling | Multiple actions in one tx | Multiple calls in one bundle |
| Adapter | Ethers (primary) | Viem (primary) |

---

## Protocol Integration Examples

See `examples/aave/` for complete Aave V3 integration examples using L1 Interop:
- `deposit.ts` - Supply collateral (ETH and ERC20)
- `borrow.ts` - Borrow assets
- `withdraw.ts` - Withdraw collateral
- `repay.ts` - Repay borrowed assets

---

## Error Handling

Both interop types support `try*` variants for explicit error handling:

```typescript
// L2→L2
const result = await sdk.interop.tryCreate({ dst, actions });
if (result.ok) {
  await sdk.interop.wait(result.value, { for: 'executed' });
} else {
  console.error('Failed:', result.error);
}

// L1
const result = await sdk.l1.call.tryCreate({ target, abi, functionName, args });
if (result.ok) {
  await result.value.wait();
} else {
  console.error('Failed:', result.error);
}
```
