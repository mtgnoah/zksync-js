# ZKsync Interop SDK Specification

## Overview

This document specifies the design for simplifying L1 Interop while preserving the beloved L2→L2 interop API. The SDK removes enshrined protocol integrations (like Aave) in favor of a flexible, declarative interface that can support any protocol.

## Design Principles

1. **Preserve L2→L2 API**: The existing Stripe-style API for L2→L2 interop remains unchanged.
2. **Generic over Enshrined**: No protocol-specific code in the SDK core. Integrations live in examples.
3. **Declarative Input**: Users provide ABI + args; SDK handles encoding.
4. **User Responsibility**: Users are responsible for calldata correctness and safety.
5. **Minimal Magic**: No auto-approvals, no hidden operations, explicit user control.
6. **Consistent Mental Model**: Both L1 and L2→L2 use `quote()` → `prepare()` → `create()` → `wait()`.

---

## Architecture

### L2→L2 Interop (Unchanged)

The existing L2→L2 API remains exactly as designed:

```typescript
// Asset transfers
sdk.sendERC20.quote(...)
sdk.sendERC20.prepare(...)
sdk.sendERC20.create(...)
sdk.sendERC20.wait(...)

sdk.sendNative.quote(...)
sdk.sendNative.create(...)

// Remote calls
sdk.remoteCall.quote(...)
sdk.remoteCall.create(...)
sdk.remoteCall.wait(...)

// Bundles (multi-action sequences)
sdk.bundle()
  .sendNative(...)
  .sendERC20(...)
  .remoteCall(...)
  .quote()    // "Tell me what will happen and what it will cost"
  .prepare()  // "Build transactions, don't send"
  .create()   // "Do the whole thing (sign + send)"
  .wait()     // "Poll until finalized"
```

### L1 Interop (New Design)

L1 Interop follows the same Stripe-style pattern but with resources appropriate for L1 operations:

```typescript
// Single remote call to L1
sdk.l1.call.quote({ target, abi, functionName, args, value })
sdk.l1.call.prepare(...)
sdk.l1.call.create(...)
sdk.l1.call.wait(...)

// Bundle of L1 operations
sdk.l1.bundle()
  .call({ target: USDC, abi: erc20Abi, functionName: 'approve', args: [spender, amount] })
  .call({ target: AAVE_POOL, abi: poolAbi, functionName: 'supply', args: [asset, amount, onBehalfOf, 0] })
  .quote()    // "What will this cost?"
  .prepare()  // "Build it"
  .create()   // "Execute it"
  .wait()     // "Tell me when it's done"
```

**Key difference from L2→L2**: L1 Interop uses generic `call` instead of `sendERC20`/`sendNative` because:
- L1 operations are arbitrary contract calls via ShadowAccount
- Asset transfers on L1 are just `call` operations to token contracts
- No special "bridge" semantics needed—just execute calls

### Chain Identification

Chains are identified by **name strings**, not chain IDs:

```typescript
// Good
targetChain: 'ethereum'
targetChain: 'zksync-era'
targetChain: 'sophon'

// Not this
targetChain: 1
targetChain: 324
```

The SDK maintains an internal registry mapping names to chain configurations.

---

## L1 Operations

### Call Format

L1 calls are defined declaratively with ABI and arguments:

```typescript
interface L1CallParams {
  target: Address;
  abi: Abi;
  functionName: string;
  args: unknown[];
  value?: bigint;
}
```

The SDK encodes calldata from the ABI and args. Users never provide raw calldata.

### Example: Aave Deposit via Bundle

```typescript
const handle = await sdk.l1.bundle()
  .call({
    target: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'approve',
    args: [AAVE_POOL, amount],
  })
  .call({
    target: AAVE_POOL,
    abi: aavePoolAbi,
    functionName: 'supply',
    args: [USDC_ADDRESS, amount, onBehalfOf, 0],
  })
  .create();

await handle.wait();
```

### Example: Single Call

```typescript
// Simple single operation
const quote = await sdk.l1.call.quote({
  target: UNISWAP_ROUTER,
  abi: routerAbi,
  functionName: 'swapExactTokensForTokens',
  args: [amountIn, amountOutMin, path, to, deadline],
});

console.log(`Estimated cost: ${quote.totalCost}`);

const handle = await sdk.l1.call.create({...});
const result = await handle.wait();
```

### Sequential Execution

Bundle operations execute **strictly in order**. There are no dependencies between operations—each operation's output cannot be used as input to subsequent operations.

