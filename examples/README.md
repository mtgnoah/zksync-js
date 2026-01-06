# SDK Examples

Example scripts for **deposits (L1 → L2)**, **withdrawals (L2 → L1)**, and **L1 Interop (execute L1 transactions from L2)** using either `ethers` or `viem` adapters.

## 🛠️ Prerequisites

- [Bun](https://bun.sh/) installed
- Environment variables:

```bash
export PRIVATE_KEY=0xabc123...        # your funded test key
export L1_RPC=http://localhost:8545   # optional, defaults to local
export L2_RPC=http://localhost:3050   # optional, defaults to local
```

**Install deps:**

```bash
# From root
bun install
```

## 🚀 Running Examples

### Deposits

| Script                                      | Description                      |
| ------------------------------------------- | -------------------------------- |
| `examples/viem/deposits/eth.ts`             | Deposit ETH to an ETH-based L2   |
| `examples/viem/deposits/erc20-base.ts`      | Deposit base ERC-20 (base ≠ ETH) |
| `examples/viem/deposits/erc20-nonbase.ts`   | Deposit non-base ERC-20          |
| `examples/ethers/deposits/eth.ts`           | Deposit ETH to an ETH-based L2   |
| `examples/ethers/deposits/erc20-base.ts`    | Deposit base ERC-20 (base ≠ ETH) |
| `examples/ethers/deposits/erc20-nonbase.ts` | Deposit non-base ERC-20          |

Run any deposit script:

```bash
bun run examples/viem/deposits/eth.ts
```

---

### Withdrawals

| Script                                         | Description                           |
| ---------------------------------------------- | ------------------------------------- |
| `examples/viem/withdrawals/eth.ts`             | Withdraw ETH from an ETH-based L2     |
| `examples/viem/withdrawals/base.ts`            | Withdraw base token from a non-ETH L2 |
| `examples/viem/withdrawals/eth-nonbase.ts`     | Withdraw ETH from a non-ETH L2        |
| `examples/viem/withdrawals/erc20-nonbase.ts`   | Withdraw non-base ERC-20              |
| `examples/ethers/withdrawals/eth.ts`           | Withdraw ETH from an ETH-based L2     |
| `examples/ethers/withdrawals/base.ts`          | Withdraw base token from a non-ETH L2 |
| `examples/ethers/withdrawals/eth-nonbase.ts`   | Withdraw ETH from a non-ETH L2        |
| `examples/ethers/withdrawals/erc20-nonbase.ts` | Withdraw non-base ERC-20              |

Run any withdrawal script:

```bash
bun run examples/ethers/withdrawals/erc20-nonbase.ts
```

---

### Interop

Execute cross-chain transactions without manual bridging. See [interop/README.md](./interop/README.md) for detailed documentation.

| Directory           | Description                                      |
| ------------------- | ------------------------------------------------ |
| `examples/interop/` | L2→L2 and L1 Interop documentation               |
| `examples/aave/`    | Aave V3 L1 integration (deposit, borrow, etc)    |

**L2→L2 Interop** - Send tokens and execute calls between ZKsync L2 chains:

```typescript
const handle = await sdk.interop.create({
  dst: 324n, // Destination chain ID
  actions: [
    { type: 'sendErc20', token: USDC, to: recipient, amount: parseUnits('100', 6) },
  ],
});
await sdk.interop.wait(handle, { for: 'executed' });
```

**L1 Interop** - Execute arbitrary L1 transactions from L2:

```typescript
import { createViemSdk } from '@matterlabs/zksync-js/viem';

const sdk = createViemSdk(client);

// Execute any L1 contract call from L2
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