**Future Enhancement**: A contract read feature may be added to support patterns like "read balance, then use it":

```typescript
// Future API (not in v1)
sdk.l1.bundle()
  .read({
    target: TOKEN,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [shadowAccount],
    outputId: 'balance',
  })
  .call({
    target: TOKEN,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipient, { ref: 'balance' }],
  })
  .create()
```

This is out of scope for the initial implementation.

---

## Funding Model

### Hybrid Approach with Quote

The SDK uses a **hybrid funding model** with an explicit quote step:

1. **Quote Phase**: SDK calculates required funds for execution
2. **User Approval**: User reviews and approves the quote
3. **Automatic Bridging**: If funds are insufficient on the destination, SDK bridges them

```typescript
// Step 1: Get quote
const quote = await sdk.l1.bundle()
  .call({ target: USDC, abi: erc20Abi, functionName: 'approve', args: [...] })
  .call({ target: AAVE_POOL, abi: poolAbi, functionName: 'supply', args: [...] })
  .quote();

// quote contains:
// - requiredFunds: total funds needed on L1
// - currentBalance: funds already in ShadowAccount
// - bridgeAmount: amount that will be bridged from L2
// - estimatedGas: gas estimate for L1 execution
// - totalCost: all-in cost

console.log(`This will cost ${quote.totalCost} and bridge ${quote.bridgeAmount} to L1`);

// Step 2: Create with user consent
const handle = await sdk.l1.bundle()
  .call({ target: USDC, abi: erc20Abi, functionName: 'approve', args: [...] })
  .call({ target: AAVE_POOL, abi: poolAbi, functionName: 'supply', args: [...] })
  .create();
  // User has reviewed quote and consents to bridging
```

### No Auto-Approvals

The SDK **never** automatically approves tokens on behalf of the user. All approvals must be explicit `.call()` operations in the bundle.

---

## Gas Estimation

Gas is estimated by **simulating operations via `eth_call`** on the destination chain.

```typescript
// Internal implementation
const gasEstimate = await destinationClient.call({
  to: shadowAccount,
  data: encodedBundleExecution,
});
```

### Price Volatility Considerations

- L1 interop executes approximately every **15 minutes**
- Gas prices may change between quote and execution
- **Recommendation**: Include a buffer (e.g., 10-20%) on gas estimates
- The SDK should document this in user-facing APIs

---

## Calldata Helpers

### Included Helpers

The SDK provides helpers for common operations only:

```typescript
// ERC20 operations
sdk.helpers.erc20.approve(spender, amount)
sdk.helpers.erc20.transfer(to, amount)
sdk.helpers.erc20.transferFrom(from, to, amount)

// Common patterns
sdk.helpers.multicall.aggregate(calls)
```

### No Protocol Helpers

Protocol-specific helpers (Aave, Uniswap, etc.) are **not included** in the SDK. These belong in:

1. **Examples directory**: Reference implementations
2. **User code**: Applications build their own helpers
3. **Separate packages**: Community or protocol-maintained

---

## Bridge-Back Operations

Bridge-back (returning assets to the source chain) is **not a built-in feature**. Users add bridge operations explicitly as a `.call()` in their bundle:

```typescript
const handle = await sdk.l1.bundle()
  // Borrow from Aave
  .call({
    target: AAVE_POOL,
    abi: poolAbi,
    functionName: 'borrow',
    args: [GHO_TOKEN, amount, interestRateMode, 0, shadowAccount],
  })
  // Approve bridge to spend borrowed tokens
  .call({
    target: GHO_TOKEN,
    abi: erc20Abi,
    functionName: 'approve',
    args: [L1_NATIVE_TOKEN_VAULT, amount],
  })
  // Bridge tokens back to L2
  .call({
    target: BRIDGE_HUB,
    abi: bridgehubAbi,
    functionName: 'requestL2TransactionTwoBridges',
    args: [bridgeParams],
    value: mintValue,
  })
  .create();
```

This keeps the SDK simple and gives users full control over bridging logic.

---

## Status Tracking

### Wait with Polling

The SDK provides a `wait()` method that polls for transaction status:

```typescript
const handle = await sdk.l1.bundle()
  .call({...})
  .call({...})
  .create();

// Wait for completion
const result = await handle.wait();

// Or with options
const result = await handle.wait({
  timeout: 300_000,  // 5 minutes
  pollInterval: 5_000,  // 5 seconds
});
```

### Result Object

```typescript
interface InteropResult {
  status: 'success' | 'failed' | 'timeout';

  // On success
  transactionHash?: Hash;
  blockNumber?: bigint;

  // On failure
  error?: {
    code: string;
    message: string;
    revertReason?: string;  // Decoded revert reason
    rawError?: Hex;
  };
}
```

### Error Decoding

When execution fails, the SDK **decodes revert reasons** to provide actionable error messages:

```typescript
// Instead of
error: "0x08c379a0..."

// Users get
error: {
  code: 'EXECUTION_REVERTED',
  message: 'Execution reverted: insufficient balance',
  revertReason: 'insufficient balance',
}
```

---

## ShadowAccount / AliasedAccount

### Public Address Exposure

The execution account address is **publicly exposed** so users can:

1. Pre-fund the account
2. Check balances
3. Verify expected addresses

```typescript
// For L1 interop - get ShadowAccount address
const shadowAccount = await sdk.l1.getShadowAccount(userAddress);

// For L2→L2 interop - get AliasedAccount address (existing API)
const aliasedAccount = sdk.getAliasedAccount({
  owner: userAddress,
  sourceChain: 'zksync-era',
});
```

### Address Derivation

- **ShadowAccount** (L1): Deterministic CREATE2 from L2 owner address
- **AliasedAccount** (L2→L2): `keccak256(srcAddress || srcChainId)`

---

## L1 Interop vs L2→L2 Interop

### Separate Execution Models

While the interface is unified, L1 and L2→L2 interop have different execution models:

| Aspect | L1 Interop | L2→L2 Interop |
|--------|------------|---------------|
| Version | Separate track | v30 |
| Execution Account | ShadowAccount | AliasedAccount |
| Execution Timing | ~15 min batches | Near real-time |
| Proof Model | Batch proofs | Per-message proofs |

### Version Target

The initial implementation targets **v30** for L2→L2 interop. L1 interop follows a separate development track.

---

## Validation Policy

### No Calldata Validation

The SDK **does not validate** user-provided calldata or operation parameters:

- No checking if addresses are valid contracts
- No checking if function selectors exist
- No checking if args match ABI types (beyond encoding)
- No simulation before submission

**Rationale**: Users are responsible for constructing correct operations. Validation adds complexity and can't catch all issues anyway.

### Type Safety

TypeScript types provide compile-time safety for the operation structure, but runtime validation of contract interactions is the user's responsibility.

---

## API Reference

### L2→L2 Interop (Unchanged)

The existing API remains exactly as designed:

```typescript
// Asset transfers
sdk.sendERC20.quote(params: SendERC20Params): Promise<Quote>
sdk.sendERC20.prepare(params: SendERC20Params): Promise<PreparedTx>
sdk.sendERC20.create(params: SendERC20Params): Promise<Handle>

sdk.sendNative.quote(params: SendNativeParams): Promise<Quote>
sdk.sendNative.prepare(params: SendNativeParams): Promise<PreparedTx>
sdk.sendNative.create(params: SendNativeParams): Promise<Handle>

// Remote calls
sdk.remoteCall.quote(params: RemoteCallParams): Promise<Quote>
sdk.remoteCall.prepare(params: RemoteCallParams): Promise<PreparedTx>
sdk.remoteCall.create(params: RemoteCallParams): Promise<Handle>

// Bundles
sdk.bundle(): BundleBuilder
```

### L1 Interop (New)

```typescript
interface L1InteropAPI {
  // Single call resource
  call: {
    quote(params: L1CallParams): Promise<L1Quote>;
    prepare(params: L1CallParams): Promise<L1PreparedTx>;
    create(params: L1CallParams): Promise<L1Handle>;
  };

  // Bundle builder
  bundle(): L1BundleBuilder;

  // Get ShadowAccount address
  getShadowAccount(owner: Address): Promise<Address>;

  // Deploy ShadowAccount if not exists
  deployShadowAccount(owner: Address): Promise<Hash>;
}

interface L1CallParams {
  target: Address;
  abi: Abi;
  functionName: string;
  args: unknown[];
  value?: bigint;
  sender?: Address;
}

interface L1BundleBuilder {
  call(params: L1CallParams): L1BundleBuilder;
  quote(): Promise<L1Quote>;
  prepare(): Promise<L1PreparedTx>;
  create(): Promise<L1Handle>;
}

interface L1Quote {
  requiredFunds: bigint;      // Total funds needed on L1
  currentBalance: bigint;     // Funds already in ShadowAccount
  bridgeAmount: bigint;       // Amount to bridge from L2
  estimatedGas: bigint;       // Gas estimate for L1 execution
  gasPrice: bigint;           // Current L1 gas price
  totalCost: bigint;          // All-in cost
  calls: L1CallParams[];      // The calls being quoted
}

interface L1Handle {
  hash: Hash;                 // L2 submission transaction hash
  bundleHash: Hash;           // Bundle identifier
  wait(options?: WaitOptions): Promise<L1Result>;
}

interface WaitOptions {
  timeout?: number;           // Default: 600_000 (10 min)
  pollInterval?: number;      // Default: 15_000 (15 sec)
}

interface L1Result {
  status: 'success' | 'failed' | 'timeout';
  l1TransactionHash?: Hash;   // L1 execution tx hash
  l1BlockNumber?: bigint;
  error?: {
    code: string;
    message: string;
    revertReason?: string;    // Decoded revert reason
  };
}
```

### Helper Methods

```typescript
// Helpers return L1CallParams for use in bundles
interface L1Helpers {
  erc20: {
    approve(token: Address, spender: Address, amount: bigint): L1CallParams;
    transfer(token: Address, to: Address, amount: bigint): L1CallParams;
    transferFrom(token: Address, from: Address, to: Address, amount: bigint): L1CallParams;
  };
}

// Usage
sdk.l1.bundle()
  .call(sdk.l1.helpers.erc20.approve(USDC, AAVE_POOL, amount))
  .call({ target: AAVE_POOL, abi: poolAbi, functionName: 'supply', args: [...] })
  .create();
```

---

## Migration from Current Implementation

### Aave Code

Current Aave plugin code moves to `examples/aave/`:

```
examples/
  aave/
    deposit.ts
    withdraw.ts
    borrow.ts
    repay.ts
    README.md
```

These serve as reference implementations showing how to use the generic SDK for specific protocols.

### Removed Components

- `src/adapters/*/resources/l1-interop/plugins/aave/` → `examples/aave/`
- Aave-specific types in `core/types/flows/aave.ts` → Examples
- Aave-specific errors → Generic errors only

### Preserved Components

- Core interop types (`L1InteropOperation`, `L1InteropParams`, etc.)
- ShadowAccount utilities
- Chain registry
- Gas estimation services
- Data encoding utilities

---

## Error Types

```typescript
// Base error
class InteropError extends Error {
  code: string;
  details?: unknown;
}

// Specific errors
class ExecutionAccountNotDeployedError extends InteropError {}
class BundleSubmissionFailedError extends InteropError {}
class ExecutionFailedError extends InteropError {}
class InsufficientFundsError extends InteropError {}
class TimeoutError extends InteropError {}
class ChainNotRegisteredError extends InteropError {}
```

---

## Configuration

### Chain Registration

```typescript
// Register chains at SDK initialization
const sdk = createZksyncSdk({
  chains: {
    'ethereum': { rpcUrl: '...', chainId: 1 },
    'zksync-era': { rpcUrl: '...', chainId: 324 },
    'sophon': { rpcUrl: '...', chainId: 50104 },
  },
});

// Or register dynamically
sdk.registerChain('custom-l2', { rpcUrl: '...', chainId: 12345 });
```

---

## Implementation Phases

### Phase 1: Core Implementation
1. Remove Aave plugin from core SDK
2. Implement `sdk.l1.call` resource with `quote()`, `prepare()`, `create()`
3. Implement `sdk.l1.bundle()` builder pattern
4. Implement `sdk.l1.getShadowAccount()`
5. Implement `sdk.l1.deployShadowAccount()`
6. Implement funding flow with automatic bridging from quote
7. Add gas estimation via eth_call simulation
8. Move Aave code to `examples/aave/`

### Phase 2: Helpers & Polish
1. Add `sdk.l1.helpers.erc20` helpers
2. Implement `wait()` with polling and revert decoding
3. Documentation and Aave examples
4. Integration tests

---

## Open Questions

1. **Contract Read Feature**: Should the `.read()` pattern be prioritized for v1, or deferred?

2. **Multi-chain Operations**: Should L1 bundles support operations that span multiple L1 protocols in a single atomic bundle?

3. **Simulation Mode**: Should `prepare()` include simulation results, or should there be a separate `simulate()` method?

4. **Bundle Reuse**: Should bundles be reusable objects that can be quoted/created multiple times, or single-use builders?

5. **Error Recovery**: What recovery mechanisms should be exposed when L1 execution fails but funds are in ShadowAccount?
